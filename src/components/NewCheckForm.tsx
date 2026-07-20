"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Select, Textarea } from "@/components/ui";

export function NewCheckForm({
  clients,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Select a client.");
      return;
    }
    if (!file && pastedText.trim().length === 0) {
      setError("Upload a file or paste the document text.");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("clientId", clientId);
    if (file) formData.append("file", file);
    if (pastedText.trim()) formData.append("text", pastedText);

    const res = await fetch(`/api/checks`, { method: "POST", body: formData });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Check failed.");
      return;
    }
    const body = await res.json();
    router.push(`/checks/${body.checkId}`);
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Client</label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Document (DOCX or PDF)
          </label>
          <input
            type="file"
            accept=".docx,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> or paste text{" "}
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <Textarea
          rows={8}
          placeholder="Paste the document text here…"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Running check… this can take a minute" : "Run check"}
        </Button>
      </form>
    </Card>
  );
}
