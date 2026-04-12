import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-legislation");

const createLegislationSchema = z.object({
  diploma: z.string(),
  article: z.string(),
  epigraph: z.string().optional(),
  content: z.string(),
  scope: z.enum(["CORE", "MODULE"]),
});

const updateLegislationSchema = z.object({
  diploma: z.string().optional(),
  article: z.string().optional(),
  epigraph: z.string().optional(),
  content: z.string().optional(),
  scope: z.enum(["CORE", "MODULE"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const data = await parseBody(req, createLegislationSchema);
    if (data instanceof NextResponse) return data;

    const legislation = await prisma.legislation.create({
      data: {
        diploma: data.diploma,
        article: data.article,
        epigraph: data.epigraph,
        content: data.content,
        scope: data.scope,
      },
    });

    logger.info({ legislationId: legislation.id }, "Legislacao criada");

    return NextResponse.json(legislation, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Erro ao criar legislacao");
    return errorResponse("Erro interno", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const scope = req.nextUrl.searchParams.get("scope");
    const diploma = req.nextUrl.searchParams.get("diploma");

    const where: Record<string, unknown> = {};
    if (scope) where.scope = scope;
    if (diploma) where.diploma = diploma;

    const legislation = await prisma.legislation.findMany({
      where,
      orderBy: [{ diploma: "asc" }, { article: "asc" }],
    });

    return NextResponse.json(legislation);
  } catch (error) {
    logger.error({ error }, "Erro ao listar legislacao");
    return errorResponse("Erro interno", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return errorResponse("ID em falta", 400);
    }

    const data = await parseBody(req, updateLegislationSchema);
    if (data instanceof NextResponse) return data;

    const existing = await prisma.legislation.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Legislacao nao encontrada", 404);
    }

    const legislation = await prisma.legislation.update({
      where: { id },
      data,
    });

    logger.info({ legislationId: id }, "Legislacao atualizada");

    return NextResponse.json(legislation);
  } catch (error) {
    logger.error({ error }, "Erro ao atualizar legislacao");
    return errorResponse("Erro interno", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return errorResponse("ID em falta", 400);
    }

    const existing = await prisma.legislation.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Legislacao nao encontrada", 404);
    }

    const legislation = await prisma.legislation.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info({ legislationId: id }, "Legislacao desativada (soft delete)");

    return NextResponse.json(legislation);
  } catch (error) {
    logger.error({ error }, "Erro ao desativar legislacao");
    return errorResponse("Erro interno", 500);
  }
}
