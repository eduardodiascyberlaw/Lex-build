"use client";

import { useEffect, useState, useCallback } from "react";
import { HarnessTabNav, type HarnessTab } from "./harness-tab-nav";
import { TabDashboard } from "./tab-dashboard";
import { TabPipeline } from "./tab-pipeline";
import { TabChat } from "./tab-chat";
import { TabKnowledge } from "./tab-knowledge";
import { TabPromptLab } from "./tab-prompt-lab";

export interface Phase {
  id: string;
  number: number;
  status: string;
  content: string | null;
  editedByUser: boolean;
  tokenInput: number | null;
  tokenOutput: number | null;
  startedAt: string | null;
  approvedAt: string | null;
}

export interface PecaUpload {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

export interface PecaDetail {
  id: string;
  type: string;
  status: string;
  currentPhase: number;
  caseData: Record<string, unknown> | null;
  model: string;
  createdAt: string;
  updatedAt: string;
  phases: Phase[];
  uploads: PecaUpload[];
  messages: { id: string; phase: number; role: string; content: string; createdAt: string }[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HarnessShellProps {
  pecaId: string;
}

export function HarnessShell({ pecaId }: HarnessShellProps) {
  const [activeTab, setActiveTab] = useState<HarnessTab>("dashboard");
  const [peca, setPeca] = useState<PecaDetail | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPeca = useCallback(async () => {
    try {
      const res = await fetch(`/api/pecas/${pecaId}`);
      if (!res.ok) {
        setError("Peca nao encontrada.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPeca(data);
    } catch {
      setError("Erro ao carregar peca.");
    } finally {
      setLoading(false);
    }
  }, [pecaId]);

  useEffect(() => {
    loadPeca();
  }, [loadPeca]);

  function handleNewMessage(msg: Message) {
    setChatMessages((prev) => [...prev, msg]);
    if (msg.role === "assistant") {
      loadPeca();
    }
  }

  async function handleApproved() {
    setChatMessages([]);
    await loadPeca();
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground animate-pulse">
          A CARREGAR OPERACAO...
        </span>
      </div>
    );
  }

  if (error || !peca) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <span className="font-mono text-sm text-primary">
          {error || "ERRO: PECA NAO ENCONTRADA"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <HarnessTabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && <TabDashboard peca={peca} onReload={loadPeca} />}
        {activeTab === "pipeline" && <TabPipeline peca={peca} onApproved={handleApproved} />}
        {activeTab === "chat" && (
          <TabChat
            peca={peca}
            messages={chatMessages}
            onNewMessage={handleNewMessage}
            onApproved={handleApproved}
          />
        )}
        {activeTab === "knowledge" && <TabKnowledge peca={peca} />}
        {activeTab === "prompt-lab" && <TabPromptLab peca={peca} />}
      </div>
    </div>
  );
}
