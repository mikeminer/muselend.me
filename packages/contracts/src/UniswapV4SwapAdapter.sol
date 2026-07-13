// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { ISwapAdapter } from "./interfaces/ISwapAdapter.sol";
import { IUniversalRouter, IAllowanceTransfer } from "./interfaces/IUniversalRouter.sol";

/// @title MuseLend typed Uniswap v4 adapter
/// @notice Executes only allowlisted single-pool swaps through the official Universal Router.
contract UniswapV4SwapAdapter is ISwapAdapter, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");
    bytes1 internal constant V4_SWAP = 0x10;
    bytes1 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    bytes1 internal constant SWAP_EXACT_OUT_SINGLE = 0x08;
    bytes1 internal constant SETTLE_ALL = 0x0c;
    bytes1 internal constant TAKE_ALL = 0x0f;

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

    error OnlyPositionManager();
    error InvalidRoute();
    error DeadlineExpired();
    error SlippageCheckFailed();

    IUniversalRouter public immutable universalRouter;
    IAllowanceTransfer public immutable permit2;
    address public immutable positionManager;
    mapping(bytes32 poolId => bool allowed) public allowedPool;

    event PoolUpdated(bytes32 indexed poolId, bool allowed);

    constructor(
        IUniversalRouter universalRouter_,
        IAllowanceTransfer permit2_,
        address positionManager_,
        address admin,
        address poolAdmin
    ) {
        if (
            address(universalRouter_) == address(0) || address(permit2_) == address(0)
                || positionManager_ == address(0) || admin == address(0) || poolAdmin == address(0)
        ) revert InvalidRoute();
        universalRouter = universalRouter_;
        permit2 = permit2_;
        positionManager = positionManager_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POOL_ADMIN_ROLE, poolAdmin);
    }

    modifier onlyPositionManager() {
        if (msg.sender != positionManager) revert OnlyPositionManager();
        _;
    }

    function setPool(PoolKey calldata key, bool allowed) external onlyRole(POOL_ADMIN_ROLE) {
        bytes32 id = _poolId(key);
        if (key.currency0 == address(0) || key.currency0 >= key.currency1 || key.tickSpacing <= 0) {
            revert InvalidRoute();
        }
        allowedPool[id] = allowed;
        emit PoolUpdated(id, allowed);
    }

    function sellExactInput(Route calldata route, uint256 amountIn, uint256 minUsdcOut, uint256 deadline)
        external
        onlyPositionManager
        nonReentrant
        returns (uint256 usdcOut)
    {
        (PoolKey memory key, bool creatorIsCurrency0) = _validateRoute(route, deadline);
        usdcOut = _exactInput(
            key,
            creatorIsCurrency0,
            route.creatorToken,
            route.usdc,
            amountIn,
            minUsdcOut,
            route.minHopPriceX36,
            deadline
        );
    }

    function buyExactOutput(Route calldata route, uint256 tokenAmountOut, uint256 maxUsdcIn, uint256 deadline)
        external
        onlyPositionManager
        nonReentrant
        returns (uint256 usdcIn)
    {
        (PoolKey memory key, bool creatorIsCurrency0) = _validateRoute(route, deadline);
        usdcIn = _exactOutput(
            key,
            !creatorIsCurrency0,
            route.usdc,
            route.creatorToken,
            tokenAmountOut,
            maxUsdcIn,
            route.minHopPriceX36,
            deadline
        );
    }

    function buyExactInput(Route calldata route, uint256 usdcIn, uint256 minTokenOut, uint256 deadline)
        external
        onlyPositionManager
        nonReentrant
        returns (uint256 tokenOut)
    {
        (PoolKey memory key, bool creatorIsCurrency0) = _validateRoute(route, deadline);
        tokenOut = _exactInput(
            key,
            !creatorIsCurrency0,
            route.usdc,
            route.creatorToken,
            usdcIn,
            minTokenOut,
            route.minHopPriceX36,
            deadline
        );
    }

    // Balance deltas authenticate Universal Router settlement; every caller is nonReentrant.
    // slither-disable-start reentrancy-balance
    function _exactInput(
        PoolKey memory key,
        bool zeroForOne,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 minHopPriceX36,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        uint256 beforeIn = IERC20(tokenIn).balanceOf(address(this));
        _authorize(tokenIn, amountIn, deadline);
        uint256 beforeOut = IERC20(tokenOut).balanceOf(address(this));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            ExactInputSingleParams(
                key, zeroForOne, amountIn.toUint128(), minAmountOut.toUint128(), minHopPriceX36, bytes("")
            )
        );
        params[1] = abi.encode(tokenIn, amountIn);
        params[2] = abi.encode(tokenOut, minAmountOut);
        _execute(params, SWAP_EXACT_IN_SINGLE, deadline);
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - beforeOut;
        if (amountOut < minAmountOut || IERC20(tokenIn).balanceOf(address(this)) != beforeIn) {
            revert SlippageCheckFailed();
        }
        _revoke(tokenIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
    }

    // slither-disable-end reentrancy-balance

    // Balance deltas authenticate spend/refund accounting; every caller is nonReentrant.
    // slither-disable-start reentrancy-balance
    function _exactOutput(
        PoolKey memory key,
        bool zeroForOne,
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        uint256 minHopPriceX36,
        uint256 deadline
    ) internal returns (uint256 amountIn) {
        _authorize(tokenIn, maxAmountIn, deadline);
        uint256 beforeIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 beforeOut = IERC20(tokenOut).balanceOf(address(this));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            ExactOutputSingleParams(
                key, zeroForOne, amountOut.toUint128(), maxAmountIn.toUint128(), minHopPriceX36, bytes("")
            )
        );
        params[1] = abi.encode(tokenIn, maxAmountIn);
        params[2] = abi.encode(tokenOut, amountOut);
        _execute(params, SWAP_EXACT_OUT_SINGLE, deadline);
        amountIn = beforeIn - IERC20(tokenIn).balanceOf(address(this));
        uint256 received = IERC20(tokenOut).balanceOf(address(this)) - beforeOut;
        if (amountIn > maxAmountIn || received != amountOut) revert SlippageCheckFailed();
        _revoke(tokenIn);
        uint256 refund = maxAmountIn - amountIn;
        if (refund > 0) IERC20(tokenIn).safeTransfer(msg.sender, refund);
        IERC20(tokenOut).safeTransfer(msg.sender, received);
    }
    // slither-disable-end reentrancy-balance

    function _execute(bytes[] memory params, bytes1 swapAction, uint256 deadline) internal {
        bytes memory actions = abi.encodePacked(swapAction, SETTLE_ALL, TAKE_ALL);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);
        universalRouter.execute(abi.encodePacked(V4_SWAP), inputs, deadline);
    }

    function _authorize(address token, uint256 amount, uint256 deadline) internal {
        if (amount == 0 || amount > type(uint160).max || deadline > type(uint48).max) revert InvalidRoute();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).forceApprove(address(permit2), amount);
        permit2.approve(token, address(universalRouter), amount.toUint160(), deadline.toUint48());
    }

    function _revoke(address token) internal {
        permit2.approve(token, address(universalRouter), 0, 0);
        IERC20(token).forceApprove(address(permit2), 0);
    }

    function _validateRoute(Route calldata route, uint256 deadline)
        internal
        view
        returns (PoolKey memory key, bool creatorIsCurrency0)
    {
        if (
            block.timestamp > deadline || route.creatorToken == address(0) || route.usdc == address(0)
                || route.creatorToken == route.usdc || route.tickSpacing <= 0 || route.minHopPriceX36 == 0
        ) {
            if (block.timestamp > deadline) revert DeadlineExpired();
            revert InvalidRoute();
        }
        creatorIsCurrency0 = route.creatorToken < route.usdc;
        key = PoolKey(
            creatorIsCurrency0 ? route.creatorToken : route.usdc,
            creatorIsCurrency0 ? route.usdc : route.creatorToken,
            route.fee,
            route.tickSpacing,
            route.hook
        );
        bytes32 id = _poolId(key);
        if (id != route.poolId || !allowedPool[id]) revert InvalidRoute();
    }

    function _poolId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }
}
