import { testnetBuyQuote } from "@/lib/testnet-quote";

export async function POST(request: Request) {
  return testnetBuyQuote(request, "buy-exact-input");
}
