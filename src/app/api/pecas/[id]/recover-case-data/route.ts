import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { extractCaseData } from "@/lib/case-data-extractor";
import { createClaudeClient, callClaude } from "@/lib/claude-api";

const logger = createLogger("api-peca-recover-case-data");

/**
 * Recovery endpoint: rebuilds peca.caseData from the approved Phase 0 content.
 *
 * Called from the UI when approving a later phase fails with
 * CASE_DATA_MISSING (409). The user clicks "Reprocessar análise" and we:
 *   1. Try the local multi-strategy extractor on the existing Phase 0 text.
 *   2. If that fails, ask Claude to convert the prose plan into structured
 *      JSON. The user pays for this round-trip with their own API key.
 *
 * Idempotent — running twice on the same peca with the same Phase 0 text
 * yields the same caseData.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const peca = await prisma.peca.findFirst({
    where: { id, userId: auth.user.id },
    select: {
      id: true,
      type: true,
      currentPhase: true,
      model: true,
      phases: { where: { number: 0, status: "APPROVED" }, select: { content: true } },
    },
  });

  if (!peca) return errorResponse("Não encontrado", 404, "NOT_FOUND");

  const phase0 = peca.phases[0];
  if (!phase0?.content) {
    return errorResponse(
      "Fase 0 ainda não está aprovada — não há plano para reprocessar",
      400,
      "PHASE_0_NOT_APPROVED"
    );
  }

  // Strategy 1 — local multi-pattern extractor.
  const local = extractCaseData(phase0.content);
  if (local.ok && local.caseData) {
    await prisma.peca.update({
      where: { id },
      data: { caseData: local.caseData },
    });
    logger.info(
      { pecaId: id, strategy: local.strategy },
      "caseData recovered locally"
    );
    return NextResponse.json({ ok: true, source: "local", strategy: local.strategy });
  }

  // Strategy 2 — ask Claude to extract structured JSON. Needs the user's API key.
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { apiKeyEnc: true, model: true },
  });
  if (!user?.apiKeyEnc) {
    return errorResponse(
      "Sem API key configurada para reprocessar a análise. Configure em Definições.",
      400,
      "MISSING_API_KEY"
    );
  }

  try {
    const client = createClaudeClient(user.apiKeyEnc);
    const systemPrompt = [
      "És um extractor estruturado para a plataforma Lex Build.",
      "Recebes a análise de viabilidade (Fase 0) de uma peça processual portuguesa em texto livre.",
      "A tua única tarefa é devolver um único objecto JSON com os campos do plano do caso.",
      "Não devolvas nada além do JSON. Sem markdown, sem prosa, sem comentários.",
      "Campos esperados quando aplicáveis ao tipo de peça (RECURSO, ACPAD, CAUTELAR, EXECUCAO):",
      "- tribunal, tribunal_a_quo, tribunal_ad_quem, processo, jurisdicao",
      "- recorrente / recorrido / autor / re / requerente / requerida / exequente / executada (objectos com nome, qualidade ou descricao)",
      "- modules_active (array de strings — códigos de módulo temático)",
      "- tipo_acao, tempestividade_ativa, impugna_factos (boolean)",
      "Se algum campo não for inferível do texto, omita-o.",
    ].join("\n");

    const userPrompt = `Tipo de peça: ${peca.type}\n\nFase 0 — texto:\n\n${phase0.content}`;

    const result = await callClaude(
      client,
      user.model || peca.model,
      systemPrompt,
      [{ role: "user", content: userPrompt }],
      2048
    );

    const remote = extractCaseData(result.content);
    if (!remote.ok || !remote.caseData) {
      logger.warn({ pecaId: id, content: result.content.slice(0, 200) }, "remote extraction failed");
      return errorResponse(
        "Não foi possível reconstruir o plano. Edite a Fase 0 e tente novamente.",
        422,
        "REMOTE_EXTRACTION_FAILED"
      );
    }

    await prisma.peca.update({
      where: { id },
      data: { caseData: remote.caseData },
    });

    logger.info(
      { pecaId: id, strategy: "claude_remote", inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      "caseData recovered via Claude"
    );

    return NextResponse.json({ ok: true, source: "claude", strategy: "claude_remote" });
  } catch (err) {
    logger.error({ err, pecaId: id }, "recover failed");
    return errorResponse("Erro a chamar o Claude para reprocessar.", 500, "CLAUDE_ERROR");
  }
}
