"use client";

import { useState, useRef, useEffect } from "react";
import type { PecaDetail, Message } from "../harness-shell";
import { Button } from "@/components/ui/button";

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
              {msg.content}
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
