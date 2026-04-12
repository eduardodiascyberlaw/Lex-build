"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TemplateUpload } from "@/components/settings/template-upload";

interface Profile {
  id: string;
  email: string;
  name: string;
  cpOA: string;
  firmName: string | null;
  model: string;
  hasApiKey: boolean;
}

interface ApiKeyStatus {
  hasKey: boolean;
  maskedKey: string | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // API key form
  const [newApiKey, setNewApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [profileRes, keyRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/profile/api-key"),
      ]);
      if (profileRes.ok) setProfile(await profileRes.json());
      if (keyRes.ok) setApiKeyStatus(await keyRes.json());
    } catch {
      setError("Erro ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      cpOA: formData.get("cpOA") as string,
      firmName: (formData.get("firmName") as string) || null,
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
        setMessage("Perfil atualizado.");
      } else {
        const body = await res.json();
        setError(body.error || "Erro ao guardar.");
      }
    } catch {
      setError("Erro de ligação.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveApiKey() {
    if (!newApiKey.trim()) return;
    setSavingKey(true);
    setError("");

    try {
      const res = await fetch("/api/profile/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: newApiKey }),
      });

      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus({ hasKey: true, maskedKey: data.maskedKey });
        setNewApiKey("");
        setMessage("API key guardada com sucesso.");
      } else {
        const body = await res.json();
        setError(body.error || "Erro ao guardar API key.");
      }
    } catch {
      setError("Erro de ligação.");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleRemoveApiKey() {
    try {
      const res = await fetch("/api/profile/api-key", { method: "DELETE" });
      if (res.ok) {
        setApiKeyStatus({ hasKey: false, maskedKey: null });
        setMessage("API key removida.");
      }
    } catch {
      setError("Erro ao remover API key.");
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">A carregar...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Definições</h1>

      {message && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Dados do advogado</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" name="name" defaultValue={profile?.name ?? ""} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpOA">Cédula Profissional (OA)</Label>
              <Input id="cpOA" name="cpOA" defaultValue={profile?.cpOA ?? ""} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firmName">Escritório</Label>
              <Input id="firmName" name="firmName" defaultValue={profile?.firmName ?? ""} />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "A guardar..." : "Guardar perfil"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle>API Key do Claude</CardTitle>
          <CardDescription>
            A sua chave da Anthropic. Encriptada em repouso com AES-256-GCM. Nunca é partilhada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeyStatus?.hasKey && (
            <div className="flex items-center gap-3">
              <code className="rounded bg-muted px-2 py-1 text-sm">{apiKeyStatus.maskedKey}</code>
              <Button variant="destructive" size="sm" onClick={handleRemoveApiKey}>
                Remover
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
            <Button onClick={handleSaveApiKey} disabled={savingKey || !newApiKey.trim()}>
              {savingKey ? "A guardar..." : apiKeyStatus?.hasKey ? "Substituir" : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Template upload placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Template .docx</CardTitle>
          <CardDescription>
            Papel timbrado do escritório. Upload do ficheiro .docx com header/footer/logo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateUpload />
        </CardContent>
      </Card>
    </div>
  );
}
