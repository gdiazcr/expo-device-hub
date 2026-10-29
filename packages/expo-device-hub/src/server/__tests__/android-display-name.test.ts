import { expect, test } from "bun:test";

import { androidDisplayName } from "../android-display-name";

test("reads the AVD display name from config.ini", () => {
  expect(androidDisplayName({ config: { "avd.ini.displayname": "Titerra S10e" } })).toBe(
    "Titerra S10e",
  );
});

test("falls back to the AVD name when the display name is missing or blank", () => {
  expect(androidDisplayName({ config: {} })).toBeUndefined();
  expect(androidDisplayName({ config: { "avd.ini.displayname": "  " } })).toBeUndefined();
});
