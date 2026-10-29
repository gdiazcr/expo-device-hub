import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { runAvdmanagerListAvd } from "./avdmanager";
import { type AndroidUtilsResult } from "./errors";

/**
 * Longest a cached `avdmanager list avd` is reused even when the AVD files look
 * unchanged, so a change the signature misses (a removed system image, an AVD
 * whose `path=` points outside the AVD home) still shows up.
 */
export const AVD_LIST_MAX_AGE_MS = 30_000;

/** The AVD home `avdmanager` reads, from the SDK's environment variables or `~/.android/avd`. */
export function resolveAvdHome(env: NodeJS.ProcessEnv, home: string): string {
  if (env.ANDROID_AVD_HOME) return env.ANDROID_AVD_HOME;
  if (env.ANDROID_USER_HOME) return join(env.ANDROID_USER_HOME, "avd");
  if (env.ANDROID_SDK_HOME) return join(env.ANDROID_SDK_HOME, ".android", "avd");
  return join(home, ".android", "avd");
}

/**
 * A cheap fingerprint of what `avdmanager list avd` reports: each `<name>.ini`
 * and its `<name>.avd/config.ini`, by modification time. Creating, deleting,
 * renaming or editing an AVD changes it.
 */
export async function avdHomeSignature(avdHome: string): Promise<string> {
  let entries: string[];
  try {
    entries = await readdir(avdHome);
  } catch {
    return "missing";
  }
  const inis = entries.filter((entry) => entry.endsWith(".ini")).sort();
  const parts = await Promise.all(
    inis.map(async (ini) => {
      const name = ini.slice(0, -".ini".length);
      const [iniStat, configStat] = await Promise.all([
        stat(join(avdHome, ini)).catch(() => null),
        stat(join(avdHome, `${name}.avd`, "config.ini")).catch(() => null),
      ]);
      return `${ini}:${iniStat?.mtimeMs ?? "-"}:${configStat?.mtimeMs ?? "-"}`;
    }),
  );
  return parts.join("|");
}

type AvdListCacheOptions = {
  run?: (avdmanagerPath: string) => Promise<AndroidUtilsResult<string | null>>;
  signature?: (avdHome: string) => Promise<string>;
  now?: () => number;
  maxAgeMs?: number;
};

type CachedList = { key: string; at: number; value: string | null };

/**
 * Wrap `avdmanager list avd`, which starts a JVM on every call, so a device
 * list polled several times a second reruns it only when the AVDs change.
 * Failures are not cached, so a fixed toolchain is picked up on the next call.
 */
export function createAvdListCache(options: AvdListCacheOptions = {}) {
  const run = options.run ?? runAvdmanagerListAvd;
  const signature = options.signature ?? avdHomeSignature;
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? AVD_LIST_MAX_AGE_MS;
  let cached: CachedList | null = null;
  let inFlight: { key: string; promise: Promise<AndroidUtilsResult<string | null>> } | null = null;

  return async function listAvd(
    avdmanagerPath: string,
    avdHome: string,
  ): Promise<AndroidUtilsResult<string | null>> {
    const key = `${avdmanagerPath}\n${avdHome}\n${await signature(avdHome)}`;
    if (cached && cached.key === key && now() - cached.at < maxAgeMs) {
      return { value: cached.value, error: null };
    }
    if (inFlight?.key === key) return inFlight.promise;

    const promise = run(avdmanagerPath).then((listed) => {
      if (!listed.error) cached = { key, at: now(), value: listed.value };
      return listed;
    });
    inFlight = { key, promise };
    try {
      return await promise;
    } finally {
      if (inFlight?.promise === promise) inFlight = null;
    }
  };
}

/** The process-wide cache {@link listDevices} reads through. */
export const listAvdCached = createAvdListCache();
