"use client";

import { useEffect, useState } from "react";
import type { PecaDetail } from "../harness-shell";

interface KnowledgeSummaryProps {
  peca: PecaDetail;
}

interface KnowledgeCounts {
  core: number;
  legislation: number;
  jurisprudence: number;
  doctrine: number;
  styleRefs: number;
}

export function KnowledgeSummary({ peca }: KnowledgeSummaryProps) {
  const [counts, setCounts] = useState<KnowledgeCounts | null>(null);

  useEffect(() => {
    fetch(`/api/pecas/${peca.id}/knowledge`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCounts(data);
      })
      .catch(() => {});
  }, [peca.id]);

  const items = counts
    ? [
        { label: "Núcleo", value: counts.core },
        { label: "Legislação", value: counts.legislation },
        { label: "Jurisprudência", value: counts.jurisprudence },
        { label: "Doutrina", value: counts.doctrine },
        { label: "Estilo", value: counts.styleRefs },
      ]
    : null;

  return (
    <div className="harness-panel p-3">
      <h3 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
        Base de conhecimento
      </h3>
      {!items ? (
        <span className="text-xs text-muted-foreground">A carregar...</span>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-lg font-bold text-foreground">{item.value}</div>
              <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
