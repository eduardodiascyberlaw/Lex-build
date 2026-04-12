"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StyleRef {
  id: string;
  pecaType: string;
  section: string;
  beforeText: string;
  afterText: string;
  notes: string | null;
  isGoldStandard: boolean;
  createdAt: string;
}

function truncate(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function StyleRefList({ refs }: { refs: StyleRef[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (refs.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem referencias nesta seccao.</p>;
  }

  return (
    <div className="space-y-3">
      {refs.map((ref) => {
        const isExpanded = expandedId === ref.id;

        return (
          <Card key={ref.id} className="cursor-pointer" onClick={() => toggleExpand(ref.id)}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {ref.pecaType}
                </Badge>
                {ref.isGoldStandard && (
                  <Badge className="bg-amber-100 text-amber-800 text-xs">Gold Standard</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(ref.createdAt).toLocaleDateString("pt-PT")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Antes</p>
                  <p className="whitespace-pre-wrap">
                    {isExpanded ? ref.beforeText : truncate(ref.beforeText)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Depois</p>
                  <p className="whitespace-pre-wrap">
                    {isExpanded ? ref.afterText : truncate(ref.afterText)}
                  </p>
                </div>
              </div>

              {ref.notes && isExpanded && (
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground mb-1">Notas</p>
                  <p className="whitespace-pre-wrap">{ref.notes}</p>
                </div>
              )}

              {!isExpanded && <p className="text-xs text-muted-foreground">Clique para expandir</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
