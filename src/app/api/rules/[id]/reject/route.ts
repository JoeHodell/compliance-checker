import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  if (rule.status !== "PENDING") {
    return NextResponse.json({ error: "This rule isn't pending approval." }, { status: 409 });
  }

  // Rejected without ever being approved — status ARCHIVED with no approvedById distinguishes
  // this from a rule that was active and later archived.
  const updated = await prisma.rule.update({ where: { id }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ rule: updated });
}
