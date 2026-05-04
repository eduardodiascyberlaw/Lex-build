import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { buildContext } from "@/lib/context-engine";
import { createClaudeClient, streamClaude } from "@/lib/claude-api";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-prompt-lab-execute");

export async function POST(
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

  // Get user's API key
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { apiKeyEnc: true, model: true },
  });

  if (!user?.apiKeyEnc) {
    return errorResponse(
      "Configure a sua API key nas definicoes antes de executar",
      400,
      "NO_API_KEY"
    );
  }

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      include: {
        uploads: { select: { textContent: true, filename: true } },
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
      .map((u) => `### ${u.filename}\n${u.textContent ?? "(sem texto extraido)"}`)
      .join("\n\n");

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
      pecaType: peca.type as "ACPAD" | "CAUTELAR" | "EXECUCAO" | "RECURSO",
      phase,
      caseData: peca.caseData as Record<string, unknown> | null,
      documentsText,
      previousOutputs,
    });

    // Stream response — sandbox mode, does NOT save to DB
    const client = createClaudeClient(user.apiKeyEnc);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const generator = streamClaude(
            client,
            peca.model,
            systemPrompt,
            [{ role: "user", content: userPrompt }],
            16384
          );

          let result = await generator.next();

          while (!result.done) {
            const chunk = result.value;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            result = await generator.next();
          }

          // Send final stats (but do NOT persist anything)
          const stats = result.value;
          if (stats) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ stats: { inputTokens: stats.inputTokens, outputTokens: stats.outputTokens } })}\n\n`
              )
            );
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          logger.error({ err, pecaId: id, phase }, "Prompt lab execute failed");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Erro na chamada a API do Claude" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    logger.error({ err, pecaId: id, phase }, "Prompt lab execute error");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
