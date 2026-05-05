"use client";

import type { PecaDetail } from "../harness-shell";
import { Badge } from "@/components/ui/badge";
import { getPhaseNames } from "@/lib/orchestrator";

interface PipelineStateProps {
  peca: PecaDetail;
}

function statusBadge(status: string, isCurrentPhase: boolean) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="approved">Aprovada</Badge>;
    case "ACTIVE":
      return (
        <Badge variant={isCurrentPhase ? "streaming" : "default"}>
          {isCurrentPhase ? "A gerar..." : "Activa"}
        </Badge>
      );
    case "SKIPPED":
      return <Badge variant="skipped">Ignorada</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejeitada</Badge>;
    default:
      return <Badge variant="pending">Pendente</Badge>;
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export function PipelineState({ peca }: PipelineStateProps) {
  const PHASE_LABELS = getPhaseNames(peca.type as "ACPAD" | "CAUTELAR" | "EXECUCAO" | "RECURSO");
  // Build phase 0-5 array with fallback for phases not yet created
  const phaseMap = new Map(peca.phases.map((p) => [p.number, p]));

  return (
    <div className="harness-panel p-3">
      <h3 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
        Estado das fases
      </h3>
      <div className="space-y-1.5">
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const phase = phaseMap.get(n);
          const status = phase?.status ?? "PENDING";
          const isCurrentPhase = n === peca.currentPhase && status === "ACTIVE";
          const tokens = (phase?.tokenInput ?? 0) + (phase?.tokenOutput ?? 0);

          return (
            <div
              key={n}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-sm ${
                isCurrentPhase ? "bg-muted" : ""
              }`}
            >
              <span className="font-mono text-[0.6rem] text-muted-foreground w-4">{n}</span>
              <span className="text-xs flex-1 truncate">{PHASE_LABELS[n]}</span>
              {statusBadge(status, isCurrentPhase)}
              {tokens > 0 && (
                <span className="hidden sm:inline font-mono text-[0.6rem] text-muted-foreground">
                  {tokens.toLocaleString()}tk
                </span>
              )}
              <span className="hidden sm:inline font-mono text-[0.6rem] text-muted-foreground w-12 text-right">
                {formatTime(phase?.startedAt ?? null)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
