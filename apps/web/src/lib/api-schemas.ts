import {z} from "zod";
export const address=z.string().regex(/^0x[a-fA-F0-9]{40}$/,"Invalid EVM address");
export const tokenRequest=z.object({chainId:z.literal(84532),token:address});
export const quoteRequest=z.object({chainId:z.literal(84532),creatorToken:address,amount:z.string().regex(/^\d+$/),slippageBps:z.number().int().min(1).max(1000),deadline:z.number().int().positive()});
export const acceptanceRequest=z.object({chainId:z.literal(84532),wallet:address,version:z.string().min(1).max(64),signature:z.string().regex(/^0x[a-fA-F0-9]+$/)});
export const siweVerifyRequest = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
});
