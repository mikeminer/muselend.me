import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
export default function OverviewPage() { return <><PageHeading eyebrow="Portfolio" title="Your MuseLend overview" description="Positions, vault deposits, hedge epochs and activity derived from Base Sepolia." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Net position" value="0 USDC" detail="Wallet not connected" /><MetricCard label="Debt" value="0 USDC" detail="No active positions" /><MetricCard label="Senior shares" value="0" detail="No vault deposits" /><MetricCard label="Junior capital" value="0 USDC" detail="No epoch exposure" /></div><div className="mt-8"><EmptyState title="No on-chain activity yet" text="Connect a wallet on Base Sepolia after contracts are deployed to open a position or supply a vault." /><Button asChild className="mt-4"><Link href="/app/borrow">Review a borrow quote <ArrowRight /></Link></Button></div></>; }
