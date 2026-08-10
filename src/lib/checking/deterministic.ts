import type { Rule } from "@prisma/client";
import type { FlagCandidate } from "@/lib/checking/types";

type DiscretePatternLogic = {
  checkMode?: "regex" | "literal" | "llm";
  value?: string;
  instruction?: string;
};

type LookupPatternLogic = {
  terms?: { wrong: string; right: string }[];
};

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Acronyms (WHO, TB, PEPFAR) need case-sensitive matching — case-insensitive would
 * match ordinary lowercase words that happen to share the letters (e.g. "who"/"WHO"). */
export function buildTermRegex(term: string) {
  const isAcronymLike = /^[A-Z]{2,}$/.test(term.trim());
  return new RegExp(`\\b${escapeRegex(term)}\\b`, isAcronymLike ? "g" : "gi");
}

export function findMatches(paragraph: string, regex: RegExp) {
  const matches: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(paragraph)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) re.lastIndex++; // avoid infinite loop on zero-length matches
  }
  return matches;
}

/** Runs every ACTIVE discrete (regex/literal) rule and every lookup_table rule's term list against the document, deterministically. */
export function runDeterministicChecks(paragraphs: string[], rules: Rule[]): FlagCandidate[] {
  const candidates: FlagCandidate[] = [];

  for (const rule of rules) {
    if (rule.status !== "ACTIVE" || rule.isSuppression) continue;

    if (rule.ruleType === "DISCRETE") {
      const logic = rule.patternLogic as DiscretePatternLogic;
      if (!logic.value || logic.checkMode === "llm") continue;
      let regex: RegExp;
      try {
        regex =
          logic.checkMode === "regex" ? new RegExp(logic.value, "gi") : buildTermRegex(logic.value);
      } catch {
        continue; // skip rules with an invalid regex rather than failing the whole check
      }
      paragraphs.forEach((paragraph, paragraphIndex) => {
        for (const match of findMatches(paragraph, regex)) {
          candidates.push({
            ruleId: rule.id,
            flagSource: "CLIENT_RULE",
            category: rule.category,
            severity: rule.severity,
            location: { paragraphIndex, startOffset: match.start, endOffset: match.end },
            matchedText: match.text,
            message: rule.description,
          });
        }
      });
    }

    if (rule.ruleType === "LOOKUP_TABLE") {
      const logic = rule.patternLogic as LookupPatternLogic;
      for (const term of logic.terms ?? []) {
        if (!term.wrong) continue;
        // Skip no-op pairs (extraction occasionally emits wrong === right) — they'd only flag themselves.
        if (term.wrong.trim().toLowerCase() === (term.right ?? "").trim().toLowerCase()) continue;
        let regex: RegExp;
        try {
          regex = buildTermRegex(term.wrong);
        } catch {
          continue;
        }
        paragraphs.forEach((paragraph, paragraphIndex) => {
          for (const match of findMatches(paragraph, regex)) {
            candidates.push({
              ruleId: rule.id,
              flagSource: "CLIENT_RULE",
              category: rule.category,
              severity: rule.severity,
              location: { paragraphIndex, startOffset: match.start, endOffset: match.end },
              matchedText: match.text,
              message: `Prefer "${term.right}" over "${term.wrong}" (${rule.description}).`,
            });
          }
        });
      }
    }
  }

  return candidates;
}
