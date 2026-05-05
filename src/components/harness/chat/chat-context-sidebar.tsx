"use client";

import { useEffect, useState } from "react";
import type { PecaDetail } from "../harness-shell";
import { Button } from "@/components/ui/button";
import { getPhaseNames, type PecaTypeStr } from "@/lib/orchestrator";

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
  const phaseLabels = getPhaseNames(peca.type as PecaTypeStr);

  return (
    <div className="w-64 shrink-0 border-r border-border overflow-y-auto bg-card">
      {/* Contexto do caso */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
          Contexto do caso
        </h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID</span>
            <span>{peca.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <span>{peca.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fase</span>
            <span>
              {peca.currentPhase} — {phaseLabels[peca.currentPhase] ?? "?"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="truncate ml-2">
              {(peca.caseData?.cliente as string) ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Acções rápidas */}
      <div className="p-3 border-b border-border">
        <h4 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
          Acções
        </h4>
        <div className="space-y-1">
          {hasContent && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-7"
              onClick={onApprove}
            >
              Aprovar fase
            </Button>
          )}
          {hasContent && onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-7"
              onClick={onEdit}
            >
              Editar antes de aprovar
            </Button>
          )}
          {onAttach && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-7"
              onClick={onAttach}
              disabled={uploading}
            >
              {uploading ? "A anexar..." : "Anexar documento"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs h-7"
            onClick={() => onCommand("Procura jurisprudência relevante para esta fase.")}
          >
            Procurar jurisprudência
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs h-7"
            onClick={() => onCommand("Resume o caso até agora.")}
          >
            Resumir caso
          </Button>
        </div>
      </div>

      {/* Outras peças */}
      <div className="p-3">
        <h4 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
          Outras peças
        </h4>
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
                <span>{p.type}</span>
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
