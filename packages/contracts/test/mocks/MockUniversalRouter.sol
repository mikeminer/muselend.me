// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IUniversalRouter } from "../../src/interfaces/IUniversalRouter.sol";
import { MockPermit2 } from "./MockPermit2.sol";

contract MockUniversalRouter is IUniversalRouter {
    using SafeERC20 for IERC20;

    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct ExactInputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        uint256 minHopPriceX36;
        bytes hookData;
    }

    struct ExactOutputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountOut;
        uint128 amountInMaximum;
        uint256 minHopPriceX36;
        bytes hookData;
    }

    MockPermit2 public immutable permit2;
    address public immutable creator;
    address public immutable usdc;
    uint256 public immutable priceUsdcPerToken;

    constructor(MockPermit2 permit2_, address creator_, address usdc_, uint256 price_) {
        permit2 = permit2_;
        creator = creator_;
        usdc = usdc_;
        priceUsdcPerToken = price_;
    }

    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable {
        require(block.timestamp <= deadline && commands.length == 1 && commands[0] == 0x10, "COMMAND");
        (bytes memory actions, bytes[] memory params) = abi.decode(inputs[0], (bytes, bytes[]));
        if (actions[0] == 0x06) {
            ExactInputSingleParams memory swap = abi.decode(params[0], (ExactInputSingleParams));
            address tokenIn = swap.zeroForOne ? swap.poolKey.currency0 : swap.poolKey.currency1;
            address tokenOut = swap.zeroForOne ? swap.poolKey.currency1 : swap.poolKey.currency0;
            uint256 output = tokenIn == creator
                ? uint256(swap.amountIn) * priceUsdcPerToken / 1e18
                : uint256(swap.amountIn) * 1e18 / priceUsdcPerToken;
            require(output >= swap.amountOutMinimum, "MIN_OUT");
            permit2.transferFrom(msg.sender, address(this), swap.amountIn, tokenIn);
            IERC20(tokenOut).safeTransfer(msg.sender, output);
        } else if (actions[0] == 0x08) {
            ExactOutputSingleParams memory swap = abi.decode(params[0], (ExactOutputSingleParams));
            address tokenIn = swap.zeroForOne ? swap.poolKey.currency0 : swap.poolKey.currency1;
            address tokenOut = swap.zeroForOne ? swap.poolKey.currency1 : swap.poolKey.currency0;
            uint256 input = tokenOut == creator
                ? (uint256(swap.amountOut) * priceUsdcPerToken + 1e18 - 1) / 1e18
                : (uint256(swap.amountOut) * 1e18 + priceUsdcPerToken - 1) / priceUsdcPerToken;
            require(input <= swap.amountInMaximum, "MAX_IN");
            permit2.transferFrom(msg.sender, address(this), uint160(input), tokenIn);
            IERC20(tokenOut).safeTransfer(msg.sender, swap.amountOut);
        } else {
            revert("ACTION");
        }
    }
}
