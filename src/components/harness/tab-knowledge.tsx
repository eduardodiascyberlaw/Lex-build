"use client";

import { useEffect, useState } from "react";
import type { PecaDetail } from "./harness-shell";

interface TabKnowledgeProps {
  peca: PecaDetail;
}

interface ModuleDetail {
  code: string;
  name: string;
  description: string | null;
  legislationCount: number;
  jurisprudenceCount: number;
  doctrineCount: number;
  notesCount: number;
}

interface KnowledgeData {
  core: number;
  legislation: number;
  jurisprudence: number;
  doctrine: number;
  styleRefs: number;
  modules: ModuleDetail[];
}

export function TabKnowledge({ peca }: TabKnowledgeProps) {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeModules = (peca.caseData?.modules_active as string[]) ?? [];

  useEffect(() => {
    fetch(`/api/pecas/${peca.id}/knowledge`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [peca.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground animate-pulse">
          A CARREGAR BASE DE CONHECIMENTO...
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-sm text-primary">ERRO AO CARREGAR CONHECIMENTO</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Summary counters */}
        <div className="grid grid-cols-5 gap-px bg-border">
          {[
            { label: "CORE REFS", value: data.core },
            { label: "LEGISLACAO", value: data.legislation },
            { label: "JURISPRUDENCIA", value: data.jurisprudence },
            { label: "DOUTRINA", value: data.doctrine },
            { label: "STYLE REFS", value: data.styleRefs },
          ].map((item) => (
            <div key={item.label} className="bg-card px-3 py-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">{item.value}</div>
              <div className="font-mono text-[0.55rem] uppercase tracking-widest text-muted-foreground mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Active modules */}
        <div>
          <h3 className="harness-sigil mb-3">MODULOS ACTIVADOS ({activeModules.length})</h3>
          {activeModules.length === 0 ? (
            <div className="harness-panel p-4 text-xs text-muted-foreground">
              Nenhum modulo activado nesta peca. Os modulos sao activados na Fase 0.
            </div>
          ) : (
            <div className="space-y-1">
              {data.modules
                .filter((m) => activeModules.includes(m.code))
                .map((mod) => {
                  const isExpanded = expandedModule === mod.code;
                  return (
                    <div key={mod.code} className="harness-panel">
                      <button
                        onClick={() => setExpandedModule(isExpanded ? null : mod.code)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-mono text-xs text-harness-green">{mod.code}</span>
                        <span className="text-sm flex-1 text-left">{mod.name}</span>
                        <span className="font-mono text-[0.6rem] text-muted-foreground">
                          L:{mod.legislationCount} J:{mod.jurisprudenceCount} D:{mod.doctrineCount}{" "}
                          N:{mod.notesCount}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </button>
                      {isExpanded && mod.description && (
                        <div className="border-t border-border px-4 py-3 text-xs text-foreground/70">
                          {mod.description}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* All available modules */}
        {data.modules.filter((m) => !activeModules.includes(m.code)).length > 0 && (
          <div>
            <h3 className="harness-sigil mb-3">OUTROS MODULOS DISPONIVEIS</h3>
            <div className="space-y-1">
              {data.modules
                .filter((m) => !activeModules.includes(m.code))
                .map((mod) => (
                  <div key={mod.code} className="harness-panel opacity-50">
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground">{mod.code}</span>
                      <span className="text-sm flex-1">{mod.name}</span>
                      <span className="font-mono text-[0.6rem] text-muted-foreground">
                        L:{mod.legislationCount} J:{mod.jurisprudenceCount} D:{mod.doctrineCount}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
