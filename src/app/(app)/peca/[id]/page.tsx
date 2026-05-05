"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { HarnessShell } from "@/components/harness/harness-shell";

export default function PecaPage() {
  const params = useParams();
  const { data: session } = useSession();
  const pecaId = params.id as string;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="-m-6 lg:-m-8">
      <HarnessShell pecaId={pecaId} isAdmin={isAdmin} />
    </div>
  );
}
