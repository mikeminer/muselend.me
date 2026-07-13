// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { ISwapAdapter } from "../src/interfaces/ISwapAdapter.sol";
import { UniswapV4SwapAdapter } from "../src/UniswapV4SwapAdapter.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { MockPermit2 } from "./mocks/MockPermit2.sol";
import { MockUniversalRouter } from "./mocks/MockUniversalRouter.sol";

contract UniswapV4SwapAdapterTest is Test {
    MockERC20 internal usdc;
    MockERC20 internal creator;
    MockPermit2 internal permit2;
    MockUniversalRouter internal router;
    UniswapV4SwapAdapter internal adapter;
    ISwapAdapter.Route internal route;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        creator = new MockERC20("Creator", "CREATOR", 18);
        permit2 = new MockPermit2();
        router = new MockUniversalRouter(permit2, address(creator), address(usdc), 10e6);
        adapter = new UniswapV4SwapAdapter(router, permit2, address(this), address(this), address(this));

        (address currency0, address currency1) = address(creator) < address(usdc)
            ? (address(creator), address(usdc))
            : (address(usdc), address(creator));
        UniswapV4SwapAdapter.PoolKey memory key =
            UniswapV4SwapAdapter.PoolKey(currency0, currency1, 3000, 60, address(0));
        adapter.setPool(key, true);
        route = ISwapAdapter.Route(
            address(creator), address(usdc), keccak256(abi.encode(key)), 3000, 60, address(0), 1
        );

        creator.mint(address(this), 1_000e18);
        usdc.mint(address(this), 100_000e6);
        creator.mint(address(router), 1_000e18);
        usdc.mint(address(router), 100_000e6);
        creator.approve(address(adapter), type(uint256).max);
        usdc.approve(address(adapter), type(uint256).max);
    }

    function testSellExactInputUsesTypedV4Actions() public {
        uint256 before = usdc.balanceOf(address(this));
        uint256 output = adapter.sellExactInput(route, 100e18, 999e6, block.timestamp + 1 hours);
        assertEq(output, 1_000e6);
        assertEq(usdc.balanceOf(address(this)) - before, 1_000e6);
        assertEq(permit2.allowance(address(adapter), address(creator), address(router)), 0);
        assertEq(creator.allowance(address(adapter), address(permit2)), 0);
    }

    function testBuyExactOutputRefundsUnusedMaximum() public {
        uint256 before = usdc.balanceOf(address(this));
        uint256 input = adapter.buyExactOutput(route, 100e18, 1_200e6, block.timestamp + 1 hours);
        assertEq(input, 1_000e6);
        assertEq(before - usdc.balanceOf(address(this)), 1_000e6);
        assertEq(creator.balanceOf(address(adapter)), 0);
        assertEq(usdc.balanceOf(address(adapter)), 0);
    }

    function testBuyExactInputReturnsMarketQuantity() public {
        uint256 output = adapter.buyExactInput(route, 1_500e6, 149e18, block.timestamp + 1 hours);
        assertEq(output, 150e18);
    }

    function testRejectsUnallowlistedPool() public {
        route.poolId = bytes32(uint256(123));
        vm.expectRevert(UniswapV4SwapAdapter.InvalidRoute.selector);
        adapter.sellExactInput(route, 100e18, 999e6, block.timestamp + 1 hours);
    }

    function testRejectsCallerOtherThanPositionManager() public {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(UniswapV4SwapAdapter.OnlyPositionManager.selector);
        adapter.sellExactInput(route, 100e18, 999e6, block.timestamp + 1 hours);
    }
}
