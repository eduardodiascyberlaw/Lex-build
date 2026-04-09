"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface PecaRow {
  id: string;
  type: string;
  status: string;
  currentPhase: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PHASE_0_ACTIVE: "Fase 0 — Em análise",
  PHASE_0_APPROVED: "Fase 0 — Aprovada",
  PHASE_1_ACTIVE: "Fase 1 — Pressupostos",
  PHASE_1_APPROVED: "Fase 1 — Aprovada",
  PHASE_2_ACTIVE: "Fase 2 — Factos",
  PHASE_2_APPROVED: "Fase 2 — Aprovada",
  PHASE_3_ACTIVE: "Fase 3 — Tempestividade",
  PHASE_3_APPROVED: "Fase 3 — Aprovada",
  PHASE_3_SKIPPED: "Fase 3 — Ignorada",
  PHASE_4_ACTIVE: "Fase 4 — Direito",
  PHASE_4_APPROVED: "Fase 4 — Aprovada",
  PHASE_5_ACTIVE: "Fase 5 — Pedidos",
  PHASE_5_APPROVED: "Fase 5 — Aprovada",
  GENERATING_DOCX: "A gerar .docx",
  COMPLETED: "Concluída",
  ERROR: "Erro",
};

function formatDate(dateStr: Date | string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function RecentPecas({ pecas }: { pecas: PecaRow[] }) {
  return (
    <div className="space-y-2">
      {pecas.map((peca) => (
        <Link
          key={peca.id}
          href={`/peca/${peca.id}`}
          className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <Badge variant="outline">{peca.type}</Badge>
            <span className="text-sm">{statusLabels[peca.status] ?? peca.status}</span>
          </div>
          <span className="text-xs text-muted-foreground">{formatDate(peca.updatedAt)}</span>
        </Link>
      ))}
    </div>
  );
}
