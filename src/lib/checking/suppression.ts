import type { Rule } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";
import { escapeRegex, findMatches } from "@/lib/checking/deterministic";
import { extractContextSnippet } from "@/lib/checking/contextSnippet";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import type { FlagCandidate } from "@/lib/checking/types";

type DiscretePatternLogic = { checkMode?: "regex" | "literal" | "llm"; value?: string; instruction?: string };

type SuppressedSpan = { paragraphIndex: number; start: number; end: number };

function spansOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && a.end > b.start;
}

/** Suppression matching is deliberately narrower than a normal DISCRETE rule: literal mode is
 * case-sensitive (exact match, not the acronym-aware case-insensitive matching used for
 * positive rules), so suppressing a lowercase false positive like "am" can't also swallow
 * legitimate uppercase matches like the "AM" in a flagged "10 AM". Regex mode still runs
 * case-insensitively, same as everywhere else — write case-specific patterns by hand if needed. */
function computeSuppressedSpans(paragraphs: string[], suppressionRules: Rule[]): SuppressedSpan[] {
  const spans: SuppressedSpan[] = [];
  for (const rule of suppressionRules) {
    const logic = rule.patternLogic as DiscretePatternLogic;
    if (!logic.value || logic.checkMode === "llm") continue;
    let regex: RegExp;
    try {
      regex =
        logic.checkMode === "regex"
          ? new RegExp(logic.value, "gi")
          : new RegExp(`\\b${escapeRegex(logic.value)}\\b`, "g");
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

const suppressFlagsTool: Anthropic.Tool = {
  name: "suppress_flags",
  description: "Report which candidate flags are false positives described by the given suppression instructions.",
  input_schema: {
    type: "object",
    properties: {
      suppressedIndices: {
        type: "array",
        items: { type: "integer", description: "0-based index of a candidate flag (from the numbered list) that should be silenced." },
      },
    },
    required: ["suppressedIndices"],
  },
};

const SUPPRESSION_SYSTEM_PROMPT = `You are reviewing a list of flagged passages from a document compliance check against a set of employee-written suppression instructions. Each instruction describes one specific situation where a flag is a false positive and should be silenced going forward — it is not a request to soften or disable the underlying rule generally.

For each candidate flag, decide whether any suppression instruction's described situation genuinely applies to that specific passage, given its context. Only include a flag's index if you are confident an instruction applies. Suppressing too aggressively defeats the point of the compliance check — if it's ambiguous, only loosely related, or the flag looks like a real violation despite superficially resembling the suppressed case, leave it out (i.e. leave the flag active).

Example: an instruction "don't flag 'am' as in 'I am' — that's not a time reference" should suppress a candidate flag on the word "am" used as a verb, but should NOT suppress a candidate flag on "10 AM" — that is exactly the kind of real violation the instruction is meant to leave untouched.`;

/** Runs candidate flags that survived deterministic suppression through active LLM-judgment
 * suppression rules, so an employee can describe a false-positive scenario in plain language
 * (e.g. "don't flag 'am' as the verb — just the time format") instead of having to craft an
 * exact literal/regex match. */
async function applyLlmSuppressions(
  candidates: FlagCandidate[],
  paragraphs: string[],
  llmSuppressionRules: Rule[]
): Promise<FlagCandidate[]> {
  if (llmSuppressionRules.length === 0 || candidates.length === 0) return candidates;

  const instructionList = llmSuppressionRules
    .map((r) => {
      const logic = r.patternLogic as DiscretePatternLogic;
      return `- ${logic.instruction ?? r.description}`;
    })
    .join("\n");

  const candidateList = candidates
    .map((c, i) => {
      const context = extractContextSnippet(paragraphs[c.location.paragraphIndex] ?? "", c.location.startOffset, c.location.endOffset);
      return `[${i}] matched text: "${c.matchedText}"\n    flag reason: ${c.message}\n    context: "${context}"`;
    })
    .join("\n");

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: SUPPRESSION_SYSTEM_PROMPT,
    tools: [suppressFlagsTool],
    tool_choice: { type: "tool", name: "suppress_flags" },
    messages: [
      {
        role: "user",
        content: `Suppression instructions:\n${instructionList}\n\nCandidate flags:\n${candidateList}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return candidates;

  const input = toolUse.input as { suppressedIndices?: number[] };
  const suppressed = new Set(input.suppressedIndices ?? []);
  return candidates.filter((_, i) => !suppressed.has(i));
}

/** Drops any candidate flag matched by an active suppression rule, regardless of which rule
 * (or grammar) produced the flag. Literal/regex suppressions are applied first (fast, exact);
 * remaining candidates are then checked against any LLM-judgment suppressions. */
export async function applySuppressions(
  candidates: FlagCandidate[],
  paragraphs: string[],
  rules: Rule[]
): Promise<FlagCandidate[]> {
  const suppressionRules = rules.filter((r) => r.status === "ACTIVE" && r.isSuppression);
  if (suppressionRules.length === 0) return candidates;

  const llmSuppressionRules = suppressionRules.filter(
    (r) => (r.patternLogic as DiscretePatternLogic).checkMode === "llm"
  );
  const patternSuppressionRules = suppressionRules.filter(
    (r) => (r.patternLogic as DiscretePatternLogic).checkMode !== "llm"
  );

  const suppressedSpans = computeSuppressedSpans(paragraphs, patternSuppressionRules);
  const afterPatternSuppression =
    suppressedSpans.length === 0
      ? candidates
      : candidates.filter(
          (flag) =>
            !suppressedSpans.some(
              (span) =>
                span.paragraphIndex === flag.location.paragraphIndex &&
                spansOverlap(span, { start: flag.location.startOffset, end: flag.location.endOffset })
            )
        );

  try {
    return await applyLlmSuppressions(afterPatternSuppression, paragraphs, llmSuppressionRules);
  } catch (err) {
    console.error("LLM suppression check failed", err);
    return afterPatternSuppression;
  }
}
