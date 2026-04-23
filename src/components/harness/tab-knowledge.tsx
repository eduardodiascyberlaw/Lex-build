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

interface LegislationItem {
  diploma: string;
  article: string;
  epigraph: string | null;
  content: string;
}

interface JurisprudenceItem {
  court: string;
  caseNumber: string;
  date: string;
  summary: string;
  keyPassage: string | null;
}

interface DoctrineItem {
  author: string;
  work: string;
  passage: string;
  page: string | null;
  year: number | null;
}

interface NoteItem {
  content: string;
  category: string;
}

interface ModuleExpandedData {
  code: string;
  legislation: LegislationItem[];
  jurisprudence: JurisprudenceItem[];
  doctrine: DoctrineItem[];
  platformNotes: NoteItem[];
  coreLegislation: LegislationItem[];
}

export function TabKnowledge({ peca }: TabKnowledgeProps) {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ModuleExpandedData | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
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

  async function handleToggleModule(code: string) {
    if (expandedModule === code) {
      setExpandedModule(null);
      setExpandedData(null);
      return;
    }

    setExpandedModule(code);
    setExpandedLoading(true);
    setExpandedData(null);

    try {
      const res = await fetch(
        `/api/pecas/${peca.id}/knowledge?detail=true&module=${encodeURIComponent(code)}`
      );
      if (res.ok) {
        const d = await res.json();
        setExpandedData(d);
      }
    } catch {
      // silent
    } finally {
      setExpandedLoading(false);
    }
  }

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
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-border">
          {[
            { label: "CORE REFS", value: data.core },
            { label: "LEGISLACAO", value: data.legislation },
            { label: "JURISPRUD.", value: data.jurisprudence },
            { label: "DOUTRINA", value: data.doctrine },
            { label: "STYLE REFS", value: data.styleRefs },
          ].map((item) => (
            <div key={item.label} className="bg-card px-2 sm:px-3 py-3 text-center">
              <div className="font-mono text-xl sm:text-2xl font-bold text-foreground">
                {item.value}
              </div>
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
                        onClick={() => handleToggleModule(mod.code)}
                        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-mono text-xs text-harness-green truncate max-w-20 sm:max-w-none">
                          {mod.code}
                        </span>
                        <span className="text-xs sm:text-sm flex-1 text-left truncate">
                          {mod.name}
                        </span>
                        <span className="hidden sm:inline font-mono text-[0.6rem] text-muted-foreground">
                          L:{mod.legislationCount} J:{mod.jurisprudenceCount} D:{mod.doctrineCount}{" "}
                          N:{mod.notesCount}
                        </span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border max-h-[60vh] overflow-y-auto">
                          {expandedLoading && (
                            <div className="px-4 py-6 text-center">
                              <span className="font-mono text-xs text-muted-foreground animate-pulse">
                                A CARREGAR DETALHES...
                              </span>
                            </div>
                          )}

                          {expandedData && (
                            <div className="divide-y divide-border harness-animate-in">
                              {/* Core legislation */}
                              {expandedData.coreLegislation.length > 0 && (
                                <ExpandedSection
                                  title="NUCLEO CORE"
                                  count={expandedData.coreLegislation.length}
                                >
                                  {expandedData.coreLegislation.map((leg, i) => (
                                    <LegislationCard key={i} item={leg} />
                                  ))}
                                </ExpandedSection>
                              )}

                              {/* Module legislation */}
                              {expandedData.legislation.length > 0 && (
                                <ExpandedSection
                                  title="LEGISLACAO"
                                  count={expandedData.legislation.length}
                                >
                                  {expandedData.legislation.map((leg, i) => (
                                    <LegislationCard key={i} item={leg} />
                                  ))}
                                </ExpandedSection>
                              )}

                              {/* Jurisprudence */}
                              {expandedData.jurisprudence.length > 0 && (
                                <ExpandedSection
                                  title="JURISPRUDENCIA"
                                  count={expandedData.jurisprudence.length}
                                >
                                  {expandedData.jurisprudence.map((jur, i) => (
                                    <JurisprudenceCard key={i} item={jur} />
                                  ))}
                                </ExpandedSection>
                              )}

                              {/* Doctrine */}
                              {expandedData.doctrine.length > 0 && (
                                <ExpandedSection
                                  title="DOUTRINA"
                                  count={expandedData.doctrine.length}
                                >
                                  {expandedData.doctrine.map((doc, i) => (
                                    <DoctrineCard key={i} item={doc} />
                                  ))}
                                </ExpandedSection>
                              )}

                              {/* Platform notes */}
                              {expandedData.platformNotes.length > 0 && (
                                <ExpandedSection
                                  title="NOTAS"
                                  count={expandedData.platformNotes.length}
                                >
                                  {expandedData.platformNotes.map((note, i) => (
                                    <div key={i} className="px-4 py-2 text-xs text-foreground/70">
                                      <span className="font-mono text-[0.55rem] text-muted-foreground uppercase">
                                        {note.category}
                                      </span>
                                      <p className="mt-1">{note.content}</p>
                                    </div>
                                  ))}
                                </ExpandedSection>
                              )}

                              {/* Empty state */}
                              {expandedData.legislation.length === 0 &&
                                expandedData.jurisprudence.length === 0 &&
                                expandedData.doctrine.length === 0 &&
                                expandedData.platformNotes.length === 0 &&
                                expandedData.coreLegislation.length === 0 && (
                                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                                    Modulo sem conteudo detalhado.
                                  </div>
                                )}
                            </div>
                          )}

                          {!expandedLoading && !expandedData && mod.description && (
                            <div className="px-4 py-3 text-xs text-foreground/70">
                              {mod.description}
                            </div>
                          )}
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

// Sub-components

function ExpandedSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="px-4 py-1.5">
        <span className="harness-sigil">{title}</span>
        <span className="ml-2 font-mono text-[0.55rem] text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LegislationCard({ item }: { item: LegislationItem }) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">
          {item.diploma} art. {item.article}
        </span>
        {item.epigraph && (
          <span className="text-[0.65rem] text-muted-foreground italic">{item.epigraph}</span>
        )}
      </div>
      <pre className="mt-1 text-xs font-mono whitespace-pre-wrap text-foreground/60 leading-relaxed max-h-32 overflow-y-auto">
        {item.content}
      </pre>
    </div>
  );
}

function JurisprudenceCard({ item }: { item: JurisprudenceItem }) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-foreground">{item.court}</span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          Proc. {item.caseNumber}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">{item.date}</span>
      </div>
      <p className="mt-1 text-xs text-foreground/70">{item.summary}</p>
      {item.keyPassage && (
        <blockquote className="mt-1.5 border-l-2 border-primary/40 pl-3 text-xs text-foreground/60 italic max-h-24 overflow-y-auto">
          {item.keyPassage}
        </blockquote>
      )}
    </div>
  );
}

function DoctrineCard({ item }: { item: DoctrineItem }) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-foreground">{item.author}</span>
        <span className="text-[0.65rem] text-muted-foreground italic">{item.work}</span>
        {item.page && (
          <span className="font-mono text-[0.55rem] text-muted-foreground">p. {item.page}</span>
        )}
        {item.year && (
          <span className="font-mono text-[0.55rem] text-muted-foreground">({item.year})</span>
        )}
      </div>
      <p className="mt-1 text-xs text-foreground/60 italic max-h-24 overflow-y-auto">
        {item.passage}
      </p>
    </div>
  );
}
