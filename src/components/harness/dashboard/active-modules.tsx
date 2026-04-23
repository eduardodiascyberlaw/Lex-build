"use client";

import type { PecaDetail } from "../harness-shell";

interface ActiveModulesProps {
  peca: PecaDetail;
}

const MODULE_COLORS: Record<string, string> = {
  "sis-indicacao": "bg-harness-red/20 text-harness-red",
  "abandono-voluntario": "bg-harness-amber/20 text-harness-amber",
  "erro-facto": "bg-harness-blue/20 text-harness-blue",
  "ilegalidade-formal": "bg-purple-900/30 text-purple-400",
  "integracao-socioprofissional": "bg-harness-green/20 text-harness-green",
  "menor-portugues": "bg-cyan-900/30 text-cyan-400",
  proporcionalidade: "bg-harness-amber/20 text-harness-amber",
  "proibicoes-absolutas": "bg-harness-red/20 text-harness-red",
};

export function ActiveModules({ peca }: ActiveModulesProps) {
  const modules = (peca.caseData?.modules_active as string[]) ?? [];

  return (
    <div className="harness-panel p-3">
      <h3 className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-2">
        MODULOS ACTIVOS
      </h3>
      {modules.length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhum modulo activado.</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {modules.map((m) => (
            <span
              key={m}
              className={`inline-flex items-center px-2 py-0.5 text-[0.65rem] font-mono rounded-sm ${
                MODULE_COLORS[m] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
