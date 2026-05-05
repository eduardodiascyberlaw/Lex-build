"use client";

import { useState } from "react";
import type { PecaDetail } from "./harness-shell";
import { MetricsRow } from "./dashboard/metrics-row";
import { CaseIdentification } from "./dashboard/case-identification";
import { LiveLog } from "./dashboard/live-log";
import { PipelineState } from "./dashboard/pipeline-state";
import { ActiveModules } from "./dashboard/active-modules";
import { DocumentsList } from "./dashboard/documents-list";
import { KnowledgeSummary } from "./dashboard/knowledge-summary";
import { Button } from "@/components/ui/button";

interface TabDashboardProps {
  peca: PecaDetail;
  onReload: () => void;
}

export function TabDashboard({ peca, onReload }: TabDashboardProps) {
  const isCompleted = peca.status === "COMPLETED";
  const isGeneratingDocx = peca.status === "GENERATING_DOCX";
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const outputFilename = (peca as PecaDetail & { outputFilename?: string }).outputFilename;

  async function handleRestart() {
    // Reload peca to refresh state
    onReload();
  }

  async function handleAdvancePipeline() {
    if (!isGeneratingDocx) {
      onReload();
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/pecas/${peca.id}/generate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro a gerar documento" }));
        setGenerateError(body.error ?? "Erro a gerar documento");
        return;
      }
      // Auto-trigger the browser download once the file is persisted.
      // Using a transient anchor avoids navigating away from the peca page.
      const a = document.createElement("a");
      a.href = `/api/pecas/${peca.id}/download`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      onReload();
    } catch {
      setGenerateError("Erro de ligação ao gerar.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Metrics Row — full width */}
      <MetricsRow peca={peca} />

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-px bg-border mt-px">
        {/* Left column: 8 cols */}
        <div className="col-span-1 md:col-span-8 bg-background space-y-px">
          <CaseIdentification peca={peca} />
          <KnowledgeSummary peca={peca} />
          <LiveLog peca={peca} />
        </div>

        {/* Right column: 4 cols */}
        <div className="col-span-1 md:col-span-4 bg-background space-y-px">
          <PipelineState peca={peca} />
          <ActiveModules peca={peca} />
          <DocumentsList peca={peca} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-border space-y-2">
        {generateError && (
          <div className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            {generateError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Recarregar o estado da peça?")) handleRestart();
            }}
            disabled={generating}
          >
            Recarregar
          </Button>
          {isGeneratingDocx && (
            <Button size="sm" onClick={handleAdvancePipeline} disabled={generating}>
              {generating ? "A gerar documento..." : "Gerar e descarregar documento"}
            </Button>
          )}
          {isCompleted && outputFilename && (
            <a href={`/api/pecas/${peca.id}/download`} download={outputFilename}>
              <Button size="sm">Descarregar .docx</Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
