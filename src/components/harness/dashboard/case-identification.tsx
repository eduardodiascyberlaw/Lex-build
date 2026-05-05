"use client";

import type { PecaDetail } from "../harness-shell";

interface CaseIdentificationProps {
  peca: PecaDetail;
}

export function CaseIdentification({ peca }: CaseIdentificationProps) {
  const cd = peca.caseData ?? {};

  const title =
    (cd.titulo as string) ?? (cd.caso_titulo as string) ?? `${peca.type} — ${peca.id.slice(0, 8)}`;

  const mandatario =
    (cd.advogado as string | undefined) ??
    (cd.advogada as string | undefined) ??
    (cd.mandatario as string | undefined);

  const fields: { label: string; value: string | undefined }[] = [
    { label: "Cliente", value: cd.cliente as string | undefined },
    { label: "Nacionalidade", value: cd.nacionalidade as string | undefined },
    { label: "Tribunal", value: cd.tribunal as string | undefined },
    { label: "Mandatário", value: mandatario },
    { label: "Tipo", value: peca.type },
    { label: "Criado", value: new Date(peca.createdAt).toLocaleDateString("pt-PT") },
  ];

  return (
    <div className="harness-panel p-3">
      <h3 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
        Identificação do caso
      </h3>
      <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
        {fields.map((f) => (
          <div key={f.label}>
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {f.label}
            </span>
            <p className="text-xs text-foreground truncate">{f.value ?? "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
