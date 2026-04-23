import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PecaTypeCard } from "@/components/dashboard/peca-type-card";
import { RecentPecas } from "@/components/dashboard/recent-pecas";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;

  const recentPecas = await prisma.peca.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      status: true,
      currentPhase: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Escolha o tipo de peça processual a gerar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PecaTypeCard
          type="ACPAD"
          title="ACPAD"
          description="Ação de Condenação à Prática de Ato Devido. Direito administrativo — impugnação de atos da administração."
          available
        />
        <PecaTypeCard
          type="CAUTELAR"
          title="Providência Cautelar"
          description="Suspensão de eficácia de ato administrativo. 3 fases: facto, direito, pedidos."
          available
        />
        <PecaTypeCard
          type="EXECUCAO"
          title="Execução de Sentença"
          description="Requerimento de execução de sentença administrativa. Arts. 157.º-179.º CPTA."
          available
        />
      </div>

      {recentPecas.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Peças recentes</h2>
          <RecentPecas pecas={recentPecas} />
        </div>
      )}
    </div>
  );
}
