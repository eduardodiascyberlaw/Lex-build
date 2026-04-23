"use client";

import { useEffect, useState } from "react";
import type { PecaDetail } from "../harness-shell";
import { Button } from "@/components/ui/button";

interface ChatContextSidebarProps {
  peca: PecaDetail;
  onCommand: (command: string) => void;
  onApprove: () => void;
  onEdit?: () => void;
  onAttach?: () => void;
  uploading?: boolean;
}

interface RecentPeca {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

const PHASE_LABELS: Record<number, string> = {
  0: "Analise documental",
  1: "Pressupostos",
  2: "Materia de facto",
  3: "Tempestividade",
  4: "Materia de direito",
  5: "Pedidos e prova",
};

export function ChatContextSidebar({
  peca,
  onCommand,
  onApprove,
  onEdit,
  onAttach,
  uploading,
}: ChatContextSidebarProps) {
  const [recentPecas, setRecentPecas] = useState<RecentPeca[]>([]);

  useEffect(() => {
    fetch("/api/pecas")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RecentPeca[]) =>
        setRecentPecas(data.filter((p: RecentPeca) => p.id !== peca.id).slice(0, 5))
      )
      .catch(() => {});
  }, [peca.id]);

  const currentPhaseData = peca.phases.find(
    (p) => p.number === peca.currentPhase && p.status === "ACTIVE"
  );
  const hasContent = !!currentPhaseData?.content;

  return (
    <div className="w-64 shrink-0 border-r border-border overflow-y-auto bg-card">
      {/* Section 0A — Context */}
      <div className="p-3 border-b border-border">
        <h4 className="harness-sigil mb-2">§0A CONTEXTO DO CASO</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono">{peca.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TIPO</span>
            <span className="font-mono">{peca.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">FASE</span>
            <span className="font-mono">
              {peca.currentPhase} — {PHASE_LABELS[peca.currentPhase] ?? "?"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CLIENTE</span>
            <span className="font-mono truncate ml-2">
              {(peca.caseData?.cliente as string) ?? "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Section 0B — Quick Commands */}
      <div className="p-3 border-b border-border">
        <h4 className="harness-sigil mb-2">§0B COMANDOS RAPIDOS</h4>
        <div className="space-y-1">
          {hasContent && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-mono h-7"
              onClick={onApprove}
            >
              /FASE APROVAR
            </Button>
          )}
          {hasContent && onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-mono h-7"
              onClick={onEdit}
            >
              /FASE EDITAR
            </Button>
          )}
          {onAttach && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-mono h-7"
              onClick={onAttach}
              disabled={uploading}
            >
              {uploading ? "/DOC A ENVIAR..." : "/DOC ANEXAR"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs font-mono h-7"
            onClick={() => onCommand("/JURIS BUSCAR")}
          >
            /JURIS BUSCAR
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs font-mono h-7"
            onClick={() => onCommand("/RESUMO GERAR")}
          >
            /RESUMO GERAR
          </Button>
        </div>
      </div>

      {/* Section 0C — Recent threads */}
      <div className="p-3">
        <h4 className="harness-sigil mb-2">§0C THREADS ANTERIORES</h4>
        {recentPecas.length === 0 ? (
          <span className="text-xs text-muted-foreground">Nenhuma.</span>
        ) : (
          <div className="space-y-1.5">
            {recentPecas.map((p) => (
              <a
                key={p.id}
                href={`/peca/${p.id}`}
                className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-mono">{p.type}</span>
                <span className="ml-1 text-[0.6rem]">
                  {new Date(p.createdAt).toLocaleDateString("pt-PT")}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
