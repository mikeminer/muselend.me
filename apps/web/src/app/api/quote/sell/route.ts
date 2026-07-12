import { testnetQuote } from "@/lib/testnet-quote";

export async function POST(request: Request) {
  return testnetQuote(request, "sell");
}
