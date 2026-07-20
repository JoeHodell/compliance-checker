"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CategoryBadge, Select, SeverityBadge, StatusBadge } from "@/components/ui";
import { ProposeRuleDialog } from "@/components/ProposeRuleDialog";

export type FlagItem = {
  id: string;
  ruleId: string | null;
  flagSource: "CLIENT_RULE" | "GRAMMAR";
  category: string;
  severity: "HARD" | "STYLE";
  location: { paragraphIndex: number; startOffset: number; endOffset: number };
  matchedText: string;
  message: string;
  status: "PENDING" | "ACCEPTED" | "DISMISSED";
};

type SortKey = "severity" | "category" | "status";

function categoryLabel(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function FlagList({ flags: initialFlags }: { flags: FlagItem[] }) {
  const router = useRouter();
  const [flags, setFlags] = useState(initialFlags);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [proposingFlagId, setProposingFlagId] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(flags.map((f) => f.category))),
    [flags]
  );

  const summary = useMemo(() => {
    const hard = flags.filter((f) => f.severity === "HARD" && f.status !== "DISMISSED").length;
    const style = flags.filter((f) => f.severity === "STYLE" && f.status !== "DISMISSED").length;
    return { hard, style, clean: hard === 0 && style === 0 };
  }, [flags]);

  const visibleFlags = useMemo(() => {
    let result = flags;
    if (severityFilter !== "ALL") result = result.filter((f) => f.severity === severityFilter);
    if (statusFilter !== "ALL") result = result.filter((f) => f.status === statusFilter);
    if (categoryFilter !== "ALL") result = result.filter((f) => f.category === categoryFilter);

    const severityRank = { HARD: 0, STYLE: 1 } as Record<string, number>;
    const statusRank = { PENDING: 0, ACCEPTED: 1, DISMISSED: 2 } as Record<string, number>;
    result = [...result].sort((a, b) => {
      if (sortKey === "severity") return severityRank[a.severity] - severityRank[b.severity];
      if (sortKey === "status") return statusRank[a.status] - statusRank[b.status];
      return a.category.localeCompare(b.category);
    });
    return result;
  }, [flags, severityFilter, statusFilter, categoryFilter, sortKey]);

  async function resolve(flagId: string, status: "ACCEPTED" | "DISMISSED") {
    setFlags((prev) => prev.map((f) => (f.id === flagId ? { ...f, status } : f)));
    await fetch(`/api/flags/${flagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const proposingFlag = flags.find((f) => f.id === proposingFlagId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            summary.clean
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          {summary.clean ? (
            "Clean — no open flags"
          ) : (
            <>
              <span className="text-red-700">{summary.hard} hard violation{summary.hard === 1 ? "" : "s"}</span>
              {" · "}
              <span className="text-amber-700">{summary.style} style flag{summary.style === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="ALL">All severities</option>
          <option value="HARD">Hard rule</option>
          <option value="STYLE">Style preference</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DISMISSED">Dismissed</option>
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </Select>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="severity">Sort by severity</option>
          <option value="category">Sort by category</option>
          <option value="status">Sort by status</option>
        </Select>
        <span className="text-sm text-slate-400">
          {visibleFlags.length} of {flags.length}
        </span>
      </div>

      {visibleFlags.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No flags match these filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleFlags.map((flag) => (
            <li
              key={flag.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SeverityBadge severity={flag.severity} />
                <CategoryBadge category={flag.category} />
                <StatusBadge status={flag.status} />
                {flag.flagSource === "GRAMMAR" && (
                  <span className="text-xs text-slate-400">Grammar/Mechanical engine</span>
                )}
              </div>
              <p className="mb-1 rounded bg-slate-50 px-2 py-1 font-mono text-sm text-slate-800">
                “{flag.matchedText}”
              </p>
              <p className="text-sm text-slate-600">{flag.message}</p>
              <p className="mt-1 text-xs text-slate-400">Paragraph {flag.location.paragraphIndex + 1}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  disabled={flag.status === "ACCEPTED"}
                  onClick={() => resolve(flag.id, "ACCEPTED")}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  disabled={flag.status === "DISMISSED"}
                  onClick={() => resolve(flag.id, "DISMISSED")}
                >
                  Dismiss
                </Button>
                <Button variant="ghost" onClick={() => setProposingFlagId(flag.id)}>
                  Propose a rule from this passage
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {proposingFlag && (
        <ProposeRuleDialog
          flagId={proposingFlag.id}
          matchedText={proposingFlag.matchedText}
          defaultCategory={proposingFlag.category === "GRAMMAR_MECHANICAL" ? "OTHER" : proposingFlag.category}
          defaultSeverity={proposingFlag.severity}
          onClose={() => setProposingFlagId(null)}
          onProposed={() => {
            setProposingFlagId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
