"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    const root = document.documentElement;
    const isCurrentlyDark = root.classList.contains("dark") || resolvedTheme === "dark";
    const nextTheme = isCurrentlyDark ? "light" : "dark";

    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative"
      aria-label="Tema değiştir"
      onClick={toggleTheme}
      type="button"
    >
      <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  );
}
