"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CategoryBadge, SeverityBadge } from "@/components/ui";

export function PossiblyRemovedRule({
  rule,
}: {
  rule: { id: string; description: string; category: string; severity: "HARD" | "STYLE" };
}) {
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const [saving, setSaving] = useState(false);

  async function archive() {
    setSaving(true);
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setSaving(false);
    setArchived(true);
    router.refresh();
  }

  if (archived) {
    return <Card className="p-4 text-sm text-slate-500">Archived.</Card>;
  }

  return (
    <Card className="p-4">
      <div className="mb-1 flex gap-2">
        <CategoryBadge category={rule.category} />
        <SeverityBadge severity={rule.severity} />
      </div>
      <p className="text-sm text-slate-800">{rule.description}</p>
      <p className="mt-1 text-xs text-slate-400">
        Still active — this guide update didn&apos;t mention it, but it hasn&apos;t been touched automatically.
      </p>
      <div className="mt-3">
        <Button variant="secondary" onClick={archive} disabled={saving}>
          Archive
        </Button>
      </div>
    </Card>
  );
}
