"use client";

import { useState, useRef } from "react";
import type { PecaDetail, Message } from "./harness-shell";
import { ChatContextSidebar } from "./chat/chat-context-sidebar";
import { ChatMessages } from "./chat/chat-messages";
import { ChatInspector } from "./chat/chat-inspector";

interface TabChatProps {
  peca: PecaDetail;
  messages: Message[];
  onNewMessage: (msg: Message) => void;
  onApproved: () => void;
  onReload?: () => void;
}

export function TabChat({ peca, messages, onNewMessage, onApproved, onReload }: TabChatProps) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCommand(command: string) {
    onNewMessage({ role: "user", content: command });
  }

  async function handleApproveViaCommand() {
    try {
      const res = await fetch(`/api/pecas/${peca.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        onApproved();
      }
    } catch {
      // handled by approval bar
    }
  }

  function handleEditCommand() {
    setEditMode(true);
  }

  function handleEditDone() {
    setEditMode(false);
    onApproved();
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/pecas/${peca.id}/uploads`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro no upload" }));
        setUploadError(data.error || "Erro no upload");
        return;
      }

      onNewMessage({
        role: "assistant",
        content: `Documento "${file.name}" anexado com sucesso.`,
      });

      if (onReload) onReload();
    } catch {
      setUploadError("Erro de ligacao no upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full harness-animate-in">
      {/* Hidden file input for /DOC ANEXAR */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Mobile toggle bar */}
      <div className="lg:hidden absolute top-0 right-0 z-10 flex gap-1 p-1">
        <button
          onClick={() => {
            setShowSidebar(!showSidebar);
            setShowInspector(false);
          }}
          className={`px-2 py-1 text-[0.6rem] font-mono rounded-sm transition-colors ${
            showSidebar ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          CTX
        </button>
        <button
          onClick={() => {
            setShowInspector(!showInspector);
            setShowSidebar(false);
          }}
          className={`px-2 py-1 text-[0.6rem] font-mono rounded-sm transition-colors ${
            showInspector ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          INS
        </button>
      </div>

      {/* Sidebar — always on lg+, togglable on <lg */}
      <div
        className={`${showSidebar ? "block absolute inset-y-0 left-0 z-20" : "hidden"} lg:block`}
      >
        <ChatContextSidebar
          peca={peca}
          onCommand={handleCommand}
          onApprove={handleApproveViaCommand}
          onEdit={handleEditCommand}
          onAttach={handleAttachClick}
          uploading={uploading}
        />
      </div>

      {/* Center — chat messages */}
      <ChatMessages
        peca={peca}
        messages={messages}
        onNewMessage={onNewMessage}
        onApproved={onApproved}
        editMode={editMode}
        onEditDone={handleEditDone}
        uploadError={uploadError}
      />

      {/* Inspector — always on lg+, togglable on <lg */}
      <div
        className={`${showInspector ? "block absolute inset-y-0 right-0 z-20" : "hidden"} lg:block`}
      >
        <ChatInspector peca={peca} />
      </div>
    </div>
  );
}
