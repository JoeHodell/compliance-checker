import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const bodySchema = z.object({
  role: z.enum(["EMPLOYEE", "ADMIN"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.id === admin.id) {
    return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
  }

  if (target.role === "ADMIN" && parsed.data.role === "EMPLOYEE") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "At least one admin must remain." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user: updated });
}
