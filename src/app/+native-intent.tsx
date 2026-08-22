// expo-router native intent handler. The share extension launches the app
// with promptular://dataUrl=promptularShareKey..., which is not a screen.
// This redirects that link to the Enhance tab; the useShareIntent hook in
// the root layout then delivers the shared text. Without this file,
// expo-router shows Unmatched Route.

import { getShareExtensionKey } from "expo-share-intent";

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return "/";
    }
    return path;
  } catch {
    return "/";
  }
}
