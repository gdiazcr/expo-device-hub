import { useEffect, useState } from "react";

import { type ColorScheme } from "@expo/hub-components";

/**
 * Tracks the system color scheme (`prefers-color-scheme`) for Hub's own UI,
 * used while the Hub theme preference is `system` (see `hubTheme.ts`).
 *
 * The stream's "Theme" control drives the *device's* appearance (see
 * `@expo/hub-client`'s `setAppearance`), not Hub's.
 */
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setScheme(mq.matches ? "dark" : "light");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return scheme;
}
