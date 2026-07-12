import { HedgeEpochPanel } from "@/components/hedge-epoch-panel";
import { PageHeading } from "@/components/page-heading";

export default function UnderwritePage() {
  return (
    <>
      <PageHeading
        eyebrow="Junior hedge"
        title="Underwrite a fixed epoch"
        description="Capital is locked while positions remain exposed. Premium and downside PnL come with the risk of losing capital when creator tokens rise."
      />
      <HedgeEpochPanel />
    </>
  );
}
