"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FileEntry {
  file: File;
  category: string;
  uploadProgress: number; // 0-100, -1 = error
}

const CATEGORIES = [
  { value: "sentenca", label: "Sentença" },
  { value: "peticao_inicial", label: "Petição inicial" },
  { value: "documento_prova", label: "Documento / Prova" },
  { value: "procuracao", label: "Procuração" },
  { value: "notificacao", label: "Notificação" },
  { value: "requerimento", label: "Requerimento" },
  { value: "outro", label: "Outro" },
];

const MAX_FILE_SIZE_MB = 20;
const MAX_TOTAL_SIZE_MB = 100;
const ACCEPTED_EXTS = [".pdf", ".docx", ".txt"];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function defaultCategory(filename: string, type: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("sentenc") || lower.includes("acordao") || lower.includes("decisao"))
    return "sentenca";
  if (lower.includes("peticao") || lower.includes("pi_") || lower.includes("_pi."))
    return "peticao_inicial";
  if (lower.includes("procuracao") || lower.includes("mandato")) return "procuracao";
  if (lower.includes("notificacao") || lower.includes("notif")) return "notificacao";
  // RECURSO: first suggestion for "sentenca" when we know it's a recurso
  if (type === "RECURSO") return "sentenca";
  return "outro";
}

export default function NewPecaPage() {
  const router = useRouter();
  const params = useParams();
  const type = (params.type as string).toUpperCase();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const valid: FileEntry[] = [];
      const errors: string[] = [];

      for (const file of newFiles) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ACCEPTED_EXTS.includes(ext)) {
          errors.push(`${file.name}: formato não suportado (use PDF, DOCX ou TXT)`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          errors.push(`${file.name}: excede ${MAX_FILE_SIZE_MB} MB`);
          continue;
        }
        // Dedup
        if (entries.some((e) => e.file.name === file.name && e.file.size === file.size)) {
          continue;
        }
        valid.push({ file, category: defaultCategory(file.name, type), uploadProgress: 0 });
      }

      const totalAfter = [...entries, ...valid].reduce((s, e) => s + e.file.size, 0);
      if (totalAfter > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        errors.push(`Total excede ${MAX_TOTAL_SIZE_MB} MB`);
      } else {
        setEntries((prev) => [...prev, ...valid]);
      }

      if (errors.length > 0) setError(errors.join(" | "));
    },
    [entries, type]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
    // Reset so same file can be added again after removal
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }

  function updateCategory(index: number, category: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, category } : e)));
  }

  function removeFile(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (entries.length === 0) {
      setError("Carregue pelo menos um documento.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Create peca
      const pecaRes = await fetch("/api/pecas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!pecaRes.ok) {
        const body = await pecaRes.json();
        setError(body.error || "Erro ao criar peça.");
        setUploading(false);
        return;
      }

      const peca = await pecaRes.json();

      // Upload files sequentially with per-file progress
      for (let i = 0; i < entries.length; i++) {
        const { file, category } = entries[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category);

        // Update to in-progress
        setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, uploadProgress: 50 } : e)));

        const uploadRes = await fetch(`/api/pecas/${peca.id}/uploads`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.json();
          setEntries((prev) =>
            prev.map((e, idx) => (idx === i ? { ...e, uploadProgress: -1 } : e))
          );
          setError(`Erro no upload de ${file.name}: ${body.error}`);
          setUploading(false);
          return;
        }

        setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, uploadProgress: 100 } : e)));
      }

      // Start pipeline
      const startRes = await fetch(`/api/pecas/${peca.id}/start`, { method: "POST" });
      if (!startRes.ok) {
        const body = await startRes.json();
        setError(body.error || "Erro ao iniciar pipeline.");
        setUploading(false);
        return;
      }

      router.push(`/peca/${peca.id}`);
    } catch {
      setError("Erro de ligação.");
      setUploading(false);
    }
  }

  const totalSize = entries.reduce((s, e) => s + e.file.size, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Nova peça — {type}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Documentos do caso</CardTitle>
          <CardDescription>
            {type === "RECURSO" ? (
              <>
                Carregue obrigatoriamente: <strong>Sentença recorrida</strong>,{" "}
                <strong>Petição inicial</strong> e documentos juntados ao processo.
                A Fase 0 analisa a viabilidade do recurso com base nestes documentos.
              </>
            ) : (
              "Carregue os documentos relevantes (decisão administrativa, notificação, requerimento, etc.)."
            )}{" "}
            Formatos: PDF, DOCX, TXT. Máximo {MAX_FILE_SIZE_MB} MB por ficheiro / {MAX_TOTAL_SIZE_MB}{" "}
            MB total.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
              <button
                className="ml-2 underline"
                onClick={() => setError("")}
              >
                Fechar
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTS.join(",")}
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Drag-drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <svg
              className="mb-3 h-10 w-10 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium">
              {dragOver ? "Soltar aqui" : "Arrastar ficheiros ou clicar para selecionar"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT — máx. {MAX_FILE_SIZE_MB} MB cada</p>
          </div>

          {/* File list */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{entries.length} ficheiro(s)</span>
                <span>{formatSize(totalSize)}</span>
              </div>

              {entries.map((entry, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(entry.file.size)}</p>
                    </div>
                    <button
                      onClick={() => !uploading && removeFile(i)}
                      disabled={uploading}
                      className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      Remover
                    </button>
                  </div>

                  {/* Category selector */}
                  <div className="mt-2">
                    <select
                      value={entry.category}
                      onChange={(e) => updateCategory(i, e.target.value)}
                      disabled={uploading}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Upload progress */}
                  {uploading && (
                    <div className="mt-2">
                      {entry.uploadProgress === -1 ? (
                        <p className="text-xs text-red-500">Erro no upload</p>
                      ) : entry.uploadProgress === 100 ? (
                        <p className="text-xs text-green-600">✓ Enviado</p>
                      ) : entry.uploadProgress > 0 ? (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${entry.uploadProgress}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full w-0 bg-primary" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={uploading || entries.length === 0}
            className="w-full"
          >
            {uploading
              ? `A enviar... (${entries.filter((e) => e.uploadProgress === 100).length}/${entries.length})`
              : `Criar peça ${type} e iniciar análise`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
