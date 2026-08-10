import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.discriminatedUnion("checkMode", [
  z.object({
    description: z.string().min(1),
    checkMode: z.enum(["literal", "regex"]),
    value: z.string().min(1),
  }),
  z.object({
    description: z.string().min(1),
    checkMode: z.literal("llm"),
    instruction: z.string().min(1),
  }),
]);

// Creates a suppression rule: rather than flagging new violations, it silences any flag
// (from any rule, or grammar) that matches its pattern. Like a proposed rule, this is a new
// employee interpretation, so it lands PENDING for admin sign-off rather than taking effect
// immediately.
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
  const { description } = parsed.data;
  const patternLogic =
    parsed.data.checkMode === "llm"
      ? { checkMode: parsed.data.checkMode, instruction: parsed.data.instruction }
      : { checkMode: parsed.data.checkMode, value: parsed.data.value };

  const rule = await prisma.rule.create({
    data: {
      clientId: flag.documentCheck.clientId,
      ruleType: "DISCRETE",
      category: flag.category,
      description,
      severity: flag.severity,
      patternLogic,
      status: "PENDING",
      isSuppression: true,
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
