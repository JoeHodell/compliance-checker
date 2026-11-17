import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseUploadedFile, parsePlainText } from "@/lib/parsing/extractText";
import { extractRulesFromGuide, type ExistingRuleRef } from "@/lib/extraction/extractRules";
import { persistExtractedRules } from "@/lib/extraction/persistRules";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("Could not read guide upload", err);
    return NextResponse.json(
      { error: "The upload could not be read — the file(s) may be too large or the upload was interrupted. Try again." },
      { status: 400 }
    );
  }
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const pastedText = formData.get("text");

  const paragraphs: string[] = [];
  const rawTextParts: string[] = [];
  const filenames: string[] = [];

  for (const file of files) {
    try {
      const parsedFile = await parseUploadedFile(file);
      paragraphs.push(...parsedFile.paragraphs);
      rawTextParts.push(parsedFile.rawText);
      filenames.push(file.name);
    } catch (err) {
      console.error(`Could not parse ${file.name}`, err);
      return NextResponse.json({ error: `Could not read "${file.name}" — is it a valid DOCX or PDF?` }, { status: 400 });
    }
  }
  if (typeof pastedText === "string" && pastedText.trim().length > 0) {
    const parsedText = parsePlainText(pastedText);
    paragraphs.push(...parsedText.paragraphs);
    rawTextParts.push(parsedText.rawText);
    filenames.push("Pasted text");
  }

  if (paragraphs.length === 0) {
    return NextResponse.json({ error: "Provide a file or pasted text." }, { status: 400 });
  }

  const guide = await prisma.guide.create({
    data: {
      clientId,
      filename: filenames.join(", "),
      rawText: rawTextParts.join("\n\n"),
      uploadedById: user.id,
    },
  });

  try {
    // If this client already has active rules, this is a guide update — pass them so
    // extraction can tell new content apart from restatements/changes of what's active.
    const existingRules: ExistingRuleRef[] = await prisma.rule.findMany({
      where: { clientId, status: "ACTIVE" },
      select: { id: true, category: true, description: true },
    });

    const extracted = await extractRulesFromGuide(paragraphs, existingRules);
    const { created, matchedRuleIds } = await persistExtractedRules({
      clientId,
      guideId: guide.id,
      rules: extracted,
    });

    if (existingRules.length > 0) {
      await prisma.guide.update({
        where: { id: guide.id },
        data: { diffSummary: { matchedRuleIds, priorActiveRuleIds: existingRules.map((r) => r.id) } },
      });
    }

    const activeCount = created.filter((r) => r.status === "ACTIVE").length;
    const needsReviewCount = created.filter((r) => r.status === "NEEDS_REVIEW").length;
    return NextResponse.json({
      guideId: guide.id,
      ruleCount: created.length,
      activeCount,
      needsReviewCount,
    });
  } catch (err) {
    // The guide itself is saved even if extraction fails, so it's not lost — but
    // report the failure clearly rather than pretending 0 rules was a real result.
    console.error("Rule extraction failed", err);
    const message = err instanceof Error ? err.message : "Rule extraction failed.";
    return NextResponse.json({ error: message, guideId: guide.id }, { status: 502 });
  }
}
