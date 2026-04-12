import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules-code");

const updateModuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pecaTypes: z.array(z.enum(["ACPAD", "CAUTELAR"])).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;

    const thematicModule = await prisma.thematicModule.findUnique({
      where: { code },
      include: {
        legislation: {
          include: { legislation: true },
        },
        jurisprudence: true,
        doctrine: true,
        platformNotes: true,
        coreRefs: {
          include: { legislation: true },
        },
      },
    });

    if (!thematicModule) {
      return errorResponse("Modulo nao encontrado", 404);
    }

    return NextResponse.json(thematicModule);
  } catch (error) {
    logger.error({ error }, "Erro ao obter modulo");
    return errorResponse("Erro interno", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;

    const data = await parseBody(req, updateModuleSchema);
    if (data instanceof NextResponse) return data;

    const existing = await prisma.thematicModule.findUnique({
      where: { code },
    });

    if (!existing) {
      return errorResponse("Modulo nao encontrado", 404);
    }

    const thematicModule = await prisma.thematicModule.update({
      where: { code },
      data,
    });

    logger.info({ moduleId: thematicModule.id, code }, "Modulo atualizado");

    return NextResponse.json(thematicModule);
  } catch (error) {
    logger.error({ error }, "Erro ao atualizar modulo");
    return errorResponse("Erro interno", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;

    const existing = await prisma.thematicModule.findUnique({
      where: { code },
    });

    if (!existing) {
      return errorResponse("Modulo nao encontrado", 404);
    }

    const thematicModule = await prisma.thematicModule.update({
      where: { code },
      data: { isActive: false },
    });

    logger.info({ moduleId: thematicModule.id, code }, "Modulo desativado (soft delete)");

    return NextResponse.json(thematicModule);
  } catch (error) {
    logger.error({ error }, "Erro ao desativar modulo");
    return errorResponse("Erro interno", 500);
  }
}
