import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

type Bucket={count:number;reset:number}; const buckets=new Map<string,Bucket>();
export function requestContext(request:Request,limit=30,windowMs=60_000){const requestId=request.headers.get("x-request-id")??crypto.randomUUID();const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"local";const key=`${new URL(request.url).pathname}:${forwarded}`;const now=Date.now();const bucket=buckets.get(key);if(!bucket||bucket.reset<=now)buckets.set(key,{count:1,reset:now+windowMs});else{bucket.count++;if(bucket.count>limit)return {requestId,limited:true as const};}return {requestId,limited:false as const};}
export function apiError(requestId:string,status:number,code:string,message:string,details?:unknown){return NextResponse.json({error:{code,message,details},requestId},{status,headers:{"cache-control":"no-store","x-request-id":requestId}})}
export async function parseBody<T>(request:Request,schema:ZodType<T>,requestId:string):Promise<T|NextResponse>{try{const body=await request.json();return schema.parse(body)}catch(error){return apiError(requestId,400,"INVALID_REQUEST","Request validation failed",error instanceof ZodError?error.issues:undefined)}}
export function rateLimitResponse(requestId:string){return apiError(requestId,429,"RATE_LIMITED","Too many requests")}
