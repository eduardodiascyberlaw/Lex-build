"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PhaseChatProps {
  pecaId: string;
  messages: Message[];
  onNewMessage: (msg: Message) => void;
  disabled?: boolean;
}

export function PhaseChat({ pecaId, messages, onNewMessage, disabled }: PhaseChatProps) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    onNewMessage({ role: "user", content: text });
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch(`/api/pecas/${pecaId}/chat`, {
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
              // skip malformed lines
            }
          }
        }
      }

      onNewMessage({ role: "assistant", content: full });
      setStreamText("");
    } catch {
      onNewMessage({ role: "assistant", content: "Erro de ligação." });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-md border p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-md p-3 text-sm whitespace-pre-wrap ${
              msg.role === "user" ? "ml-8 bg-primary/10" : "mr-8 bg-muted"
            }`}
          >
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {msg.role === "user" ? "Você" : "Claude"}
            </span>
            {msg.content}
          </div>
        ))}

        {streaming && streamText && (
          <div className="mr-8 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Claude</span>
            {streamText}
            <span className="animate-pulse">|</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva a sua mensagem..."
          disabled={disabled || streaming}
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={disabled || streaming || !input.trim()}>
          {streaming ? "..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
