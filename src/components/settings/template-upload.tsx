"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateInfo {
  id: string;
  name: string;
  createdAt: string;
}

export function TemplateUpload() {
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplate = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/template");
      if (res.ok) {
        // Endpoint returns the template object directly (or null if none).
        const data: TemplateInfo | null = await res.json();
        setTemplate(data);
      }
    } catch {
      setError("Erro ao carregar template.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/template", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data: TemplateInfo = await res.json();
        setTemplate(data);
        setMessage("Template carregado com sucesso.");
      } else {
        const body = await res.json();
        setError(body.error || "Erro ao carregar template.");
      }
    } catch {
      setError("Erro de ligacao.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete() {
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/profile/template", { method: "DELETE" });
      if (res.ok) {
        setTemplate(null);
        setMessage("Template removido.");
      } else {
        setError("Erro ao remover template.");
      }
    } catch {
      setError("Erro de ligacao.");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">A carregar...</p>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {template && (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Template atual: <strong>{template.name}</strong>
          </span>
          <span className="text-xs text-muted-foreground">
            ({new Date(template.createdAt).toLocaleDateString("pt-PT")})
          </span>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Remover
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="template-file">
          {template ? "Substituir template" : "Carregar template .docx"}
        </Label>
        <Input
          ref={fileInputRef}
          id="template-file"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading && <p className="text-sm text-muted-foreground">A carregar...</p>}
      </div>
    </div>
  );
}
