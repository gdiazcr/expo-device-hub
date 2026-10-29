import { type AndroidDevice } from "@expo/hub-android-utils";

/** The `config.ini` key Android's SDK and Android Studio's Device Manager use for an AVD's display name. */
const AVD_DISPLAY_NAME_KEY = "avd.ini.displayname";

/** An AVD's display name, or undefined when it has none and the AVD name should show instead. */
export function androidDisplayName(device: Pick<AndroidDevice, "config">): string | undefined {
  return device.config[AVD_DISPLAY_NAME_KEY]?.trim() || undefined;
}
