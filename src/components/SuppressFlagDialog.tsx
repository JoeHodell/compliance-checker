"use client";

import { useState } from "react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

export function SuppressFlagDialog({
  flagId,
  matchedText,
  onClose,
  onSuppressed,
}: {
  flagId: string;
  matchedText: string;
  onClose: () => void;
  onSuppressed: () => void;
}) {
  const [description, setDescription] = useState(`Don't flag "${matchedText}" — false positive.`);
  const [checkMode, setCheckMode] = useState<"literal" | "regex" | "llm">("llm");
  const [value, setValue] = useState(matchedText);
  const [instruction, setInstruction] = useState(
    `Don't flag "${matchedText}" when it's used the way it appears here — only silence genuine false positives like this one, not real violations of the same rule elsewhere.`
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const body =
      checkMode === "llm"
        ? { description, checkMode, instruction }
        : { description, checkMode, value };
    const res = await fetch(`/api/flags/${flagId}/suppress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      setError(errorBody.error ?? "Could not create suppression.");
      return;
    }
    onSuppressed();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-lg p-6">
        <h3 className="mb-1 text-base font-semibold text-slate-900">Suppress this flag</h3>
        <p className="mb-4 text-sm text-slate-500">
          Stops flagging text matching this going forward — from this rule, any other rule, or
          grammar checking. This is a new interpretation, not a fix to the guide itself, so it
          sits in the admin queue until approved (same as proposing a rule).
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Why</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Match as</label>
            <Select
              value={checkMode}
              onChange={(e) => setCheckMode(e.target.value as "literal" | "regex" | "llm")}
              className="w-full"
            >
              <option value="llm">Describe the situation (judgment call)</option>
              <option value="literal">Exact word/phrase</option>
              <option value="regex">Pattern (regex)</option>
            </Select>
          </div>

          {checkMode === "llm" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                When should this be suppressed?
              </label>
              <Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">
                Checked in context against every future flag by the same judgment the tone/voice
                rules use — so it can tell &ldquo;I am proud&rdquo; from &ldquo;10 AM&rdquo; without
                you having to write a pattern. Describe the false-positive case specifically; vague
                instructions get applied conservatively.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Value</label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
              {checkMode === "literal" && (
                <p className="mt-1 text-xs text-slate-400">
                  Exact match is case-sensitive, so suppressing lowercase &ldquo;am&rdquo; won&apos;t
                  also hide a legitimate &ldquo;10 AM&rdquo; flag elsewhere in the rules.
                </p>
              )}
            </div>
          )}
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
