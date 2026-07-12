import { ContentPage } from "@/components/content-page";

export default function Status() {
  return <ContentPage
    eyebrow="System status"
    title="Testnet preparation"
    intro="The application and protocol pass local and CI verification. External infrastructure and Base Sepolia deployment remain intentionally unprovisioned."
    sections={[
      { title: "Web application", body: "Production build, unit tests, accessibility checks and local-chain lifecycle E2E pass · Vercel deployment pending account authentication" },
      { title: "Base Sepolia contracts", body: "Deployment artifacts and guarded script are ready · no transaction has been signed or broadcast" },
      { title: "Indexer and database", body: "Schema and direct on-chain fallback are implemented · managed persistence is not provisioned" },
      { title: "Base Mainnet", body: "Disabled · independent audit, legal review and all launch gates remain incomplete" },
    ]}
  />;
}
