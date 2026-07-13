// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import {
    BaseCreatorTokenMirror,
    BaseCreatorTokenMirrorFactory
} from "../src/BaseCreatorTokenMirrorFactory.sol";

contract BaseCreatorTokenMirrorFactoryTest is Test {
    uint256 internal constant ATTESTER_KEY = 0xA11CE;
    address internal constant SOURCE_TOKEN = address(0xBACE);
    address internal constant CURRENCY = address(0xC0FFEE);
    address internal constant HOOK = address(0xBEEF);
    address internal wallet = address(0xCAFE);
    BaseCreatorTokenMirrorFactory internal factory;

    function setUp() public {
        vm.chainId(84532);
        factory = new BaseCreatorTokenMirrorFactory(vm.addr(ATTESTER_KEY), CURRENCY, HOOK);
    }

    function testClaimCreatesMatchingMirrorAndMintsExactBalance() public {
        BaseCreatorTokenMirrorFactory.Claim memory voucher = _voucher(wallet, SOURCE_TOKEN, 42e18);
        bytes memory signature = _sign(voucher, ATTESTER_KEY);

        vm.expectEmit(true, false, false, false);
        emit BaseCreatorTokenMirrorFactory.MirrorCreated(
            SOURCE_TOKEN, address(0), "Creator Alice", "ALICE", 18
        );
        vm.prank(wallet);
        address mirrorAddress = factory.claim(voucher, signature);

        BaseCreatorTokenMirror mirror = BaseCreatorTokenMirror(mirrorAddress);
        assertEq(factory.mirrorFor(SOURCE_TOKEN), mirrorAddress);
        assertTrue(factory.hasClaimed(wallet, SOURCE_TOKEN));
        assertEq(mirror.name(), "Creator Alice");
        assertEq(mirror.symbol(), "ALICE");
        assertEq(mirror.decimals(), 18);
        assertEq(mirror.balanceOf(wallet), 42e18);
        assertEq(mirror.sourceToken(), SOURCE_TOKEN);
        assertEq(mirror.coinType(), 0);
    }

    function testClaimIsOneTimePerWalletAndSourceToken() public {
        BaseCreatorTokenMirrorFactory.Claim memory voucher = _voucher(wallet, SOURCE_TOKEN, 1e18);
        bytes memory signature = _sign(voucher, ATTESTER_KEY);
        vm.prank(wallet);
        factory.claim(voucher, signature);

        vm.expectRevert(BaseCreatorTokenMirrorFactory.AlreadyClaimed.selector);
        vm.prank(wallet);
        factory.claim(voucher, signature);
    }

    function testSecondWalletReusesMirrorAndMustKeepMetadata() public {
        address secondWallet = address(0xD00D);
        BaseCreatorTokenMirrorFactory.Claim memory first = _voucher(wallet, SOURCE_TOKEN, 2e18);
        bytes memory firstSignature = _sign(first, ATTESTER_KEY);
        vm.prank(wallet);
        address firstMirror = factory.claim(first, firstSignature);

        BaseCreatorTokenMirrorFactory.Claim memory second = _voucher(secondWallet, SOURCE_TOKEN, 3e18);
        bytes memory secondSignature = _sign(second, ATTESTER_KEY);
        vm.prank(secondWallet);
        address secondMirror = factory.claim(second, secondSignature);

        assertEq(secondMirror, firstMirror);
        assertEq(BaseCreatorTokenMirror(firstMirror).balanceOf(secondWallet), 3e18);

        address thirdWallet = address(0xD0D0);
        BaseCreatorTokenMirrorFactory.Claim memory mismatch = _voucher(thirdWallet, SOURCE_TOKEN, 4e18);
        mismatch.symbol = "SPOOF";
        bytes memory mismatchSignature = _sign(mismatch, ATTESTER_KEY);
        vm.expectRevert(BaseCreatorTokenMirrorFactory.MetadataMismatch.selector);
        vm.prank(thirdWallet);
        factory.claim(mismatch, mismatchSignature);
    }

    function testRejectsWrongSignerExpiredOversizedAndWrongChainClaims() public {
        BaseCreatorTokenMirrorFactory.Claim memory voucher = _voucher(wallet, SOURCE_TOKEN, 1e18);
        bytes memory wrongSignature = _sign(voucher, 0xBAD);

        vm.expectRevert(BaseCreatorTokenMirrorFactory.InvalidSignature.selector);
        vm.prank(wallet);
        factory.claim(voucher, wrongSignature);

        voucher.deadline = block.timestamp - 1;
        bytes memory expiredSignature = _sign(voucher, ATTESTER_KEY);
        vm.expectRevert(BaseCreatorTokenMirrorFactory.ClaimExpired.selector);
        vm.prank(wallet);
        factory.claim(voucher, expiredSignature);

        voucher = _voucher(wallet, SOURCE_TOKEN, 1_000_001e18);
        bytes memory oversizedSignature = _sign(voucher, ATTESTER_KEY);
        vm.expectRevert(BaseCreatorTokenMirrorFactory.ClaimTooLarge.selector);
        vm.prank(wallet);
        factory.claim(voucher, oversizedSignature);

        voucher = _voucher(wallet, SOURCE_TOKEN, 1e18);
        bytes memory wrongChainSignature = _sign(voucher, ATTESTER_KEY);
        vm.chainId(8453);
        vm.expectRevert(BaseCreatorTokenMirrorFactory.WrongChain.selector);
        vm.prank(wallet);
        factory.claim(voucher, wrongChainSignature);
    }

    function testOnlyFactoryCanMintMirrorTokens() public {
        BaseCreatorTokenMirrorFactory.Claim memory voucher = _voucher(wallet, SOURCE_TOKEN, 1e18);
        bytes memory signature = _sign(voucher, ATTESTER_KEY);
        vm.prank(wallet);
        BaseCreatorTokenMirror mirror = BaseCreatorTokenMirror(factory.claim(voucher, signature));

        vm.expectRevert(BaseCreatorTokenMirror.OnlyFactory.selector);
        mirror.mint(wallet, 1e18);
    }

    function _voucher(address recipient, address sourceToken, uint256 amount)
        internal
        view
        returns (BaseCreatorTokenMirrorFactory.Claim memory)
    {
        return BaseCreatorTokenMirrorFactory.Claim({
            wallet: recipient,
            sourceToken: sourceToken,
            amount: amount,
            name: "Creator Alice",
            symbol: "ALICE",
            decimals: 18,
            deadline: block.timestamp + 10 minutes
        });
    }

    function _sign(BaseCreatorTokenMirrorFactory.Claim memory voucher, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = factory.hashClaim(voucher);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
