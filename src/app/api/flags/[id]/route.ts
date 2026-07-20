import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const patchSchema = z.object({
  status: z.enum(["ACCEPTED", "DISMISSED", "PENDING"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const flag = await prisma.flag.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolvedAt: new Date(),
      resolvedById: user.id,
    },
  });

  return NextResponse.json({ flag });
}
