import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
export function EmptyState({ title, text }: { title: string; text: string }) { return <Card className="border-dashed border-white/12 bg-card/30"><CardContent className="flex min-h-52 flex-col items-center justify-center text-center"><Inbox className="mb-4 size-6 text-muted-foreground" /><h2 className="font-medium">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>; }
