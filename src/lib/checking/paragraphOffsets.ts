export type ParagraphBoundary = { index: number; start: number; end: number };

/** Joins paragraphs the same way parsing does ("\n\n" between them) and records each paragraph's absolute offset range, so absolute character offsets (e.g. from LanguageTool) can be mapped back to a paragraph + local offset. */
export function buildParagraphOffsets(paragraphs: string[]) {
  const boundaries: ParagraphBoundary[] = [];
  let cursor = 0;
  const parts: string[] = [];
  paragraphs.forEach((p, index) => {
    const start = cursor;
    const end = start + p.length;
    boundaries.push({ index, start, end });
    parts.push(p);
    cursor = end + 2; // account for the "\n\n" separator
  });
  return { text: parts.join("\n\n"), boundaries };
}

export function locateOffset(boundaries: ParagraphBoundary[], absoluteOffset: number) {
  for (const b of boundaries) {
    if (absoluteOffset >= b.start && absoluteOffset <= b.end) {
      return { paragraphIndex: b.index, localOffset: absoluteOffset - b.start };
    }
  }
  const last = boundaries[boundaries.length - 1];
  return { paragraphIndex: last?.index ?? 0, localOffset: 0 };
}
