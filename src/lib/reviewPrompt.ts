// Native in-app review prompts at genuinely positive moments, per the
// standard: StoreReview on iOS, Google's in-app rating on Android (the same
// expo-store-review API drives both). Apple caps prompts at 3 per user per
// 365 days and silently swallows extras, so we ask at enhance milestones
// and never anywhere negative. Never fake or force review UI.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const COUNT_KEY = "reviewEnhanceCount";
const ASKED_KEY = "reviewAskedAt"; // JSON array of ms timestamps

// Ask after these successful-enhance counts.
const MILESTONES = [3, 15, 40];

export async function recordEnhanceAndMaybeAskReview(): Promise<void> {
  try {
    const count = Number((await AsyncStorage.getItem(COUNT_KEY)) || "0") + 1;
    await AsyncStorage.setItem(COUNT_KEY, String(count));
    if (!MILESTONES.includes(count)) return;

    // Belt and braces on top of Apple's own cap: max 3 asks per 365 days.
    const asked: number[] = JSON.parse((await AsyncStorage.getItem(ASKED_KEY)) || "[]");
    const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const recent = asked.filter((t) => t > yearAgo);
    if (recent.length >= 3) return;

    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      recent.push(Date.now());
      await AsyncStorage.setItem(ASKED_KEY, JSON.stringify(recent));
    }
  } catch {
    // A failed review ask must never affect the flow that triggered it.
  }
}
