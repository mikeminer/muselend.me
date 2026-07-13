// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockMirrorFactory {
    mapping(address sourceToken => address mirror) public mirrorFor;

    function setMirror(address sourceToken, address mirror) external {
        mirrorFor[sourceToken] = mirror;
    }
}

contract MockOfficialMirror is ERC20 {
    address public immutable factory;
    address public immutable sourceToken;
    address public immutable currency;
    address public immutable hook;

    constructor(address factory_, address sourceToken_, address currency_, address hook_)
        ERC20("Official Mirror", "MIRROR")
    {
        factory = factory_;
        sourceToken = sourceToken_;
        currency = currency_;
        hook = hook_;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }

    function coinType() external pure returns (uint8) {
        return 0;
    }

    function contractVersion() external pure returns (string memory) {
        return "2.6.1-mirror-testnet";
    }

    function getPoolKey() external view returns (address, address, uint24, int24, address) {
        return address(this) < currency
            ? (address(this), currency, 10_000, int24(200), hook)
            : (currency, address(this), 10_000, int24(200), hook);
    }
}
