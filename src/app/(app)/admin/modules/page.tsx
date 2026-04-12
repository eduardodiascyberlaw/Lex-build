"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ModuleForm } from "@/components/admin/module-form";

interface ModuleItem {
  code: string;
  name: string;
  description?: string;
  pecaTypes: string[];
  sortOrder: number;
  _count?: {
    legislation: number;
    jurisprudence: number;
    doctrine: number;
    platformNotes: number;
  };
}

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (err) {
      console.error("Erro ao carregar modulos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modulos</h1>
          <p className="text-muted-foreground">Gestao dos modulos de conhecimento juridico.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Novo modulo"}
        </Button>
      </div>

      {showForm && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Criar modulo</CardTitle>
              <CardDescription>Preencha os dados do novo modulo.</CardDescription>
            </CardHeader>
            <CardContent>
              <ModuleForm
                onSaved={() => {
                  setShowForm(false);
                  fetchModules();
                }}
              />
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

      {loading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : modules.length === 0 ? (
        <p className="text-muted-foreground">Nenhum modulo encontrado.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <Link key={mod.code} href={`/admin/modules/${mod.code}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{mod.name}</CardTitle>
                    <Badge variant="outline">{mod.code}</Badge>
                  </div>
                  {mod.description && (
                    <CardDescription className="line-clamp-2">{mod.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {mod.pecaTypes.map((pt) => (
                      <Badge key={pt} variant="secondary">
                        {pt}
                      </Badge>
                    ))}
                  </div>
                  {mod._count && (
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>Legislacao: {mod._count.legislation}</span>
                      <span>Jurisprudencia: {mod._count.jurisprudence}</span>
                      <span>Doutrina: {mod._count.doctrine}</span>
                      <span>Notas: {mod._count.platformNotes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
