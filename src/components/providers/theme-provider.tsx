"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "lexbuild-theme";

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  html.classList.add(t);
  html.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark; the inline script in <head> already applied the persisted
  // preference before hydration so the visible state matches.
  const [theme, setThemeState] = useState<Theme>("dark");

  // After mount, sync state with what's actually on <html> (set by inline script).
  useEffect(() => {
    const html = document.documentElement;
    if (html.classList.contains("light")) setThemeState("light");
    else setThemeState("dark");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore storage failures (private mode, quota)
    }
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Allow components to render before provider mounts (SSR) — return safe default.
    return {
      theme: "dark",
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
