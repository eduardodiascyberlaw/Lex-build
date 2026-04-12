"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StyleReference {
  id: string;
  userName: string;
  pecaType: string;
  section: string;
  isGoldStandard: boolean;
  createdAt: string;
  beforeText?: string;
  afterText?: string;
}

export default function AdminStyleReferencesPage() {
  const [refs, setRefs] = useState<StyleReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const res = await fetch("/api/admin/style-references");
        if (res.ok) {
          const data = await res.json();
          setRefs(data);
        }
      } catch (err) {
        console.error("Erro ao carregar style refs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRefs();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Style References</h1>
        <p className="text-muted-foreground">Referencias de estilo de todos os utilizadores.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : refs.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma referencia encontrada.</p>
      ) : (
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Utilizador</th>
                <th className="text-left p-3 font-medium">Tipo de Peca</th>
                <th className="text-left p-3 font-medium">Seccao</th>
                <th className="text-left p-3 font-medium">Gold Standard</th>
                <th className="text-left p-3 font-medium">Criado em</th>
                <th className="text-right p-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {refs.map((ref) => (
                <>
                  <tr key={ref.id} className="border-b">
                    <td className="p-3">{ref.userName}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{ref.pecaType}</Badge>
                    </td>
                    <td className="p-3">{ref.section}</td>
                    <td className="p-3">
                      {ref.isGoldStandard ? (
                        <Badge variant="default">Gold</Badge>
                      ) : (
                        <span className="text-muted-foreground">Nao</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(ref.createdAt).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        className="text-sm underline text-primary"
                        onClick={() => toggleExpand(ref.id)}
                      >
                        {expanded.has(ref.id) ? "Fechar" : "Expandir"}
                      </button>
                    </td>
                  </tr>
                  {expanded.has(ref.id) && (
                    <tr key={`${ref.id}-detail`} className="border-b bg-muted/30">
                      <td colSpan={6} className="p-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Antes (original)</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm whitespace-pre-wrap">
                                {ref.beforeText || "Sem texto."}
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Depois (corrigido)</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm whitespace-pre-wrap">
                                {ref.afterText || "Sem texto."}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
