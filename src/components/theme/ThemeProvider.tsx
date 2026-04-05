import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { APP_THEME_STORAGE_KEY, migrateLegacyThemePreference } from "@/lib/theme";

function LegacyThemeBridge() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const migratedTheme = migrateLegacyThemePreference(window.localStorage);
    if (migratedTheme && theme !== migratedTheme) {
      setTheme(migratedTheme);
    }
  }, [setTheme, theme]);

  return null;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      enableSystem={false}
      storageKey={APP_THEME_STORAGE_KEY}
    >
      <LegacyThemeBridge />
      {children}
    </NextThemesProvider>
  );
}
