import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { AdminQueueItem, type PendingRuleItem } from "@/components/AdminQueueItem";

export default async function AdminQueuePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const pending = await prisma.rule.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { client: true, proposedBy: true },
  });

  const items: PendingRuleItem[] = pending.map((rule) => ({
    id: rule.id,
    description: rule.description,
    category: rule.category,
    severity: rule.severity,
    clientName: rule.client.name,
    proposedByEmail: rule.proposedBy?.email ?? null,
    quote: (rule.source as { quote?: string }).quote ?? null,
    createdAt: rule.createdAt.toISOString(),
    isSuppression: rule.isSuppression,
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Admin queue</h1>
      <p className="mb-6 text-sm text-slate-500">
        Net-new rules proposed from document checks, across all clients. Guide-sourced rules and
        edits to active rules never land here — only brand-new interpretations need sign-off.
      </p>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">Nothing pending review.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AdminQueueItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
