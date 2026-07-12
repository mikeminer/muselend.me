// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { MockERC20 } from "./MockERC20.sol";

contract MockZoraCreatorToken is MockERC20 {
    address public immutable currency;
    address public immutable hook;

    constructor(address currency_, address hook_) MockERC20("Creator", "CREATOR", 18) {
        currency = currency_;
        hook = hook_;
    }

    function coinType() external pure returns (uint8) {
        return 0;
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
