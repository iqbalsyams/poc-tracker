"use client";

import { useState } from "react";

export type Theme = "light" | "dark";

/**
 * Pilihan tema disimpan di cookie supaya server langsung merender tema yang benar
 * (tanpa kedip terang-ke-gelap saat halaman dibuka).
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      className="inline-flex min-h-11 items-center font-medium text-accent hover:underline"
    >
      {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
    </button>
  );
}
