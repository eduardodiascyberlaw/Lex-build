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
  isAdmin?: boolean;
}

export function HarnessShell({ pecaId, isAdmin }: HarnessShellProps) {
  const [activeTab, setActiveTab] = useState<HarnessTab>("dashboard");
  const [peca, setPeca] = useState<PecaDetail | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
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
        <span className="text-sm text-muted-foreground animate-pulse">
          A carregar peça...
        </span>
      </div>
    );
  }

  if (error || !peca) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <span className="text-sm text-primary">
          {error || "Peça não encontrada"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <HarnessTabNav activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />
      <div className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && (
          <div className="h-full harness-animate-in">
            <TabDashboard peca={peca} onReload={loadPeca} />
          </div>
        )}
        {activeTab === "pipeline" && (
          <div className="h-full harness-animate-in">
            <TabPipeline peca={peca} onApproved={handleApproved} />
          </div>
        )}
        {activeTab === "chat" && (
          <TabChat
            peca={peca}
            messages={chatMessages}
            onNewMessage={handleNewMessage}
            onApproved={handleApproved}
            onReload={loadPeca}
          />
        )}
        {activeTab === "knowledge" && (
          <div className="h-full harness-animate-in">
            <TabKnowledge peca={peca} />
          </div>
        )}
        {activeTab === "prompt-lab" && (
          <div className="h-full harness-animate-in">
            <TabPromptLab peca={peca} />
          </div>
        )}
      </div>
    </div>
  );
}
