"use client";

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

  async function handleRestart() {
    // Reload peca to refresh state
    onReload();
  }

  async function handleAdvancePipeline() {
    if (isGeneratingDocx) {
      await fetch(`/api/pecas/${peca.id}/generate`, { method: "POST" });
    }
    onReload();
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
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-xs tracking-wider"
          onClick={handleRestart}
        >
          RESTART AGENT
        </Button>
        {!isCompleted && (
          <Button
            size="sm"
            className="font-mono text-xs tracking-wider"
            onClick={handleAdvancePipeline}
          >
            {isGeneratingDocx ? "GERAR DOCX" : "AVANCAR PIPELINE"}
          </Button>
        )}
        {isCompleted && (peca as PecaDetail & { outputFilename?: string }).outputFilename && (
          <a href={`/api/pecas/${peca.id}/download`}>
            <Button size="sm" className="font-mono text-xs tracking-wider">
              DOWNLOAD .DOCX
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
