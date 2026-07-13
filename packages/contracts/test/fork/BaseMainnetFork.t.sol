// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { CreatorTokenValidator } from "../../src/CreatorTokenValidator.sol";

interface IZoraCreatorCoin {
    function coinType() external view returns (uint8);
    function contractVersion() external view returns (string memory);
    function getPoolKey() external view returns (address, address, uint24, int24, address);
}

interface IZoraFactoryReadOnly {
    function creatorCoinHook() external view returns (address);
}

/// @notice Read-only integration coverage against a Creator Coin emitted by the official Zora factory.
/// @dev The fork is pinned to the creation block. No transaction is broadcast and the test skips when
///      BASE_MAINNET_RPC_URL is absent so ordinary local and CI test runs remain credential-free.
contract BaseMainnetForkTest is Test {
    uint256 internal constant BASE_CHAIN_ID = 8453;
    uint256 internal constant FORK_BLOCK = 48_546_235;
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant ZORA_FACTORY = 0x777777751622c0d3258f214F9DF38E35BF45baF3;
    address internal constant ZORA_CREATOR_COIN_IMPLEMENTATION = 0x2c800c1CE59DC8DCeBf3FE3978E5FeEfC538f51F;
    address internal constant ZORA_CREATOR_COIN_HOOK = 0x0469a4Bd3724DC86C9542F4694c976DA13C450c0;
    address internal constant REAL_CREATOR_COIN = 0xf774d7Fb286265B4359773c557E9E5DD4910474d;
    bytes32 internal constant REAL_CREATOR_COIN_PROXY_CODEHASH =
        0x2e1522b7b29179491a7ab17e817e95b63eb24e32a3067f924e48c4958cf38b65;

    function testOfficialCreatorCoinPassesLiveValidatorOnPinnedBaseFork() public {
        string memory rpcUrl = vm.envOr("BASE_MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            vm.skip(true);
            return;
        }

        vm.createSelectFork(rpcUrl, FORK_BLOCK);

        assertEq(block.chainid, BASE_CHAIN_ID);
        assertGt(BASE_USDC.code.length, 0);
        assertEq(IERC20Metadata(BASE_USDC).decimals(), 6);
        assertGt(ZORA_FACTORY.code.length, 0);
        assertGt(ZORA_CREATOR_COIN_IMPLEMENTATION.code.length, 0);
        assertGt(ZORA_CREATOR_COIN_HOOK.code.length, 0);
        assertEq(IZoraFactoryReadOnly(ZORA_FACTORY).creatorCoinHook(), ZORA_CREATOR_COIN_HOOK);
        assertEq(REAL_CREATOR_COIN.codehash, REAL_CREATOR_COIN_PROXY_CODEHASH);

        IZoraCreatorCoin coin = IZoraCreatorCoin(REAL_CREATOR_COIN);
        assertEq(coin.coinType(), 0);
        assertEq(coin.contractVersion(), "2.6.0");
        (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hook) =
            coin.getPoolKey();
        assertTrue(currency0 == REAL_CREATOR_COIN || currency1 == REAL_CREATOR_COIN);
        assertEq(hook, ZORA_CREATOR_COIN_HOOK);
        assertEq(fee, 8_388_608);
        assertEq(tickSpacing, 200);

        CreatorTokenValidator validator = new CreatorTokenValidator(address(this));
        validator.setCanonical(REAL_CREATOR_COIN, 4);
        assertTrue(validator.validate(REAL_CREATOR_COIN, 4));
        assertFalse(validator.validate(REAL_CREATOR_COIN, 3));
    }
}
