// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/// @notice Typed swap interface. Implementations must validate routes and fixed recipients.
interface ISwapAdapter {
    struct Route {
        address creatorToken;
        address usdc;
        bytes32 poolId;
        uint24 fee;
        int24 tickSpacing;
        address hook;
    }
    function sellExactInput(Route calldata route, uint256 amountIn, uint256 minUsdcOut, uint256 deadline)
        external
        returns (uint256 usdcOut);
    function buyExactOutput(Route calldata route, uint256 tokenAmountOut, uint256 maxUsdcIn, uint256 deadline)
        external
        returns (uint256 usdcIn);
    function buyExactInput(Route calldata route, uint256 usdcIn, uint256 minTokenOut, uint256 deadline)
        external
        returns (uint256 tokenOut);
}
