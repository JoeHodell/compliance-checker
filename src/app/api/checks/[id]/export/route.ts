import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { buildNotesDocx, type NoteFlag } from "@/lib/export/notesDocx";

// Downloads the checked document as a .docx with every ACCEPTED flag attached as a Word
// comment on the flagged passage.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const documentCheck = await prisma.documentCheck.findUnique({
    where: { id },
    include: { client: true, flags: { where: { status: "ACCEPTED" }, include: { rule: true } } },
  });
  if (!documentCheck) return NextResponse.json({ error: "Check not found" }, { status: 404 });
  if (documentCheck.flags.length === 0) {
    return NextResponse.json({ error: "Accept at least one flag to export notes." }, { status: 400 });
  }

  const flags: NoteFlag[] = documentCheck.flags.map((f) => {
    const source = f.rule?.source as { origin?: string; quote?: string } | undefined;
    return {
      category: f.category,
      severity: f.severity,
      location: f.location as NoteFlag["location"],
      message: f.message,
      ruleQuote: source?.origin === "guide" ? (source.quote ?? null) : null,
    };
  });

  const buffer = await buildNotesDocx({
    documentName: documentCheck.documentName,
    clientName: documentCheck.client.name,
    paragraphs: documentCheck.rawText.split("\n\n"),
    flags,
  });

  const baseName = documentCheck.documentName.replace(/\.[^./\\]+$/, "").replace(/[^\w.-]+/g, "_") || "document";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${baseName}-notes.docx"`,
    },
  });
}
