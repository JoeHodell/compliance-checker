import type { Rule } from "@prisma/client";
import { buildTermRegex, findMatches } from "@/lib/checking/deterministic";
import type { FlagCandidate } from "@/lib/checking/types";

type DiscretePatternLogic = { checkMode?: "regex" | "literal" | "llm"; value?: string };

type SuppressedSpan = { paragraphIndex: number; start: number; end: number };

function spansOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && a.end > b.start;
}

/** Suppression rules are matched exactly like DISCRETE literal/regex rules, but the resulting
 * spans are used to filter flags out rather than create new ones. */
function computeSuppressedSpans(paragraphs: string[], suppressionRules: Rule[]): SuppressedSpan[] {
  const spans: SuppressedSpan[] = [];
  for (const rule of suppressionRules) {
    const logic = rule.patternLogic as DiscretePatternLogic;
    if (!logic.value || logic.checkMode === "llm") continue;
    let regex: RegExp;
    try {
      regex = logic.checkMode === "regex" ? new RegExp(logic.value, "gi") : buildTermRegex(logic.value);
    } catch {
      continue; // an invalid regex here just means this suppression rule does nothing
    }
    paragraphs.forEach((paragraph, paragraphIndex) => {
      for (const match of findMatches(paragraph, regex)) {
        spans.push({ paragraphIndex, start: match.start, end: match.end });
      }
    });
  }
  return spans;
}

/** Drops any candidate flag whose location overlaps an active suppression rule's match,
 * regardless of which rule (or grammar) produced the flag. */
export function applySuppressions(
  candidates: FlagCandidate[],
  paragraphs: string[],
  rules: Rule[]
): FlagCandidate[] {
  const suppressionRules = rules.filter((r) => r.status === "ACTIVE" && r.isSuppression);
  if (suppressionRules.length === 0) return candidates;

  const suppressedSpans = computeSuppressedSpans(paragraphs, suppressionRules);
  if (suppressedSpans.length === 0) return candidates;

  return candidates.filter(
    (flag) =>
      !suppressedSpans.some(
        (span) =>
          span.paragraphIndex === flag.location.paragraphIndex &&
          spansOverlap(span, { start: flag.location.startOffset, end: flag.location.endOffset })
      )
  );
}
