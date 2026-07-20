import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";
import { RulesTable, type RuleRow } from "@/components/RulesTable";
import { ChangedRuleReview } from "@/components/ChangedRuleReview";
import { PossiblyRemovedRule } from "@/components/PossiblyRemovedRule";

export default async function GuideReviewPage({
  params,
}: {
  params: Promise<{ id: string; guideId: string }>;
}) {
  const { id: clientId, guideId } = await params;
  const guide = await prisma.guide.findUnique({ where: { id: guideId } });
  if (!guide || guide.clientId !== clientId) notFound();

  const rules = await prisma.rule.findMany({
    where: { guideId },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });

  const newRules = rules.filter((r) => r.status === "ACTIVE");
  const changedRules = rules.filter((r) => r.status === "NEEDS_REVIEW");

  const hardCount = newRules.filter((r) => r.severity === "HARD").length;
  const lookupCount = newRules.filter((r) => r.ruleType === "LOOKUP_TABLE").length;

  // Old rules referenced by changed candidates, for the side-by-side comparison.
  const oldRuleIds = changedRules
    .map((r) => (r.source as { supersedesRuleId?: string }).supersedesRuleId)
    .filter((id): id is string => Boolean(id));
  const oldRules = oldRuleIds.length > 0 ? await prisma.rule.findMany({ where: { id: { in: oldRuleIds } } }) : [];
  const oldRuleById = new Map(oldRules.map((r) => [r.id, r]));

  // Rules that were active before this guide but weren't matched by anything in it —
  // surfaced for review rather than silently left alone or auto-archived.
  const diffSummary = guide.diffSummary as
    | { matchedRuleIds?: string[]; priorActiveRuleIds?: string[] }
    | null;
  let possiblyRemoved: typeof rules = [];
  if (diffSummary?.priorActiveRuleIds) {
    const matched = new Set(diffSummary.matchedRuleIds ?? []);
    const removedCandidateIds = diffSummary.priorActiveRuleIds.filter((id) => !matched.has(id));
    if (removedCandidateIds.length > 0) {
      possiblyRemoved = await prisma.rule.findMany({
        where: { id: { in: removedCandidateIds }, status: "ACTIVE" },
      });
    }
  }

  const isUpdate = Boolean(diffSummary);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Extracted from &ldquo;{guide.filename}&rdquo;
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {newRules.length} new rule{newRules.length === 1 ? "" : "s"} {isUpdate ? "added and" : ""} already
          active ({hardCount} hard, {newRules.length - hardCount} style preference, {lookupCount}{" "}
          lookup-table){isUpdate && changedRules.length > 0 ? `, ${changedRules.length} flagged as changed` : ""}
          . Skim and edit anything that looks off — nothing here is blocked on review.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Newly active rules</h2>
        <RulesTable rules={newRules as unknown as RuleRow[]} />
      </Card>

      {changedRules.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Changed — needs a quick look</h2>
          <p className="mb-3 text-sm text-slate-500">
            These update an existing active rule with different wording or logic. Nothing here has
            taken effect yet — pick which version should apply.
          </p>
          <div className="space-y-3">
            {changedRules.map((rule) => (
              <ChangedRuleReview
                key={rule.id}
                newRule={rule}
                oldRule={oldRuleById.get((rule.source as { supersedesRuleId?: string }).supersedesRuleId ?? "") ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {possiblyRemoved.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Possibly removed</h2>
          <p className="mb-3 text-sm text-slate-500">
            These were active before this update but weren&apos;t found anywhere in the new guide
            content. They&apos;re still active — archive them if the client&apos;s guide really did
            drop them, or leave them if this is just a gap in the update.
          </p>
          <div className="space-y-3">
            {possiblyRemoved.map((rule) => (
              <PossiblyRemovedRule key={rule.id} rule={rule} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link href={`/clients/${clientId}`}>
          <Button>Done — go to client page</Button>
        </Link>
      </div>
    </div>
  );
}
