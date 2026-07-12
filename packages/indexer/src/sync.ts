export type Hex=`0x${string}`;
export type ChainLog={blockNumber:bigint;blockHash:Hex;transactionHash:Hex;logIndex:number;address:Hex;topics:Hex[];data:Hex;removed?:boolean};
export type Block={number:bigint;hash:Hex;parentHash:Hex};
export interface ReadClient{getBlock(args:{blockNumber:bigint}):Promise<Block>;getLogs(args:{fromBlock:bigint;toBlock:bigint;address?:Hex[]}):Promise<ChainLog[]>;}
export interface IndexStore{cursor(chainId:number):Promise<{blockNumber:bigint;blockHash:Hex}|null>;blockHash(chainId:number,blockNumber:bigint):Promise<Hex|null>;rollback(chainId:number,fromBlock:bigint):Promise<void>;insertLogs(chainId:number,logs:ChainLog[]):Promise<void>;saveCursor(chainId:number,block:Block):Promise<void>;}
export type SyncOptions={chainId:number;deploymentBlock:bigint;confirmations:bigint;pageSize:bigint;addresses?:Hex[]};

/// Idempotent, paginated and reorg-aware synchronization. It never signs transactions.
export async function syncEvents(client:ReadClient,store:IndexStore,latestBlock:bigint,options:SyncOptions){
  const safeHead=latestBlock>options.confirmations?latestBlock-options.confirmations:0n;let cursor=await store.cursor(options.chainId);
  if(cursor){const canonical=await client.getBlock({blockNumber:cursor.blockNumber});if(canonical.hash!==cursor.blockHash){let ancestor=cursor.blockNumber;while(ancestor>options.deploymentBlock){ancestor--;const [known,chain]=await Promise.all([store.blockHash(options.chainId,ancestor),client.getBlock({blockNumber:ancestor})]);if(known===chain.hash)break;}await store.rollback(options.chainId,ancestor+1n);cursor=ancestor>=options.deploymentBlock?{blockNumber:ancestor,blockHash:(await client.getBlock({blockNumber:ancestor})).hash}:null;}}
  let from=cursor?cursor.blockNumber+1n:options.deploymentBlock;while(from<=safeHead){const to=from+options.pageSize-1n>safeHead?safeHead:from+options.pageSize-1n;const logs=await client.getLogs({fromBlock:from,toBlock:to,address:options.addresses});await store.insertLogs(options.chainId,logs);await store.saveCursor(options.chainId,await client.getBlock({blockNumber:to}));from=to+1n;}
  return {safeHead,fromBlock:cursor?.blockNumber??options.deploymentBlock,indexedThrough:safeHead};
}
