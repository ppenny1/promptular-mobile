// Google Sign In configuration. The webClientId is what the backend
// verifies tokens against (GOOGLE_CLIENT_IDS env on the web side includes
// both ids). Client IDs are public identifiers, safe in code.

import { GoogleSignin } from "@react-native-google-signin/google-signin";

export const GOOGLE_WEB_CLIENT_ID =
  "526677221242-a5cqedp77flcq3fu4u2aac8dfser1c4r.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_ID =
  "526677221242-5n3p4i2unp85cstlgcbqt7idho8f8gi7.apps.googleusercontent.com";

let configured = false;

export function ensureGoogleConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}
