import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAdmin, errorResponse } from "@/lib/api-utils";

const logger = createLogger("admin-style-references");

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const styleRefs = await prisma.styleReference.findMany({
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(styleRefs);
  } catch (error) {
    logger.error({ error }, "Erro ao listar referencias de estilo");
    return errorResponse("Erro interno", 500);
  }
}
