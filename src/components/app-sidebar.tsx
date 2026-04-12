"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AppSidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Definições" },
  { href: "/settings/notes", label: "Notas" },
  { href: "/settings/style", label: "Estilo" },
];

const adminItems = [
  { href: "/admin/modules", label: "Módulos" },
  { href: "/admin/legislation", label: "Legislação" },
  { href: "/admin/style-references", label: "Refs Estilo" },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/30 p-4 lg:flex">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xl font-bold">
          Lex Build
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent ${
              pathname.startsWith(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}

        {user.role === "ADMIN" && (
          <>
            <Separator className="my-3" />
            <span className="px-3 text-xs font-semibold uppercase text-muted-foreground">
              Admin
            </span>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent ${
                  pathname.startsWith(item.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <Separator className="my-3" />

      <div className="space-y-2">
        <div className="px-3">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sair
        </Button>
      </div>
    </aside>
  );
}
