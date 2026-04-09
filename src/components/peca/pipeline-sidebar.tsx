"use client";

import { Badge } from "@/components/ui/badge";

interface PhaseInfo {
  number: number;
  status: string;
  label: string;
}

const PHASE_LABELS: Record<number, string> = {
  0: "Análise documental",
  1: "Pressupostos",
  2: "Matéria de facto",
  3: "Tempestividade",
  4: "Matéria de direito",
  5: "Pedidos e prova",
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  PENDING: { label: "Pendente", variant: "secondary" },
  ACTIVE: { label: "Ativa", variant: "default" },
  APPROVED: { label: "Aprovada", variant: "outline" },
  SKIPPED: { label: "Ignorada", variant: "secondary" },
  REJECTED: { label: "Rejeitada", variant: "destructive" },
};

interface PipelineSidebarProps {
  phases: { number: number; status: string }[];
  currentPhase: number;
  activeModules?: string[];
}

export function PipelineSidebar({ phases, currentPhase, activeModules }: PipelineSidebarProps) {
  const allPhases: PhaseInfo[] = [0, 1, 2, 3, 4, 5].map((n) => {
    const existing = phases.find((p) => p.number === n);
    return {
      number: n,
      status: existing?.status ?? "PENDING",
      label: PHASE_LABELS[n] ?? `Fase ${n}`,
    };
  });

  return (
    <aside className="w-56 shrink-0 space-y-4 border-r pr-4">
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">Pipeline</h3>

      <div className="space-y-1">
        {allPhases.map((p) => {
          const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDING;
          const isCurrent = p.number === currentPhase;

          return (
            <div
              key={p.number}
              className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                isCurrent ? "bg-accent font-medium" : ""
              }`}
            >
              <span>
                {p.number}. {p.label}
              </span>
              <Badge variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
            </div>
          );
        })}
      </div>

      {activeModules && activeModules.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Módulos ativos</h3>
          <div className="flex flex-wrap gap-1">
            {activeModules.map((m) => (
              <Badge key={m} variant="outline" className="text-xs">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
