/** Extracts roughly one to two sentences of context around a match within a paragraph,
 * so a flag shows more than just the bare matched word/phrase in isolation. Falls back to
 * returning the whole paragraph if sentence boundaries can't be found. */
export function extractContextSnippet(paragraph: string, startOffset: number, endOffset: number): string {
  if (!paragraph) return "";

  const sentenceRegex = /[^.!?]*[.!?]+(?:\s+|$)|[^.!?]+$/g;
  const sentences: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(paragraph)) !== null) {
    if (match[0].length === 0) {
      sentenceRegex.lastIndex++;
      continue;
    }
    sentences.push({ start: match.index, end: match.index + match[0].length });
  }
  if (sentences.length === 0) return paragraph.trim();

  const containingIndex = sentences.findIndex((s) => startOffset < s.end && endOffset > s.start);
  const idx = containingIndex === -1 ? 0 : containingIndex;

  // Prefer the containing sentence plus the next one for a bit of extra context; if the match
  // falls in the last sentence, pull in the previous one instead so we still show two.
  const [windowStartIdx, windowEndIdx] =
    idx < sentences.length - 1 ? [idx, idx + 1] : [Math.max(0, idx - 1), idx];

  return paragraph.slice(sentences[windowStartIdx].start, sentences[windowEndIdx].end).trim();
}
