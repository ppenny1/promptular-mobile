// Purchases layer. RevenueCat is not wired in yet (project + products come
// in the paywall step), so this stub degrades to honest "purchases
// unavailable" behavior per the standard: never a crash, never a fake
// purchase. When react-native-purchases lands, this file becomes the only
// place that changes: configure with the per-platform public key
// (appl_/goog_ via Platform.OS), map PACKS to offerings, and implement
// purchase/restore for real.

export const PURCHASES_AVAILABLE = false;

// Display ladder (locked Aug 21, 2026). Real prices come from the store at
// purchase time once RevenueCat is live; these labels are marketing copy.
export const CREDIT_PACKS = [
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

export async function purchaseProduct(_productId: string): Promise<never> {
  throw new PurchasesUnavailableError();
}

export async function restorePurchases(): Promise<never> {
  throw new PurchasesUnavailableError();
}
