export type ParsedDocument = {
  paragraphs: string[];
  rawText: string;
};

function toParagraphs(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export async function parseDocxBuffer(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const paragraphs = toParagraphs(result.value);
  return { paragraphs, rawText: paragraphs.join("\n\n") };
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocument> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const paragraphs = toParagraphs(result.text);
    return { paragraphs, rawText: paragraphs.join("\n\n") };
  } finally {
    await parser.destroy();
  }
}

export function parsePlainText(text: string): ParsedDocument {
  const paragraphs = toParagraphs(text);
  return { paragraphs, rawText: paragraphs.join("\n\n") };
}

/** Parses an uploaded file (docx or pdf) based on its name/mimetype. */
export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    return parseDocxBuffer(buffer);
  }
  if (name.endsWith(".pdf") || file.type.includes("pdf")) {
    return parsePdfBuffer(buffer);
  }
  // Fall back to treating it as plain text.
  return parsePlainText(buffer.toString("utf-8"));
}
