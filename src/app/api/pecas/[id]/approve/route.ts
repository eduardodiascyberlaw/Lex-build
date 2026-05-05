import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, parseBody, errorResponse } from "@/lib/api-utils";
import { getPhaseToStyleSection } from "@/lib/orchestrator";

const logger = createLogger("api-peca-approve");

const approveSchema = z.object({
  editedContent: z.string().optional(),
  saveAsStyleRef: z.boolean().default(false),
  styleRefNotes: z.string().optional(),
});

// Phase number → next status mapping
const PHASE_TRANSITIONS: Record<number, { approved: string; next: string; nextPhase: number }> = {
  0: { approved: "PHASE_0_APPROVED", next: "PHASE_1_ACTIVE", nextPhase: 1 },
  1: { approved: "PHASE_1_APPROVED", next: "PHASE_2_ACTIVE", nextPhase: 2 },
  2: { approved: "PHASE_2_APPROVED", next: "PHASE_3_ACTIVE", nextPhase: 3 },
  3: { approved: "PHASE_3_APPROVED", next: "PHASE_4_ACTIVE", nextPhase: 4 },
  4: { approved: "PHASE_4_APPROVED", next: "PHASE_5_ACTIVE", nextPhase: 5 },
  5: { approved: "PHASE_5_APPROVED", next: "GENERATING_DOCX", nextPhase: 5 },
};

const PHASE_TO_STYLE_SECTION: Record<number, string> = {
  1: "PRESSUPOSTOS",
  2: "FACTOS",
  3: "TEMPESTIVIDADE",
  4: "DIREITO",
  5: "PEDIDOS",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const data = await parseBody(req, approveSchema);
  if (data instanceof NextResponse) return data;

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true, type: true, currentPhase: true, status: true, caseData: true },
    });

    if (!peca) {
      return errorResponse("Não encontrado", 404, "NOT_FOUND");
    }

    const currentPhase = peca.currentPhase;
    const transition = PHASE_TRANSITIONS[currentPhase];

    if (!transition) {
      return errorResponse("Fase inválida para aprovação", 400, "INVALID_PHASE");
    }

    const phase = await prisma.phase.findFirst({
      where: { pecaId: id, number: currentPhase, status: "ACTIVE" },
    });

    if (!phase) {
      return errorResponse("Fase não está ativa", 400, "PHASE_NOT_ACTIVE");
    }

    // D1: validate caseData prerequisite BEFORE the transaction so a missing
    // caseData doesn't roll back the phase approval. Phase 0 itself is
    // exempt — caseData is only created when Phase 0 is approved.
    if (currentPhase === 2 && !peca.caseData) {
      logger.warn({ pecaId: id, type: peca.type }, "approve blocked: caseData missing");
      return errorResponse(
        "caseData não disponível — reprocesse a Fase 0",
        409,
        "CASE_DATA_MISSING"
      );
    }

    const isEdited = !!data.editedContent;
    const finalContent = data.editedContent ?? phase.content;

    let resolvedNextPhase = transition.nextPhase;

    await prisma.$transaction(async (tx) => {
      // Approve current phase
      await tx.phase.update({
        where: { id: phase.id },
        data: {
          status: "APPROVED",
          content: finalContent,
          originalContent: isEdited ? phase.content : undefined,
          editedByUser: isEdited,
          approvedAt: new Date(),
        },
      });

      // Phase 0: extract caseData JSON from content
      if (currentPhase === 0 && finalContent) {
        const jsonMatch = finalContent.match(/```json\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const caseData = JSON.parse(jsonMatch[1]);
            await tx.peca.update({
              where: { id },
              data: { caseData },
            });
            logger.info({ pecaId: id }, "caseData extracted from Phase 0");
          } catch (parseErr) {
            logger.warn({ parseErr, pecaId: id }, "Failed to parse caseData JSON from Phase 0");
          }
        }
      }

      // Save style reference if requested
      if (data.saveAsStyleRef && isEdited && phase.content) {
        const section = getPhaseToStyleSection(peca.type as "ACPAD" | "CAUTELAR" | "EXECUCAO" | "RECURSO")[currentPhase];
        if (section) {
          await tx.styleReference.create({
            data: {
              userId: auth.user.id,
              pecaType: peca.type,
              section: section as
                | "PRESSUPOSTOS"
                | "FACTOS"
                | "TEMPESTIVIDADE"
                | "DIREITO"
                | "PEDIDOS"
                | "REQUERIMENTO"
                | "OBJETO"
                | "IMPUGNACAO_FACTO"
                | "DIREITO_RECURSO"
                | "CONCLUSOES_RECURSO",
              beforeText: phase.content,
              afterText: finalContent!,
              notes: data.styleRefNotes,
              sourcePecaId: id,
              sourcePhase: currentPhase,
            },
          });
        }
      }

      // Handle phase skips based on pecaType and caseData
      let nextStatus = transition.next;
      let nextPhase = transition.nextPhase;
      resolvedNextPhase = nextPhase; // will be overwritten below if a skip fires
      const pecaType = peca.type as "ACPAD" | "CAUTELAR" | "EXECUCAO" | "RECURSO";
      const caseDataForSkip = peca.caseData as Record<string, unknown> | null;

      if (pecaType === "CAUTELAR") {
        // CAUTELAR: skip phase 1 (after phase 0) and phase 3 (after phase 2)
        if (currentPhase === 0) {
          await tx.phase.create({
            data: { pecaId: id, number: 1, status: "SKIPPED" },
          });
          nextStatus = "PHASE_2_ACTIVE";
          nextPhase = 2;
          resolvedNextPhase = 2;
        }
        if (currentPhase === 2) {
          await tx.phase.create({
            data: { pecaId: id, number: 3, status: "SKIPPED" },
          });
          nextStatus = "PHASE_4_ACTIVE";
          nextPhase = 4;
          resolvedNextPhase = 4;
        }
      } else if (pecaType === "EXECUCAO") {
        // EXECUCAO: always skip phase 3 (after phase 2)
        if (currentPhase === 2) {
          await tx.phase.create({
            data: { pecaId: id, number: 3, status: "SKIPPED" },
          });
          nextStatus = "PHASE_4_ACTIVE";
          nextPhase = 4;
          resolvedNextPhase = 4;
        }
      } else if (pecaType === "RECURSO") {
        // RECURSO: skip phase 3 if impugna_factos not active.
        // caseDataForSkip is guaranteed non-null here — validated before the transaction (D1).
        if (currentPhase === 2 && !caseDataForSkip?.impugna_factos) {
          await tx.phase.create({
            data: { pecaId: id, number: 3, status: "SKIPPED" },
          });
          nextStatus = "PHASE_4_ACTIVE";
          nextPhase = 4;
          resolvedNextPhase = 4;
        }
      } else {
        // ACPAD: skip phase 3 if tempestividade not active
        if (currentPhase === 2 && !caseDataForSkip?.tempestividade_ativa) {
          await tx.phase.create({
            data: { pecaId: id, number: 3, status: "SKIPPED" },
          });
          nextStatus = "PHASE_4_ACTIVE";
          nextPhase = 4;
          resolvedNextPhase = 4;
        }
      }

      // Create next phase if not final
      if (currentPhase < 5) {
        await tx.phase.create({
          data: {
            pecaId: id,
            number: nextPhase,
            status: "ACTIVE",
            startedAt: new Date(),
          },
        });
      }

      // Update peca status
      await tx.peca.update({
        where: { id },
        data: {
          status: nextStatus as never,
          currentPhase: nextPhase,
        },
      });
    });

    logger.info(
      { userId: auth.user.id, pecaId: id, phase: currentPhase, edited: isEdited },
      "Phase approved"
    );

    return NextResponse.json({ success: true, nextPhase: resolvedNextPhase });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to approve phase");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
