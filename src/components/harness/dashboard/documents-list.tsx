"use client";

import type { PecaDetail } from "../harness-shell";

interface DocumentsListProps {
  peca: PecaDetail;
}

const mimeLabels: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

export function DocumentsList({ peca }: DocumentsListProps) {
  return (
    <div className="harness-panel p-3">
      <h3 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
        Documentos ({peca.uploads.length})
      </h3>
      {peca.uploads.length === 0 ? (
        <span className="text-xs text-muted-foreground">Sem documentos.</span>
      ) : (
        <div className="space-y-1">
          {peca.uploads.map((u) => (
            <div key={u.id} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[0.6rem] px-1 py-0.5 bg-muted text-muted-foreground rounded-sm">
                {mimeLabels[u.mimeType] ?? u.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
              </span>
              <span className="truncate text-foreground/80">{u.filename}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
