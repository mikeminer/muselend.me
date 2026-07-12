import { PageHeading } from "@/components/page-heading";
import { SeniorVaultPanel } from "@/components/senior-vault-panel";

export default function LendPage() {
  return (
    <>
      <PageHeading
        eyebrow="Senior vault"
        title="Supply native USDC"
        description="ERC-4626 shares accrue realized borrower interest. Withdrawals depend on available cash; queued claims are not instantly liquid."
      />
      <SeniorVaultPanel />
    </>
  );
}
