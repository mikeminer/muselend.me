// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { CreatorTokenValidator } from "../src/CreatorTokenValidator.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { MockZoraCreatorToken } from "../src/mocks/MockZoraCreatorToken.sol";
import { MockMirrorFactory, MockOfficialMirror } from "./helpers/MirrorMocks.sol";

contract CreatorTokenValidatorTest is Test {
    CreatorTokenValidator validator;
    MockERC20 currency;

    function setUp() public {
        validator = new CreatorTokenValidator(address(this));
        currency = new MockERC20("USDC", "USDC", 6);
    }

    function testRegistersAndLiveValidatesCreatorCoin() public {
        MockZoraCreatorToken token = new MockZoraCreatorToken(address(currency), makeAddr("hook"));
        validator.setCanonical(address(token), 4);
        assertTrue(validator.validate(address(token), 4));
        assertFalse(validator.validate(address(token), 3));
    }

    function testRejectsGenericErc20() public {
        vm.expectRevert(CreatorTokenValidator.InvalidCreatorToken.selector);
        validator.setCanonical(address(currency), 4);
    }

    function testRejectsContentCoinType() public {
        MutableCoin token = new MutableCoin(address(currency), makeAddr("hook"));
        token.setCoinType(1);
        vm.expectRevert(CreatorTokenValidator.InvalidCreatorToken.selector);
        validator.setCanonical(address(token), 4);
    }

    function testReturnsFalseWhenRegisteredPoolChanges() public {
        MutableCoin token = new MutableCoin(address(currency), makeAddr("hook"));
        validator.setCanonical(address(token), 4);
        assertTrue(validator.validate(address(token), 4));
        token.setHook(makeAddr("replacementHook"));
        assertFalse(validator.validate(address(token), 4));
    }

    function testDynamicallyValidatesOnlyOfficialFactoryMirrors() public {
        MockMirrorFactory factory = new MockMirrorFactory();
        address sourceToken = makeAddr("sourceToken");
        MockOfficialMirror mirror =
            new MockOfficialMirror(address(factory), sourceToken, address(currency), makeAddr("hook"));
        MockOfficialMirror rogue = new MockOfficialMirror(
            address(factory), makeAddr("rogueSource"), address(currency), makeAddr("hook")
        );
        factory.setMirror(sourceToken, address(mirror));
        validator.setMirrorFactory(address(factory));

        assertTrue(validator.validate(address(mirror), 4));
        assertFalse(validator.validate(address(mirror), 3));
        assertFalse(validator.validate(address(rogue), 4));
    }
}

contract MutableCoin {
    address public immutable currency;
    address public hook;
    uint8 public kind;

    constructor(address currency_, address hook_) {
        currency = currency_;
        hook = hook_;
    }

    function setHook(address hook_) external {
        hook = hook_;
    }

    function setCoinType(uint8 kind_) external {
        kind = kind_;
    }

    function coinType() external view returns (uint8) {
        return kind;
    }

    function contractVersion() external pure returns (string memory) {
        return "2.6.1-test";
    }

    function getPoolKey() external view returns (address, address, uint24, int24, address) {
        return address(this) < currency
            ? (address(this), currency, 10_000, int24(200), hook)
            : (currency, address(this), 10_000, int24(200), hook);
    }
}
