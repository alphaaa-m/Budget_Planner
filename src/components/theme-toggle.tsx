"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      suppressHydrationWarning
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
