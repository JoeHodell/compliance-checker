import { prisma } from "@/lib/prisma";
import { runDeterministicChecks } from "@/lib/checking/deterministic";
import { runLlmChecks } from "@/lib/checking/llmCheck";
import { runGrammarCheck } from "@/lib/checking/grammar";
import { applySuppressions } from "@/lib/checking/suppression";

export async function runDocumentCheck({
  clientId,
  documentName,
  paragraphs,
  rawText,
  uploadedById,
}: {
  clientId: string;
  documentName: string;
  paragraphs: string[];
  rawText: string;
  uploadedById: string;
}) {
  const rules = await prisma.rule.findMany({ where: { clientId, status: "ACTIVE" } });

  // Each pass fails independently — e.g. the LLM pass being unavailable shouldn't
  // block deterministic/grammar flags (or vice versa) from still being reported.
  const [deterministicFlags, llmFlags, grammarFlags] = await Promise.all([
    Promise.resolve(runDeterministicChecks(paragraphs, rules)),
    runLlmChecks(paragraphs, rules).catch((err) => {
      console.error("LLM soft-rule check failed", err);
      return [];
    }),
    runGrammarCheck(paragraphs).catch((err) => {
      console.error("Grammar check failed", err);
      return [];
    }),
  ]);

  // Suppressions apply last, and across every source — a suppression rule can silence a
  // client-rule flag, an LLM soft-rule flag, or a grammar flag alike.
  const allFlags = await applySuppressions(
    [...deterministicFlags, ...llmFlags, ...grammarFlags],
    paragraphs,
    rules
  );

  const documentCheck = await prisma.documentCheck.create({
    data: {
      clientId,
      documentName,
      rawText,
      uploadedById,
      flags: {
        create: allFlags.map((flag) => ({
          ruleId: flag.ruleId,
          flagSource: flag.flagSource,
          category: flag.category,
          severity: flag.severity,
          location: flag.location,
          matchedText: flag.matchedText,
          message: flag.message,
        })),
      },
    },
  });

  return documentCheck;
}
