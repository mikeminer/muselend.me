import {unavailableQuote} from "@/lib/quote-response";export async function POST(request:Request){return unavailableQuote(request,"buy-exact-input")}
