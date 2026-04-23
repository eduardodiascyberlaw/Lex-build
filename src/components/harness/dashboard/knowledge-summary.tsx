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
        { label: "CORE REFS", value: counts.core },
        { label: "LEGISLACAO", value: counts.legislation },
        { label: "JURISPRUDENCIA", value: counts.jurisprudence },
        { label: "DOUTRINA", value: counts.doctrine },
        { label: "STYLE REFS", value: counts.styleRefs },
      ]
    : null;

  return (
    <div className="harness-panel p-3">
      <h3 className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-2">
        BASE DE CONHECIMENTO
      </h3>
      {!items ? (
        <span className="text-xs text-muted-foreground font-mono">A carregar...</span>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div className="font-mono text-lg font-bold text-foreground">{item.value}</div>
              <div className="font-mono text-[0.55rem] uppercase tracking-widest text-muted-foreground">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
