import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";

export async function Nav() {
  const user = await requireUser();
  if (!user) return null;

  const pendingCount = user.role === "ADMIN" ? await prisma.rule.count({ where: { status: "PENDING" } }) : 0;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-slate-900">
            Style Guide Checker
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/" className="hover:text-slate-900">
              Clients
            </Link>
            <Link href="/check/new" className="hover:text-slate-900">
              Check a document
            </Link>
            {user.role === "ADMIN" && (
              <>
                <Link href="/admin/queue" className="hover:text-slate-900">
                  Admin queue
                  {pendingCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">
                      {pendingCount}
                    </span>
                  )}
                </Link>
                <Link href="/admin/users" className="hover:text-slate-900">
                  Users
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {user.email} <span className="text-slate-400">({user.role.toLowerCase()})</span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
