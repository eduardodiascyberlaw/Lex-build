import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { generateDocx } from "@/lib/docx-generator";

const logger = createLogger("api-peca-generate");

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Ownership check
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true, status: true },
    });

    if (!peca) {
      return errorResponse("Nao encontrado", 404, "NOT_FOUND");
    }

    if (peca.status !== "GENERATING_DOCX") {
      return errorResponse(
        "A peca precisa estar no estado GENERATING_DOCX para gerar o documento",
        400,
        "INVALID_STATUS"
      );
    }

    const s3Key = await generateDocx({ pecaId: id, userId: auth.user.id });

    logger.info({ userId: auth.user.id, pecaId: id, s3Key }, "DOCX generation triggered");

    return NextResponse.json({ success: true, s3Key });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to generate DOCX");
    return errorResponse("Erro na geracao do documento", 500, "GENERATION_ERROR");
  }
}
