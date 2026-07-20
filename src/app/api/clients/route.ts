import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  name: z.string().min(1, "Client name is required.").max(200),
});

// Self-serve client creation — any employee can onboard a new client, no admin gate,
// consistent with guide-sourced rules never needing approval either (Section 6.1a).
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "A client with that name already exists." }, { status: 409 });
  }

  const client = await prisma.client.create({ data: { name: parsed.data.name } });
  return NextResponse.json({ client });
}
