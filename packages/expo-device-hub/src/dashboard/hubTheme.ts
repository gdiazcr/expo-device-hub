import { type ColorScheme, type SelectOption } from "@expo/hub-components";
import { useCallback, useEffect, useState } from "react";

export const HUB_THEME_STORAGE_KEY = "expo-device-hub.theme";

/** Hub's own theme. `system` follows `prefers-color-scheme`; the rest pin it. */
export type HubThemePreference = "system" | "light" | "dark" | "dracula";

export const HUB_THEME_OPTIONS: ReadonlyArray<SelectOption<HubThemePreference>> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "dracula", label: "Dracula" },
];

/** The scheme the tokens resolve against, plus the classes that select it. */
export type ResolvedHubTheme = {
  scheme: ColorScheme;
  classNames: readonly string[];
};

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "getItem" | "setItem">;

function isHubThemePreference(value: string | null): value is HubThemePreference {
  return HUB_THEME_OPTIONS.some((option) => option.value === value);
}

/** Missing, unknown or unreadable values fall back to following the system. */
export function readHubThemePreference(storage: ReadableStorage): HubThemePreference {
  try {
    const value = storage.getItem(HUB_THEME_STORAGE_KEY);
    return isHubThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function writeHubThemePreference(
  storage: WritableStorage,
  preference: HubThemePreference,
): void {
  try {
    storage.setItem(HUB_THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in restricted browser contexts; the choice lasts for this page.
  }
}

export function resolveHubTheme(
  preference: HubThemePreference,
  systemScheme: ColorScheme,
): ResolvedHubTheme {
  switch (preference) {
    case "system":
      return resolveHubTheme(systemScheme, systemScheme);
    case "light":
      // The styleguide turns `:root` dark under `prefers-color-scheme: dark` unless it carries `light-theme`.
      return { scheme: "light", classNames: ["light-theme"] };
    case "dark":
      return { scheme: "dark", classNames: ["dark-theme"] };
    case "dracula":
      // Dracula only re-tints the dark tokens, so it needs `dark-theme` underneath.
      return { scheme: "dark", classNames: ["dark-theme", "dracula-theme"] };
  }
}

/** The stored preference, kept in sync when another Hub tab changes it. */
export function useHubThemePreference(): [
  HubThemePreference,
  (preference: HubThemePreference) => void,
] {
  const [preference, setPreference] = useState<HubThemePreference>("system");

  useEffect(() => {
    const syncFromStorage = (event?: StorageEvent) => {
      if (event && event.key !== null && event.key !== HUB_THEME_STORAGE_KEY) return;
      setPreference(readHubThemePreference(window.localStorage));
    };
    syncFromStorage();

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  const choose = useCallback((next: HubThemePreference) => {
    setPreference(next);
    writeHubThemePreference(window.localStorage, next);
  }, []);

  return [preference, choose];
}
