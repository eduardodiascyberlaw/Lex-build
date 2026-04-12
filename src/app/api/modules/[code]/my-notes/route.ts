import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-module-my-notes");

const createNoteSchema = z.object({
  content: z.string().min(1),
  category: z.enum(["GENERAL", "TRIBUNAL_SPECIFIC", "PROCEDURAL", "STRATEGIC"]).default("GENERAL"),
});

const deleteNoteSchema = z.object({
  noteId: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;

  const data = await parseBody(req, createNoteSchema);
  if (data instanceof NextResponse) return data;

  try {
    const thematicModule = await prisma.thematicModule.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!thematicModule) {
      return errorResponse("Modulo nao encontrado", 404, "MODULE_NOT_FOUND");
    }

    const note = await prisma.userNote.create({
      data: {
        userId: auth.user.id,
        moduleId: thematicModule.id,
        content: data.content,
        category: data.category,
      },
    });

    logger.info({ userId: auth.user.id, moduleCode: code, noteId: note.id }, "User note created");

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    logger.error({ err, userId: auth.user.id, moduleCode: code }, "Failed to create note");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;

  try {
    const thematicModule = await prisma.thematicModule.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!thematicModule) {
      return errorResponse("Modulo nao encontrado", 404, "MODULE_NOT_FOUND");
    }

    const notes = await prisma.userNote.findMany({
      where: {
        userId: auth.user.id,
        moduleId: thematicModule.id,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (err) {
    logger.error({ err, userId: auth.user.id, moduleCode: code }, "Failed to list notes");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;

  try {
    const { searchParams } = req.nextUrl;
    const noteIdRaw = searchParams.get("noteId");

    const parsed = deleteNoteSchema.safeParse({ noteId: noteIdRaw });
    if (!parsed.success) {
      return errorResponse("noteId em falta ou invalido", 400, "VALIDATION_ERROR");
    }

    const { noteId } = parsed.data;

    // Find note and verify ownership
    const note = await prisma.userNote.findUnique({
      where: { id: noteId },
      select: { id: true, userId: true, module: { select: { code: true } } },
    });

    if (!note) {
      return errorResponse("Nota nao encontrada", 404, "NOT_FOUND");
    }

    if (note.userId !== auth.user.id) {
      return errorResponse("Sem permissao", 403, "FORBIDDEN");
    }

    if (note.module.code !== code) {
      return errorResponse("Nota nao pertence a este modulo", 400, "MODULE_MISMATCH");
    }

    await prisma.userNote.update({
      where: { id: noteId },
      data: { isActive: false },
    });

    logger.info({ userId: auth.user.id, noteId, moduleCode: code }, "User note soft-deleted");

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: auth.user.id, moduleCode: code }, "Failed to delete note");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
