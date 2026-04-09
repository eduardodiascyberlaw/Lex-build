import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { createClaudeClient, streamClaude } from "@/lib/claude-api";
import { buildContext } from "@/lib/context-engine";

const logger = createLogger("api-chat");

const chatSchema = z.object({
  message: z.string().min(1).max(10_000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;

  // Parse body
  let data: z.infer<typeof chatSchema>;
  try {
    const body = await req.json();
    const result = chatSchema.safeParse(body);
    if (!result.success) {
      return errorResponse("Mensagem inválida", 400, "VALIDATION_ERROR");
    }
    data = result.data;
  } catch {
    return errorResponse("Body inválido", 400, "INVALID_BODY");
  }

  // Load peca with ownership check
  const peca = await prisma.peca.findFirst({
    where: { id, userId: auth.user.id },
    include: {
      uploads: { select: { textContent: true, filename: true } },
      phases: { orderBy: { number: "asc" } },
      messages: { where: { phase: { gte: 0 } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!peca) {
    return errorResponse("Não encontrado", 404, "NOT_FOUND");
  }

  // Get user's API key
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { apiKeyEnc: true, model: true },
  });

  if (!user?.apiKeyEnc) {
    return errorResponse(
      "Configure a sua API key nas definições antes de usar o chat",
      400,
      "NO_API_KEY"
    );
  }

  const currentPhase = peca.currentPhase;

  // Save user message
  await prisma.message.create({
    data: { pecaId: id, phase: currentPhase, role: "user", content: data.message },
  });

  // Build documents text
  const documentsText = peca.uploads
    .map((u) => `### ${u.filename}\n${u.textContent ?? "(sem texto extraído)"}`)
    .join("\n\n");

  // Build previous outputs
  const previousOutputs: Record<number, string> = {};
  for (const p of peca.phases) {
    if (p.status === "APPROVED" && p.content) {
      previousOutputs[p.number] = p.content;
    }
  }

  // Build context
  const context = await buildContext({
    pecaId: id,
    userId: auth.user.id,
    pecaType: peca.type,
    phase: currentPhase,
    caseData: peca.caseData as Record<string, unknown> | null,
    documentsText,
    previousOutputs,
  });

  // Build message history for this phase
  const phaseMessages = peca.messages
    .filter((m) => m.phase === currentPhase)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Add current message
  phaseMessages.push({ role: "user", content: data.message });

  // Stream response
  const client = createClaudeClient(user.apiKeyEnc);
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const generator = streamClaude(
          client,
          peca.model,
          context.systemPrompt,
          phaseMessages.length > 1
            ? phaseMessages
            : [{ role: "user", content: context.userPrompt + "\n\n" + data.message }],
          16384
        );

        let fullContent = "";
        let result = await generator.next();

        while (!result.done) {
          const chunk = result.value;
          fullContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          result = await generator.next();
        }

        // Save assistant message
        await prisma.message.create({
          data: {
            pecaId: id,
            phase: currentPhase,
            role: "assistant",
            content: fullContent,
          },
        });

        // If Phase 0, also update phase content (latest response)
        if (currentPhase === 0) {
          await prisma.phase.updateMany({
            where: { pecaId: id, number: 0, status: "ACTIVE" },
            data: { content: fullContent },
          });
        }

        // Update token usage if available
        const stats = result.value;
        if (stats) {
          await prisma.phase.updateMany({
            where: { pecaId: id, number: currentPhase, status: "ACTIVE" },
            data: {
              tokenInput: stats.inputTokens,
              tokenOutput: stats.outputTokens,
            },
          });
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        logger.error({ err, pecaId: id, phase: currentPhase }, "Chat stream failed");
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Erro na chamada à API do Claude" })}\n\n`
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
}
