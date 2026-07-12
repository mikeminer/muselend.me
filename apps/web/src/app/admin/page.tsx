import { AdminConsole } from "@/components/admin-console";
import { PageHeading } from "@/components/page-heading";

export default function Admin() {
  return <>
    <PageHeading eyebrow="Governance" title="Protocol administration" description="Read roles and bounded risk state directly from Base Sepolia. Writes require the matching on-chain role and a successful wallet-specific simulation." />
    <AdminConsole />
  </>;
}
