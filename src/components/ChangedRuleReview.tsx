"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CategoryBadge, SeverityBadge } from "@/components/ui";

export type ChangedRulePair = {
  newRule: { id: string; description: string; category: string; severity: "HARD" | "STYLE" };
  oldRule: { id: string; description: string; category: string; severity: "HARD" | "STYLE" } | null;
};

export function ChangedRuleReview({ newRule, oldRule }: ChangedRulePair) {
  const router = useRouter();
  const [resolved, setResolved] = useState<"replace" | "discard" | null>(null);
  const [saving, setSaving] = useState(false);

  async function resolve(action: "replace" | "discard") {
    setSaving(true);
    await fetch(`/api/rules/${newRule.id}/resolve-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setSaving(false);
    setResolved(action);
    router.refresh();
  }

  if (resolved) {
    return (
      <Card className="p-4 text-sm text-slate-500">
        {resolved === "replace" ? "Replaced the old rule with this update." : "Discarded — kept the existing rule."}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-slate-400">Updated (from new guide)</p>
          <div className="mb-1 flex gap-2">
            <CategoryBadge category={newRule.category} />
            <SeverityBadge severity={newRule.severity} />
          </div>
          <p className="text-sm text-slate-800">{newRule.description}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-slate-400">Currently active</p>
          {oldRule ? (
            <>
              <div className="mb-1 flex gap-2">
                <CategoryBadge category={oldRule.category} />
                <SeverityBadge severity={oldRule.severity} />
              </div>
              <p className="text-sm text-slate-800">{oldRule.description}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">(no longer available)</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => resolve("replace")} disabled={saving}>
          Replace with update
        </Button>
        <Button variant="secondary" onClick={() => resolve("discard")} disabled={saving}>
          Keep existing rule
        </Button>
      </div>
    </Card>
  );
}
