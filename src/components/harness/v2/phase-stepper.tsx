"use client";

import type { PecaDetail } from "../harness-shell";
import { getPhaseNames, type PecaTypeStr } from "@/lib/orchestrator";

interface PhaseStepperProps {
  peca: PecaDetail;
}

/**
 * Editorial Forense phase stepper. Replaces the dense "Estado das fases" card
 * with a single horizontal row that fits the lawyer's mental model: a piece is
 * a sequence of named acts, each with a clear status dot.
 */
export function PhaseStepper({ peca }: PhaseStepperProps) {
  const names = getPhaseNames(peca.type as PecaTypeStr);

  // Build a map from phase number -> status, defaulting to PENDING.
  const phaseStatus: Record<number, string> = {};
  for (const p of peca.phases) phaseStatus[p.number] = p.status;
  for (let n = 0; n <= 5; n++) if (!phaseStatus[n]) phaseStatus[n] = "PENDING";
  if (peca.currentPhase != null && phaseStatus[peca.currentPhase] === "PENDING") {
    phaseStatus[peca.currentPhase] = "ACTIVE";
  }

  const visibleSteps = [0, 1, 2, 3, 4, 5].filter((n) => names[n] && names[n] !== "—");
  const total = visibleSteps.length;
  const currentIndex = visibleSteps.indexOf(peca.currentPhase);
  const stepNumber = currentIndex >= 0 ? currentIndex + 1 : total;

  return (
    <nav
      aria-label="Etapas da peça"
      className="border-b editorial-rule bg-[var(--paper)]"
    >
      <div className="mx-auto max-w-5xl px-6 pt-6 pb-5 space-y-3">
        <p className="editorial-h-section">
          Etapa {stepNumber} de {total}
        </p>
        <ol className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
          {visibleSteps.map((n) => {
            const status = phaseStatus[n];
            const isActive = status === "ACTIVE";
            const isApproved = status === "APPROVED";
            const isSkipped = status === "SKIPPED";

            return (
              <li
                key={n}
                className={`flex items-center gap-2.5 transition-colors ${
                  isActive
                    ? "text-[var(--ink)]"
                    : isApproved
                      ? "text-[var(--ink-soft)]"
                      : "text-[var(--ink-faint)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`relative inline-block h-2.5 w-2.5 rounded-full transition-all ${
                    isActive
                      ? "bg-[var(--toga)]"
                      : isApproved
                        ? "bg-[var(--gold)]"
                        : isSkipped
                          ? "border border-dashed border-[var(--ink-faint)] bg-transparent"
                          : "bg-[var(--rule)]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 -m-1 rounded-full ring-4 ring-[var(--toga-soft)] animate-pulse" />
                  )}
                </span>
                <span
                  className={`text-sm tracking-tight ${
                    isActive ? "font-semibold" : ""
                  } ${isSkipped ? "italic line-through opacity-70" : ""}`}
                >
                  {names[n]}
                </span>
                {isApproved && (
                  <span className="text-[0.65rem] text-[var(--gold)]" aria-label="aprovada">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
