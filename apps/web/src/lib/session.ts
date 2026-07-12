import type { Redis } from "@upstash/redis";
import { timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

const encoder = new TextEncoder();
const SESSION_COOKIE = "ml_session";
export const NONCE_COOKIE = "ml_nonce";

export type WalletSession = {
  address: `0x${string}`;
  chainId: 84532;
  exp: number;
  csrf: string;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

function base64url(value: Uint8Array | string) {
  return Buffer.from(value).toString("base64url");
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

export async function createSessionToken(address: `0x${string}`) {
  const session: WalletSession = {
    address,
    chainId: 84532,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    csrf: crypto.randomUUID(),
  };
  const payload = base64url(JSON.stringify(session));
  return { token: `${payload}.${await signature(payload)}`, session };
}

export async function readSession(request: Request): Promise<WalletSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = await signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as WalletSession;
    if (session.chainId !== 84532 || session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(session.address) || !session.csrf) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60,
  });
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function nonceKey(nonce: string) {
  return `siwe:nonce:${nonce}`;
}

export async function consumeNonce(redis: Redis, nonce: string) {
  return (await redis.getdel<string>(nonceKey(nonce))) === "pending";
}

export function validCsrf(request: Request, session: WalletSession) {
  return request.headers.get("x-csrf-token") === session.csrf;
}
