import {
  CreatorTokenValidatorAbi,
  MuseLendPositionManagerAbi,
} from "@muselend/abis";
import {
  createPublicClient,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
  zeroHash,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { NextResponse } from "next/server";
import {
  apiError,
  completeRequest,
  parseBody,
  rateLimitResponse,
  requestContext,
  withTimeout,
} from "@/lib/api";
import { quoteRequest } from "@/lib/api-schemas";
import { recordQuoteRequest } from "@/lib/optional-persistence";

const mockAdapterAbi = parseAbi([
  "function priceUsdcPerToken() view returns (uint256)",
]);

export async function testnetQuote(
  request: Request,
  kind: "sell" | "buy-exact-output" | "buy-exact-input",
) {
  const context = await requestContext(request, 20);
  if (context.limited) return rateLimitResponse(context.requestId);
  const body = await parseBody(request, quoteRequest, context.requestId);
  if (body instanceof NextResponse) return body;
  const now = Math.floor(Date.now() / 1000);
  if (body.deadline <= now || body.deadline > now + 600) {
    await recordQuoteRequest({
      requestId: context.requestId,
      kind,
      ...body,
      outcome: "stale",
    });
    return apiError(
      context.requestId,
      400,
      "STALE_QUOTE",
      "Deadline must be within the next ten minutes",
    );
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const adapter = process.env.NEXT_PUBLIC_SWAP_ADAPTER_ADDRESS;
  const manager = process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS;
  const validator = process.env.NEXT_PUBLIC_CREATOR_TOKEN_VALIDATOR_ADDRESS;
  const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (
    !rpcUrl ||
    !isAddress(adapter ?? "") ||
    !isAddress(manager ?? "") ||
    !isAddress(validator ?? "") ||
    !isAddress(usdc ?? "")
  ) {
    await recordQuoteRequest({
      requestId: context.requestId,
      kind,
      ...body,
      outcome: "unconfigured",
    });
    return apiError(
      context.requestId,
      503,
      "QUOTE_UNAVAILABLE",
      "Verified Base Sepolia quote configuration is incomplete",
      { calldataReturned: false },
    );
  }

  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    const [code, allowed, canonical, price] = await withTimeout(
      Promise.all([
        client.getBytecode({ address: adapter as Address }),
        client.readContract({
          address: manager as Address,
          abi: MuseLendPositionManagerAbi,
          functionName: "allowedAdapter",
          args: [adapter as Address],
        }),
        client.readContract({
          address: validator as Address,
          abi: CreatorTokenValidatorAbi,
          functionName: "validate",
          args: [body.creatorToken as Address, 4],
        }),
        client.readContract({
          address: adapter as Address,
          abi: mockAdapterAbi,
          functionName: "priceUsdcPerToken",
        }),
      ]),
    );
    if (!code || code === "0x" || !allowed || !canonical || price <= 0n)
      throw new Error("Unverified adapter or token");
    const amount = BigInt(body.amount);
    const { quoted, protectedAmount } = quoteAmounts(
      kind,
      amount,
      price,
      body.slippageBps,
    );
    await recordQuoteRequest({
      requestId: context.requestId,
      kind,
      ...body,
      outcome: "quoted",
    });
    completeRequest(context, 200);
    return NextResponse.json(
      {
        quote: {
          kind,
          adapter,
          amount: body.amount,
          quotedAmount: quoted.toString(),
          protectedAmount: protectedAmount.toString(),
          slippageBps: body.slippageBps,
          deadline: body.deadline,
          route: {
            creatorToken: body.creatorToken,
            usdc,
            poolId: zeroHash,
            fee: 0,
            tickSpacing: 0,
            hook: zeroAddress,
            minHopPriceX36: "1",
          },
          source: "verified-testnet-adapter",
        },
        requestId: context.requestId,
      },
      {
        headers: {
          "cache-control": "no-store",
          "x-request-id": context.requestId,
        },
      },
    );
  } catch {
    await recordQuoteRequest({
      requestId: context.requestId,
      kind,
      ...body,
      outcome: "unavailable",
    });
    return apiError(
      context.requestId,
      503,
      "QUOTE_UNAVAILABLE",
      "Verified Base Sepolia adapter quote is unavailable",
      { calldataReturned: false },
    );
  }
}

export const testnetBuyQuote = testnetQuote;

export function divideUp(numerator: bigint, denominator: bigint) {
  return numerator === 0n ? 0n : (numerator - 1n) / denominator + 1n;
}

export function quoteAmounts(
  kind: "sell" | "buy-exact-output" | "buy-exact-input",
  amount: bigint,
  price: bigint,
  slippageBps: number,
) {
  const quoted =
    kind === "buy-exact-output"
      ? divideUp(amount * price, 10n ** 18n)
      : kind === "buy-exact-input"
        ? (amount * 10n ** 18n) / price
        : (amount * price) / 10n ** 18n;
  const protectedAmount =
    kind === "buy-exact-output"
      ? divideUp(quoted * BigInt(10_000 + slippageBps), 10_000n)
      : (quoted * BigInt(10_000 - slippageBps)) / 10_000n;
  return { quoted, protectedAmount };
}
