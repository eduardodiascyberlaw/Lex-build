import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules-legislation");

const linkLegislationSchema = z.object({
  legislationId: z.string(),
  relevance: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;

    const thematicModule = await prisma.thematicModule.findUnique({
      where: { code },
    });

    if (!thematicModule) {
      return errorResponse("Modulo nao encontrado", 404);
    }

    const data = await parseBody(req, linkLegislationSchema);
    if (data instanceof NextResponse) return data;

    const link = await prisma.moduleLegislation.create({
      data: {
        moduleId: thematicModule.id,
        legislationId: data.legislationId,
        relevance: data.relevance,
      },
    });

    logger.info(
      { moduleId: thematicModule.id, legislationId: data.legislationId },
      "Legislacao vinculada ao modulo"
    );

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao vincular legislacao");
    return errorResponse("Erro interno", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;

    const thematicModule = await prisma.thematicModule.findUnique({
      where: { code },
    });

    if (!thematicModule) {
      return errorResponse("Modulo nao encontrado", 404);
    }

    const legislationId = req.nextUrl.searchParams.get("legislationId");
    if (!legislationId) {
      return errorResponse("legislationId em falta", 400);
    }

    await prisma.moduleLegislation.delete({
      where: {
        moduleId_legislationId: {
          moduleId: thematicModule.id,
          legislationId,
        },
      },
    });

    logger.info(
      { moduleId: thematicModule.id, legislationId },
      "Legislacao desvinculada do modulo"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Erro ao desvincular legislacao");
    return errorResponse("Erro interno", 500);
  }
}
