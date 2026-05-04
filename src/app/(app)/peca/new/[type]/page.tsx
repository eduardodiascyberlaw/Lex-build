"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewPecaPage() {
  const router = useRouter();
  const params = useParams();
  const type = (params.type as string).toUpperCase();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    if (files.length === 0) {
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

      // Upload files
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(`/api/pecas/${peca.id}/uploads`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.json();
          setError(`Erro no upload de ${file.name}: ${body.error}`);
          setUploading(false);
          return;
        }
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

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
                Formatos: PDF, DOCX, TXT. Máximo 20 MB por ficheiro.
              </>
            ) : (
              "Carregue os documentos relevantes (decisão administrativa, notificação, requerimento, etc.). Formatos: PDF, DOCX, TXT. Máximo 20 MB por ficheiro."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            Selecionar ficheiros
          </Button>

          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                >
                  <span>
                    {f.name} ({(f.size / 1024).toFixed(0)} KB)
                  </span>
                  <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700">
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button onClick={handleCreate} disabled={uploading || files.length === 0}>
            {uploading ? "A criar peça..." : `Criar peça ${type} e iniciar análise`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
