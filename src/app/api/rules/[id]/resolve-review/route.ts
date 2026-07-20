import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  action: z.enum(["replace", "discard"]),
});

/** Resolves a NEEDS_REVIEW rule created by a guide update that conflicted with an existing
 * active rule. "replace" activates the new rule and archives the one it supersedes; "discard"
 * archives the new rule and leaves the existing one untouched. Either way nothing is silently
 * overwritten — an employee made the call. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  if (rule.status !== "NEEDS_REVIEW") {
    return NextResponse.json({ error: "This rule isn't awaiting review." }, { status: 409 });
  }

  const source = rule.source as { supersedesRuleId?: string };

  if (parsed.data.action === "discard") {
    const updated = await prisma.rule.update({ where: { id }, data: { status: "ARCHIVED" } });
    return NextResponse.json({ rule: updated });
  }

  const updated = await prisma.rule.update({ where: { id }, data: { status: "ACTIVE" } });
  if (source.supersedesRuleId) {
    await prisma.rule.update({
      where: { id: source.supersedesRuleId },
      data: { status: "ARCHIVED" },
    });
  }
  return NextResponse.json({ rule: updated });
}
