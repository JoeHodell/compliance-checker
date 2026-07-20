import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const patchSchema = z.object({
  description: z.string().min(1).optional(),
  category: z
    .enum([
      "BANNED_WORD",
      "REQUIRED_PHRASING",
      "TONE_VOICE",
      "STRUCTURAL_FORMATTING",
      "NAMING_CONVENTION",
      "POV_VOICE_RESTRICTION",
      "OTHER",
    ])
    .optional(),
  severity: z.enum(["HARD", "STYLE"]).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  patternLogic: z.unknown().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  // Rule edits to already-active (guide-sourced or previously approved) rules never need approval.
  const updated = await prisma.rule.update({
    where: { id },
    data: parsed.data as Prisma.RuleUpdateInput,
  });

  return NextResponse.json({ rule: updated });
}
