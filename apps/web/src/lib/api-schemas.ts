import {z} from "zod";
export const address=z.string().regex(/^0x[a-fA-F0-9]{40}$/,"Invalid EVM address");
export const tokenRequest=z.object({chainId:z.literal(84532),token:address});
export const quoteRequest=z.object({chainId:z.literal(84532),creatorToken:address,amount:z.string().regex(/^\d+$/),slippageBps:z.number().int().min(1).max(1000),deadline:z.number().int().positive()});
export const swapRoute = z.object({ creatorToken: address, usdc: address, poolId: z.string().regex(/^0x[a-fA-F0-9]{64}$/), fee: z.number().int().min(0).max(16_777_215), tickSpacing: z.number().int().min(-8_388_608).max(8_388_607), hook: address, minHopPriceX36: z.string().regex(/^\d+$/) });
export const buyQuoteResponse = z.object({ quote: z.object({ kind: z.enum(["buy-exact-output", "buy-exact-input"]), adapter: address, amount: z.string().regex(/^\d+$/), quotedAmount: z.string().regex(/^\d+$/), protectedAmount: z.string().regex(/^\d+$/), slippageBps: z.number().int(), deadline: z.number().int().positive(), route: swapRoute, source: z.literal("verified-testnet-adapter") }), requestId: z.string().uuid() });
export const acceptanceRequest=z.object({chainId:z.literal(84532),wallet:address,version:z.string().min(1).max(64),signature:z.string().regex(/^0x[a-fA-F0-9]+$/)});
export const siweVerifyRequest = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
});
