import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-peca-start");

/**
 * Start the pipeline: transition DRAFT → PHASE_0_ACTIVE
 * Creates Phase 0 record and sets status.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      include: { uploads: { select: { id: true } } },
    });

    if (!peca) {
      return errorResponse("Não encontrado", 404, "NOT_FOUND");
    }

    if (peca.status !== "DRAFT") {
      return errorResponse("Pipeline já iniciado", 400, "ALREADY_STARTED");
    }

    if (peca.uploads.length === 0) {
      return errorResponse("Carregue pelo menos um documento antes de iniciar", 400, "NO_UPLOADS");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.phase.create({
        data: {
          pecaId: id,
          number: 0,
          status: "ACTIVE",
          startedAt: new Date(),
        },
      });

      return tx.peca.update({
        where: { id },
        data: {
          status: "PHASE_0_ACTIVE",
          currentPhase: 0,
        },
      });
    });

    logger.info({ userId: auth.user.id, pecaId: id }, "Pipeline started");

    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to start pipeline");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
