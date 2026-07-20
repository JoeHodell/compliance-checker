"use client";

import { useState } from "react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

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

export function ProposeRuleDialog({
  flagId,
  matchedText,
  defaultCategory,
  defaultSeverity,
  onClose,
  onProposed,
}: {
  flagId: string;
  matchedText: string;
  defaultCategory: string;
  defaultSeverity: "HARD" | "STYLE";
  onClose: () => void;
  onProposed: () => void;
}) {
  const [description, setDescription] = useState(
    `Always flag "${matchedText}" going forward.`
  );
  const [category, setCategory] = useState(defaultCategory);
  const [severity, setSeverity] = useState(defaultSeverity);
  const [checkMode, setCheckMode] = useState<"literal" | "regex" | "llm">("literal");
  const [value, setValue] = useState(matchedText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/flags/${flagId}/propose-rule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, category, severity, checkMode, value }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not propose rule.");
      return;
    }
    onProposed();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-lg p-6">
        <h3 className="mb-1 text-base font-semibold text-slate-900">Propose a new rule</h3>
        <p className="mb-4 text-sm text-slate-500">
          This is a net-new interpretation, not sourced from the guide, so it will sit in the
          admin queue until approved.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Severity</label>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "HARD" | "STYLE")}
                className="w-full"
              >
                <option value="HARD">Hard rule</option>
                <option value="STYLE">Style preference</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Check as</label>
              <Select
                value={checkMode}
                onChange={(e) => setCheckMode(e.target.value as "literal" | "regex" | "llm")}
                className="w-full"
              >
                <option value="literal">Exact word/phrase</option>
                <option value="regex">Pattern (regex)</option>
                <option value="llm">Judgment call (LLM)</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {checkMode === "llm" ? "Instruction" : "Value"}
              </label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
