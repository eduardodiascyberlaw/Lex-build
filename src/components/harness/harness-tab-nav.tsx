"use client";

export type HarnessTab = "dashboard" | "pipeline" | "chat" | "knowledge" | "prompt-lab";

interface HarnessTabNavProps {
  activeTab: HarnessTab;
  onTabChange: (tab: HarnessTab) => void;
}

const tabs: { id: HarnessTab; number: string; label: string; shortLabel: string }[] = [
  { id: "dashboard", number: "00", label: "DASHBOARD", shortLabel: "DASH" },
  { id: "pipeline", number: "01", label: "PIPELINE", shortLabel: "PIPE" },
  { id: "chat", number: "02", label: "CHAT", shortLabel: "CHAT" },
  { id: "knowledge", number: "03", label: "KNOWLEDGE", shortLabel: "KB" },
  { id: "prompt-lab", number: "04", label: "PROMPT LAB", shortLabel: "LAB" },
];

export function HarnessTabNav({ activeTab, onTabChange }: HarnessTabNavProps) {
  return (
    <nav className="flex border-b border-border bg-card overflow-x-auto sm:overflow-x-visible">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-medium tracking-wider transition-colors whitespace-nowrap ${
              isActive
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-mono text-[0.65rem]">{tab.number}</span>
            <span className="md:hidden text-[0.6rem]">{tab.shortLabel}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
