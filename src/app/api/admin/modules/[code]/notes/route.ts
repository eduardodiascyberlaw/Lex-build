import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules-notes");

const createNoteSchema = z.object({
  content: z.string(),
  category: z.enum(["GENERAL", "TRIBUNAL_SPECIFIC", "PROCEDURAL", "STRATEGIC"]).default("GENERAL"),
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

    const data = await parseBody(req, createNoteSchema);
    if (data instanceof NextResponse) return data;

    const note = await prisma.platformNote.create({
      data: {
        moduleId: thematicModule.id,
        content: data.content,
        category: data.category,
      },
    });

    logger.info({ moduleId: thematicModule.id, noteId: note.id }, "Nota de plataforma criada");

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao criar nota");
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

    const noteId = req.nextUrl.searchParams.get("id");
    if (!noteId) {
      return errorResponse("ID em falta", 400);
    }

    await prisma.platformNote.update({
      where: { id: noteId, moduleId: thematicModule.id },
      data: { isActive: false },
    });

    logger.info(
      { moduleId: thematicModule.id, noteId },
      "Nota de plataforma desativada (soft delete)"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Erro ao desativar nota");
    return errorResponse("Erro interno", 500);
  }
}
