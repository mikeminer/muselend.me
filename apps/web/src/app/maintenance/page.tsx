import { ContentPage } from "@/components/content-page";

export default function MaintenancePage() {
  return <ContentPage
    eyebrow="Maintenance"
    title="MuseLend is temporarily read-only"
    intro="New product actions are paused while operators investigate or deploy a reviewed release. No wallet transaction should be requested from this page."
    sections={[
      { title: "Funds and positions", body: "The blockchain remains authoritative. Existing contracts are not controlled by this website maintenance switch." },
      { title: "Updates", body: "Use the public status, risk and legal pages while the application and transactional APIs are unavailable." },
    ]}
  />;
}
