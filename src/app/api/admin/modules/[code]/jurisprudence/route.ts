import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules-jurisprudence");

const createJurisprudenceSchema = z.object({
  court: z.string(),
  caseNumber: z.string(),
  date: z.string(),
  summary: z.string(),
  keyPassage: z.string().optional(),
  tags: z.array(z.string()).default([]),
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

    const data = await parseBody(req, createJurisprudenceSchema);
    if (data instanceof NextResponse) return data;

    const entry = await prisma.moduleJurisprudence.create({
      data: {
        moduleId: thematicModule.id,
        court: data.court,
        caseNumber: data.caseNumber,
        date: data.date,
        summary: data.summary,
        keyPassage: data.keyPassage,
        tags: data.tags,
      },
    });

    logger.info({ moduleId: thematicModule.id, entryId: entry.id }, "Jurisprudencia criada");

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao criar jurisprudencia");
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

    await prisma.moduleJurisprudence.delete({
      where: { id, moduleId: thematicModule.id },
    });

    logger.info({ moduleId: thematicModule.id, entryId: id }, "Jurisprudencia eliminada");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Erro ao eliminar jurisprudencia");
    return errorResponse("Erro interno", 500);
  }
}
