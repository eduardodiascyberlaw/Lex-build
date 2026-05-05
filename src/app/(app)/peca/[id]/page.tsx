"use client";

import { useParams } from "next/navigation";
import { PecaShellV2 } from "@/components/harness/v2/peca-shell-v2";

export default function PecaPage() {
  const params = useParams();
  const pecaId = params.id as string;

  return (
    <div className="-m-6 lg:-m-8">
      <PecaShellV2 pecaId={pecaId} />
    </div>
  );
}
