"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LegislationFormProps {
  onSaved: () => void;
}

export function LegislationForm({ onSaved }: LegislationFormProps) {
  const [diploma, setDiploma] = useState("");
  const [article, setArticle] = useState("");
  const [epigraph, setEpigraph] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<"CORE" | "MODULE">("CORE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/legislation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diploma,
          article,
          epigraph: epigraph || undefined,
          content,
          scope,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao guardar legislacao.");
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
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="leg-diploma">Diploma</Label>
          <Input
            id="leg-diploma"
            value={diploma}
            onChange={(e) => setDiploma(e.target.value)}
            placeholder="Ex: CPA"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leg-article">Artigo</Label>
          <Input
            id="leg-article"
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            placeholder="Ex: 102.o"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leg-epigraph">Epigrafe (opcional)</Label>
        <Input
          id="leg-epigraph"
          value={epigraph}
          onChange={(e) => setEpigraph(e.target.value)}
          placeholder="Ex: Prazo para decisao"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="leg-content">Conteudo</Label>
        <Textarea
          id="leg-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Texto integral do artigo..."
          rows={5}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="leg-scope">Scope</Label>
        <select
          id="leg-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as "CORE" | "MODULE")}
          className="flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="CORE">CORE</option>
          <option value="MODULE">MODULE</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "A guardar..." : "Guardar legislacao"}
      </Button>
    </form>
  );
}
