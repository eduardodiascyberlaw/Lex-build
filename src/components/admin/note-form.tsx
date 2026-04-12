"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface NoteFormProps {
  moduleCode: string;
  onSaved: () => void;
}

const NOTE_CATEGORIES = [
  "PROCEDURAL_TIP",
  "COMMON_MISTAKE",
  "BEST_PRACTICE",
  "TEMPLATE_NOTE",
  "GENERAL",
];

export function NoteForm({ moduleCode, onSaved }: NoteFormProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(NOTE_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/modules/${moduleCode}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao guardar nota.");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="note-category">Categoria</Label>
        <select
          id="note-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-10 w-full max-w-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {NOTE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-content">Conteudo</Label>
        <Textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Conteudo da nota..."
          rows={5}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "A guardar..." : "Guardar nota"}
      </Button>
    </form>
  );
}
