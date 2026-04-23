"use client";

import { useState } from "react";
import type { PecaDetail } from "./harness-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalBar } from "@/components/peca/approval-bar";
import { getPhaseNames } from "@/lib/orchestrator";

interface TabPipelineProps {
  peca: PecaDetail;
  onApproved: () => void;
}

function statusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="approved">APROVADO</Badge>;
    case "ACTIVE":
      return <Badge variant="streaming">ATIVA</Badge>;
    case "SKIPPED":
      return <Badge variant="skipped">IGNORADO</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">REJEITADA</Badge>;
    default:
      return <Badge variant="pending">PENDENTE</Badge>;
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TabPipeline({ peca, onApproved }: TabPipelineProps) {
  const PHASE_LABELS = getPhaseNames(peca.type as "ACPAD" | "CAUTELAR");
  const [expandedPhase, setExpandedPhase] = useState<number | null>(peca.currentPhase);
  const phaseMap = new Map(peca.phases.map((p) => [p.number, p]));

  const currentPhaseData = peca.phases.find(
    (p) => p.number === peca.currentPhase && p.status === "ACTIVE"
  );

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-2 max-w-4xl mx-auto">
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const phase = phaseMap.get(n);
          const status = phase?.status ?? "PENDING";
          const isExpanded = expandedPhase === n;
          const isCurrentActive = n === peca.currentPhase && status === "ACTIVE";
          const tokens = (phase?.tokenInput ?? 0) + (phase?.tokenOutput ?? 0);

          return (
            <div
              key={n}
              className={`harness-panel overflow-hidden ${
                isCurrentActive ? "ring-1 ring-primary/50" : ""
              }`}
            >
              {/* Phase header */}
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : n)}
                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <span className="font-mono text-sm text-muted-foreground w-4 sm:w-6 shrink-0">
                  {n}
                </span>
                <span className="text-xs sm:text-sm font-medium flex-1 text-left truncate">
                  {PHASE_LABELS[n]}
                </span>
                {statusBadge(status)}
                {tokens > 0 && (
                  <span className="hidden sm:inline font-mono text-xs text-muted-foreground">
                    {tokens.toLocaleString()} tk
                  </span>
                )}
                <span className="hidden sm:inline font-mono text-xs text-muted-foreground">
                  {formatTime(phase?.startedAt ?? null)}
                </span>
                <span className="text-muted-foreground text-xs shrink-0">
                  {isExpanded ? "▼" : "▶"}
                </span>
              </button>

              {/* Phase content (expanded) */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {/* Timestamps */}
                  <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-1 text-xs text-muted-foreground font-mono">
                    <span>INICIO: {formatTime(phase?.startedAt ?? null)}</span>
                    <span>FIM: {formatTime(phase?.approvedAt ?? null)}</span>
                    {phase?.tokenInput != null && (
                      <span>IN: {phase.tokenInput.toLocaleString()}</span>
                    )}
                    {phase?.tokenOutput != null && (
                      <span>OUT: {phase.tokenOutput.toLocaleString()}</span>
                    )}
                    {phase?.editedByUser && <span className="text-harness-amber">EDITADA</span>}
                  </div>

                  {/* Content preview */}
                  {phase?.content && (
                    <div className="bg-muted rounded-sm p-3 max-h-64 overflow-y-auto text-sm whitespace-pre-wrap text-foreground/80">
                      {phase.content}
                    </div>
                  )}

                  {/* Approval bar for current active phase */}
                  {isCurrentActive && currentPhaseData?.content && (
                    <ApprovalBar
                      pecaId={peca.id}
                      phaseContent={currentPhaseData.content}
                      onApproved={onApproved}
                    />
                  )}

                  {/* Skip button for non-mandatory phases */}
                  {isCurrentActive && !phase?.content && (
                    <div className="text-xs text-muted-foreground">
                      A aguardar output do agente. Use o tab CHAT para interagir.
                    </div>
                  )}

                  {status === "PENDING" && (
                    <div className="text-xs text-muted-foreground font-mono">
                      FASE PENDENTE — aguarda conclusao das fases anteriores.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
