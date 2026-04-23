"use client";

import type { PecaDetail, Message } from "./harness-shell";
import { ChatContextSidebar } from "./chat/chat-context-sidebar";
import { ChatMessages } from "./chat/chat-messages";
import { ChatInspector } from "./chat/chat-inspector";

interface TabChatProps {
  peca: PecaDetail;
  messages: Message[];
  onNewMessage: (msg: Message) => void;
  onApproved: () => void;
}

export function TabChat({ peca, messages, onNewMessage, onApproved }: TabChatProps) {
  function handleCommand(command: string) {
    // Send as a chat message
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

  return (
    <div className="flex h-full">
      <ChatContextSidebar
        peca={peca}
        onCommand={handleCommand}
        onApprove={handleApproveViaCommand}
      />
      <ChatMessages
        peca={peca}
        messages={messages}
        onNewMessage={onNewMessage}
        onApproved={onApproved}
      />
      <ChatInspector peca={peca} />
    </div>
  );
}
