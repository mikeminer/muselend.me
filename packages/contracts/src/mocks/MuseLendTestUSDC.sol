// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Valueless Base Sepolia USDC-shaped faucet asset used by the MuseLend test deployment.
contract MuseLendTestUSDC is ERC20 {
    uint256 public constant INITIAL_LIQUIDITY = 2_000_000e6;
    uint256 public constant FAUCET_AMOUNT = 10_000e6;
    mapping(address account => bool claimed) public hasClaimedFaucet;

    error FaucetAlreadyClaimed();
    error InvalidInitialHolder();

    constructor(address initialHolder) ERC20("MuseLend Test USDC", "mUSDC") {
        if (initialHolder == address(0)) revert InvalidInitialHolder();
        _mint(initialHolder, INITIAL_LIQUIDITY);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external returns (uint256 amount) {
        if (hasClaimedFaucet[msg.sender]) revert FaucetAlreadyClaimed();
        hasClaimedFaucet[msg.sender] = true;
        amount = FAUCET_AMOUNT;
        _mint(msg.sender, amount);
    }
}
