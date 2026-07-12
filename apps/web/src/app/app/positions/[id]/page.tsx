import { notFound } from "next/navigation";
import { PositionDetailPanel } from "@/components/position-detail-panel";

export default async function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <div>
    <p className="text-xs uppercase tracking-[.18em] text-primary">Position</p>
    <h1 className="mt-2 mb-8 font-mono text-3xl">#{id}</h1>
    <PositionDetailPanel id={BigInt(id)} />
  </div>;
}
