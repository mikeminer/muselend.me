import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
  maxUint256,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
} from "viem";

const enabled = process.env.RUN_ANVIL_E2E === "1";
const rpcUrl = "http://127.0.0.1:8547";
const anvilChain = defineChain({
  id: 31_337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

type Artifact = { abi: Abi; bytecode: { object: Hex } };

test.describe("Anvil protocol lifecycle", () => {
  test.skip(!enabled, "Set RUN_ANVIL_E2E=1 to run the local-chain integration suite");
  let anvil: ChildProcess;

  test.beforeAll(async () => {
    const executable =
      process.env.ANVIL_BIN ??
      (process.platform === "win32" ? join(homedir(), ".foundry", "bin", "anvil.exe") : "anvil");
    anvil = spawn(executable, ["--port", "8547", "--silent"], {
      stdio: "ignore",
      windowsHide: true,
    });
    const client = createPublicClient({ chain: anvilChain, transport: http(rpcUrl) });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        if ((await client.getChainId()) === 31_337) return;
      } catch {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      }
    }
    throw new Error("Anvil did not become ready");
  });

  test.afterAll(async () => {
    if (anvil && !anvil.killed) {
      const exited = new Promise<void>((resolveExit) => anvil.once("exit", () => resolveExit()));
      anvil.kill();
      await Promise.race([exited, new Promise<void>((resolveWait) => setTimeout(resolveWait, 2_000))]);
    }
  });

  test("full and capped close, default, epoch redemption, and FIFO withdrawal work end to end", async () => {
    test.setTimeout(90_000);
    const publicClient = createPublicClient({ chain: anvilChain, transport: http(rpcUrl) });
    const testClient = createTestClient({ chain: anvilChain, mode: "anvil", transport: http(rpcUrl) });
    const unlockedClient = createWalletClient({ chain: anvilChain, transport: http(rpcUrl) });
    const accounts = await unlockedClient.getAddresses();
    const [admin, borrower, lender, underwriter, keeper] = accounts;

    const wallet = (account: Address) =>
      createWalletClient({ account, chain: anvilChain, transport: http(rpcUrl) });
    const adminWallet = wallet(admin);
    const borrowerWallet = wallet(borrower);
    const lenderWallet = wallet(lender);
    const underwriterWallet = wallet(underwriter);
    const keeperWallet = wallet(keeper);

    const deploy = async (contract: string, args: readonly unknown[] = []) => {
      const artifact = await loadArtifact(contract);
      const hash = await adminWallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error(`${contract} deployment returned no address`);
      return { address: receipt.contractAddress, abi: artifact.abi };
    };
    const write = async (
      client: ReturnType<typeof wallet>,
      contract: { address: Address; abi: Abi },
      functionName: string,
      args: readonly unknown[] = [],
    ) => {
      const hash = await client.writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName,
        args,
        gas: 15_000_000n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`${functionName} transaction reverted`);
      return hash;
    };

    const usdc = await deploy("MockERC20", ["USD Coin", "USDC", 6]);
    const creator = await deploy("MockZoraCreatorToken", [usdc.address, "0x0000000000000000000000000000000000000001"]);
    const adapter = await deploy("MockSwapAdapter", [parseUnits("10", 6), admin]);
    const rate = await deploy("InterestRateModel", [
      {
        baseRateRay: 2n * 10n ** 25n,
        preKinkSlopeRay: 10n ** 26n,
        postKinkSlopeRay: 68n * 10n ** 25n,
        kinkRay: 8n * 10n ** 26n,
        maxBorrowRateRay: 8n * 10n ** 26n,
        reserveFactorBps: 1_000,
      },
    ]);
    const treasury = await deploy("ProtocolTreasury", [usdc.address, admin, admin]);
    const risk = await deploy("MuseLendRiskManager", [
      admin,
      admin,
      admin,
      false,
      parseUnits("1000000", 6),
      parseUnits("500000", 6),
      50,
    ]);
    const senior = await deploy("MuseLendUSDCVault", [usdc.address, admin, rate.address, risk.address, treasury.address]);
    const junior = await deploy("MuseLendHedgeEpochVault", [usdc.address, admin, risk.address]);
    const receipt = await deploy("MuseLendPositionReceipt", [admin]);
    const validator = await deploy("CreatorTokenValidator", [admin]);
    const manager = await deploy("MuseLendPositionManager", [
      usdc.address,
      senior.address,
      junior.address,
      receipt.address,
      risk.address,
      validator.address,
      admin,
      admin,
      adapter.address,
      treasury.address,
    ]);

    await write(adminWallet, senior, "setPositionManager", [manager.address]);
    await write(adminWallet, junior, "setPositionManager", [manager.address]);
    await write(adminWallet, receipt, "setPositionManager", [manager.address]);
    await write(adminWallet, validator, "setCanonical", [creator.address, 4]);
    await write(adminWallet, risk, "setTokenConfig", [
      creator.address,
      {
        enabled: true,
        canonicalZoraVersion: 4,
        riskTier: 1,
        advanceRateBps: 6_000,
        seniorCoverageBps: 9_000,
        coverageCapBps: 15_000,
        maximumPriceImpactBps: 1_000,
        minimumPositionUsdc: parseUnits("100", 6),
        maximumPositionUsdc: parseUnits("100000", 6),
        maximumTokenExposureUsdc: parseUnits("1000000", 6),
        maximumWalletExposureUsdc: parseUnits("100000", 6),
      },
    ]);
    await write(adminWallet, risk, "setTerm", [creator.address, 7 * 24 * 60 * 60, 250, true]);

    const block = await publicClient.getBlock();
    const now = Number(block.timestamp);
    await write(adminWallet, junior, "createEpoch", [now - 1, now + 60, now + 60, now + 11 * 86_400, now + 14 * 86_400]);

    await write(adminWallet, usdc, "mint", [lender, parseUnits("100000", 6)]);
    await write(adminWallet, usdc, "mint", [underwriter, parseUnits("100000", 6)]);
    await write(adminWallet, usdc, "mint", [adapter.address, parseUnits("1000000", 6)]);
    await write(adminWallet, creator, "mint", [borrower, parseUnits("1000", 18)]);
    await write(adminWallet, creator, "mint", [adapter.address, parseUnits("1000", 18)]);

    await write(lenderWallet, usdc, "approve", [senior.address, maxUint256]);
    await write(lenderWallet, senior, "deposit", [parseUnits("100000", 6), lender]);
    await write(underwriterWallet, usdc, "approve", [junior.address, maxUint256]);
    await write(underwriterWallet, junior, "deposit", [1, parseUnits("100000", 6), underwriter]);
    await testClient.increaseTime({ seconds: 61 });
    await testClient.mine({ blocks: 1 });

    const route = {
      creatorToken: creator.address,
      usdc: usdc.address,
      poolId: `0x${"01".padStart(64, "0")}` as Hex,
      fee: 3_000,
      tickSpacing: 60,
      hook: "0x0000000000000000000000000000000000000000" as Address,
      minHopPriceX36: 1n,
    };
    const openPosition = async () => {
      await write(borrowerWallet, creator, "approve", [manager.address, maxUint256]);
      await write(borrowerWallet, manager, "openPosition", [
        {
          creatorToken: creator.address,
          adapter: adapter.address,
          amount: parseUnits("100", 18),
          minUsdcOut: parseUnits("999", 6),
          principal: parseUnits("600", 6),
          term: 7 * 86_400,
          epochId: 1,
          deadline: Number((await publicClient.getBlock()).timestamp) + 3_600,
          route,
        },
      ]);
    };

    await openPosition();
    expect(await publicClient.readContract({ address: receipt.address, abi: receipt.abi, functionName: "ownerOf", args: [1n] })).toBe(borrower);
    await write(adminWallet, usdc, "mint", [borrower, parseUnits("100", 6)]);
    await write(borrowerWallet, usdc, "approve", [manager.address, maxUint256]);
    await write(adminWallet, adapter, "setPrice", [parseUnits("12", 6)]);
    await write(borrowerWallet, manager, "closeFull", [
      1n,
      0n,
      Number((await publicClient.getBlock()).timestamp) + 3_600,
      route,
    ]);
    expect(await publicClient.readContract({ address: creator.address, abi: creator.abi, functionName: "balanceOf", args: [borrower] })).toBe(parseUnits("1000", 18));

    await write(adminWallet, adapter, "setPrice", [parseUnits("10", 6)]);
    await openPosition();
    await write(adminWallet, adapter, "setPrice", [parseUnits("20", 6)]);
    await write(borrowerWallet, manager, "closeCapped", [
      2n,
      parseUnits("75", 18),
      Number((await publicClient.getBlock()).timestamp) + 3_600,
      route,
    ]);
    expect(await publicClient.readContract({ address: creator.address, abi: creator.abi, functionName: "balanceOf", args: [borrower] })).toBe(parseUnits("975", 18));

    await write(adminWallet, adapter, "setPrice", [parseUnits("10", 6)]);
    await openPosition();
    await testClient.increaseTime({ seconds: 10 * 86_400 + 2 });
    await testClient.mine({ blocks: 1 });
    await write(keeperWallet, manager, "settleExpiredPosition", [3n]);
    const position = (await publicClient.readContract({
      address: manager.address,
      abi: manager.abi,
      functionName: "positions",
      args: [3n],
    })) as readonly unknown[];
    expect(position.at(-1)).toBe(4);

    await testClient.increaseTime({ seconds: 2 * 86_400 });
    await testClient.mine({ blocks: 1 });
    await write(keeperWallet, junior, "closeEpoch", [1n]);
    const juniorShares = await publicClient.readContract({ address: junior.address, abi: junior.abi, functionName: "balanceOf", args: [underwriter, 1n] }) as bigint;
    const juniorBefore = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: "balanceOf", args: [underwriter] }) as bigint;
    await write(underwriterWallet, junior, "redeem", [1n, juniorShares, underwriter]);
    const juniorAfter = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: "balanceOf", args: [underwriter] }) as bigint;
    expect(juniorAfter).toBeGreaterThan(juniorBefore);

    const queuedShares = parseUnits("1000", 6);
    const lenderBefore = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: "balanceOf", args: [lender] }) as bigint;
    await write(lenderWallet, senior, "requestRedeem", [queuedShares, lender]);
    await write(keeperWallet, senior, "claimNextWithdrawal");
    const lenderAfter = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: "balanceOf", args: [lender] }) as bigint;
    expect(lenderAfter).toBeGreaterThan(lenderBefore);
  });
});

async function loadArtifact(contract: string): Promise<Artifact> {
  const path = resolve(
    process.cwd(),
    "../../packages/contracts/out",
    `${contract}.sol`,
    `${contract}.json`,
  );
  return JSON.parse(await readFile(path, "utf8")) as Artifact;
}
