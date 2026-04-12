"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface JurisprudenceFormProps {
  moduleCode: string;
  onSaved: () => void;
}

export function JurisprudenceForm({ moduleCode, onSaved }: JurisprudenceFormProps) {
  const [court, setCourt] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [date, setDate] = useState("");
  const [summary, setSummary] = useState("");
  const [keyPassage, setKeyPassage] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/modules/${moduleCode}/jurisprudence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court,
          caseNumber,
          date,
          summary,
          keyPassage: keyPassage || undefined,
          tags: tags
            ? tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao guardar jurisprudencia.");
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
          <Label htmlFor="juris-court">Tribunal</Label>
          <Input
            id="juris-court"
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            placeholder="Ex: STA"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="juris-case">N.o Processo</Label>
          <Input
            id="juris-case"
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            placeholder="Ex: 0123/20.0BELSB"
            required
          />
        </div>
      </div>

      <div className="space-y-2 max-w-[200px]">
        <Label htmlFor="juris-date">Data</Label>
        <Input
          id="juris-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="juris-summary">Sumario</Label>
        <Textarea
          id="juris-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Resumo do acordao..."
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="juris-passage">Passagem-chave (opcional)</Label>
        <Textarea
          id="juris-passage"
          value={keyPassage}
          onChange={(e) => setKeyPassage(e.target.value)}
          placeholder="Citacao relevante do acordao..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="juris-tags">Tags (separadas por virgula)</Label>
        <Input
          id="juris-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Ex: direito administrativo, prazo, ato devido"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "A guardar..." : "Guardar jurisprudencia"}
      </Button>
    </form>
  );
}
