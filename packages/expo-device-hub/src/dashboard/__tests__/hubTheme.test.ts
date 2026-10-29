import { describe, expect, test } from "bun:test";

import {
  HUB_THEME_STORAGE_KEY,
  readHubThemePreference,
  resolveHubTheme,
  writeHubThemePreference,
} from "../hubTheme";

describe("hub theme preference storage", () => {
  test("defaults to following the system", () => {
    expect(readHubThemePreference(memoryStorage())).toBe("system");
  });

  test("round-trips a pinned theme", () => {
    const storage = memoryStorage();

    writeHubThemePreference(storage, "dracula");
    expect(storage.getItem(HUB_THEME_STORAGE_KEY)).toBe("dracula");
    expect(readHubThemePreference(storage)).toBe("dracula");
  });

  test("falls back to the system for unknown or inaccessible storage", () => {
    expect(readHubThemePreference(memoryStorage({ [HUB_THEME_STORAGE_KEY]: "solarized" }))).toBe(
      "system",
    );
    expect(
      readHubThemePreference({
        getItem() {
          throw new Error("blocked");
        },
      }),
    ).toBe("system");
  });

  test("keeps the page usable when storage rejects writes", () => {
    expect(() =>
      writeHubThemePreference(
        {
          getItem: () => null,
          setItem() {
            throw new Error("quota");
          },
        },
        "dark",
      ),
    ).not.toThrow();
  });
});

describe("hub theme resolution", () => {
  test("system follows the OS scheme", () => {
    expect(resolveHubTheme("system", "dark")).toEqual({
      scheme: "dark",
      classNames: ["dark-theme"],
    });
    expect(resolveHubTheme("system", "light")).toEqual({
      scheme: "light",
      classNames: ["light-theme"],
    });
  });

  test("a pinned light theme opts out of the OS dark mode", () => {
    expect(resolveHubTheme("light", "dark")).toEqual({
      scheme: "light",
      classNames: ["light-theme"],
    });
  });

  test("dracula layers on top of the dark theme whatever the OS scheme", () => {
    expect(resolveHubTheme("dracula", "light")).toEqual({
      scheme: "dark",
      classNames: ["dark-theme", "dracula-theme"],
    });
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
