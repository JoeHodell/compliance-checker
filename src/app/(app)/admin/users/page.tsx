import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { UserRoleRow } from "@/components/UserRoleRow";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Users</h1>
      <p className="mb-6 text-sm text-slate-500">
        Any admin can promote or demote any other employee. At least one admin must remain.
      </p>

      <Card className="p-5">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-400">
              <th className="pb-2 pr-3">Email</th>
              <th className="pb-2 pr-3">Joined</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRoleRow
                key={user.id}
                user={{
                  id: user.id,
                  email: user.email,
                  role: user.role,
                  createdAt: user.createdAt.toISOString(),
                }}
                isSelf={user.id === admin.id}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
