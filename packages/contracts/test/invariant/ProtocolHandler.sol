// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { MuseLendPositionManager } from "../../src/MuseLendPositionManager.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { ISwapAdapter } from "../../src/interfaces/ISwapAdapter.sol";

contract ProtocolHandler is Test {
    MuseLendPositionManager public immutable manager;
    MockERC20 public immutable creator;
    ISwapAdapter.Route internal route;
    address public immutable adapter;
    uint256 public expectedJuniorCoverage;

    constructor(MuseLendPositionManager manager_, MockERC20 creator_, address adapter_, address usdc_) {
        manager = manager_;
        creator = creator_;
        adapter = adapter_;
        route = ISwapAdapter.Route(address(creator_), usdc_, bytes32(uint256(1)), 3000, 60, address(0), 1);
    }

    function open(uint256 seed, uint96 rawAmount) external {
        address user = address(uint160(uint256(keccak256(abi.encode(seed, "user")))));
        uint256 amount = bound(uint256(rawAmount), 10e18, 100e18);
        uint256 proceeds = amount * 10e6 / 1e18;
        creator.mint(user, amount);
        uint256 expectedId = manager.nextPositionId();
        vm.startPrank(user);
        creator.approve(address(manager), amount);
        try manager.openPosition(
            MuseLendPositionManager.OpenParams(
                address(creator),
                adapter,
                amount,
                proceeds * 99 / 100,
                proceeds * 50 / 100,
                7 days,
                1,
                block.timestamp + 1 hours,
                route
            )
        ) {
            (,,,,,,,, uint128 juniorCoverage,,,,,,,,) = manager.positions(expectedId);
            expectedJuniorCoverage += juniorCoverage;
        } catch { }
        vm.stopPrank();
    }
}
