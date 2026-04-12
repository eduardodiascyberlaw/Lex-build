"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LegislationForm } from "@/components/admin/legislation-form";

interface LegislationItem {
  id: string;
  diploma: string;
  article: string;
  epigraph?: string;
  content?: string;
  scope: "CORE" | "MODULE";
}

export default function AdminLegislationPage() {
  const [items, setItems] = useState<LegislationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterScope, setFilterScope] = useState<string>("ALL");
  const [filterDiploma, setFilterDiploma] = useState("");

  const fetchLegislation = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/legislation");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error("Erro ao carregar legislacao:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLegislation();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar?")) return;
    try {
      const res = await fetch(`/api/admin/legislation/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchLegislation();
    } catch (err) {
      console.error("Erro ao eliminar:", err);
    }
  };

  const filtered = items.filter((item) => {
    if (filterScope !== "ALL" && item.scope !== filterScope) return false;
    if (filterDiploma && !item.diploma.toLowerCase().includes(filterDiploma.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Legislacao</h1>
          <p className="text-muted-foreground">Gestao de artigos legislativos.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Nova legislacao"}
        </Button>
      </div>

      {showForm && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Criar legislacao</CardTitle>
            </CardHeader>
            <CardContent>
              <LegislationForm
                onSaved={() => {
                  setShowForm(false);
                  fetchLegislation();
                }}
              />
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

      <div className="flex gap-4 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Scope</label>
          <div className="flex gap-1">
            {["ALL", "CORE", "MODULE"].map((s) => (
              <Button
                key={s}
                variant={filterScope === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterScope(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1 flex-1 max-w-xs">
          <label className="text-sm font-medium">Diploma</label>
          <Input
            placeholder="Filtrar por diploma..."
            value={filterDiploma}
            onChange={(e) => setFilterDiploma(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum resultado.</p>
      ) : (
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Diploma</th>
                <th className="text-left p-3 font-medium">Artigo</th>
                <th className="text-left p-3 font-medium">Epigrafe</th>
                <th className="text-left p-3 font-medium">Scope</th>
                <th className="text-right p-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3">{item.diploma}</td>
                  <td className="p-3">{item.article}</td>
                  <td className="p-3 text-muted-foreground">{item.epigraph || "—"}</td>
                  <td className="p-3">
                    <Badge variant={item.scope === "CORE" ? "default" : "secondary"}>
                      {item.scope}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
