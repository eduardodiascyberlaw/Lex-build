"use client";

import type { PecaDetail } from "../harness-shell";

interface MetricsRowProps {
  peca: PecaDetail;
}

function getAgentStatus(status: string): { label: string; color: string } {
  if (status === "COMPLETED") return { label: "Concluída", color: "text-harness-green" };
  if (status === "ERROR") return { label: "Erro", color: "text-primary" };
  if (status.includes("ACTIVE")) return { label: "Em curso", color: "text-harness-green" };
  if (status === "GENERATING_DOCX") return { label: "A gerar documento", color: "text-harness-amber" };
  return { label: "Em espera", color: "text-muted-foreground" };
}

function estimateCost(inputTokens: number, outputTokens: number): string {
  // Claude Sonnet pricing approximation: $3/M input, $15/M output
  const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  return cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
}

export function MetricsRow({ peca }: MetricsRowProps) {
  const status = getAgentStatus(peca.status);
  const currentPhase = peca.currentPhase;
  const totalPhases = 5;

  const totalInput = peca.phases.reduce((s, p) => s + (p.tokenInput ?? 0), 0);
  const totalOutput = peca.phases.reduce((s, p) => s + (p.tokenOutput ?? 0), 0);
  const cost = estimateCost(totalInput, totalOutput);

  const metrics = [
    { label: "Estado", value: status.label, className: status.color },
    { label: "Fase atual", value: `${currentPhase}/${totalPhases}`, className: "text-foreground" },
    { label: "Custo estimado", value: cost, className: "text-harness-amber" },
  ];

  return (
    <div className="grid grid-cols-3 gap-px bg-border">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card px-3 py-2.5">
          <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-1">
            {m.label}
          </div>
          <div className={`text-sm font-semibold ${m.className}`}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}
