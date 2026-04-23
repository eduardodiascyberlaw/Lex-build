"use client";

export type HarnessTab = "dashboard" | "pipeline" | "chat" | "knowledge" | "prompt-lab";

interface HarnessTabNavProps {
  activeTab: HarnessTab;
  onTabChange: (tab: HarnessTab) => void;
}

const tabs: { id: HarnessTab; number: string; label: string }[] = [
  { id: "dashboard", number: "00", label: "DASHBOARD" },
  { id: "pipeline", number: "01", label: "PIPELINE" },
  { id: "chat", number: "02", label: "CHAT" },
  { id: "knowledge", number: "03", label: "KNOWLEDGE" },
  { id: "prompt-lab", number: "04", label: "PROMPT LAB" },
];

export function HarnessTabNav({ activeTab, onTabChange }: HarnessTabNavProps) {
  return (
    <nav className="flex border-b border-border bg-card">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wider transition-colors ${
              isActive
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-mono text-[0.65rem]">{tab.number}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
