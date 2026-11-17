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
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function resetPassword() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/users/${user.id}/reset-password`, { method: "POST" });
    setSaving(false);
    setConfirmingReset(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not reset password.");
      return;
    }
    const body = await res.json();
    setTempPassword(body.tempPassword);
    setCopied(false);
  }

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the password is visible on screen to copy by hand.
    }
  }

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
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-2">
            {!isSelf &&
              (user.role === "ADMIN" ? (
                <Button variant="secondary" onClick={() => setRole("EMPLOYEE")} disabled={saving}>
                  Remove admin
                </Button>
              ) : (
                <Button onClick={() => setRole("ADMIN")} disabled={saving}>
                  Make admin
                </Button>
              ))}
            {confirmingReset ? (
              <>
                <span className="self-center text-xs text-slate-500">Replace their password?</span>
                <Button variant="secondary" onClick={() => setConfirmingReset(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={resetPassword} disabled={saving}>
                  {saving ? "Resetting…" : "Confirm"}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingReset(true)} disabled={saving}>
                Reset password
              </Button>
            )}
          </div>
          {tempPassword && (
            <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-left text-xs text-amber-900">
              <p>
                Temporary password for {user.email} — shown once, share it securely:
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm select-all">{tempPassword}</code>
                <Button variant="secondary" onClick={copyPassword}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="ghost" onClick={() => setTempPassword(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
