import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { parseDocxBuffer } from "../src/lib/parsing/extractText";
import { extractRulesFromGuide } from "../src/lib/extraction/extractRules";
import { persistExtractedRules } from "../src/lib/extraction/persistRules";

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findUnique({ where: { name: "Partners In Health" } });
  if (!client) throw new Error("PIH client not found — run the seed script first.");

  // Reset to a clean slate: drop the excerpt-based test guide/rules/checks before the real run.
  await prisma.flag.deleteMany({ where: { documentCheck: { clientId: client.id } } });
  await prisma.documentCheck.deleteMany({ where: { clientId: client.id } });
  await prisma.rule.deleteMany({ where: { clientId: client.id } });
  await prisma.guide.deleteMany({ where: { clientId: client.id } });
  console.log("Cleared prior test guides/rules/checks for PIH.");

  const buffer = fs.readFileSync("/Users/joe/Code/ComplianceChecker/PIH_Writing_Style_Guide.docx");
  const parsed = await parseDocxBuffer(buffer);
  console.log(`Parsed ${parsed.paragraphs.length} paragraphs from the real guide docx.`);

  const guide = await prisma.guide.create({
    data: {
      clientId: client.id,
      filename: "PIH_Writing_Style_Guide.docx",
      rawText: parsed.rawText,
    },
  });
  console.log(`Created guide record ${guide.id}. Starting chunked extraction (this takes several minutes)...`);

  const extracted = await extractRulesFromGuide(parsed.paragraphs);
  console.log(`Extraction returned ${extracted.length} candidate rules.`);

  const { created } = await persistExtractedRules({ clientId: client.id, guideId: guide.id, rules: extracted });
  console.log(`Persisted ${created.length} active rules.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
