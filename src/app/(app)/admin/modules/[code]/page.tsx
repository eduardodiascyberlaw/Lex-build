"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JurisprudenceForm } from "@/components/admin/jurisprudence-form";
import { NoteForm } from "@/components/admin/note-form";
import { LegislationForm } from "@/components/admin/legislation-form";

interface ModuleDetail {
  code: string;
  name: string;
  description?: string;
  pecaTypes: string[];
  sortOrder: number;
  legislation: Array<{
    id: string;
    diploma: string;
    article: string;
    epigraph?: string;
    relevance?: number;
  }>;
  jurisprudence: Array<{
    id: string;
    court: string;
    caseNumber: string;
    date: string;
    summary: string;
    keyPassage?: string;
    tags?: string[];
  }>;
  doctrine: Array<{
    id: string;
    author: string;
    work: string;
    passage: string;
    page?: string;
    year?: number;
  }>;
  platformNotes: Array<{
    id: string;
    content: string;
    category: string;
  }>;
  coreRefs: Array<{
    id: string;
    diploma: string;
    article: string;
    context?: string;
  }>;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const code = params.code as string;

  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<string | null>(null);

  const fetchModule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/modules/${code}`);
      if (res.ok) {
        const data = await res.json();
        setMod(data);
      }
    } catch (err) {
      console.error("Erro ao carregar modulo:", err);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar?")) return;
    try {
      const res = await fetch(`/api/admin/modules/${code}/${type}/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchModule();
    } catch (err) {
      console.error("Erro ao eliminar:", err);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">A carregar...</p>;
  }

  if (!mod) {
    return <p className="text-muted-foreground">Modulo nao encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{mod.name}</h1>
          <Badge variant="outline">{mod.code}</Badge>
        </div>
        {mod.description && <p className="text-muted-foreground">{mod.description}</p>}
        <div className="flex gap-1 mt-2">
          {mod.pecaTypes.map((pt) => (
            <Badge key={pt} variant="secondary">
              {pt}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="legislacao">
        <TabsList>
          <TabsTrigger value="legislacao">Legislacao</TabsTrigger>
          <TabsTrigger value="jurisprudencia">Jurisprudencia</TabsTrigger>
          <TabsTrigger value="doutrina">Doutrina</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="corerefs">Core Refs</TabsTrigger>
        </TabsList>

        {/* Legislacao Tab */}
        <TabsContent value="legislacao" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Legislacao vinculada</h2>
            <Button
              size="sm"
              onClick={() => setShowForm(showForm === "legislacao" ? null : "legislacao")}
            >
              {showForm === "legislacao" ? "Cancelar" : "Adicionar"}
            </Button>
          </div>
          {showForm === "legislacao" && (
            <Card>
              <CardHeader>
                <CardTitle>Adicionar legislacao</CardTitle>
              </CardHeader>
              <CardContent>
                <LegislationForm
                  onSaved={() => {
                    setShowForm(null);
                    fetchModule();
                  }}
                />
              </CardContent>
            </Card>
          )}
          {mod.legislation.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma legislacao vinculada.</p>
          ) : (
            <div className="space-y-2">
              {mod.legislation.map((leg) => (
                <Card key={leg.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <span className="font-medium">{leg.diploma}</span>
                      <span className="text-muted-foreground ml-2">Art. {leg.article}</span>
                      {leg.epigraph && (
                        <span className="text-sm text-muted-foreground ml-2">— {leg.epigraph}</span>
                      )}
                      {leg.relevance !== undefined && (
                        <Badge variant="outline" className="ml-2">
                          Relevancia: {leg.relevance}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete("legislation", leg.id)}
                    >
                      Eliminar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Jurisprudencia Tab */}
        <TabsContent value="jurisprudencia" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Jurisprudencia</h2>
            <Button
              size="sm"
              onClick={() => setShowForm(showForm === "jurisprudencia" ? null : "jurisprudencia")}
            >
              {showForm === "jurisprudencia" ? "Cancelar" : "Adicionar"}
            </Button>
          </div>
          {showForm === "jurisprudencia" && (
            <Card>
              <CardHeader>
                <CardTitle>Adicionar jurisprudencia</CardTitle>
              </CardHeader>
              <CardContent>
                <JurisprudenceForm
                  moduleCode={code}
                  onSaved={() => {
                    setShowForm(null);
                    fetchModule();
                  }}
                />
              </CardContent>
            </Card>
          )}
          {mod.jurisprudence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma jurisprudencia.</p>
          ) : (
            <div className="space-y-2">
              {mod.jurisprudence.map((j) => (
                <Card key={j.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {j.court} — {j.caseNumber}
                      </CardTitle>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete("jurisprudence", j.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                    <CardDescription>
                      {new Date(j.date).toLocaleDateString("pt-PT")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm">{j.summary}</p>
                    {j.keyPassage && (
                      <p className="text-sm text-muted-foreground italic">
                        &ldquo;{j.keyPassage}&rdquo;
                      </p>
                    )}
                    {j.tags && j.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {j.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Doutrina Tab */}
        <TabsContent value="doutrina" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Doutrina</h2>
            <Button
              size="sm"
              onClick={() => setShowForm(showForm === "doutrina" ? null : "doutrina")}
            >
              {showForm === "doutrina" ? "Cancelar" : "Adicionar"}
            </Button>
          </div>
          {showForm === "doutrina" && (
            <Card>
              <CardHeader>
                <CardTitle>Adicionar doutrina</CardTitle>
                <CardDescription>Formulario de doutrina (a implementar).</CardDescription>
              </CardHeader>
            </Card>
          )}
          {mod.doctrine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma doutrina.</p>
          ) : (
            <div className="space-y-2">
              {mod.doctrine.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {d.author} — {d.work}
                      </CardTitle>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete("doctrine", d.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                    <CardDescription>
                      {d.page && `p. ${d.page}`}
                      {d.year && ` (${d.year})`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm italic">&ldquo;{d.passage}&rdquo;</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Notas Tab */}
        <TabsContent value="notas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Notas da plataforma</h2>
            <Button size="sm" onClick={() => setShowForm(showForm === "notas" ? null : "notas")}>
              {showForm === "notas" ? "Cancelar" : "Adicionar"}
            </Button>
          </div>
          {showForm === "notas" && (
            <Card>
              <CardHeader>
                <CardTitle>Adicionar nota</CardTitle>
              </CardHeader>
              <CardContent>
                <NoteForm
                  moduleCode={code}
                  onSaved={() => {
                    setShowForm(null);
                    fetchModule();
                  }}
                />
              </CardContent>
            </Card>
          )}
          {mod.platformNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma nota.</p>
          ) : (
            <div className="space-y-2">
              {mod.platformNotes.map((n) => (
                <Card key={n.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <Badge variant="outline" className="mr-2">
                        {n.category}
                      </Badge>
                      <span className="text-sm">{n.content}</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete("notes", n.id)}
                    >
                      Eliminar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Core Refs Tab */}
        <TabsContent value="corerefs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Core References</h2>
          </div>
          {!mod.coreRefs || mod.coreRefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma core reference.</p>
          ) : (
            <div className="space-y-2">
              {mod.coreRefs.map((cr) => (
                <Card key={cr.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <span className="font-medium">{cr.diploma}</span>
                      <span className="text-muted-foreground ml-2">Art. {cr.article}</span>
                      {cr.context && (
                        <span className="text-sm text-muted-foreground ml-2">— {cr.context}</span>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete("core-refs", cr.id)}
                    >
                      Eliminar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
