"use client";

export type HarnessTab = "dashboard" | "pipeline" | "chat" | "knowledge" | "prompt-lab";

interface HarnessTabNavProps {
  activeTab: HarnessTab;
  onTabChange: (tab: HarnessTab) => void;
  isAdmin?: boolean;
}

const tabs: { id: HarnessTab; label: string; shortLabel: string; adminOnly?: boolean }[] = [
  { id: "dashboard", label: "Resumo", shortLabel: "Resumo" },
  { id: "pipeline", label: "Fases", shortLabel: "Fases" },
  { id: "chat", label: "Chat", shortLabel: "Chat" },
  { id: "knowledge", label: "Base Legal", shortLabel: "Legal" },
  { id: "prompt-lab", label: "Laboratório", shortLabel: "Lab", adminOnly: true },
];

export function HarnessTabNav({ activeTab, onTabChange, isAdmin }: HarnessTabNavProps) {
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);
  return (
    <nav className="flex border-b border-border bg-card overflow-x-auto sm:overflow-x-visible">
      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="md:hidden">{tab.shortLabel}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
