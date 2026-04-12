"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PipelineSidebar } from "@/components/peca/pipeline-sidebar";
import { PhaseChat } from "@/components/peca/phase-chat";
import { ApprovalBar } from "@/components/peca/approval-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Phase {
  id: string;
  number: number;
  status: string;
  content: string | null;
  editedByUser: boolean;
}

interface PecaDetail {
  id: string;
  type: string;
  status: string;
  currentPhase: number;
  caseData: Record<string, unknown> | null;
  phases: Phase[];
  uploads: { id: string; filename: string }[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function PecaPage() {
  const params = useParams();
  const pecaId = params.id as string;

  const [peca, setPeca] = useState<PecaDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPeca = useCallback(async () => {
    try {
      const res = await fetch(`/api/pecas/${pecaId}`);
      if (!res.ok) {
        setError("Peça não encontrada.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPeca(data);

      // Load messages for current phase
      // Messages are loaded from chat history in the API — for now we use local state
    } catch {
      setError("Erro ao carregar peça.");
    } finally {
      setLoading(false);
    }
  }, [pecaId]);

  useEffect(() => {
    loadPeca();
  }, [loadPeca]);

  function handleNewMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handleApproved() {
    setMessages([]);
    await loadPeca();
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">A carregar...</div>;
  }

  if (error || !peca) {
    return <div className="p-8 text-red-600">{error || "Peça não encontrada."}</div>;
  }

  const currentPhaseData = peca.phases.find(
    (p) => p.number === peca.currentPhase && p.status === "ACTIVE"
  );

  const activeModules = (peca.caseData?.modules_active as string[]) ?? [];

  const isCompleted = peca.status === "COMPLETED";
  const isPhase0 = peca.currentPhase === 0;

  return (
    <div className="flex gap-6">
      <PipelineSidebar
        phases={peca.phases}
        currentPhase={peca.currentPhase}
        activeModules={activeModules}
      />

      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{peca.type}</h1>
          <Badge variant="outline">{peca.status.replace(/_/g, " ")}</Badge>
        </div>

        {isCompleted && (
          <div className="rounded-md bg-green-50 p-4 text-green-800 space-y-3">
            <p>Peca concluida.</p>
            {(peca as PecaDetail & { outputS3Key?: string }).outputS3Key && (
              <a href={`/api/pecas/${pecaId}/download`} className="inline-block">
                <Button>Download .docx</Button>
              </a>
            )}
          </div>
        )}

        {peca.status === "GENERATING_DOCX" && (
          <div className="rounded-md bg-yellow-50 p-4 text-yellow-800 space-y-3">
            <p>A gerar documento .docx...</p>
            <Button
              onClick={async () => {
                await fetch(`/api/pecas/${pecaId}/generate`, {
                  method: "POST",
                });
                loadPeca();
              }}
            >
              Gerar DOCX
            </Button>
          </div>
        )}

        {/* Phase 0 or feedback chat */}
        {!isCompleted && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Fase {peca.currentPhase}
              {isPhase0 ? " — Análise documental" : ""}
            </h2>

            {/* Show phase content for phases 1-5 when Claude has generated output */}
            {!isPhase0 && currentPhaseData?.content && (
              <ApprovalBar
                pecaId={pecaId}
                phaseContent={currentPhaseData.content}
                onApproved={handleApproved}
              />
            )}

            {/* Chat — always available for Phase 0, available as feedback in other phases */}
            <PhaseChat
              pecaId={pecaId}
              messages={messages}
              onNewMessage={handleNewMessage}
              disabled={isCompleted}
            />

            {/* Phase 0: approve button (after caseData is ready) */}
            {isPhase0 && currentPhaseData?.content && (
              <ApprovalBar
                pecaId={pecaId}
                phaseContent={currentPhaseData.content}
                onApproved={handleApproved}
              />
            )}
          </div>
        )}

        {/* Show approved phases history */}
        {peca.phases
          .filter((p) => p.status === "APPROVED")
          .map((p) => (
            <details key={p.id} className="rounded-md border">
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                Fase {p.number} — Aprovada
                {p.editedByUser && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Editada
                  </Badge>
                )}
              </summary>
              <div className="whitespace-pre-wrap border-t p-4 text-sm">{p.content}</div>
            </details>
          ))}
      </div>
    </div>
  );
}
