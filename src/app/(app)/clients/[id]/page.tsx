import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";
import { RulesTable, type RuleRow } from "@/components/RulesTable";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const [rules, guides, needsReviewByGuide] = await Promise.all([
    prisma.rule.findMany({
      where: { clientId: id, status: "ACTIVE" },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    }),
    prisma.guide.findMany({
      where: { clientId: id },
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: true },
    }),
    prisma.rule.groupBy({
      by: ["guideId"],
      where: { clientId: id, status: "NEEDS_REVIEW", guideId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const needsReviewCountByGuideId = new Map(needsReviewByGuide.map((g) => [g.guideId, g._count._all]));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
          <p className="text-sm text-slate-500">{rules.length} active rules</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/check/new?clientId=${client.id}`}>
            <Button variant="secondary">Check a document</Button>
          </Link>
          <Link href={`/clients/${client.id}/guides/new`}>
            <Button>Upload style guide</Button>
          </Link>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Active rule set</h2>
        <RulesTable rules={rules as unknown as RuleRow[]} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Guide history</h2>
        {guides.length === 0 ? (
          <p className="text-sm text-slate-500">No guides uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {guides.map((guide) => {
              const needsReviewCount = needsReviewCountByGuideId.get(guide.id) ?? 0;
              return (
                <li key={guide.id} className="flex items-center justify-between py-2 text-sm">
                  <Link
                    href={`/clients/${client.id}/guides/${guide.id}/review`}
                    className="text-slate-800 underline-offset-2 hover:underline"
                  >
                    {guide.filename}
                  </Link>
                  <span className="flex items-center gap-2 text-slate-400">
                    {needsReviewCount > 0 && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review
                      </span>
                    )}
                    {guide.uploadedAt.toLocaleString()}
                    {guide.uploadedBy ? ` — ${guide.uploadedBy.email}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
