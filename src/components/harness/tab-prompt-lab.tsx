"use client";

import { useState, useEffect } from "react";
import type { PecaDetail } from "./harness-shell";
import { Button } from "@/components/ui/button";

interface TabPromptLabProps {
  peca: PecaDetail;
}

interface PromptData {
  systemPrompt: string;
  userPrompt: string;
  systemTokenEstimate: number;
  userTokenEstimate: number;
}

const PHASE_LABELS: Record<number, string> = {
  0: "Analise documental",
  1: "Pressupostos",
  2: "Materia de facto",
  3: "Tempestividade",
  4: "Materia de direito",
  5: "Pedidos e prova",
};

function estimateTokens(text: string): number {
  // Rough estimation: ~4 chars per token
  return Math.ceil(text.length / 4);
}

export function TabPromptLab({ peca }: TabPromptLabProps) {
  const [selectedPhase, setSelectedPhase] = useState(peca.currentPhase);
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Model params (display only)
  const modelParams = {
    model: peca.model,
    temperature: 1.0,
    max_tokens: 8192,
    top_p: 1.0,
  };

  useEffect(() => {
    loadPrompt(selectedPhase);
  }, [selectedPhase, peca.id]);

  async function loadPrompt(phase: number) {
    setLoading(true);
    setError("");
    setPromptData(null);

    try {
      const res = await fetch(`/api/pecas/${peca.id}/prompt-lab/${phase}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro" }));
        setError(data.error || "Erro ao carregar prompts.");
        return;
      }
      const data = await res.json();
      setPromptData(data);
    } catch {
      setError("Erro de ligacao.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyCurl() {
    if (!promptData) return;
    const curl = `curl -X POST https://api.anthropic.com/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '${JSON.stringify({
    model: modelParams.model,
    max_tokens: modelParams.max_tokens,
    system: promptData.systemPrompt.slice(0, 200) + "...",
    messages: [{ role: "user", content: promptData.userPrompt.slice(0, 200) + "..." }],
  })}'`;
    navigator.clipboard.writeText(curl);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Phase selector */}
      <div className="flex items-center gap-1 border-b border-border bg-card px-4 py-2">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setSelectedPhase(n)}
            className={`px-3 py-1 text-xs font-mono rounded-sm transition-colors ${
              selectedPhase === n
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            FASE {n}
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">{PHASE_LABELS[selectedPhase]}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center py-8">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">
              A CONSTRUIR PROMPTS...
            </span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <span className="font-mono text-sm text-primary">{error}</span>
          </div>
        )}

        {promptData && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Model params row */}
            <div className="grid grid-cols-4 gap-px bg-border">
              {Object.entries(modelParams).map(([key, value]) => (
                <div key={key} className="bg-card px-3 py-2">
                  <div className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">
                    {key}
                  </div>
                  <div className="font-mono text-xs text-foreground">{String(value)}</div>
                </div>
              ))}
            </div>

            {/* System prompt */}
            <div className="harness-panel">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <h3 className="harness-sigil">§IN SYSTEM PROMPT</h3>
                <span className="font-mono text-[0.6rem] text-muted-foreground">
                  ~{promptData.systemTokenEstimate.toLocaleString()} tokens
                </span>
              </div>
              <pre className="p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap text-foreground/70 leading-relaxed">
                {promptData.systemPrompt}
              </pre>
            </div>

            {/* User prompt */}
            <div className="harness-panel">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <h3 className="harness-sigil">§IN USER PROMPT</h3>
                <span className="font-mono text-[0.6rem] text-muted-foreground">
                  ~{promptData.userTokenEstimate.toLocaleString()} tokens
                </span>
              </div>
              <pre className="p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap text-foreground/70 leading-relaxed">
                {promptData.userPrompt}
              </pre>
            </div>

            {/* Output stream (from existing phase data) */}
            {(() => {
              const phaseData = peca.phases.find((p) => p.number === selectedPhase);
              if (phaseData?.content) {
                return (
                  <div className="harness-panel">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <h3 className="harness-sigil">§OUT OUTPUT STREAM</h3>
                      <span className="font-mono text-[0.6rem] text-muted-foreground">
                        ~{estimateTokens(phaseData.content).toLocaleString()} tokens
                      </span>
                    </div>
                    <pre className="p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap text-foreground/70 leading-relaxed">
                      {phaseData.content}
                    </pre>
                  </div>
                );
              }
              return null;
            })()}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={handleCopyCurl}
              >
                COPIAR CURL
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
