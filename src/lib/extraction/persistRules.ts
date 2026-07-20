import { prisma } from "@/lib/prisma";
import type { ExtractedRule } from "@/lib/extraction/extractRules";

const VALID_RULE_TYPES = new Set(["DISCRETE", "LOOKUP_TABLE"]);
const VALID_CATEGORIES = new Set([
  "BANNED_WORD",
  "REQUIRED_PHRASING",
  "TONE_VOICE",
  "STRUCTURAL_FORMATTING",
  "NAMING_CONVENTION",
  "POV_VOICE_RESTRICTION",
  "OTHER",
]);

/** Turns an ExtractedRule into the patternLogic JSON shape stored on Rule.patternLogic. */
function toPatternLogic(rule: ExtractedRule) {
  if (rule.ruleType === "LOOKUP_TABLE") {
    return { terms: rule.terms ?? [] };
  }
  if (rule.checkMode === "llm") {
    return { checkMode: "llm", instruction: rule.instruction ?? rule.description };
  }
  return { checkMode: rule.checkMode ?? "literal", value: rule.value ?? "" };
}

/** Coerces a rule's ruleType/category into the schema's enums rather than trusting the model's
 * output verbatim — the tool schema declares these as enums, but the model occasionally emits
 * a value outside it (e.g. "OTHER" for ruleType, which is only a valid category). */
function normalizeRule(rule: ExtractedRule): ExtractedRule {
  const ruleType = VALID_RULE_TYPES.has(rule.ruleType)
    ? rule.ruleType
    : rule.terms && rule.terms.length > 0
      ? "LOOKUP_TABLE"
      : "DISCRETE";
  const category = VALID_CATEGORIES.has(rule.category) ? rule.category : "OTHER";
  return { ...rule, ruleType, category };
}

export async function persistExtractedRules({
  clientId,
  guideId,
  rules,
}: {
  clientId: string;
  guideId: string;
  rules: ExtractedRule[];
}) {
  const normalized = rules
    .map(normalizeRule)
    .filter((rule) => rule.ruleType !== "LOOKUP_TABLE" || (rule.terms && rule.terms.length > 0));

  // "same" candidates restate an existing active rule with no meaningful difference — they're
  // matched (so the rule isn't flagged as possibly-removed) but don't need a new row.
  const toCreate = normalized.filter((rule) => rule.relation !== "same");
  const matchedRuleIds = new Set(
    normalized.map((rule) => rule.matchedRuleId).filter((id): id is string => Boolean(id))
  );

  const results = await Promise.allSettled(
    toCreate.map((rule) => {
      const isChanged = rule.relation === "changed" && rule.matchedRuleId;
      return prisma.rule.create({
        data: {
          clientId,
          guideId,
          ruleType: rule.ruleType,
          category: rule.category,
          description: rule.description,
          patternLogic: toPatternLogic(rule),
          severity: rule.severity,
          // A rule that updates an existing active one isn't silently applied — it needs an
          // employee to look at it before it takes over from the rule it supersedes.
          status: isChanged ? "NEEDS_REVIEW" : "ACTIVE",
          source: {
            origin: "guide",
            guideId,
            quote: rule.quote,
            ...(isChanged ? { supersedesRuleId: rule.matchedRuleId } : {}),
          },
        },
      });
    })
  );

  const created = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof prisma.rule.create>>> => r.status === "fulfilled")
    .map((r) => r.value);

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    // A handful of malformed rows shouldn't sink the rest of a guide's extraction.
    console.error(`${failures.length} extracted rule(s) failed to persist:`, failures);
  }

  return { created, matchedRuleIds: Array.from(matchedRuleIds) };
}
