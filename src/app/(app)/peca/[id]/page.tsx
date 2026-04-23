"use client";

import { useParams } from "next/navigation";
import { HarnessShell } from "@/components/harness/harness-shell";

export default function PecaPage() {
  const params = useParams();
  const pecaId = params.id as string;

  return (
    <div className="-m-6 lg:-m-8">
      <HarnessShell pecaId={pecaId} />
    </div>
  );
}
