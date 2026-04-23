import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { buildContext } from "@/lib/context-engine";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-prompt-lab");

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, phase: phaseStr } = await params;
  const phase = parseInt(phaseStr, 10);

  if (isNaN(phase) || phase < 0 || phase > 5) {
    return errorResponse("Fase invalida", 400, "INVALID_PHASE");
  }

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      include: {
        uploads: { select: { textContent: true } },
        phases: {
          orderBy: { number: "asc" },
          select: { number: true, status: true, content: true },
        },
      },
    });

    if (!peca) {
      return errorResponse("Nao encontrado", 404, "NOT_FOUND");
    }

    // Build documents text
    const documentsText = peca.uploads
      .filter((u) => u.textContent)
      .map((u) => u.textContent)
      .join("\n\n---\n\n");

    // Build previous outputs
    const previousOutputs: Record<number, string> = {};
    for (const p of peca.phases) {
      if (p.status === "APPROVED" && p.content) {
        previousOutputs[p.number] = p.content;
      }
    }

    const { systemPrompt, userPrompt } = await buildContext({
      pecaId: id,
      userId: auth.user.id,
      pecaType: peca.type as "ACPAD" | "CAUTELAR",
      phase,
      caseData: peca.caseData as Record<string, unknown> | null,
      documentsText,
      previousOutputs,
    });

    return NextResponse.json({
      systemPrompt,
      userPrompt,
      systemTokenEstimate: estimateTokens(systemPrompt),
      userTokenEstimate: estimateTokens(userPrompt),
    });
  } catch (err) {
    logger.error({ err, pecaId: id, phase }, "Failed to build prompt-lab");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
