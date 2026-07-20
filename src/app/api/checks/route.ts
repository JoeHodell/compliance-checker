import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseUploadedFile, parsePlainText } from "@/lib/parsing/extractText";
import { runDocumentCheck } from "@/lib/checking/runCheck";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const clientId = formData.get("clientId");
  const file = formData.get("file");
  const pastedText = formData.get("text");

  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Select a client." }, { status: 400 });
  }
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let parsed;
  let documentName: string;
  if (file instanceof File && file.size > 0) {
    parsed = await parseUploadedFile(file);
    documentName = file.name;
  } else if (typeof pastedText === "string" && pastedText.trim().length > 0) {
    parsed = parsePlainText(pastedText);
    documentName = "Pasted document";
  } else {
    return NextResponse.json({ error: "Provide a file or pasted text." }, { status: 400 });
  }

  if (parsed.paragraphs.length === 0) {
    return NextResponse.json({ error: "Could not find any text in that document." }, { status: 400 });
  }

  const documentCheck = await runDocumentCheck({
    clientId,
    documentName,
    paragraphs: parsed.paragraphs,
    rawText: parsed.rawText,
    uploadedById: user.id,
  });

  return NextResponse.json({ checkId: documentCheck.id });
}
