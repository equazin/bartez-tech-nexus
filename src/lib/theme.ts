export type AppTheme = "dark" | "light";

export const APP_THEME_STORAGE_KEY = "bartez-theme";

const LEGACY_THEME_STORAGE_KEYS = ["theme", "admin_theme", "b2b_theme"] as const;

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "dark" || value === "light";
}

export function readStoredTheme(storage: Storage, key = APP_THEME_STORAGE_KEY): AppTheme | null {
  const value = storage.getItem(key);
  return isAppTheme(value) ? value : null;
}

export function clearLegacyThemePreferences(storage: Storage) {
  for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
    storage.removeItem(legacyKey);
  }
}

export function migrateLegacyThemePreference(storage: Storage): AppTheme | null {
  const currentTheme = readStoredTheme(storage);
  if (currentTheme) {
    clearLegacyThemePreferences(storage);
    return currentTheme;
  }

  for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
    const legacyTheme = storage.getItem(legacyKey);
    if (isAppTheme(legacyTheme)) {
      storage.setItem(APP_THEME_STORAGE_KEY, legacyTheme);
      clearLegacyThemePreferences(storage);
      return legacyTheme;
    }
  }

  clearLegacyThemePreferences(storage);
  return null;
}
