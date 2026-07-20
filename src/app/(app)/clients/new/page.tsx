"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Textarea } from "@/components/ui";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give the client a name.");
      return;
    }
    setLoading(true);

    setStatus("Creating client…");
    const clientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!clientRes.ok) {
      setLoading(false);
      setStatus(null);
      const body = await clientRes.json().catch(() => ({}));
      setError(body.error ?? "Could not create client.");
      return;
    }
    const { client } = await clientRes.json();

    const hasGuide = files.length > 0 || pastedText.trim().length > 0;
    if (!hasGuide) {
      router.push(`/clients/${client.id}`);
      return;
    }

    setStatus("Extracting rules from the guide… this reads it in sections, so it can take a few minutes");
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    if (pastedText.trim()) formData.append("text", pastedText);

    const guideRes = await fetch(`/api/clients/${client.id}/guides`, {
      method: "POST",
      body: formData,
    });
    setLoading(false);
    setStatus(null);
    if (!guideRes.ok) {
      const body = await guideRes.json().catch(() => ({}));
      setError(
        `Client created, but guide extraction failed: ${body.error ?? "unknown error"}. You can retry the upload from the client page.`
      );
      return;
    }
    const body = await guideRes.json();
    router.push(`/clients/${client.id}/guides/${body.guideId}/review`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Add a new client</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create the client record and, optionally, upload their style guide in the same step —
        rules extract and go active automatically, same as any other guide upload.
      </p>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Client name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GLAAD" />
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> style guide (optional, can add later){" "}
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Guide file(s) (DOCX or PDF) — select multiple if it&apos;s split across docs (e.g.
              core guide + glossary)
            </label>
            <input
              type="file"
              accept=".docx,.pdf"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
            />
            {files.length > 1 && (
              <p className="mt-1 text-xs text-slate-500">
                {files.length} files selected: {files.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or paste text{" "}
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <Textarea
            rows={6}
            placeholder="Paste the style guide text here…"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? status ?? "Working…" : "Create client"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
