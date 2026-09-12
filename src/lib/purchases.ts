// Purchases layer, now backed by RevenueCat (react-native-purchases).
// The public SDK key is per store: appl_ for iOS, goog_ for Android
// (empty until the Play side exists; an empty key degrades to honest
// "purchases unavailable" behavior, never a crash, so Android code can
// ship before the Play app does).
//
// Credits and Pro are granted SERVER-SIDE by the RevenueCat webhook
// (/api/revenuecat); the app never grants anything locally. After a
// purchase the caller reloads /api/account to show the new balance.

import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, PRODUCT_CATEGORY } from "react-native-purchases";

const IOS_API_KEY = "appl_HzxWGqMNgFLhCQhmtGUqbhWidwp";
const ANDROID_API_KEY = "goog_rUiOvKWUpkUbvmzpdgJuoxorLjr";

const API_KEY = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;

export const PURCHASES_AVAILABLE = API_KEY.length > 0;

// Display ladder (locked Aug 21, 2026). Store prices are the source of
// truth at purchase time; these labels are marketing copy.
export const CREDIT_PACKS: readonly { id: string; credits: number; price: string; tag?: string }[] = [
  { id: "com.decalvenue.promptular.credits.50", credits: 50, price: "$4.99" },
  { id: "com.decalvenue.promptular.credits.100", credits: 100, price: "$8.99", tag: "Popular" },
  { id: "com.decalvenue.promptular.credits.500", credits: 500, price: "$19.99", tag: "Best value" },
  { id: "com.decalvenue.promptular.credits.1000", credits: 1000, price: "$29.99" },
] as const;

export const PRO_PRODUCT = {
  id: "com.decalvenue.promptular.pro",
  price: "$9.99",
} as const;

export class PurchasesUnavailableError extends Error {
  constructor() {
    super("Purchases aren't available yet in this build.");
  }
}

export class PurchaseCancelledError extends Error {
  constructor() {
    super("Purchase cancelled.");
  }
}

let configured = false;

function ensureConfigured() {
  if (!PURCHASES_AVAILABLE) throw new PurchasesUnavailableError();
  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  }
}

// Ties RevenueCat's customer to our numeric user id so webhook events carry
// it (the webhook also resolves aliases for safety). Call after sign-in and
// whenever the Account screen loads with a signed-in user.
export async function identifyPurchaser(userId: number): Promise<void> {
  try {
    ensureConfigured();
    await Purchases.logIn(String(userId));
  } catch {
    // Identification is best-effort; the webhook's alias resolution covers
    // the anonymous-first case.
  }
}

export async function purchaseProduct(productId: string): Promise<void> {
  ensureConfigured();
  // PRODUCT_CATEGORY matters: on Android getProducts defaults to
  // SUBSCRIPTION and returns nothing for one-time products (iOS ignores
  // the parameter, which is why this only ever failed on Android).
  const products = await Purchases.getProducts(
    [productId],
    PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );
  const product = products.find((p) => p.identifier === productId) || products[0];
  if (!product) {
    throw new Error("That product isn't available right now.");
  }
  try {
    await Purchases.purchaseStoreProduct(product);
  } catch (err) {
    const e = err as { userCancelled?: boolean };
    if (e.userCancelled) throw new PurchaseCancelledError();
    throw err;
  }
}

export async function restorePurchases(): Promise<void> {
  ensureConfigured();
  await Purchases.restorePurchases();
}
