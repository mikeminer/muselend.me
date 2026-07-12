import {createConfig,http} from "wagmi";import {baseSepolia} from "wagmi/chains";import {coinbaseWallet,injected,walletConnect} from "wagmi/connectors";
const projectId=process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;const connectors=[injected({shimDisconnect:true}),coinbaseWallet({appName:"MuseLend"}),...(projectId?[walletConnect({projectId})]:[])];
export const wagmiConfig=createConfig({chains:[baseSepolia],connectors,ssr:true,transports:{[baseSepolia.id]:http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL??"https://sepolia.base.org")}});
