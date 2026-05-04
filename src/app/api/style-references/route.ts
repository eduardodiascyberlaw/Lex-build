import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-style-references");

const createStyleRefSchema = z.object({
  pecaType: z.enum(["ACPAD", "CAUTELAR", "EXECUCAO", "RECURSO"]),
  section: z.enum([
    "PRESSUPOSTOS",
    "FACTOS",
    "TEMPESTIVIDADE",
    "DIREITO",
    "PEDIDOS",
    "REQUERIMENTO",
    "OBJETO",
    "IMPUGNACAO_FACTO",
    "DIREITO_RECURSO",
    "CONCLUSOES_RECURSO",
  ]),
  beforeText: z.string(),
  afterText: z.string(),
  notes: z.string().optional(),
  isGoldStandard: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const data = await parseBody(req, createStyleRefSchema);
  if (data instanceof NextResponse) return data;

  try {
    const styleRef = await prisma.styleReference.create({
      data: {
        userId: auth.user.id,
        pecaType: data.pecaType,
        section: data.section,
        beforeText: data.beforeText,
        afterText: data.afterText,
        notes: data.notes,
        isGoldStandard: data.isGoldStandard,
      },
    });

    logger.info(
      { userId: auth.user.id, styleRefId: styleRef.id, section: data.section },
      "Style reference created"
    );

    return NextResponse.json(styleRef, { status: 201 });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to create style reference");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;
    const pecaType = searchParams.get("pecaType");
    const section = searchParams.get("section");

    const where: Record<string, unknown> = {
      userId: auth.user.id,
      isActive: true,
    };

    if (pecaType) where.pecaType = pecaType;
    if (section) where.section = section;

    const styleRefs = await prisma.styleReference.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(styleRefs);
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to list style references");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
