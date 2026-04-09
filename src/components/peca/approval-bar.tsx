"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ApprovalBarProps {
  pecaId: string;
  phaseContent: string | null;
  onApproved: () => void;
  disabled?: boolean;
}

export function ApprovalBar({ pecaId, phaseContent, onApproved, disabled }: ApprovalBarProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editedContent, setEditedContent] = useState(phaseContent ?? "");
  const [saveAsStyleRef, setSaveAsStyleRef] = useState(false);
  const [styleNotes, setStyleNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove(withEdit: boolean) {
    setLoading(true);
    setError("");

    try {
      const body: Record<string, unknown> = {};
      if (withEdit) {
        body.editedContent = editedContent;
        body.saveAsStyleRef = saveAsStyleRef;
        if (saveAsStyleRef && styleNotes) {
          body.styleRefNotes = styleNotes;
        }
      }

      const res = await fetch(`/api/pecas/${pecaId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao aprovar.");
        setLoading(false);
        return;
      }

      onApproved();
    } catch {
      setError("Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }

  if (!phaseContent) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      {mode === "view" ? (
        <>
          <div className="prose prose-sm max-h-[50vh] max-w-none overflow-y-auto whitespace-pre-wrap rounded bg-muted p-4">
            {phaseContent}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleApprove(false)} disabled={disabled || loading}>
              {loading ? "A aprovar..." : "Aprovar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditedContent(phaseContent);
                setMode("edit");
              }}
              disabled={disabled || loading}
            >
              Editar antes de aprovar
            </Button>
          </div>
        </>
      ) : (
        <>
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={15}
            className="font-mono text-sm"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="saveStyleRef"
              checked={saveAsStyleRef}
              onChange={(e) => setSaveAsStyleRef(e.target.checked)}
            />
            <Label htmlFor="saveStyleRef" className="text-sm">
              Guardar como referência de estilo
            </Label>
          </div>

          {saveAsStyleRef && (
            <Textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              placeholder="Notas sobre a correção (ex: 'Eliminei travessões, fundi frases curtas')"
              rows={2}
            />
          )}

          <div className="flex gap-2">
            <Button onClick={() => handleApprove(true)} disabled={loading}>
              {loading ? "A aprovar..." : "Aprovar com edições"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
