import { BaseCreatorTokenMirrorFactoryAbi } from "@muselend/abis";
import { getCoin, setApiKey } from "@zoralabs/coins-sdk";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  fallback,
  http,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";

export const MAX_CLAIM_TOKENS = 1_000_000n;
export const CLAIM_DOMAIN = {
  name: "MuseLend Base Creator Mirror",
  version: "1",
  chainId: baseSepolia.id,
} as const;
export const CLAIM_TYPES = {
  Claim: [
    { name: "wallet", type: "address" },
    { name: "sourceToken", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "decimals", type: "uint8" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const creatorCoinAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function contractVersion() view returns (string)",
  "function getPoolKey() view returns (address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)",
]);

type IndexedCoin = {
  address: string;
  coinType: string;
  platformBlocked: boolean;
};

export type ClaimVoucher = {
  wallet: Address;
  sourceToken: Address;
  amount: bigint;
  name: string;
  symbol: string;
  decimals: number;
  deadline: bigint;
};

export type ClaimAttestation = {
  claimed: boolean;
  eligible: boolean;
  mirror?: Address;
  capped: boolean;
  sourceBalance: bigint;
  voucher?: ClaimVoucher;
  signature?: Hex;
};

export function validateCreatorMetadata(name: string, symbol: string, decimals: number) {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name).length;
  const symbolBytes = encoder.encode(symbol).length;
  if (nameBytes < 1 || nameBytes > 96) throw new Error("INVALID_TOKEN_NAME");
  if (symbolBytes < 1 || symbolBytes > 24) throw new Error("INVALID_TOKEN_SYMBOL");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("INVALID_TOKEN_DECIMALS");
  }
}

export function claimAmount(balance: bigint, decimals: number) {
  const maximum = MAX_CLAIM_TOKENS * 10n ** BigInt(decimals);
  return { amount: balance > maximum ? maximum : balance, capped: balance > maximum };
}

export function validateIndexedCreatorCoin(coin: IndexedCoin | undefined, sourceToken: Address) {
  if (
    !coin ||
    coin.coinType !== "CREATOR" ||
    coin.platformBlocked ||
    !isAddress(coin.address) ||
    coin.address.toLowerCase() !== sourceToken.toLowerCase()
  ) {
    throw new Error("NOT_A_CREATOR_COIN");
  }
}

export function claimConfiguration() {
  const factory = process.env.NEXT_PUBLIC_CREATOR_MIRROR_FACTORY_ADDRESS;
  const privateKey = process.env.TESTNET_CLAIM_ATTESTER_PRIVATE_KEY;
  if (!factory || !isAddress(factory)) throw new Error("CLAIM_FACTORY_NOT_CONFIGURED");
  if (!privateKey || !/^0x[\da-fA-F]{64}$/.test(privateKey)) {
    throw new Error("CLAIM_ATTESTER_NOT_CONFIGURED");
  }
  return { factory: factory as Address, privateKey: privateKey as Hex };
}

export async function createClaimAttestation(
  wallet: Address,
  sourceToken: Address,
): Promise<ClaimAttestation> {
  const { factory, privateKey } = claimConfiguration();
  const baseClient = createPublicClient({
    chain: base,
    transport: fallback(
      [...new Set([
        process.env.BASE_MAINNET_RPC_URL ?? "https://mainnet.base.org",
        process.env.BASE_MAINNET_FALLBACK_RPC_URL ?? "https://base-rpc.publicnode.com",
      ])].map((url) => http(url, { retryCount: 1, retryDelay: 200 })),
    ),
  });
  const sepoliaClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org"),
  });
  const [baseBlock, sepoliaBlock] = await Promise.all([
    baseClient.getBlockNumber(),
    sepoliaClient.getBlockNumber(),
  ]);
  const bytecode = await baseClient.getBytecode({ address: sourceToken, blockNumber: baseBlock });
  if (!bytecode || bytecode === "0x") throw new Error("SOURCE_TOKEN_NOT_FOUND");

  // Legacy Creator Coins (including v1.1.0) predate coinType(), so use Zora's
  // canonical index for classification and keep metadata/balance/pool reads on-chain.
  setApiKey(process.env.ZORA_API_KEY);
  const [name, symbol, decimals, balance, version, poolKey, indexedCoinResult] =
    await Promise.all([
      baseClient.readContract({ address: sourceToken, abi: creatorCoinAbi, functionName: "name", blockNumber: baseBlock }),
      baseClient.readContract({ address: sourceToken, abi: creatorCoinAbi, functionName: "symbol", blockNumber: baseBlock }),
      baseClient.readContract({ address: sourceToken, abi: creatorCoinAbi, functionName: "decimals", blockNumber: baseBlock }),
      baseClient.readContract({ address: sourceToken, abi: creatorCoinAbi, functionName: "balanceOf", args: [wallet], blockNumber: baseBlock }),
      baseClient.readContract({ address: sourceToken, abi: creatorCoinAbi, functionName: "contractVersion", blockNumber: baseBlock }),
      baseClient.readContract({ address: sourceToken, abi: creatorCoinAbi, functionName: "getPoolKey", blockNumber: baseBlock }),
      getCoin({ address: sourceToken, chain: base.id }),
    ]);

  validateCreatorMetadata(name, symbol, decimals);
  validateIndexedCreatorCoin(indexedCoinResult.data?.zora20Token, sourceToken);
  const normalizedSourceToken = sourceToken.toLowerCase();
  if (
    !version ||
    (poolKey[0].toLowerCase() !== normalizedSourceToken &&
      poolKey[1].toLowerCase() !== normalizedSourceToken)
  ) {
    throw new Error("NOT_A_CREATOR_COIN");
  }
  if (balance === 0n) throw new Error("ZERO_SOURCE_BALANCE");

  const [attester, claimed, mirror] = await Promise.all([
    sepoliaClient.readContract({ address: factory, abi: BaseCreatorTokenMirrorFactoryAbi, functionName: "attester", blockNumber: sepoliaBlock }),
    sepoliaClient.readContract({ address: factory, abi: BaseCreatorTokenMirrorFactoryAbi, functionName: "hasClaimed", args: [wallet, sourceToken], blockNumber: sepoliaBlock }),
    sepoliaClient.readContract({ address: factory, abi: BaseCreatorTokenMirrorFactoryAbi, functionName: "mirrorFor", args: [sourceToken], blockNumber: sepoliaBlock }),
  ]);
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== attester.toLowerCase()) {
    throw new Error("CLAIM_ATTESTER_MISMATCH");
  }
  const existingMirror = mirror === "0x0000000000000000000000000000000000000000" ? undefined : mirror;
  const limited = claimAmount(balance, decimals);
  if (claimed) {
    return { claimed: true, eligible: false, mirror: existingMirror, capped: limited.capped, sourceBalance: balance };
  }

  const voucher: ClaimVoucher = {
    wallet,
    sourceToken,
    amount: limited.amount,
    name,
    symbol,
    decimals,
    deadline: BigInt(Math.floor(Date.now() / 1_000) + 10 * 60),
  };
  const signature = await account.signTypedData({
    domain: { ...CLAIM_DOMAIN, verifyingContract: factory },
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message: voucher,
  });
  return {
    claimed: false,
    eligible: true,
    mirror: existingMirror,
    capped: limited.capped,
    sourceBalance: balance,
    voucher,
    signature,
  };
}
