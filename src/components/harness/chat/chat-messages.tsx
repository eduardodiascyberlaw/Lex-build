"use client";

import { useState, useRef, useEffect } from "react";
import type { PecaDetail, Message } from "../harness-shell";
import { ApprovalBar } from "@/components/peca/approval-bar";

interface ChatMessagesProps {
  peca: PecaDetail;
  messages: Message[];
  onNewMessage: (msg: Message) => void;
  onApproved: () => void;
}

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ChatMessages({ peca, messages, onNewMessage, onApproved }: ChatMessagesProps) {
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentPhaseData = peca.phases.find(
    (p) => p.number === peca.currentPhase && p.status === "ACTIVE"
  );
  const hasContent = !!currentPhaseData?.content;
  const isCompleted = peca.status === "COMPLETED";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

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

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Show approval bar when phase has content */}
        {hasContent && (
          <div className="mb-3">
            <ApprovalBar
              pecaId={peca.id}
              phaseContent={currentPhaseData!.content}
              onApproved={onApproved}
            />
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
