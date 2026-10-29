import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { avdHomeSignature, createAvdListCache, resolveAvdHome } from "../avd-list-cache";
import { type AndroidUtilsResult } from "../errors";

function harness() {
  const state = { signature: "a", now: 0, runs: 0, fail: false };
  const listAvd = createAvdListCache({
    run: async (): Promise<AndroidUtilsResult<string | null>> => {
      state.runs += 1;
      if (state.fail) {
        return { value: null, error: { message: "no java", error: "no java" } };
      }
      return { value: `list ${state.runs}`, error: null };
    },
    signature: async () => state.signature,
    now: () => state.now,
    maxAgeMs: 1_000,
  });
  return { state, listAvd: () => listAvd("/sdk/avdmanager", "/home/.android/avd") };
}

describe("createAvdListCache", () => {
  test("reuses the list while the AVD files are unchanged", async () => {
    const { state, listAvd } = harness();

    expect((await listAvd()).value).toBe("list 1");
    state.now = 999;
    expect((await listAvd()).value).toBe("list 1");
    expect(state.runs).toBe(1);
  });

  test("reruns avdmanager when the AVD files change", async () => {
    const { state, listAvd } = harness();

    await listAvd();
    state.signature = "b";
    expect((await listAvd()).value).toBe("list 2");
  });

  test("reruns avdmanager once the cached list is too old", async () => {
    const { state, listAvd } = harness();

    await listAvd();
    state.now = 1_000;
    expect((await listAvd()).value).toBe("list 2");
  });

  test("does not cache a failure", async () => {
    const { state, listAvd } = harness();

    state.fail = true;
    expect((await listAvd()).error?.message).toBe("no java");
    state.fail = false;
    expect((await listAvd()).value).toBe("list 2");
  });

  test("shares one avdmanager run between overlapping calls", async () => {
    const { state, listAvd } = harness();

    const [first, second] = await Promise.all([listAvd(), listAvd()]);
    expect(first.value).toBe("list 1");
    expect(second.value).toBe("list 1");
    expect(state.runs).toBe(1);
  });
});

describe("avdHomeSignature", () => {
  test("changes when an AVD's config.ini is edited or an AVD is added", async () => {
    const avdHome = await mkdtemp(join(tmpdir(), "hub-android-avd-home-"));

    try {
      await writeFile(join(avdHome, "pixel.ini"), "path=pixel.avd\n");
      await mkdir(join(avdHome, "pixel.avd"));
      const config = join(avdHome, "pixel.avd", "config.ini");
      await writeFile(config, "hw.device.name=pixel_9\n");
      await utimes(config, new Date(1_000), new Date(1_000));
      const before = await avdHomeSignature(avdHome);

      await utimes(config, new Date(2_000), new Date(2_000));
      const edited = await avdHomeSignature(avdHome);
      expect(edited).not.toBe(before);

      await writeFile(join(avdHome, "tablet.ini"), "path=tablet.avd\n");
      expect(await avdHomeSignature(avdHome)).not.toBe(edited);
    } finally {
      await rm(avdHome, { recursive: true, force: true });
    }
  });

  test("reports a missing AVD home without throwing", async () => {
    expect(await avdHomeSignature(join(tmpdir(), "hub-android-no-such-avd-home"))).toBe("missing");
  });
});

describe("resolveAvdHome", () => {
  test("prefers ANDROID_AVD_HOME, then ANDROID_USER_HOME, then ~/.android/avd", () => {
    expect(resolveAvdHome({ ANDROID_AVD_HOME: "/avd" }, "/home")).toBe("/avd");
    expect(resolveAvdHome({ ANDROID_USER_HOME: "/user" }, "/home")).toBe("/user/avd");
    expect(resolveAvdHome({}, "/home")).toBe("/home/.android/avd");
  });
});
