"use client";

import { useEffect, useRef, useState } from "react";
import type { PecaDetail, Message } from "../harness-shell";
import { getPhaseNames, type PecaTypeStr } from "@/lib/orchestrator";
import { EditorialMarkdown } from "./editorial-markdown";

interface ActivePhaseCardProps {
  peca: PecaDetail;
  messages: Message[];
  onNewMessage: (msg: Message) => void;
  onApproved: () => void;
  onEdit: () => void;
}

/**
 * The Editorial Forense centerpiece. One column. The active phase is the
 * page; the agent text reads like a printed paragraph; actions sit inline
 * below the divider; the chat is a quiet refinement bar that opens on demand.
 *
 * Auto-start parity with the legacy chat: when a writing phase (1+) is ACTIVE
 * with no content and no chat history, we dispatch the default directive
 * once per phase. Phase 0 stays manual.
 */
export function ActivePhaseCard({
  peca,
  messages,
  onNewMessage,
  onApproved,
  onEdit,
}: ActivePhaseCardProps) {
  const phaseNames = getPhaseNames(peca.type as PecaTypeStr);
  const phaseNumber = peca.currentPhase;
  const phaseLabel = phaseNames[phaseNumber] ?? `Fase ${phaseNumber}`;

  const phase = peca.phases.find(
    (p) => p.number === peca.currentPhase && (p.status === "ACTIVE" || p.status === "APPROVED")
  );
  const content = phase?.content ?? null;
  const isApproved = phase?.status === "APPROVED";

  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRecover, setShowRecover] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const autoStartedRef = useRef<Set<number>>(new Set());

  const tokens = (phase?.tokenInput ?? 0) + (phase?.tokenOutput ?? 0);
  const cost = (() => {
    const c = ((phase?.tokenInput ?? 0) * 3 + (phase?.tokenOutput ?? 0) * 15) / 1_000_000;
    return c < 0.01 ? "<0,01€" : `${c.toFixed(2).replace(".", ",")} €`;
  })();

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    onNewMessage({ role: "user", content: text });
    setStreaming(true);
    setStreamText("");
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/pecas/${peca.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "Erro" }));
        setErrorMsg(body.error ?? "Erro a contactar o agente.");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setStreamText(acc);
      }
      onNewMessage({ role: "assistant", content: acc });
      setStreamText("");
    } catch {
      setErrorMsg("Erro de ligação.");
    } finally {
      setStreaming(false);
    }
  }

  // Auto-start writing phases (1+) once.
  useEffect(() => {
    if (
      phaseNumber > 0 &&
      phase?.status === "ACTIVE" &&
      !content &&
      messages.length === 0 &&
      !streaming &&
      !autoStartedRef.current.has(phaseNumber)
    ) {
      autoStartedRef.current.add(phaseNumber);
      sendMessage("Redige a secção conforme as instruções do agente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseNumber, phase?.status, content, messages.length, streaming]);

  async function handleApprove() {
    setErrorMsg(null);
    setShowRecover(false);
    try {
      const res = await fetch(`/api/pecas/${peca.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro" }));
        setErrorMsg(body.error ?? "Erro ao aprovar.");
        if (body.code === "CASE_DATA_MISSING") setShowRecover(true);
        return;
      }
      onApproved();
    } catch {
      setErrorMsg("Erro de ligação ao aprovar.");
    }
  }

  async function handleRecover() {
    setRecovering(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/pecas/${peca.id}/recover-case-data`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro" }));
        setErrorMsg(body.error ?? "Não foi possível reprocessar.");
        return;
      }
      // Plan rebuilt — try the approve again automatically.
      setShowRecover(false);
      handleApprove();
    } catch {
      setErrorMsg("Erro de ligação ao reprocessar.");
    } finally {
      setRecovering(false);
    }
  }

  function handleRefine() {
    const text = refineInput.trim();
    if (!text) return;
    setRefineInput("");
    setRefineOpen(false);
    sendMessage(text);
  }

  const showStreamSurface = streaming || streamText;
  const showContent = !!content && !streaming;

  return (
    <article className="editorial-surface mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <header className="mb-8 space-y-2">
        <p className="editorial-h-section">{peca.type} · Etapa {phaseNumber}</p>
        <h2 className="editorial-h-display">{phaseLabel}</h2>
      </header>

      {errorMsg && (
        <div className="mb-6 rounded-sm border border-[var(--toga)]/30 bg-[var(--toga-soft)] px-4 py-3 text-sm text-[var(--toga)]">
          {errorMsg}
          {showRecover && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleRecover}
                disabled={recovering}
                className="rounded-sm bg-[var(--toga)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-[var(--toga)]/90"
              >
                {recovering ? "A reprocessar..." : "Reprocessar análise"}
              </button>
              <span className="text-xs text-[var(--ink-soft)]">
                A Fase 0 não produziu um plano estruturado. Vamos pedir ao Lex Build para refazer.
              </span>
            </div>
          )}
        </div>
      )}

      {!showContent && !showStreamSurface && phaseNumber === 0 && (
        <div className="rounded-sm border editorial-rule bg-[var(--paper-deep)]/40 p-8">
          <p className="editorial-meta mb-4">
            Esta primeira etapa é uma conversa. Apresente o caso, junte
            documentos e o Lex Build identifica viabilidade, partes e teses
            antes de iniciar a redação.
          </p>
          <p className="editorial-meta">
            Use a caixa abaixo para iniciar.
          </p>
        </div>
      )}

      {showStreamSurface && (
        <div>
          {streamText ? (
            <EditorialMarkdown>{streamText}</EditorialMarkdown>
          ) : (
            <span className="editorial-meta italic">A redigir…</span>
          )}
          <span className="editorial-caret" aria-hidden />
        </div>
      )}

      {showContent && (
        <>
          <EditorialMarkdown>{content!}</EditorialMarkdown>

          <p className="mt-6 editorial-meta">
            {tokens.toLocaleString("pt-PT")} tokens · {cost}
            {isApproved && " · aprovada"}
          </p>

          {!isApproved && (
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t editorial-rule pt-6">
              <button
                onClick={handleApprove}
                className="rounded-sm bg-[var(--ink)] px-5 py-2 text-sm font-medium text-[var(--paper)] transition-all hover:bg-[var(--ink)]/85"
              >
                Aprovar etapa
              </button>
              <button
                onClick={onEdit}
                className="rounded-sm border editorial-rule px-5 py-2 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
              >
                Editar antes de aprovar
              </button>
              <button
                onClick={() => setRefineOpen((v) => !v)}
                className="ml-auto text-sm text-[var(--ink-soft)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
              >
                {refineOpen ? "Fechar refinamento" : "Pedir refinamento"}
              </button>
            </div>
          )}

          {refineOpen && !isApproved && (
            <div className="mt-4 rounded-sm border editorial-rule bg-[var(--paper-deep)]/40 p-4 space-y-3">
              <p className="editorial-meta">
                Diga ao Lex Build o que quer ajustar (citações, ordem, ênfase…).
              </p>
              <textarea
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                rows={3}
                placeholder="Ex.: reforça o argumento da insuficiência de fundamentação no §6."
                className="w-full resize-none rounded-sm border editorial-rule bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--toga)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRefine}
                  disabled={streaming || !refineInput.trim()}
                  className="rounded-sm bg-[var(--toga)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[var(--toga)]/90"
                >
                  Pedir
                </button>
                <button
                  onClick={() => {
                    setRefineOpen(false);
                    setRefineInput("");
                  }}
                  className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Phase-0 conversational input (only when there's no content yet) */}
      {phaseNumber === 0 && !showStreamSurface && (
        <div className="mt-6 space-y-3">
          <textarea
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            rows={4}
            placeholder="Descreva o caso, peça uma análise, junte texto da sentença…"
            className="w-full resize-none rounded-sm border editorial-rule bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--toga)]"
          />
          <button
            onClick={handleRefine}
            disabled={streaming || !refineInput.trim()}
            className="rounded-sm bg-[var(--toga)] px-5 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-[var(--toga)]/90"
          >
            Iniciar análise
          </button>
        </div>
      )}
    </article>
  );
}
