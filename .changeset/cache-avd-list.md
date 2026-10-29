---
"expo-device-hub": patch
---

Stop starting a JVM on every device-list poll: `avdmanager list avd` reruns only when an AVD's files change, or after 30 seconds.
