"use client";

import type { PecaDetail } from "../harness-shell";
import { Badge } from "@/components/ui/badge";

interface PipelineStateProps {
  peca: PecaDetail;
}

const PHASE_LABELS: Record<number, string> = {
  0: "Analise documental",
  1: "Pressupostos",
  2: "Materia de facto",
  3: "Tempestividade",
  4: "Materia de direito",
  5: "Pedidos e prova",
};

function statusBadge(status: string, isCurrentPhase: boolean) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="approved">APROVADO</Badge>;
    case "ACTIVE":
      return (
        <Badge variant={isCurrentPhase ? "streaming" : "default"}>
          {isCurrentPhase ? "STREAMING" : "ATIVA"}
        </Badge>
      );
    case "SKIPPED":
      return <Badge variant="skipped">IGNORADO</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">REJEITADA</Badge>;
    default:
      return <Badge variant="pending">PENDENTE</Badge>;
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export function PipelineState({ peca }: PipelineStateProps) {
  // Build phase 0-5 array with fallback for phases not yet created
  const phaseMap = new Map(peca.phases.map((p) => [p.number, p]));

  return (
    <div className="harness-panel p-3">
      <h3 className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-2">
        ESTADO DO PIPELINE
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
                <span className="font-mono text-[0.6rem] text-muted-foreground">
                  {tokens.toLocaleString()}tk
                </span>
              )}
              <span className="font-mono text-[0.6rem] text-muted-foreground w-12 text-right">
                {formatTime(phase?.startedAt ?? null)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
