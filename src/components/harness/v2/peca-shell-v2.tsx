"use client";

import { useCallback, useEffect, useState } from "react";
import type { PecaDetail, Message } from "../harness-shell";
import { PhaseStepper } from "./phase-stepper";
import { ActivePhaseCard } from "./active-phase-card";
import { getPhaseNames, type PecaTypeStr } from "@/lib/orchestrator";

interface PecaShellV2Props {
  pecaId: string;
}

type SecondaryTab = "documentos" | "base-legal" | "historico";

/**
 * Editorial Forense shell. Replaces the 5-tab harness with a single canvas:
 *   - Top bar (compact, lex-build identity)
 *   - PhaseStepper (always visible, the spine of the lawyer's mental model)
 *   - ActivePhaseCard (the page — agent text, actions, refinement)
 *   - Secondary footer (Documentos / Base legal / Histórico) — collapsed by default
 */
export function PecaShellV2({ pecaId }: PecaShellV2Props) {
  const [peca, setPeca] = useState<PecaDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [secondaryOpen, setSecondaryOpen] = useState<SecondaryTab | null>(null);
  const [editMode, setEditMode] = useState(false);

  const loadPeca = useCallback(async () => {
    try {
      const res = await fetch(`/api/pecas/${pecaId}`);
      if (!res.ok) {
        setErrorMsg("Peça não encontrada.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPeca(data);
    } catch {
      setErrorMsg("Erro ao carregar peça.");
    } finally {
      setLoading(false);
    }
  }, [pecaId]);

  useEffect(() => {
    loadPeca();
  }, [loadPeca]);

  function handleNewMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
    if (msg.role === "assistant") loadPeca();
  }

  async function handleApproved() {
    setMessages([]);
    setEditMode(false);
    await loadPeca();
  }

  if (loading) {
    return (
      <div className="editorial-surface flex min-h-screen items-center justify-center">
        <span className="editorial-meta animate-pulse">A carregar peça…</span>
      </div>
    );
  }

  if (errorMsg || !peca) {
    return (
      <div className="editorial-surface flex min-h-screen items-center justify-center">
        <span className="editorial-meta text-[var(--toga)]">
          {errorMsg || "Peça não encontrada"}
        </span>
      </div>
    );
  }

  const phaseNames = getPhaseNames(peca.type as PecaTypeStr);
  const tribunal = (peca.caseData?.tribunal as string) ?? null;
  const caso =
    (peca.caseData?.titulo as string) ??
    (peca.caseData?.cliente as string) ??
    `${peca.type} · ${peca.id.slice(0, 8)}`;

  const isCompleted = peca.status === "COMPLETED";
  const isGeneratingDocx = peca.status === "GENERATING_DOCX";
  const outputFilename = (peca as PecaDetail & { outputFilename?: string }).outputFilename;

  return (
    <div className="editorial-surface min-h-[calc(100vh-3rem)] flex flex-col">
      {/* Case identity strip */}
      <div className="border-b editorial-rule bg-[var(--paper)]">
        <div className="mx-auto max-w-5xl px-6 pt-6 pb-4">
          <p className="editorial-h-section">{peca.type}</p>
          <h1
            className="text-[var(--ink)] mt-1"
            style={{
              fontFamily: "var(--font-serif), Fraunces, serif",
              fontWeight: 600,
              fontSize: "1.5rem",
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            {caso}
          </h1>
          {tribunal && <p className="editorial-meta mt-1">{tribunal}</p>}
        </div>
      </div>

      {/* Phase stepper */}
      <PhaseStepper peca={peca} />

      {/* Active phase canvas */}
      <main className="flex-1 bg-[var(--paper)]">
        {isCompleted && outputFilename ? (
          <CompletedCanvas peca={peca} outputFilename={outputFilename} />
        ) : isGeneratingDocx ? (
          <GenerateCanvas peca={peca} onReload={loadPeca} />
        ) : editMode ? (
          <EditCanvas peca={peca} onDone={handleApproved} onCancel={() => setEditMode(false)} />
        ) : (
          <ActivePhaseCard
            peca={peca}
            messages={messages}
            onNewMessage={handleNewMessage}
            onApproved={handleApproved}
            onEdit={() => setEditMode(true)}
          />
        )}
      </main>

      {/* Secondary panels (footer) */}
      <footer className="border-t editorial-rule bg-[var(--paper-deep)]/40">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex gap-1 border-b editorial-rule">
            {(
              [
                { id: "documentos", label: `Documentos (${peca.uploads.length})` },
                { id: "base-legal", label: "Base legal" },
                { id: "historico", label: "Histórico" },
              ] as { id: SecondaryTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setSecondaryOpen((curr) => (curr === t.id ? null : t.id))
                }
                className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors ${
                  secondaryOpen === t.id
                    ? "text-[var(--ink)] border-b-2 border-[var(--toga)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {secondaryOpen === "documentos" && (
            <SecondaryDocumentos peca={peca} />
          )}
          {secondaryOpen === "base-legal" && <SecondaryBaseLegal peca={peca} />}
          {secondaryOpen === "historico" && <SecondaryHistorico peca={peca} phaseNames={phaseNames} />}
        </div>
      </footer>
    </div>
  );
}

/* ─── Completed canvas ─── */
function CompletedCanvas({
  peca,
  outputFilename,
}: {
  peca: PecaDetail;
  outputFilename: string;
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-center">
      <p className="editorial-h-section">Peça concluída</p>
      <h2 className="editorial-h-display mt-2">Documento pronto a descarregar</h2>
      <p className="editorial-body mt-4 text-[var(--ink-soft)]">
        O ficheiro <strong>{outputFilename}</strong> contém todas as etapas aprovadas, com o
        seu papel timbrado.
      </p>
      <a
        href={`/api/pecas/${peca.id}/download`}
        download={outputFilename}
        className="mt-8 inline-block rounded-sm bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-[var(--paper)] hover:bg-[var(--ink)]/85"
      >
        Descarregar .docx
      </a>
    </article>
  );
}

/* ─── Generate canvas ─── */
function GenerateCanvas({
  peca,
  onReload,
}: {
  peca: PecaDetail;
  onReload: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setErr(null);
    try {
      const res = await fetch(`/api/pecas/${peca.id}/generate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro" }));
        setErr(body.error ?? "Erro a gerar documento");
        return;
      }
      // Auto-download
      const a = document.createElement("a");
      a.href = `/api/pecas/${peca.id}/download`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      onReload();
    } catch {
      setErr("Erro de ligação ao gerar.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-center">
      <p className="editorial-h-section">Última etapa</p>
      <h2 className="editorial-h-display mt-2">Compor o documento final</h2>
      <p className="editorial-body mt-4 text-[var(--ink-soft)]">
        Todas as fases foram aprovadas. Falta gerar o ficheiro <strong>.docx</strong> com o
        seu papel timbrado.
      </p>
      {err && (
        <p className="editorial-meta mt-4 text-[var(--toga)]">{err}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="mt-8 inline-block rounded-sm bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-[var(--paper)] disabled:opacity-50 hover:bg-[var(--ink)]/85"
      >
        {generating ? "A gerar documento…" : "Gerar e descarregar"}
      </button>
    </article>
  );
}

/* ─── Edit canvas ─── */
function EditCanvas({
  peca,
  onDone,
  onCancel,
}: {
  peca: PecaDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const phase = peca.phases.find((p) => p.number === peca.currentPhase);
  const [editedContent, setEditedContent] = useState(phase?.content ?? "");
  const [saveAsRef, setSaveAsRef] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleApprove() {
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { editedContent, saveAsStyleRef: saveAsRef };
      if (saveAsRef && notes) body.styleRefNotes = notes;
      const res = await fetch(`/api/pecas/${peca.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro" }));
        setErr(data.error ?? "Erro ao aprovar.");
        return;
      }
      onDone();
    } catch {
      setErr("Erro de ligação ao aprovar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="editorial-h-section">Editar etapa {peca.currentPhase}</p>
      <h2 className="editorial-h-display mt-1">Refinar antes de aprovar</h2>
      <p className="editorial-meta mt-2">
        Edite o texto livremente. Pode guardar a sua versão como referência de estilo —
        as próximas peças vão seguir o seu padrão.
      </p>
      {err && (
        <p className="mt-4 rounded-sm border border-[var(--toga)]/30 bg-[var(--toga-soft)] px-3 py-2 text-sm text-[var(--toga)]">
          {err}
        </p>
      )}
      <textarea
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        rows={20}
        className="mt-6 w-full resize-y rounded-sm border editorial-rule bg-[var(--paper)] px-4 py-3 editorial-body focus:outline-none focus:ring-1 focus:ring-[var(--toga)]"
      />
      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--ink-soft)]">
        <input
          type="checkbox"
          checked={saveAsRef}
          onChange={(e) => setSaveAsRef(e.target.checked)}
        />
        Guardar a minha versão como referência de estilo
      </label>
      {saveAsRef && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas (o que melhorou, o que evitar)…"
          className="mt-2 w-full resize-none rounded-sm border editorial-rule bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--toga)]"
        />
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleApprove}
          disabled={saving}
          className="rounded-sm bg-[var(--ink)] px-5 py-2 text-sm font-medium text-[var(--paper)] disabled:opacity-50 hover:bg-[var(--ink)]/85"
        >
          {saving ? "A aprovar…" : "Aprovar com edições"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-sm border editorial-rule px-5 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]"
        >
          Cancelar
        </button>
      </div>
    </article>
  );
}

/* ─── Secondary panels ─── */
function SecondaryDocumentos({ peca }: { peca: PecaDetail }) {
  if (peca.uploads.length === 0) {
    return (
      <p className="py-6 editorial-meta">Nenhum documento anexado.</p>
    );
  }
  return (
    <ul className="py-4 space-y-2 text-sm text-[var(--ink)]">
      {peca.uploads.map((u) => (
        <li key={u.id} className="flex items-center gap-3">
          <span className="rounded-sm bg-[var(--paper-deep)] px-1.5 py-0.5 text-[0.65rem] uppercase text-[var(--ink-soft)]">
            {(u.mimeType.split("/")[1] ?? "doc").toUpperCase()}
          </span>
          <span className="truncate">{u.filename}</span>
          <span className="ml-auto editorial-meta">
            {new Date(u.createdAt).toLocaleDateString("pt-PT")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SecondaryBaseLegal({ peca }: { peca: PecaDetail }) {
  const modules = (peca.caseData?.modules_active as string[]) ?? [];
  return (
    <div className="py-5 space-y-3">
      <p className="editorial-meta">
        Conhecimento jurídico injectado nesta peça. Os módulos são activados pelo
        Lex Build com base no caso.
      </p>
      {modules.length === 0 ? (
        <p className="editorial-meta">Nenhum módulo activado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {modules.map((m) => (
            <span
              key={m}
              className="rounded-sm bg-[var(--paper-deep)] px-2 py-1 text-xs text-[var(--ink-soft)]"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SecondaryHistorico({
  peca,
  phaseNames,
}: {
  peca: PecaDetail;
  phaseNames: Record<number, string>;
}) {
  return (
    <ul className="py-4 space-y-2 text-sm text-[var(--ink)]">
      {peca.phases.map((p) => (
        <li key={p.id} className="flex items-baseline gap-3">
          <span className="editorial-meta w-12">
            {p.approvedAt
              ? new Date(p.approvedAt).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
          <span className="truncate">
            {phaseNames[p.number] ?? `Etapa ${p.number}`}
          </span>
          <span
            className={`ml-auto text-xs ${
              p.status === "APPROVED"
                ? "text-[var(--gold)]"
                : p.status === "ACTIVE"
                  ? "text-[var(--toga)]"
                  : "text-[var(--ink-faint)]"
            }`}
          >
            {p.status === "APPROVED"
              ? "aprovada"
              : p.status === "ACTIVE"
                ? "em curso"
                : p.status === "SKIPPED"
                  ? "ignorada"
                  : "pendente"}
          </span>
        </li>
      ))}
    </ul>
  );
}
