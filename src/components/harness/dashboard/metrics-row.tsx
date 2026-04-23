"use client";

import type { PecaDetail } from "../harness-shell";

interface MetricsRowProps {
  peca: PecaDetail;
}

function getAgentStatus(status: string): { label: string; color: string } {
  if (status === "COMPLETED") return { label: "CONCLUIDO", color: "text-harness-green" };
  if (status === "ERROR") return { label: "ERRO", color: "text-primary" };
  if (status.includes("ACTIVE")) return { label: "ATIVO", color: "text-harness-green" };
  if (status === "GENERATING_DOCX") return { label: "GERANDO", color: "text-harness-amber" };
  return { label: "IDLE", color: "text-muted-foreground" };
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
  const totalTokens = totalInput + totalOutput;

  // Calculate P50 latency from phases with startedAt and approvedAt
  const latencies = peca.phases
    .filter((p) => p.startedAt && p.approvedAt)
    .map((p) => new Date(p.approvedAt!).getTime() - new Date(p.startedAt!).getTime());
  const p50 =
    latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)] : 0;
  const p50Str = p50 > 0 ? `${(p50 / 1000).toFixed(1)}s` : "--";

  const cost = estimateCost(totalInput, totalOutput);

  const metrics = [
    { label: "STATUS", value: status.label, className: status.color },
    { label: "FASE ATUAL", value: `${currentPhase}/${totalPhases}`, className: "text-foreground" },
    { label: "TOKENS SESSAO", value: totalTokens.toLocaleString(), className: "text-foreground" },
    { label: "LATENCIA P50", value: p50Str, className: "text-foreground" },
    { label: "CUSTO ESTIMADO", value: cost, className: "text-harness-amber" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-border">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card px-3 py-2.5">
          <div className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            {m.label}
          </div>
          <div className={`font-mono text-sm font-semibold ${m.className}`}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}
