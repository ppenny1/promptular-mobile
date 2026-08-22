// Stable anonymous device id, generated once and kept in SecureStore.
// Sent with sign-in so the server's one-time 15-credit trial is device-tied
// (fail-open on the server; a missing id still grants).

import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const DEVICE_KEY = "promptular_device_id";

export async function getDeviceId(): Promise<string | null> {
  try {
    let id = await SecureStore.getItemAsync(DEVICE_KEY);
    if (!id) {
      id = Crypto.randomUUID();
      await SecureStore.setItemAsync(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
