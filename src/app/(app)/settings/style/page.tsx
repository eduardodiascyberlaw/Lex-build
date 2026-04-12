"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StyleRefList } from "@/components/settings/style-ref-list";

interface StyleRef {
  id: string;
  pecaType: string;
  section: string;
  beforeText: string;
  afterText: string;
  notes: string | null;
  isGoldStandard: boolean;
  createdAt: string;
}

const PECA_TYPES = [
  { value: "ACPAD", label: "ACPAD" },
  { value: "CAUTELAR", label: "Cautelar" },
];

const SECTIONS = [
  { value: "PRESSUPOSTOS", label: "Pressupostos" },
  { value: "FACTOS", label: "Factos" },
  { value: "TEMPESTIVIDADE", label: "Tempestividade" },
  { value: "DIREITO", label: "Direito" },
  { value: "PEDIDOS", label: "Pedidos" },
];

export default function StylePage() {
  const [refs, setRefs] = useState<StyleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Form state
  const [pecaType, setPecaType] = useState("ACPAD");
  const [section, setSection] = useState("PRESSUPOSTOS");
  const [beforeText, setBeforeText] = useState("");
  const [afterText, setAfterText] = useState("");
  const [notes, setNotes] = useState("");

  const loadRefs = useCallback(async () => {
    try {
      const res = await fetch("/api/style-references");
      if (res.ok) {
        const data = await res.json();
        setRefs(data);
      }
    } catch {
      setError("Erro ao carregar referencias de estilo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!beforeText.trim() || !afterText.trim()) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/style-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pecaType,
          section,
          beforeText,
          afterText,
          notes: notes.trim() || null,
        }),
      });

      if (res.ok) {
        setBeforeText("");
        setAfterText("");
        setNotes("");
        setMessage("Referencia de estilo adicionada.");
        loadRefs();
      } else {
        const body = await res.json();
        setError(body.error || "Erro ao guardar.");
      }
    } catch {
      setError("Erro de ligacao.");
    } finally {
      setSaving(false);
    }
  }

  // Group refs by section
  const groupedRefs = SECTIONS.map((s) => ({
    section: s,
    items: refs.filter((r) => r.section === s.value),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return <div className="p-8 text-muted-foreground">A carregar...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Referencias de Estilo</h1>

      {message && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Add form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar referencia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pecaType">Tipo de Peca</Label>
                <select
                  id="pecaType"
                  value={pecaType}
                  onChange={(e) => setPecaType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {PECA_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Seccao</Label>
                <select
                  id="section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="beforeText">Texto original (antes)</Label>
              <Textarea
                id="beforeText"
                value={beforeText}
                onChange={(e) => setBeforeText(e.target.value)}
                rows={4}
                placeholder="Texto original gerado pela IA..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="afterText">Texto corrigido (depois)</Label>
              <Textarea
                id="afterText"
                value={afterText}
                onChange={(e) => setAfterText(e.target.value)}
                rows={4}
                placeholder="Texto corrigido pelo advogado..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas sobre a correcao..."
              />
            </div>

            <Button type="submit" disabled={saving || !beforeText.trim() || !afterText.trim()}>
              {saving ? "A guardar..." : "Adicionar referencia"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Grouped list */}
      {groupedRefs.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sem referencias de estilo.</p>
      ) : (
        groupedRefs.map((group) => (
          <div key={group.section.value} className="space-y-3">
            <h2 className="text-lg font-semibold">{group.section.label}</h2>
            <StyleRefList refs={group.items} />
          </div>
        ))
      )}
    </div>
  );
}
