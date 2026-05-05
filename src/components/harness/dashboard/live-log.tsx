"use client";

import type { PecaDetail } from "../harness-shell";

interface LiveLogProps {
  peca: PecaDetail;
}

interface LogEntry {
  time: string;
  level: "INFO" | "OK" | "WARN" | "EVT";
  message: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const levelColors: Record<string, string> = {
  INFO: "text-harness-blue",
  OK: "text-harness-green",
  WARN: "text-harness-amber",
  EVT: "text-foreground",
};

function buildLogEntries(peca: PecaDetail): LogEntry[] {
  const entries: LogEntry[] = [];

  // Creation
  entries.push({
    time: formatTime(peca.createdAt),
    level: "EVT",
    message: `Peça ${peca.type} criada — ID ${peca.id.slice(0, 8)}`,
  });

  // Phase transitions
  for (const phase of peca.phases) {
    if (phase.startedAt) {
      entries.push({
        time: formatTime(phase.startedAt),
        level: "INFO",
        message: `Fase ${phase.number} iniciada`,
      });
    }
    if (phase.status === "APPROVED" && phase.approvedAt) {
      const tokens = (phase.tokenInput ?? 0) + (phase.tokenOutput ?? 0);
      entries.push({
        time: formatTime(phase.approvedAt),
        level: "OK",
        message: `Fase ${phase.number} aprovada${tokens > 0 ? ` (${tokens.toLocaleString()} tokens)` : ""}`,
      });
    }
    if (phase.status === "SKIPPED" && phase.approvedAt) {
      entries.push({
        time: formatTime(phase.approvedAt),
        level: "WARN",
        message: `Fase ${phase.number} ignorada`,
      });
    }
  }

  // Messages log
  if (peca.messages) {
    for (const msg of peca.messages) {
      entries.push({
        time: formatTime(msg.createdAt),
        level: msg.role === "user" ? "EVT" : "INFO",
        message: `[Fase ${msg.phase}] ${msg.role === "user" ? "Mensagem" : "Resposta"}: ${msg.content.slice(0, 60)}${msg.content.length > 60 ? "..." : ""}`,
      });
    }
  }

  // Sort by time and take last 20
  entries.sort((a, b) => a.time.localeCompare(b.time));
  return entries.slice(-20);
}

export function LiveLog({ peca }: LiveLogProps) {
  const entries = buildLogEntries(peca);

  return (
    <div className="harness-panel p-3 flex flex-col">
      <h3 className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-2">
        Histórico
      </h3>
      <div className="flex-1 overflow-y-auto max-h-48 space-y-0.5">
        {entries.length === 0 ? (
          <span className="text-xs text-muted-foreground font-mono">Sem eventos registados.</span>
        ) : (
          entries.map((e, i) => (
            <div key={i} className="font-mono text-[0.65rem] leading-tight flex gap-2">
              <span className="text-muted-foreground shrink-0">{e.time}</span>
              <span className={`shrink-0 w-10 ${levelColors[e.level]}`}>[{e.level}]</span>
              <span className="text-foreground/80 truncate">{e.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
