"use client";

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

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-4">
      {/* Left: Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-8">
        <span className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground font-mono font-bold text-sm">
          S
        </span>
        <span className="hidden sm:block font-mono text-xs tracking-wider text-muted-foreground">
          LEX BUILD <span className="text-foreground">V0.1.0</span>
          <span className="hidden md:inline"> / Agente de Guerrilha</span>
        </span>
      </Link>

      {/* Center: Navigation */}
      <nav className="flex items-center gap-1 flex-1">
        {navItems.map((item) => (
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
        {user.role === "ADMIN" &&
          adminItems.map((item) => (
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

      {/* Right: Status + User + Logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-harness-green animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">ONLINE</span>
        </div>
        <span className="text-xs text-muted-foreground truncate max-w-32">{user.name}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7 px-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          SAIR
        </Button>
      </div>
    </header>
  );
}
