import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-peca-detail");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Explicit select — never ship outputBytes (heavy bytea) to the client
    // when listing the peca; clients fetch the binary via /download.
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        currentPhase: true,
        templateId: true,
        caseData: true,
        model: true,
        outputFilename: true,
        outputMimeType: true,
        createdAt: true,
        updatedAt: true,
        uploads: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            createdAt: true,
          },
        },
        phases: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            status: true,
            content: true,
            editedByUser: true,
            tokenInput: true,
            tokenOutput: true,
            startedAt: true,
            approvedAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 50,
          select: {
            id: true,
            phase: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!peca) {
      return errorResponse("Não encontrado", 404, "NOT_FOUND");
    }

    return NextResponse.json(peca);
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to fetch peca");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true },
    });

    if (!peca) {
      return errorResponse("Não encontrado", 404, "NOT_FOUND");
    }

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { pecaId: id } }),
      prisma.phase.deleteMany({ where: { pecaId: id } }),
      prisma.pecaUpload.deleteMany({ where: { pecaId: id } }),
      prisma.peca.delete({ where: { id } }),
    ]);

    logger.info({ userId: auth.user.id, pecaId: id }, "Peca deleted");
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to delete peca");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
