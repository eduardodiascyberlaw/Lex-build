"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { PecaDetail, Message } from "../harness-shell";
import { Button } from "@/components/ui/button";

/* ─── CaseData JSON → readable card ─── */

interface CaseDataParty {
  nome?: string;
  descricao?: string;
}

interface CaseDataJson {
  tribunal?: string;
  juizo?: string;
  processo_cautelar?: string | null;
  processo?: string | null;
  // ACPAD
  autor?: CaseDataParty;
  re?: CaseDataParty;
  // CAUTELAR
  requerente?: CaseDataParty;
  requerida?: CaseDataParty;
  requisitos_114?: { providencia_adotada?: string; acao_dependente?: string };
  subtipo_acao?: string;
  // EXECUCAO
  exequente?: CaseDataParty;
  executada?: CaseDataParty;
  tipo_execucao?: string;
  modulos_direito?: string[];
  dispositivo_sentenca?: string;
  data_transito?: string;
  data_notificacao?: string;
  dominio?: string;
  // Shared
  tipo_acao?: string;
  base_legal?: string;
  modules_active?: string[];
  tempestividade_ativa?: boolean;
  blocos_direito?: string[];
  cronologia?: { data?: string; facto?: string }[];
  documentos?: string[];
  prova_testemunhal?: { nome?: string; morada?: string; facto?: string }[] | null;
  prova_pericial?: string | null;
  [key: string]: unknown;
}

function isCaseData(obj: unknown): obj is CaseDataJson {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  // All 3 types have "tribunal" + at least one party key
  return "tribunal" in o && ("autor" in o || "requerente" in o || "exequente" in o);
}

function PartyRow({
  label: lbl,
  party,
  cls,
}: {
  label: string;
  party: CaseDataParty;
  cls: string;
}) {
  return (
    <div className={cls}>
      <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-wider text-primary/70 mb-0.5">
        {lbl}
      </div>
      <div className="text-sm leading-relaxed">
        <div className="font-semibold">{party.nome}</div>
        {party.descricao && (
          <div className="text-muted-foreground text-xs mt-0.5">{party.descricao}</div>
        )}
      </div>
    </div>
  );
}

function CaseDataCard({ data }: { data: CaseDataJson }) {
  const L = "text-[0.6rem] font-mono font-semibold uppercase tracking-wider text-primary/70 mb-0.5";
  const V = "text-sm leading-relaxed";
  const S = "py-2";

  // Resolve party fields across ACPAD / CAUTELAR / EXECUCAO
  const partyA = data.autor || data.requerente || data.exequente;
  const partyB = data.re || data.requerida || data.executada;
  const labelA = data.autor ? "Autor" : data.requerente ? "Requerente" : "Exequente";
  const labelB = data.re ? "Re" : data.requerida ? "Requerida" : "Executada";

  // Title varies by type
  const isCautelar = !!data.requerente;
  const isExecucao = !!data.exequente;
  const title = isExecucao
    ? "Plano — Execucao de Sentenca"
    : isCautelar
      ? "Plano — Providencia Cautelar"
      : "Plano — ACPAD";

  return (
    <div className="rounded-sm border border-primary/30 bg-card/80 overflow-hidden my-2">
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/30">
        <span className="text-[0.65rem] font-mono font-bold uppercase tracking-widest text-primary">
          {title}
        </span>
      </div>
      <div className="px-4 divide-y divide-border/30">
        {data.tribunal && (
          <div className={S}>
            <div className={L}>Tribunal</div>
            <div className={V}>{data.tribunal}</div>
          </div>
        )}
        {data.juizo && (
          <div className={S}>
            <div className={L}>Juizo</div>
            <div className={V}>{data.juizo}</div>
          </div>
        )}
        {(data.processo_cautelar || data.processo) && (
          <div className={S}>
            <div className={L}>{isExecucao ? "Processo" : "Processo cautelar"}</div>
            <div className={V}>{data.processo || data.processo_cautelar}</div>
          </div>
        )}
        {partyA && <PartyRow label={labelA} party={partyA} cls={S} />}
        {partyB && <PartyRow label={labelB} party={partyB} cls={S} />}
        {data.tipo_acao && (
          <div className={S}>
            <div className={L}>Tipo de acao</div>
            <div className={V}>
              {data.tipo_acao}
              {data.subtipo_acao && (
                <span className="text-muted-foreground"> — {data.subtipo_acao}</span>
              )}
            </div>
          </div>
        )}
        {data.tipo_execucao && (
          <div className={S}>
            <div className={L}>Tipo de execucao</div>
            <div className={V}>{data.tipo_execucao}</div>
          </div>
        )}
        {data.base_legal && (
          <div className={S}>
            <div className={L}>Base legal</div>
            <div className={V}>{data.base_legal}</div>
          </div>
        )}
        {data.requisitos_114 && (
          <div className={S}>
            <div className={L}>Requisitos art. 114.o CPTA</div>
            <div className="text-xs space-y-1 mt-1">
              {data.requisitos_114.providencia_adotada && (
                <div>
                  <span className="text-primary/70 font-semibold">Providencia:</span>{" "}
                  {data.requisitos_114.providencia_adotada}
                </div>
              )}
              {data.requisitos_114.acao_dependente && (
                <div>
                  <span className="text-primary/70 font-semibold">Acao dependente:</span>{" "}
                  {data.requisitos_114.acao_dependente}
                </div>
              )}
            </div>
          </div>
        )}
        {data.dispositivo_sentenca && (
          <div className={S}>
            <div className={L}>Dispositivo da sentenca</div>
            <div className="text-xs mt-1">{data.dispositivo_sentenca}</div>
          </div>
        )}
        {data.data_transito && (
          <div className={S}>
            <div className={L}>Data transito em julgado</div>
            <div className={V}>{data.data_transito}</div>
          </div>
        )}
        {data.modules_active && data.modules_active.length > 0 && (
          <div className={S}>
            <div className={L}>Modulos ativos</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.modules_active.map((m) => (
                <span
                  key={m}
                  className="px-2 py-0.5 text-xs font-mono rounded-sm bg-primary/15 text-primary border border-primary/20"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {data.modulos_direito && data.modulos_direito.length > 0 && (
          <div className={S}>
            <div className={L}>Modulos de direito</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.modulos_direito.map((m) => (
                <span
                  key={m}
                  className="px-2 py-0.5 text-xs font-mono rounded-sm bg-primary/15 text-primary border border-primary/20"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Tempestividade only for ACPAD */}
        {!isCautelar && !isExecucao && (
          <div className={S}>
            <div className={L}>Tempestividade (Fase 3)</div>
            <div className={V}>
              {data.tempestividade_ativa ? (
                <span className="text-harness-green font-semibold">Ativa</span>
              ) : (
                <span className="text-muted-foreground">Nao ativa — Fase 3 sera saltada</span>
              )}
            </div>
          </div>
        )}
        {data.blocos_direito && data.blocos_direito.length > 0 && (
          <div className={S}>
            <div className={L}>Blocos de direito</div>
            <div className={V}>{data.blocos_direito.join(", ")}</div>
          </div>
        )}
        {data.cronologia && data.cronologia.length > 0 && (
          <div className={S}>
            <div className={L}>Cronologia</div>
            <div className="space-y-1 mt-1">
              {data.cronologia.map((c, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="font-mono text-primary/70 shrink-0 tabular-nums">{c.data}</span>
                  <span className="text-foreground">{c.facto}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.documentos && data.documentos.length > 0 && (
          <div className={S}>
            <div className={L}>Documentos</div>
            <div className="space-y-0.5 mt-1">
              {data.documentos.map((d, i) => (
                <div key={i} className="text-xs">
                  {d}
                </div>
              ))}
            </div>
          </div>
        )}
        {data.prova_testemunhal && data.prova_testemunhal.length > 0 && (
          <div className={S}>
            <div className={L}>Prova testemunhal</div>
            <div className="space-y-1.5 mt-1">
              {data.prova_testemunhal.map((t, i) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold">{t.nome}</span>
                  {t.morada && <span className="text-muted-foreground"> — {t.morada}</span>}
                  {t.facto && <div className="text-muted-foreground ml-2">Prova: {t.facto}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Splits message content: text parts are rendered as-is,
 * ```json blocks that look like caseData become a CaseDataCard.
 */
function MessageContent({ content }: { content: string }) {
  const parts = useMemo(() => {
    const result: { type: "text" | "casedata" | "code"; value: string; parsed?: CaseDataJson }[] =
      [];
    const regex = /```json\s*\n([\s\S]*?)\n```/g;
    let last = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > last) {
        result.push({ type: "text", value: content.slice(last, match.index) });
      }
      try {
        const parsed = JSON.parse(match[1]);
        if (isCaseData(parsed)) {
          result.push({ type: "casedata", value: match[0], parsed });
        } else {
          result.push({ type: "code", value: match[0] });
        }
      } catch {
        result.push({ type: "code", value: match[0] });
      }
      last = match.index + match[0].length;
    }

    if (last < content.length) {
      result.push({ type: "text", value: content.slice(last) });
    }

    return result;
  }, [content]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "casedata" && part.parsed) {
          return <CaseDataCard key={i} data={part.parsed} />;
        }
        if (part.type === "code") {
          return (
            <pre key={i} className="text-xs bg-muted/50 rounded-sm p-2 overflow-x-auto">
              {part.value}
            </pre>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

interface ChatMessagesProps {
  peca: PecaDetail;
  messages: Message[];
  onNewMessage: (msg: Message) => void;
  onApproved: () => void;
  editMode?: boolean;
  onEditDone?: () => void;
  uploadError?: string;
}

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ChatMessages({
  peca,
  messages,
  onNewMessage,
  onApproved,
  editMode,
  onEditDone,
  uploadError,
}: ChatMessagesProps) {
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Edit mode state
  const [editedContent, setEditedContent] = useState("");
  const [saveAsStyleRef, setSaveAsStyleRef] = useState(false);
  const [styleNotes, setStyleNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const currentPhaseData = peca.phases.find(
    (p) => p.number === peca.currentPhase && p.status === "ACTIVE"
  );
  const hasContent = !!currentPhaseData?.content;
  const isCompleted = peca.status === "COMPLETED";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  // Initialize edit content when entering edit mode
  useEffect(() => {
    if (editMode && currentPhaseData?.content) {
      setEditedContent(currentPhaseData.content);
      setSaveAsStyleRef(false);
      setStyleNotes("");
      setEditError("");
    }
  }, [editMode, currentPhaseData?.content]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    onNewMessage({ role: "user", content: text });
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch(`/api/pecas/${peca.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        onNewMessage({ role: "assistant", content: `Erro: ${body.error}` });
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) {
                full += parsed.text;
                setStreamText(full);
              }
              if (parsed.error) {
                full += `\n\nErro: ${parsed.error}`;
                setStreamText(full);
              }
            } catch {
              // skip malformed
            }
          }
        }
      }

      onNewMessage({ role: "assistant", content: full });
      setStreamText("");
    } catch {
      onNewMessage({ role: "assistant", content: "Erro de ligacao." });
    } finally {
      setStreaming(false);
    }
  }

  async function handleApproveWithEdits() {
    setEditLoading(true);
    setEditError("");

    try {
      const body: Record<string, unknown> = {
        editedContent,
        saveAsStyleRef,
      };
      if (saveAsStyleRef && styleNotes) {
        body.styleRefNotes = styleNotes;
      }

      const res = await fetch(`/api/pecas/${peca.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro" }));
        setEditError(data.error || "Erro ao aprovar.");
        return;
      }

      if (onEditDone) onEditDone();
    } catch {
      setEditError("Erro de ligacao.");
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col h-full min-w-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Upload error */}
        {uploadError && (
          <div className="rounded-sm bg-primary/10 border border-primary/30 px-3 py-2 text-xs font-mono text-primary">
            {uploadError}
          </div>
        )}

        {/* Inline editor when editMode is active */}
        {editMode && hasContent && (
          <div className="harness-panel p-4 space-y-3 harness-animate-in">
            <h4 className="harness-sigil">§ EDITAR FASE {peca.currentPhase}</h4>
            {editError && (
              <div className="rounded-sm bg-primary/10 border border-primary/30 px-3 py-2 text-xs text-primary">
                {editError}
              </div>
            )}
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={15}
              className="w-full resize-y bg-muted border border-border rounded-sm px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editSaveStyleRef"
                checked={saveAsStyleRef}
                onChange={(e) => setSaveAsStyleRef(e.target.checked)}
              />
              <label htmlFor="editSaveStyleRef" className="text-xs text-muted-foreground">
                Guardar como referencia de estilo
              </label>
            </div>
            {saveAsStyleRef && (
              <textarea
                value={styleNotes}
                onChange={(e) => setStyleNotes(e.target.value)}
                placeholder="Notas sobre a correcao..."
                rows={2}
                className="w-full resize-none bg-muted border border-border rounded-sm px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="font-mono text-xs"
                onClick={handleApproveWithEdits}
                disabled={editLoading}
              >
                {editLoading ? "A APROVAR..." : "APROVAR COM EDICOES"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={onEditDone}
                disabled={editLoading}
              >
                CANCELAR
              </Button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="harness-timestamp">{formatTimestamp()}</span>
              <span
                className={`text-[0.65rem] font-mono font-semibold uppercase tracking-wider ${
                  msg.role === "user" ? "text-foreground" : "text-primary"
                }`}
              >
                {msg.role === "user" ? "OPERADOR" : "AGENTE ACPAD"}
              </span>
            </div>
            <div
              className={`rounded-sm p-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "ml-4 bg-muted border-l-2 border-muted-foreground/30"
                  : "mr-4 bg-card border-l-2 border-primary/50"
              }`}
            >
              <MessageContent content={msg.content} />
            </div>
          </div>
        ))}

        {streaming && streamText && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="harness-timestamp">{formatTimestamp()}</span>
              <span className="text-[0.65rem] font-mono font-semibold uppercase tracking-wider text-primary">
                AGENTE ACPAD
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-harness-blue animate-pulse" />
            </div>
            <div className="mr-4 rounded-sm bg-card border-l-2 border-primary/50 p-3 text-sm whitespace-pre-wrap">
              {streamText}
              <span className="animate-pulse text-primary">|</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <ChatInputBar
        onSend={sendMessage}
        disabled={isCompleted || streaming}
        streaming={streaming}
      />
    </div>
  );
}

interface ChatInputBarProps {
  onSend: (text: string) => void;
  disabled: boolean;
  streaming: boolean;
}

function ChatInputBar({ onSend, disabled, streaming }: ChatInputBarProps) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    }
  }

  function handleSendClick() {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Insira directiva para o agente..."
          disabled={disabled}
          rows={2}
          className="flex-1 resize-none bg-muted border border-border rounded-sm px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSendClick}
          disabled={disabled || !input.trim()}
          className="shrink-0 h-auto px-4 bg-primary text-primary-foreground text-xs font-mono font-semibold tracking-wider rounded-sm disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {streaming ? "..." : "ENVIAR"}
        </button>
      </div>
      <div className="flex gap-4 mt-1.5 text-[0.6rem] text-muted-foreground font-mono">
        <span>SHIFT+ENTER nova linha</span>
        <span>ENTER enviar</span>
      </div>
    </div>
  );
}
