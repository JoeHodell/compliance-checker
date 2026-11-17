import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FlagList, type FlagItem } from "@/components/FlagList";
import { extractContextSnippet } from "@/lib/checking/contextSnippet";

export default async function CheckResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const documentCheck = await prisma.documentCheck.findUnique({
    where: { id },
    include: { client: true, flags: true },
  });
  if (!documentCheck) notFound();

  // rawText was joined with "\n\n" between paragraphs when the document was parsed — reverse that
  // to look up the paragraph each flag's location refers to.
  const paragraphs = documentCheck.rawText.split("\n\n");

  const ruleIds = Array.from(
    new Set(documentCheck.flags.map((f) => f.ruleId).filter((id): id is string => Boolean(id)))
  );
  const rules = ruleIds.length > 0 ? await prisma.rule.findMany({ where: { id: { in: ruleIds } } }) : [];
  const ruleById = new Map(rules.map((r) => [r.id, r]));

  const flags: FlagItem[] = documentCheck.flags.map((f) => {
    const location = f.location as FlagItem["location"];
    const paragraph = paragraphs[location.paragraphIndex] ?? "";
    const rule = f.ruleId ? ruleById.get(f.ruleId) : undefined;
    const ruleSource = rule?.source as { origin?: string; quote?: string } | undefined;

    return {
      id: f.id,
      ruleId: f.ruleId,
      flagSource: f.flagSource,
      category: f.category,
      severity: f.severity,
      location,
      matchedText: f.matchedText,
      message: f.message,
      status: f.status,
      contextSnippet: extractContextSnippet(paragraph, location.startOffset, location.endOffset),
      // Only the client's own guide copy counts here — not the passage that prompted an
      // employee-proposed rule, which is a different kind of "source".
      ruleQuote: ruleSource?.origin === "guide" ? (ruleSource.quote ?? null) : null,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{documentCheck.documentName}</h1>
        <p className="text-sm text-slate-500">
          Checked against {documentCheck.client.name} — {documentCheck.uploadedAt.toLocaleString()}
        </p>
      </div>
      <FlagList checkId={documentCheck.id} flags={flags} />
    </div>
  );
}
