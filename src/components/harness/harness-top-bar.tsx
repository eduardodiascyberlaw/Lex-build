"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface HarnessTopBarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Definicoes" },
];

const adminItems = [{ href: "/admin/modules", label: "Admin" }];

export function HarnessTopBar({ user }: HarnessTopBarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const allItems = [...navItems, ...(user.role === "ADMIN" ? adminItems : [])];

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-4 relative">
      {/* Left: Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-4 md:mr-8">
        <span className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground font-mono font-bold text-sm">
          S
        </span>
        <span className="hidden sm:block font-mono text-xs tracking-wider text-muted-foreground">
          LEX BUILD <span className="text-foreground">V0.1.0</span>
          <span className="hidden md:inline"> / Agente de Guerrilha</span>
        </span>
      </Link>

      {/* Center: Navigation — full on md+, hamburger on <md */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {allItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors ${
              pathname.startsWith(item.href)
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Hamburger button — <md only */}
      <button
        className="md:hidden flex-1 flex items-center"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Menu"
      >
        <svg
          className="h-5 w-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {menuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Right: Status + User + Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-harness-green animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">ONLINE</span>
        </div>
        <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-32">
          {user.name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7 px-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          SAIR
        </Button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-card border-b border-border md:hidden">
          {allItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-2.5 text-xs font-medium tracking-wide uppercase transition-colors ${
                pathname.startsWith(item.href)
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
