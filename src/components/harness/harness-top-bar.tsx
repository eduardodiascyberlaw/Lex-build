"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";

interface HarnessTopBarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      {theme === "dark" ? (
        // Sun icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Definições" },
];

const adminItems = [{ href: "/admin/modules", label: "Admin" }];

export function HarnessTopBar({ user }: HarnessTopBarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const allItems = [...navItems, ...(user.role === "ADMIN" ? adminItems : [])];

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-4 relative">
      {/* Left: Logo — Editorial Forense identity */}
      <Link href="/dashboard" className="flex items-center gap-2.5 mr-4 md:mr-8">
        <span
          className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground text-sm leading-none"
          style={{ fontFamily: "var(--font-serif), Fraunces, serif", fontWeight: 600 }}
        >
          L
        </span>
        <span className="hidden sm:flex items-baseline gap-1.5 text-sm">
          <span className="font-medium text-foreground tracking-tight">Lex Build</span>
          <span className="text-[0.65rem] tracking-wide text-muted-foreground">v0.1</span>
        </span>
      </Link>

      {/* Center: Navigation — full on md+, hamburger on <md */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {allItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 text-sm transition-colors ${
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

      {/* Right: User + Theme + Logout */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-32">
          {user.name}
        </span>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7 px-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sair
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
              className={`block px-4 py-2.5 text-sm transition-colors ${
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
