"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Module {
  id: string;
  code: string;
  name: string;
}

interface UserNote {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

const NOTE_CATEGORIES = [
  { value: "GENERAL", label: "Geral" },
  { value: "TRIBUNAL_SPECIFIC", label: "Tribunal Específico" },
  { value: "PROCEDURAL", label: "Procedimental" },
  { value: "STRATEGIC", label: "Estratégico" },
];

export default function NotesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Form state
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");

  const loadModules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch {
      setError("Erro ao carregar módulos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const loadNotes = useCallback(async (moduleCode: string) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/modules/${moduleCode}/my-notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch {
      setError("Erro ao carregar notas.");
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  function handleSelectModule(code: string) {
    setSelectedModule(code);
    setMessage("");
    setError("");
    loadNotes(code);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModule || !content.trim()) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/modules/${selectedModule}/my-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category }),
      });

      if (res.ok) {
        setContent("");
        setCategory("GENERAL");
        setMessage("Nota adicionada.");
        loadNotes(selectedModule);
      } else {
        const body = await res.json();
        setError(body.error || "Erro ao guardar nota.");
      }
    } catch {
      setError("Erro de ligacao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!selectedModule) return;

    try {
      const res = await fetch(`/api/modules/${selectedModule}/my-notes?noteId=${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage("Nota removida.");
        loadNotes(selectedModule);
      } else {
        setError("Erro ao remover nota.");
      }
    } catch {
      setError("Erro de ligacao.");
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">A carregar...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Notas por Modulo</h1>

      {message && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Module selector */}
      <div className="flex flex-wrap gap-2">
        {modules.map((mod) => (
          <Button
            key={mod.code}
            variant={selectedModule === mod.code ? "default" : "outline"}
            size="sm"
            onClick={() => handleSelectModule(mod.code)}
          >
            {mod.name}
          </Button>
        ))}
      </div>

      {selectedModule && (
        <>
          {/* Add note form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adicionar nota</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddNote} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {NOTE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Conteudo</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder="Escreva a sua nota..."
                    required
                  />
                </div>

                <Button type="submit" disabled={saving || !content.trim()}>
                  {saving ? "A guardar..." : "Adicionar nota"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Notes list */}
          {loadingNotes ? (
            <p className="text-muted-foreground text-sm">A carregar notas...</p>
          ) : notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem notas para este modulo.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="flex items-start justify-between gap-4 pt-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {NOTE_CATEGORIES.find((c) => c.value === note.category)?.label ??
                            note.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString("pt-PT")}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      Remover
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
