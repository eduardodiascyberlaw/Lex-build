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

const ACPAD_STYLE_SECTIONS: Record<number, string> = {
  1: "PRESSUPOSTOS",
  2: "FACTOS",
  3: "TEMPESTIVIDADE",
  4: "DIREITO",
  5: "PEDIDOS",
};

const CAUTELAR_STYLE_SECTIONS: Record<number, string> = {
  2: "FACTOS",
  4: "DIREITO",
  5: "PEDIDOS",
};

export function getPhaseToStyleSection(pecaType: "ACPAD" | "CAUTELAR"): Record<number, string> {
  return pecaType === "CAUTELAR" ? CAUTELAR_STYLE_SECTIONS : ACPAD_STYLE_SECTIONS;
}

const ACPAD_PHASE_NAMES: Record<number, string> = {
  0: "Análise documental",
  1: "Pressupostos",
  2: "Matéria de facto",
  3: "Tempestividade",
  4: "Matéria de direito",
  5: "Pedidos, prova e valor",
};

const CAUTELAR_PHASE_NAMES: Record<number, string> = {
  0: "Análise documental",
  1: "—",
  2: "Matéria de facto",
  3: "—",
  4: "Direito — 3 pilares",
  5: "Pedidos, prova e valor",
};

export function getPhaseNames(pecaType: "ACPAD" | "CAUTELAR"): Record<number, string> {
  return pecaType === "CAUTELAR" ? CAUTELAR_PHASE_NAMES : ACPAD_PHASE_NAMES;
}

// Backwards-compatible export for components that don't have pecaType yet
export const PHASE_NAMES = ACPAD_PHASE_NAMES;
export const PHASE_TO_STYLE_SECTION = ACPAD_STYLE_SECTIONS;

/**
 * Get the transition for a given phase number.
 */
export function getTransition(phase: number): PhaseTransition | null {
  return PHASE_TRANSITIONS[phase] ?? null;
}

/**
 * Determine the next phase, accounting for skip logic.
 * ACPAD: skip phase 3 if tempestividade not active.
 * CAUTELAR: always skip phases 1 and 3.
 */
export function getNextPhase(
  currentPhase: number,
  caseData: Record<string, unknown> | null,
  pecaType: "ACPAD" | "CAUTELAR" = "ACPAD"
): { nextStatus: string; nextPhase: number; skippedPhases: number[] } {
  const transition = PHASE_TRANSITIONS[currentPhase];
  if (!transition) {
    throw new Error(`Invalid phase for transition: ${currentPhase}`);
  }

  let { nextStatus, nextPhase } = transition;
  const skippedPhases: number[] = [];

  if (pecaType === "CAUTELAR") {
    // Phase 0 → skip phase 1, go to phase 2
    if (currentPhase === 0) {
      skippedPhases.push(1);
      nextStatus = "PHASE_2_ACTIVE";
      nextPhase = 2;
      logger.info("Phase 1 skipped (CAUTELAR — no pressupostos)");
    }
    // Phase 2 → skip phase 3, go to phase 4
    if (currentPhase === 2) {
      skippedPhases.push(3);
      nextStatus = "PHASE_4_ACTIVE";
      nextPhase = 4;
      logger.info("Phase 3 skipped (CAUTELAR — no tempestividade)");
    }
  } else {
    // ACPAD: Phase 2 → check if Phase 3 should be skipped
    if (currentPhase === 2 && !caseData?.tempestividade_ativa) {
      skippedPhases.push(3);
      nextStatus = "PHASE_4_ACTIVE";
      nextPhase = 4;
      logger.info("Phase 3 skipped (tempestividade not active)");
    }
  }

  return { nextStatus, nextPhase, skippedPhases };
}

/**
 * Whether the given phase should be skipped based on pecaType and caseData.
 */
export function shouldSkipPhase(
  phase: number,
  caseData: Record<string, unknown> | null,
  pecaType: "ACPAD" | "CAUTELAR" = "ACPAD"
): boolean {
  if (pecaType === "CAUTELAR") {
    return phase === 1 || phase === 3;
  }
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
