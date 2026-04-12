import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-modules");

const createModuleSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  pecaTypes: z.array(z.enum(["ACPAD", "CAUTELAR"])),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const data = await parseBody(req, createModuleSchema);
    if (data instanceof NextResponse) return data;

    const existing = await prisma.thematicModule.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return errorResponse("Modulo com este codigo ja existe", 409);
    }

    const thematicModule = await prisma.thematicModule.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        pecaTypes: data.pecaTypes,
        sortOrder: data.sortOrder,
      },
    });

    logger.info({ moduleId: thematicModule.id, code: thematicModule.code }, "Modulo criado");

    return NextResponse.json(thematicModule, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao criar modulo");
    return errorResponse("Erro interno", 500);
  }
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const modules = await prisma.thematicModule.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            legislation: true,
            jurisprudence: true,
            doctrine: true,
            platformNotes: true,
          },
        },
      },
    });

    return NextResponse.json(modules);
  } catch (error) {
    logger.error({ error }, "Erro ao listar modulos");
    return errorResponse("Erro interno", 500);
  }
}
