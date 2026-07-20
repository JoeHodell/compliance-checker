import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import type Anthropic from "@anthropic-ai/sdk";

export type ExtractedRule = {
  ruleType: "DISCRETE" | "LOOKUP_TABLE";
  category:
    | "BANNED_WORD"
    | "REQUIRED_PHRASING"
    | "TONE_VOICE"
    | "STRUCTURAL_FORMATTING"
    | "NAMING_CONVENTION"
    | "POV_VOICE_RESTRICTION"
    | "OTHER";
  description: string;
  severity: "HARD" | "STYLE";
  quote: string;
  checkMode?: "regex" | "literal" | "llm";
  value?: string;
  instruction?: string;
  terms?: { wrong: string; right: string }[];
  /** Only meaningful when existing rules were passed in (a guide update, not a first upload). */
  relation?: "new" | "same" | "changed";
  /** Set when relation is "same" or "changed" — the existing rule this candidate corresponds to. */
  matchedRuleId?: string;
};

export type ExistingRuleRef = { id: string; category: string; description: string };

const CHUNK_SIZE = 100;

export function chunkParagraphs(paragraphs: string[], chunkSize = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    chunks.push(paragraphs.slice(i, i + chunkSize).join("\n"));
  }
  return chunks;
}

const RULE_CATEGORIES = [
  "BANNED_WORD",
  "REQUIRED_PHRASING",
  "TONE_VOICE",
  "STRUCTURAL_FORMATTING",
  "NAMING_CONVENTION",
  "POV_VOICE_RESTRICTION",
  "OTHER",
] as const;

const proposeRulesTool: Anthropic.Tool = {
  name: "propose_rules",
  description:
    "Propose a structured, checkable style rule set extracted from this chunk of a client's style guide.",
  input_schema: {
    type: "object",
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ruleType: {
              type: "string",
              enum: ["DISCRETE", "LOOKUP_TABLE"],
              description:
                "DISCRETE for a single checkable rule (a banned word, a capitalization rule, a tone instruction). LOOKUP_TABLE for a set of many term-pair swaps or proper-noun/facility-name spellings bundled into ONE record — use this whenever the guide lists more than ~4 similar wrong->right term pairs, instead of creating one DISCRETE rule per term.",
            },
            category: {
              type: "string",
              enum: [...RULE_CATEGORIES],
            },
            description: {
              type: "string",
              description: "Human-readable summary of the rule, written for an editor to skim.",
            },
            severity: {
              type: "string",
              enum: ["HARD", "STYLE"],
              description:
                "HARD for objective, unambiguous rules (banned words, required capitalization/punctuation, factual naming). STYLE for tone/voice preferences that require judgment.",
            },
            quote: {
              type: "string",
              description: "A short verbatim quote from this guide chunk that is the source of this rule.",
            },
            checkMode: {
              type: "string",
              enum: ["regex", "literal", "llm"],
              description:
                "DISCRETE rules only. 'literal' for an exact banned/required word or phrase match. 'regex' for a pattern (e.g. detecting em-dashes, date formats). 'llm' for fuzzy tone/voice/POV rules that need human-like judgment rather than pattern matching.",
            },
            value: {
              type: "string",
              description: "DISCRETE rules with checkMode 'literal' or 'regex' only: the literal string or regex pattern to search for.",
            },
            instruction: {
              type: "string",
              description: "DISCRETE rules with checkMode 'llm' only: a clear natural-language instruction describing what to flag.",
            },
            terms: {
              type: "array",
              description: "LOOKUP_TABLE rules only: the full list of term-pairs this record bundles.",
              items: {
                type: "object",
                properties: {
                  wrong: { type: "string" },
                  right: { type: "string" },
                },
                required: ["wrong", "right"],
              },
            },
            relation: {
              type: "string",
              enum: ["new", "same", "changed"],
              description:
                "Only set this when a list of EXISTING ACTIVE RULES was provided above. 'new' if this rule has no corresponding existing rule. 'same' if it restates an existing rule with no meaningful difference (a duplicate — still extract it so it's not lost, but mark it 'same'). 'changed' if it corresponds to an existing rule but the specifics differ (different wording, different pattern, updated preference). Omit entirely if no existing rules were provided.",
            },
            matchedRuleId: {
              type: "string",
              description:
                "Required when relation is 'same' or 'changed': the exact id of the existing rule this one corresponds to, copied from the provided list.",
            },
          },
          required: ["ruleType", "category", "description", "severity", "quote"],
        },
      },
    },
    required: ["rules"],
  },
};

const SYSTEM_PROMPT = `You are helping an editorial team at an agency convert a client's prose style guide into a structured, machine-checkable rule set.

Extract ONLY actionable, checkable style/usage rules that a document reviewer would want flagged when violated: banned or preferred words/phrases, capitalization rules, punctuation/formatting rules, tone/voice guidance, POV or voice restrictions, naming conventions, structural requirements.

Do NOT extract pure reference/informational content that isn't a checkable rule: general glossary definitions of technical/medical/subject-matter terms explained purely for the reader's understanding, acronym expansion lists with no usage instruction, biographical facts, mission statements, boilerplate marketing copy, or narrative history — unless the entry also contains an explicit usage instruction (e.g. "prefer X over Y", "always capitalize", "avoid this term"), in which case extract just that usage instruction.

When the guide lists many similar word-swap pairs (e.g. a "plain language" cheat sheet) or many proper-noun/facility/place-name spellings in a row, bundle ALL of them into a single LOOKUP_TABLE rule with all term-pairs in "terms", rather than creating a separate DISCRETE rule per term. Only use DISCRETE for a standalone rule (a single banned word, a single formatting convention, a tone instruction).

LOOKUP_TABLE term pairs are for unconditional word swaps only ("always write X as Y") — a "wrong" term should never be a value the document is allowed to use at all. Do NOT put an acronym in a LOOKUP_TABLE as "wrong" when the guide's actual rule is "spell out on first reference, abbreviate on later references" (e.g. PEPFAR, WHO) — that is a first-reference rule, not a banned term, so either skip it or extract it as a DISCRETE rule with checkMode "llm" describing the first-reference/subsequent-reference distinction. Never extract a term pair where "wrong" and "right" are the same word.

Do NOT extract generic proofreading-checklist reminders that tell a human editor to "double check" or "review" something for internal consistency (e.g. "double check consistent use of dashes," "check spacing is consistent") — these have no specific checkable pattern and would fire on every instance of the thing being reviewed, which isn't useful as an automated flag. Only extract a rule when the guide states a specific, checkable preference (e.g. "use an em dash, not two hyphens").

Every rule must include a short verbatim "quote" from the guide text it was derived from.

If this chunk of the guide contains no extractable rules, call the tool with an empty "rules" array.

If a list of the client's EXISTING ACTIVE RULES is provided below, this is an updated guide version for a client we already have rules for — set "relation" and "matchedRuleId" on every extracted rule as described in the tool schema, so we can tell what's genuinely new versus what updates or restates something already active. Match generously by meaning, not exact wording — a rule about the same word/topic with different phrasing is still "same" or "changed", not "new".`;

export async function extractRulesFromChunk(
  chunkText: string,
  existingRules: ExistingRuleRef[] = []
): Promise<ExtractedRule[]> {
  const client = getAnthropicClient();
  const existingRulesBlock =
    existingRules.length > 0
      ? `\n\nExisting active rules for this client (match against these for "relation"/"matchedRuleId"):\n${existingRules
          .map((r) => `- id: ${r.id}\n  category: ${r.category}\n  description: ${r.description}`)
          .join("\n")}`
      : "";

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [proposeRulesTool],
    tool_choice: { type: "tool", name: "propose_rules" },
    messages: [
      {
        role: "user",
        content: `Here is a chunk of the client's style guide:\n\n---\n${chunkText}\n---${existingRulesBlock}`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens") {
    // The tool call was cut off mid-generation — surface this rather than silently
    // returning whatever partial (and likely unparseable) rules made it through.
    console.error(
      `Rule extraction hit max_tokens for a chunk (${chunkText.length} chars) — some rules from this chunk were likely dropped.`
    );
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return [];
  const input = toolUse.input as { rules?: ExtractedRule[] };
  const rules = input.rules ?? [];
  console.log(`Chunk (${chunkText.length} chars) → ${rules.length} rules, stop_reason=${message.stop_reason}`);
  return rules;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractRulesFromChunkWithRetry(
  chunk: string,
  existingRules: ExistingRuleRef[],
  maxAttempts = 3
): Promise<ExtractedRule[]> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await extractRulesFromChunk(chunk, existingRules);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const retryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status);
      if (!retryable || attempt === maxAttempts) throw err;
      const delayMs = 2000 * attempt;
      console.warn(`Chunk extraction hit a transient error (status ${status}), retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
  return []; // unreachable — the loop above always returns or throws
}

export async function extractRulesFromGuide(
  paragraphs: string[],
  existingRules: ExistingRuleRef[] = []
): Promise<ExtractedRule[]> {
  const chunks = chunkParagraphs(paragraphs);
  const results: ExtractedRule[] = [];
  let failures = 0;
  for (const chunk of chunks) {
    try {
      const rules = await extractRulesFromChunkWithRetry(chunk, existingRules);
      results.push(...rules);
    } catch (err) {
      // Keep extracting the rest of the guide even if one chunk's call fails transiently.
      failures++;
      console.error("Rule extraction failed for one guide chunk", err);
    }
  }
  if (failures > 0 && results.length === 0) {
    throw new Error(
      `Rule extraction failed for all ${failures} chunk(s) of this guide. Check ANTHROPIC_API_KEY and try again.`
    );
  }
  return results;
}
