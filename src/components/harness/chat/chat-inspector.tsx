"use client";

import type { PecaDetail } from "../harness-shell";

interface ChatInspectorProps {
  peca: PecaDetail;
}

function estimateCost(input: number, output: number): string {
  const cost = (input * 3 + output * 15) / 1_000_000;
  return cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
}

export function ChatInspector({ peca }: ChatInspectorProps) {
  const currentPhase = peca.phases.find((p) => p.number === peca.currentPhase);
  const tokenIn = currentPhase?.tokenInput ?? 0;
  const tokenOut = currentPhase?.tokenOutput ?? 0;

  // Calculate latency for current phase
  const latency =
    currentPhase?.startedAt && currentPhase?.approvedAt
      ? (
          (new Date(currentPhase.approvedAt).getTime() -
            new Date(currentPhase.startedAt).getTime()) /
          1000
        ).toFixed(1) + "s"
      : "--";

  const guardRails = [
    { label: "ANTI-AI-REVIEW", active: peca.currentPhase >= 1 },
    { label: "CITACAO-CHECK", active: peca.currentPhase >= 4 },
    { label: "PII-FILTER", active: true },
    { label: "OWNERSHIP", active: true },
  ];

  return (
    <div className="w-72 shrink-0 border-l border-border overflow-y-auto bg-card">
      {/* Custo desta fase */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
          Esta fase
        </h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tokens entrada</span>
            <span>{tokenIn.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tokens saída</span>
            <span>{tokenOut.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duração</span>
            <span>{latency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Custo</span>
            <span className="text-harness-amber">{estimateCost(tokenIn, tokenOut)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Modelo</span>
            <span className="text-[0.65rem] truncate ml-2">{peca.model}</span>
          </div>
        </div>
      </div>

      {/* Verificações activas */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
          Verificações
        </h4>
        <div className="space-y-1">
          {guardRails.map((gr) => {
            const labels: Record<string, string> = {
              "ANTI-AI-REVIEW": "Revisão anti-IA",
              "CITACAO-CHECK": "Verificação de citações",
              "PII-FILTER": "Filtro de dados pessoais",
              "OWNERSHIP": "Propriedade do caso",
            };
            return (
              <div key={gr.label} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    gr.active ? "bg-harness-green" : "bg-muted-foreground/30"
                  }`}
                />
                <span
                  className={`text-[0.7rem] ${gr.active ? "text-harness-green" : "text-muted-foreground"}`}
                >
                  {labels[gr.label] ?? gr.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Módulos activos */}
      <div className="p-3">
        <h4 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
          Módulos activos
        </h4>
        {(() => {
          const modules = (peca.caseData?.modules_active as string[]) ?? [];
          if (modules.length === 0)
            return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="space-y-0.5">
              {modules.map((m) => (
                <div key={m} className="text-[0.7rem] text-muted-foreground">
                  {m}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
