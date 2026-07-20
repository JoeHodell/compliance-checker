"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export type UserRow = {
  id: string;
  email: string;
  role: "EMPLOYEE" | "ADMIN";
  createdAt: string;
};

export function UserRoleRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setRole(role: "EMPLOYEE" | "ADMIN") {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/users/${user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update role.");
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-3 text-sm text-slate-800">
        {user.email} {isSelf && <span className="text-slate-400">(you)</span>}
      </td>
      <td className="py-3 pr-3 text-sm text-slate-500">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="py-3 pr-3">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            user.role === "ADMIN"
              ? "border-slate-300 bg-slate-100 text-slate-700"
              : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          {user.role === "ADMIN" ? "Admin" : "Employee"}
        </span>
      </td>
      <td className="py-3 text-right">
        {isSelf ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            {user.role === "ADMIN" ? (
              <Button variant="secondary" onClick={() => setRole("EMPLOYEE")} disabled={saving}>
                {saving ? "Saving…" : "Remove admin"}
              </Button>
            ) : (
              <Button onClick={() => setRole("ADMIN")} disabled={saving}>
                {saving ? "Saving…" : "Make admin"}
              </Button>
            )}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
