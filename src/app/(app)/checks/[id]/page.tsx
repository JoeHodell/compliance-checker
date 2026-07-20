import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FlagList, type FlagItem } from "@/components/FlagList";

export default async function CheckResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const documentCheck = await prisma.documentCheck.findUnique({
    where: { id },
    include: { client: true, flags: true },
  });
  if (!documentCheck) notFound();

  const flags: FlagItem[] = documentCheck.flags.map((f) => ({
    id: f.id,
    ruleId: f.ruleId,
    flagSource: f.flagSource,
    category: f.category,
    severity: f.severity,
    location: f.location as FlagItem["location"],
    matchedText: f.matchedText,
    message: f.message,
    status: f.status,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{documentCheck.documentName}</h1>
        <p className="text-sm text-slate-500">
          Checked against {documentCheck.client.name} — {documentCheck.uploadedAt.toLocaleString()}
        </p>
      </div>
      <FlagList flags={flags} />
    </div>
  );
}
