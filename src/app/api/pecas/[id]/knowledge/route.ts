import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-peca-knowledge");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true, type: true, caseData: true },
    });

    if (!peca) {
      return errorResponse("Nao encontrado", 404, "NOT_FOUND");
    }

    const activeModules =
      ((peca.caseData as Record<string, unknown>)?.modules_active as string[]) ?? [];

    // Count core legislation
    const core = await prisma.legislation.count({
      where: { scope: "CORE", isActive: true },
    });

    // Count module-specific content
    const modules = await prisma.thematicModule.findMany({
      where: { isActive: true, pecaTypes: { has: peca.type as "ACPAD" | "CAUTELAR" } },
      select: {
        code: true,
        name: true,
        description: true,
        _count: {
          select: {
            legislation: true,
            jurisprudence: true,
            doctrine: true,
            platformNotes: true,
          },
        },
      },
    });

    // Total counts
    const totalLegislation = modules.reduce((s, m) => s + m._count.legislation, 0) + core;
    const totalJurisprudence = modules.reduce((s, m) => s + m._count.jurisprudence, 0);
    const totalDoctrine = modules.reduce((s, m) => s + m._count.doctrine, 0);

    // Style refs for this user
    const styleRefs = await prisma.styleReference.count({
      where: { userId: auth.user.id, pecaType: peca.type as "ACPAD" | "CAUTELAR", isActive: true },
    });

    return NextResponse.json({
      core,
      legislation: totalLegislation,
      jurisprudence: totalJurisprudence,
      doctrine: totalDoctrine,
      styleRefs,
      modules: modules.map((m) => ({
        code: m.code,
        name: m.name,
        description: m.description,
        legislationCount: m._count.legislation,
        jurisprudenceCount: m._count.jurisprudence,
        doctrineCount: m._count.doctrine,
        notesCount: m._count.platformNotes,
      })),
    });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to fetch knowledge");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
