import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth";

// Unambiguous characters only (no 0/O, 1/l/I) so it's easy to read out or retype.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 14) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

// Admin-initiated reset: sets a fresh random password and returns it exactly once so the
// admin can pass it to the employee. Sessions are stateless cookies, so any existing
// session for that user stays valid until it expires.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tempPassword = generateTempPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword) } });

  return NextResponse.json({ email: target.email, tempPassword });
}
