import { buildParagraphOffsets, locateOffset } from "@/lib/checking/paragraphOffsets";
import type { FlagCandidate } from "@/lib/checking/types";

type LanguageToolMatch = {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  rule: { id: string; description: string; category?: { id: string; name: string } };
};

type LanguageToolResponse = { matches: LanguageToolMatch[] };

/** Calls the self-hosted LanguageTool instance and maps its matches onto the same Flag shape used for client rules. */
export async function runGrammarCheck(paragraphs: string[]): Promise<FlagCandidate[]> {
  const baseUrl = process.env.LANGUAGETOOL_URL;
  if (!baseUrl) {
    console.warn("LANGUAGETOOL_URL is not set; skipping grammar/mechanical check.");
    return [];
  }

  const { text, boundaries } = buildParagraphOffsets(paragraphs);
  if (text.trim().length === 0) return [];

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/v2/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "en-US" }),
    });
  } catch (err) {
    // A grammar-flag false negative is far better than crashing the whole document check.
    console.error("LanguageTool request failed", err);
    return [];
  }

  if (!res.ok) {
    console.error("LanguageTool request failed", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as LanguageToolResponse;

  return data.matches.map((match) => {
    const { paragraphIndex, localOffset } = locateOffset(boundaries, match.offset);
    return {
      ruleId: null,
      flagSource: "GRAMMAR" as const,
      category: "GRAMMAR_MECHANICAL" as const,
      severity: "HARD" as const,
      location: {
        paragraphIndex,
        startOffset: localOffset,
        endOffset: localOffset + match.length,
      },
      matchedText: text.slice(match.offset, match.offset + match.length),
      message: match.message,
    };
  });
}
