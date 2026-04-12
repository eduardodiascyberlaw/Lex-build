"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ModuleFormProps {
  onSaved: () => void;
  initial?: {
    code: string;
    name: string;
    description?: string;
    pecaTypes: string[];
    sortOrder: number;
  };
}

const PECA_TYPE_OPTIONS = ["ACPAD", "CAUTELAR"];

export function ModuleForm({ onSaved, initial }: ModuleFormProps) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pecaTypes, setPecaTypes] = useState<string[]>(initial?.pecaTypes ?? []);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePecaType = (pt: string) => {
    setPecaTypes((prev) => (prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, description, pecaTypes, sortOrder }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao guardar modulo.");
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
          <Label htmlFor="module-code">Codigo</Label>
          <Input
            id="module-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex: ACPAD"
            required
            disabled={!!initial}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="module-name">Nome</Label>
          <Input
            id="module-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Acao de Condenacao a Pratica de Ato Devido"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="module-description">Descricao</Label>
        <Textarea
          id="module-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descricao do modulo..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipos de peca</Label>
        <div className="flex gap-3">
          {PECA_TYPE_OPTIONS.map((pt) => (
            <label key={pt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pecaTypes.includes(pt)}
                onChange={() => togglePecaType(pt)}
                className="rounded border-input"
              />
              <span className="text-sm">{pt}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-w-[120px]">
        <Label htmlFor="module-sort">Ordem</Label>
        <Input
          id="module-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "A guardar..." : "Guardar modulo"}
      </Button>
    </form>
  );
}
