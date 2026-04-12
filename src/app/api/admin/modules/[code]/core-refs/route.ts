import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules-core-refs");

const createCoreRefSchema = z.object({
  legislationId: z.string(),
  context: z.string().optional(),
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

    const data = await parseBody(req, createCoreRefSchema);
    if (data instanceof NextResponse) return data;

    const ref = await prisma.moduleCoreRef.create({
      data: {
        moduleId: thematicModule.id,
        legislationId: data.legislationId,
        context: data.context,
      },
    });

    logger.info({ moduleId: thematicModule.id, refId: ref.id }, "Referencia core criada");

    return NextResponse.json(ref, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao criar referencia core");
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

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return errorResponse("ID em falta", 400);
    }

    await prisma.moduleCoreRef.delete({
      where: { id, moduleId: thematicModule.id },
    });

    logger.info({ moduleId: thematicModule.id, refId: id }, "Referencia core eliminada");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Erro ao eliminar referencia core");
    return errorResponse("Erro interno", 500);
  }
}
