"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "dark" | "light";
const THEME_STORAGE_KEY = "enver-crm-theme";

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

function applyThemeMode(mode: ThemeMode) {
  applyTheme(mode);
}

export function GlobalThemeToggle() {
  const resolveInitialTheme = (): ThemeMode => {
    if (typeof document === "undefined") return "light";
    const htmlTheme = document.documentElement.getAttribute("data-theme");
    return htmlTheme === "dark" || htmlTheme === "light" ? htmlTheme : "light";
  };

  const [theme, setTheme] = useState<ThemeMode>(() => {
    return resolveInitialTheme();
  });

  useEffect(() => {
    applyThemeMode(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // no-op when storage is unavailable
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const title =
    theme === "dark"
      ? "Перемкнути на світлу тему"
      : "Перемкнути на темну тему";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={title}
      title={title}
      className="fixed right-3 top-3 z-[140] inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface-elevated)] text-[var(--enver-text)] shadow-[var(--enver-shadow-lg)] transition hover:bg-[var(--enver-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enver-accent-ring)]"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
