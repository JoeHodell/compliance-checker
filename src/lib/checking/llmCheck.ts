import type { Rule } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import type { FlagCandidate } from "@/lib/checking/types";

type DiscretePatternLogic = { checkMode?: "regex" | "literal" | "llm"; instruction?: string };

const reportFlagsTool: Anthropic.Tool = {
  name: "report_flags",
  description: "Report every passage in the document that violates one of the given soft/judgment rules.",
  input_schema: {
    type: "object",
    properties: {
      flags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ruleId: { type: "string", description: "Must exactly match one of the provided rule ids." },
            paragraphIndex: { type: "integer", description: "0-based index of the paragraph (as numbered below) containing the violation." },
            quote: { type: "string", description: "A short verbatim excerpt from that paragraph showing the violation." },
            reason: { type: "string", description: "One sentence explaining why this violates the rule." },
          },
          required: ["ruleId", "paragraphIndex", "quote", "reason"],
        },
      },
    },
    required: ["flags"],
  },
};

const SYSTEM_PROMPT = `You are a meticulous copy editor checking a document against a client's soft/judgment style rules (tone, voice, point-of-view restrictions, and similar things that can't be checked with a simple pattern match).

For each rule, read the whole document and flag every passage that genuinely violates it. Be precise: quote only the specific offending excerpt, not the whole paragraph, and quote it VERBATIM — character-for-character from the document, since the quote is used to locate the flag.

Only call report_flags with passages you are confident are real violations. The "flags" array is your final answer, not a scratchpad — do not include an entry for a passage you considered and ruled out. If a passage complies with the rule, is a borderline judgment call you're not confident about, or doesn't actually appear in the document, leave it out entirely rather than including it with a reason explaining why it doesn't count. If nothing in the document violates a given rule, report nothing for that rule.

Bad example — never do this: including an entry whose "reason" is "This actually complies, not a violation" or "Compliant, skip" or "Not applicable, remove" or "placeholder". If you catch yourself writing a reason like that, delete the entire entry instead of including it. Every entry in "flags" must be a reason a human editor would act on, stated as a plain violation (e.g. "Uses jargon 'catchment area' instead of the preferred 'area'"), never as a note about why something was ruled out.`;

const SELF_NEGATING_PATTERNS = [
  /\bnot a violation\b/i,
  /\bcompliant\b/i,
  /\bchecks? out\b/i,
  /\bno violation\b/i,
  /\breconsider\b/i,
  /\bremove\b/i,
  /\bskip\b/i,
  /\bplaceholder\b/i,
  /\bnot applicable\b/i,
  /\bfalse flag\b/i,
  /\bnot present in\b/i,
  /\bexcluded\b/i,
  /\bactually\b/i,
];

function isSelfNegating(reason: string): boolean {
  return SELF_NEGATING_PATTERNS.some((pattern) => pattern.test(reason));
}

export async function runLlmChecks(paragraphs: string[], rules: Rule[]): Promise<FlagCandidate[]> {
  const llmRules = rules.filter((r) => {
    if (r.status !== "ACTIVE" || r.ruleType !== "DISCRETE") return false;
    const logic = r.patternLogic as DiscretePatternLogic;
    return logic.checkMode === "llm";
  });
  if (llmRules.length === 0 || paragraphs.length === 0) return [];

  const ruleList = llmRules
    .map((r) => {
      const logic = r.patternLogic as DiscretePatternLogic;
      return `- id: ${r.id}\n  severity: ${r.severity}\n  instruction: ${logic.instruction ?? r.description}`;
    })
    .join("\n");

  const numberedDoc = paragraphs.map((p, i) => `[${i}] ${p}`).join("\n\n");

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [reportFlagsTool],
    tool_choice: { type: "tool", name: "report_flags" },
    messages: [
      {
        role: "user",
        content: `Rules to check:\n${ruleList}\n\nDocument (numbered paragraphs):\n${numberedDoc}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return [];

  const input = toolUse.input as {
    flags?: { ruleId: string; paragraphIndex: number; quote: string; reason: string }[];
  };

  const ruleById = new Map(llmRules.map((r) => [r.id, r]));
  const candidates: FlagCandidate[] = [];
  for (const flag of input.flags ?? []) {
    const rule = ruleById.get(flag.ruleId);
    if (!rule) continue;
    const paragraph = paragraphs[flag.paragraphIndex] ?? "";
    const startOffset = paragraph.indexOf(flag.quote);
    // Drop hallucinated quotes rather than silently mislocating them at offset 0 —
    // a quote that isn't verbatim in its claimed paragraph isn't a real flag.
    if (startOffset === -1) continue;
    // Defensive net: despite instructions, the model occasionally includes an entry whose
    // own reasoning concludes it isn't a real violation. Catch that self-negating language
    // rather than surfacing it to the user as a genuine flag.
    if (isSelfNegating(flag.reason)) continue;
    candidates.push({
      ruleId: rule.id,
      flagSource: "CLIENT_RULE",
      category: rule.category,
      severity: rule.severity,
      location: {
        paragraphIndex: flag.paragraphIndex,
        startOffset,
        endOffset: startOffset + flag.quote.length,
      },
      matchedText: flag.quote,
      message: flag.reason,
    });
  }
  return candidates;
}
