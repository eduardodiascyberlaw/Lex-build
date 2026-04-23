"use client";

import type { PecaDetail } from "../harness-shell";

interface CaseIdentificationProps {
  peca: PecaDetail;
}

export function CaseIdentification({ peca }: CaseIdentificationProps) {
  const cd = peca.caseData ?? {};

  const title =
    (cd.titulo as string) ?? (cd.caso_titulo as string) ?? `${peca.type} — ${peca.id.slice(0, 8)}`;

  const fields: { label: string; value: string | undefined }[] = [
    { label: "CLIENTE", value: cd.cliente as string | undefined },
    { label: "NACIONALIDADE", value: cd.nacionalidade as string | undefined },
    { label: "TRIBUNAL", value: cd.tribunal as string | undefined },
    { label: "ADVOGADA", value: cd.advogada as string | undefined },
    { label: "TIPO", value: peca.type },
    { label: "CRIADO", value: new Date(peca.createdAt).toLocaleDateString("pt-PT") },
  ];

  return (
    <div className="harness-panel p-3">
      <h3 className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-2">
        IDENTIFICACAO DO CASO
      </h3>
      <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2">
        {fields.map((f) => (
          <div key={f.label}>
            <span className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">
              {f.label}
            </span>
            <p className="text-xs text-foreground truncate">{f.value ?? "--"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
