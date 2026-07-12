// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ISwapAdapter } from "../interfaces/ISwapAdapter.sol";

/// @notice Deterministic test adapter. One creator-token whole unit is priced in raw USDC units.
contract MockSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;
    error DeadlineExpired();
    error InvalidRoute();
    error UnauthorizedPriceAdmin();
    uint256 public priceUsdcPerToken;
    address public immutable priceAdmin;

    constructor(uint256 price_, address priceAdmin_) {
        if (priceAdmin_ == address(0)) revert UnauthorizedPriceAdmin();
        priceUsdcPerToken = price_;
        priceAdmin = priceAdmin_;
    }

    function setPrice(uint256 price_) external {
        if (msg.sender != priceAdmin) revert UnauthorizedPriceAdmin();
        priceUsdcPerToken = price_;
    }

    function _check(Route calldata r, uint256 deadline) internal view {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (r.creatorToken == address(0) || r.usdc == address(0)) revert InvalidRoute();
    }

    function sellExactInput(Route calldata r, uint256 amountIn, uint256 minUsdcOut, uint256 deadline)
        external
        returns (uint256 usdcOut)
    {
        _check(r, deadline);
        usdcOut = Math.mulDiv(amountIn, priceUsdcPerToken, 1e18);
        if (usdcOut < minUsdcOut) revert InvalidRoute();
        IERC20(r.creatorToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(r.usdc).safeTransfer(msg.sender, usdcOut);
    }

    function buyExactOutput(Route calldata r, uint256 tokenAmountOut, uint256 maxUsdcIn, uint256 deadline)
        external
        returns (uint256 usdcIn)
    {
        _check(r, deadline);
        usdcIn = Math.mulDiv(tokenAmountOut, priceUsdcPerToken, 1e18, Math.Rounding.Ceil);
        if (usdcIn > maxUsdcIn) revert InvalidRoute();
        IERC20(r.usdc).safeTransferFrom(msg.sender, address(this), usdcIn);
        IERC20(r.creatorToken).safeTransfer(msg.sender, tokenAmountOut);
    }

    function buyExactInput(Route calldata r, uint256 usdcIn, uint256 minTokenOut, uint256 deadline)
        external
        returns (uint256 tokenOut)
    {
        _check(r, deadline);
        tokenOut = Math.mulDiv(usdcIn, 1e18, priceUsdcPerToken);
        if (tokenOut < minTokenOut) revert InvalidRoute();
        IERC20(r.usdc).safeTransferFrom(msg.sender, address(this), usdcIn);
        IERC20(r.creatorToken).safeTransfer(msg.sender, tokenOut);
    }
}
