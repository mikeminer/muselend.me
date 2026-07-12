export const chains = {
  base: {
    id: 8453,
    name: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    enabled: false,
  },
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    enabled: true,
  },
} as const;

export const product = {
  name: "MuseLend",
  domain: "muselend.me",
  tagline: "Unlock USDC from your creator token.",
} as const;
