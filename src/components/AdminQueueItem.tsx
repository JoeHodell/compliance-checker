"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CategoryBadge, Select, SeverityBadge, Textarea } from "@/components/ui";

const CATEGORY_OPTIONS = [
  "BANNED_WORD",
  "REQUIRED_PHRASING",
  "TONE_VOICE",
  "STRUCTURAL_FORMATTING",
  "NAMING_CONVENTION",
  "POV_VOICE_RESTRICTION",
  "OTHER",
];

function categoryLabel(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export type PendingRuleItem = {
  id: string;
  description: string;
  category: string;
  severity: "HARD" | "STYLE";
  clientName: string;
  proposedByEmail: string | null;
  quote: string | null;
  createdAt: string;
  isSuppression: boolean;
};

export function AdminQueueItem({ item }: { item: PendingRuleItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [category, setCategory] = useState(item.category);
  const [severity, setSeverity] = useState(item.severity);
  const [saving, setSaving] = useState(false);
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  async function saveEdits() {
    setSaving(true);
    await fetch(`/api/rules/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, category, severity }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function decide(action: "approve" | "reject") {
    setSaving(true);
    await fetch(`/api/rules/${item.id}/${action}`, { method: "POST" });
    setSaving(false);
    setResolved(action === "approve" ? "approved" : "rejected");
    router.refresh();
  }

  if (resolved) {
    const approvedText = item.isSuppression ? "Approved — now silencing matching flags." : "Approved — now active.";
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        {resolved === "approved" ? approvedText : "Rejected."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{item.clientName}</span>
        {item.isSuppression && (
          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
            Suppression
          </span>
        )}
        {editing ? (
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </Select>
        ) : (
          <CategoryBadge category={item.category} />
        )}
        {editing ? (
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as "HARD" | "STYLE")}>
            <option value="HARD">Hard rule</option>
            <option value="STYLE">Style preference</option>
          </Select>
        ) : (
          <SeverityBadge severity={item.severity} />
        )}
      </div>

      {editing ? (
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      ) : (
        <p className="text-sm text-slate-800">{item.description}</p>
      )}

      {item.quote && <p className="mt-1 text-xs italic text-slate-400">“{item.quote}”</p>}
      <p className="mt-1 text-xs text-slate-400">
        Proposed by {item.proposedByEmail ?? "unknown"} — {new Date(item.createdAt).toLocaleString()}
      </p>

      <div className="mt-3 flex gap-2">
        {editing ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdits} disabled={saving}>
              Save
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => decide("approve")} disabled={saving}>
              Approve
            </Button>
            <Button variant="danger" onClick={() => decide("reject")} disabled={saving}>
              Reject
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={saving}>
              Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
