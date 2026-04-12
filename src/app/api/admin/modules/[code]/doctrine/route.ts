import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules-doctrine");

const createDoctrineSchema = z.object({
  author: z.string(),
  work: z.string(),
  passage: z.string(),
  page: z.string().optional(),
  year: z.number().int().optional(),
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

    const data = await parseBody(req, createDoctrineSchema);
    if (data instanceof NextResponse) return data;

    const entry = await prisma.moduleDoctrine.create({
      data: {
        moduleId: thematicModule.id,
        author: data.author,
        work: data.work,
        passage: data.passage,
        page: data.page,
        year: data.year,
      },
    });

    logger.info({ moduleId: thematicModule.id, entryId: entry.id }, "Doutrina criada");

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao criar doutrina");
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

    await prisma.moduleDoctrine.delete({
      where: { id, moduleId: thematicModule.id },
    });

    logger.info({ moduleId: thematicModule.id, entryId: id }, "Doutrina eliminada");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Erro ao eliminar doutrina");
    return errorResponse("Erro interno", 500);
  }
}
