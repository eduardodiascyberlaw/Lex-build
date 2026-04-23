import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-pecas");

const createPecaSchema = z.object({
  type: z.enum(["ACPAD", "CAUTELAR", "EXECUCAO"]),
  templateId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const data = await parseBody(req, createPecaSchema);
  if (data instanceof NextResponse) return data;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { model: true },
    });

    const peca = await prisma.peca.create({
      data: {
        userId: auth.user.id,
        type: data.type,
        status: "DRAFT",
        model: user?.model ?? "claude-sonnet-4-20250514",
        templateId: data.templateId,
      },
    });

    logger.info({ userId: auth.user.id, pecaId: peca.id, type: data.type }, "Peca created");

    return NextResponse.json(peca, { status: 201 });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to create peca");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const pecas = await prisma.peca.findMany({
      where: { userId: auth.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        currentPhase: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(pecas);
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to list pecas");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
