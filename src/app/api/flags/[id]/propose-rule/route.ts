import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  description: z.string().min(1),
  category: z.enum([
    "BANNED_WORD",
    "REQUIRED_PHRASING",
    "TONE_VOICE",
    "STRUCTURAL_FORMATTING",
    "NAMING_CONVENTION",
    "POV_VOICE_RESTRICTION",
    "OTHER",
  ]),
  severity: z.enum(["HARD", "STYLE"]),
  checkMode: z.enum(["literal", "regex", "llm"]),
  value: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: flagId } = await params;
  const flag = await prisma.flag.findUnique({
    where: { id: flagId },
    include: { documentCheck: true },
  });
  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { description, category, severity, checkMode, value } = parsed.data;

  const patternLogic =
    checkMode === "llm"
      ? { checkMode: "llm", instruction: description }
      : { checkMode, value: value ?? flag.matchedText };

  // Net-new rule proposals from a document check need admin sign-off, unlike edits to
  // already-active guide-sourced rules — so this lands PENDING, not ACTIVE.
  const rule = await prisma.rule.create({
    data: {
      clientId: flag.documentCheck.clientId,
      ruleType: "DISCRETE",
      category,
      description,
      severity,
      patternLogic,
      status: "PENDING",
      proposedById: user.id,
      source: {
        origin: "proposed",
        quote: flag.matchedText,
        fromFlagId: flag.id,
      },
    },
  });

  return NextResponse.json({ rule });
}
