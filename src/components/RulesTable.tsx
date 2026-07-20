"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CategoryBadge, Select, SeverityBadge, StatusBadge, Textarea } from "@/components/ui";

export type RuleRow = {
  id: string;
  ruleType: "DISCRETE" | "LOOKUP_TABLE";
  category: string;
  description: string;
  severity: "HARD" | "STYLE";
  status: string;
  patternLogic: unknown;
  source: unknown;
};

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

function lookupTermCount(patternLogic: unknown): number | null {
  if (
    patternLogic &&
    typeof patternLogic === "object" &&
    "terms" in patternLogic &&
    Array.isArray((patternLogic as { terms: unknown[] }).terms)
  ) {
    return (patternLogic as { terms: unknown[] }).terms.length;
  }
  return null;
}

function sourceQuote(source: unknown): string | null {
  if (source && typeof source === "object" && "quote" in source) {
    const q = (source as { quote?: unknown }).quote;
    return typeof q === "string" ? q : null;
  }
  return null;
}

function RuleEditRow({ rule }: { rule: RuleRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(rule.description);
  const [category, setCategory] = useState(rule.category);
  const [severity, setSeverity] = useState(rule.severity);
  const [saving, setSaving] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const termCount = lookupTermCount(rule.patternLogic);
  const quote = sourceQuote(rule.source);

  async function save() {
    setSaving(true);
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, category, severity }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function archive() {
    setSaving(true);
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setSaving(false);
    setConfirmingArchive(false);
    router.refresh();
  }

  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="w-24 py-3 pr-3">
        <span className="text-xs font-medium uppercase text-slate-400">
          {rule.ruleType === "LOOKUP_TABLE" ? `Lookup (${termCount ?? 0})` : "Discrete"}
        </span>
      </td>
      <td className="py-3 pr-3">
        {editing ? (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        ) : (
          <p className="text-sm text-slate-800">{rule.description}</p>
        )}
        {quote && !editing && (
          <p className="mt-1 text-xs italic text-slate-400">“{quote}”</p>
        )}
      </td>
      <td className="w-40 py-3 pr-3">
        {editing ? (
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </Select>
        ) : (
          <CategoryBadge category={rule.category} />
        )}
      </td>
      <td className="w-36 py-3 pr-3">
        {editing ? (
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as "HARD" | "STYLE")}>
            <option value="HARD">Hard rule</option>
            <option value="STYLE">Style preference</option>
          </Select>
        ) : (
          <SeverityBadge severity={rule.severity} />
        )}
      </td>
      <td className="w-24 py-3 pr-3">
        <StatusBadge status={rule.status} />
      </td>
      <td className="w-40 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : confirmingArchive ? (
          <div className="flex justify-end gap-2">
            <span className="self-center text-xs text-slate-500">Archive this rule?</span>
            <Button variant="secondary" onClick={() => setConfirmingArchive(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={archive} disabled={saving}>
              {saving ? "Archiving…" : "Confirm"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {rule.status === "ACTIVE" && (
              <Button variant="ghost" onClick={() => setConfirmingArchive(true)}>
                Archive
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function RulesTable({ rules, groupByCategory = true }: { rules: RuleRow[]; groupByCategory?: boolean }) {
  const groups = useMemo(() => {
    if (!groupByCategory) return { All: rules };
    const map: Record<string, RuleRow[]> = {};
    for (const rule of rules) {
      map[rule.category] = map[rule.category] ?? [];
      map[rule.category].push(rule);
    }
    return map;
  }, [rules, groupByCategory]);

  if (rules.length === 0) {
    return <p className="text-sm text-slate-500">No rules yet.</p>;
  }

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([category, groupRules]) => (
        <div key={category}>
          {groupByCategory && (
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              {categoryLabel(category)}{" "}
              <span className="font-normal text-slate-400">({groupRules.length})</span>
            </h3>
          )}
          <table className="w-full border-collapse">
            <tbody>
              {groupRules.map((rule) => (
                <RuleEditRow key={rule.id} rule={rule} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
