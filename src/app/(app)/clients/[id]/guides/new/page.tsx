"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Textarea } from "@/components/ui";

export default function NewGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0 && pastedText.trim().length === 0) {
      setError("Upload one or more files or paste the guide text.");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    if (pastedText.trim()) formData.append("text", pastedText);

    const res = await fetch(`/api/clients/${clientId}/guides`, {
      method: "POST",
      body: formData,
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Extraction failed.");
      return;
    }
    const body = await res.json();
    router.push(`/clients/${clientId}/guides/${body.guideId}/review`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Upload a style guide</h1>
      <p className="mb-6 text-sm text-slate-500">
        Rules are extracted automatically and go active right away. If this client already has
        active rules, new content is added automatically and anything that changes an existing
        rule is flagged for a quick review — nothing gets silently overwritten.
      </p>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Guide file(s) (DOCX or PDF) — select multiple if the guide is split across docs
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
          <div>
            <Textarea
              rows={8}
              placeholder="Paste the style guide text here…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Extracting rules… this reads the guide in sections, so it can take a few minutes"
              : "Upload & extract rules"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
