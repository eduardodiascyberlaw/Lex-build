import { createLogger } from "@/lib/logger";

const logger = createLogger("orchestrator");

export interface PhaseTransition {
  approvedStatus: string;
  nextStatus: string;
  nextPhase: number;
}

const PHASE_TRANSITIONS: Record<number, PhaseTransition> = {
  0: { approvedStatus: "PHASE_0_APPROVED", nextStatus: "PHASE_1_ACTIVE", nextPhase: 1 },
  1: { approvedStatus: "PHASE_1_APPROVED", nextStatus: "PHASE_2_ACTIVE", nextPhase: 2 },
  2: { approvedStatus: "PHASE_2_APPROVED", nextStatus: "PHASE_3_ACTIVE", nextPhase: 3 },
  3: { approvedStatus: "PHASE_3_APPROVED", nextStatus: "PHASE_4_ACTIVE", nextPhase: 4 },
  4: { approvedStatus: "PHASE_4_APPROVED", nextStatus: "PHASE_5_ACTIVE", nextPhase: 5 },
  5: { approvedStatus: "PHASE_5_APPROVED", nextStatus: "GENERATING_DOCX", nextPhase: 5 },
};

export const PHASE_TO_STYLE_SECTION: Record<number, string> = {
  1: "PRESSUPOSTOS",
  2: "FACTOS",
  3: "TEMPESTIVIDADE",
  4: "DIREITO",
  5: "PEDIDOS",
};

export const PHASE_NAMES: Record<number, string> = {
  0: "Análise documental",
  1: "Pressupostos",
  2: "Matéria de facto",
  3: "Tempestividade",
  4: "Matéria de direito",
  5: "Pedidos, prova e valor",
};

/**
 * Get the transition for a given phase number.
 */
export function getTransition(phase: number): PhaseTransition | null {
  return PHASE_TRANSITIONS[phase] ?? null;
}

/**
 * Determine the next phase, accounting for Phase 3 skip logic.
 */
export function getNextPhase(
  currentPhase: number,
  caseData: Record<string, unknown> | null
): { nextStatus: string; nextPhase: number; skipPhase3: boolean } {
  const transition = PHASE_TRANSITIONS[currentPhase];
  if (!transition) {
    throw new Error(`Invalid phase for transition: ${currentPhase}`);
  }

  let { nextStatus, nextPhase } = transition;
  let skipPhase3 = false;

  // Phase 2 → check if Phase 3 should be skipped
  if (currentPhase === 2 && !caseData?.tempestividade_ativa) {
    skipPhase3 = true;
    nextStatus = "PHASE_4_ACTIVE";
    nextPhase = 4;
    logger.info("Phase 3 skipped (tempestividade not active)");
  }

  return { nextStatus, nextPhase, skipPhase3 };
}

/**
 * Whether the given phase should be skipped based on caseData.
 */
export function shouldSkipPhase(phase: number, caseData: Record<string, unknown> | null): boolean {
  if (phase === 3 && !caseData?.tempestividade_ativa) {
    return true;
  }
  return false;
}

/**
 * Whether the pipeline is at the final phase (ready for DOCX generation).
 */
export function isFinalPhase(phase: number): boolean {
  return phase === 5;
}

/**
 * Whether the current phase has content (phases 1-5 generate text).
 */
export function isRedactionPhase(phase: number): boolean {
  return phase >= 1 && phase <= 5;
}
