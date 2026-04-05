import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { AppTheme } from "@/lib/theme";

export function useAppTheme() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const currentTheme = useMemo<AppTheme>(() => {
    const activeTheme = resolvedTheme ?? theme;
    return activeTheme === "light" ? "light" : "dark";
  }, [resolvedTheme, theme]);

  return {
    theme: currentTheme,
    isDark: currentTheme === "dark",
    isLight: currentTheme === "light",
    setTheme: (nextTheme: AppTheme) => setTheme(nextTheme),
    toggleTheme: () => setTheme(currentTheme === "dark" ? "light" : "dark"),
  };
}
