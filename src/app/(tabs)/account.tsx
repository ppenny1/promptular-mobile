// The Account tab. Apple Sign In wired end-to-end; Google lands once the
// Google Cloud project + GOOGLE_CLIENT_IDS exist. Restore Purchases, Leave
// a Review, and Delete Account complete this screen in later steps.

import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { ensureGoogleConfigured } from "@/lib/googleAuth";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError, setToken, clearToken } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

interface AccountUser {
  name: string | null;
  email: string | null;
  authProvider: string;
  isPro: boolean;
  creditBalance: number;
  promptCount: number;
}

export default function AccountScreen() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ user: AccountUser }>("/api/account");
      setUser(res.user);
      setState("ready");
    } catch {
      setUser(null);
      setState("signedout");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleAppleSignIn() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token");

      const name = credential.fullName?.givenName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(" ")
        : null;

      const deviceId = await getDeviceId();
      const res = await api<{ token: string; user: AccountUser }>(
        "/api/auth/apple-mobile",
        {
          method: "POST",
          auth: false,
          body: {
            identityToken: credential.identityToken,
            name,
            platform: Platform.OS,
            deviceId,
          },
        }
      );
      await setToken(res.token);
      setUser(res.user);
      setState("ready");
    } catch (err) {
      // User canceling the Apple sheet is not an error worth showing.
      const code = (err as { code?: string }).code;
      console.log("Apple sign-in error:", code, err);
      if (code !== "ERR_REQUEST_CANCELED") {
        setError(
          err instanceof ApiError
            ? err.message
            : "Sign in didn't work. Please try again."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      ensureGoogleConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken =
        result.type === "success" ? result.data.idToken : null;
      if (!idToken) {
        // User closed the sheet; not an error worth showing.
        return;
      }
      const name =
        result.type === "success" ? result.data.user.name ?? null : null;

      const deviceId = await getDeviceId();
      const res = await api<{ token: string; user: AccountUser }>(
        "/api/auth/google",
        {
          method: "POST",
          auth: false,
          body: { idToken, name, platform: Platform.OS, deviceId },
        }
      );
      await setToken(res.token);
      setUser(res.user);
      setState("ready");
    } catch (err) {
      console.log("Google sign-in error:", err);
      setError(
        err instanceof ApiError
          ? err.message
          : "Sign in didn't work. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSignOut() {
    Alert.alert("Sign out?", "Your prompts and credits stay on your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await clearToken();
          setUser(null);
          setState("signedout");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16) }}
    >
      <Text style={{ color: colors.lumen, fontSize: 28, fontWeight: "800" }}>
        Account
      </Text>

      {state === "signedout" && (
        <View
          style={{
            marginTop: spacing(5),
            borderRadius: radius.card,
            backgroundColor: colors.panel,
            padding: spacing(5),
          }}
        >
          <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 17 }}>
            Sign in to Promptular
          </Text>
          <Text style={{ color: colors.lumenDim, marginTop: 6, fontSize: 14, lineHeight: 20 }}>
            Your prompts and credits live on your account, so they follow you
            to any device. New accounts start with 15 free Enhance credits.
          </Text>

          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={12}
              style={{ height: 48, marginTop: spacing(5) }}
              onPress={handleAppleSignIn}
            />
          )}

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={busy}
            style={{
              marginTop: spacing(3),
              height: 48,
              borderRadius: 12,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#1F1F1F", fontSize: 16, fontWeight: "600" }}>
              Sign in with Google
            </Text>
          </Pressable>

          {error !== "" && (
            <Text style={{ color: colors.danger, marginTop: spacing(3), fontSize: 13 }}>
              {error}
            </Text>
          )}

        </View>
      )}

      {state === "ready" && user && (
        <>
          <View
            style={{
              marginTop: spacing(5),
              borderRadius: radius.card,
              backgroundColor: colors.panel,
              padding: spacing(5),
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 17 }}>
              {user.name || user.email || "Signed in"}
            </Text>
            <Text style={{ color: colors.lumenDim, marginTop: 4, fontSize: 13 }}>
              Signed in with {user.authProvider === "apple" ? "Apple" : "Google"}
              {" · "}
              {user.isPro ? "Pro" : "Free"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(3) }}>
            <View
              style={{
                flex: 1,
                borderRadius: radius.card,
                backgroundColor: colors.panel,
                padding: spacing(4),
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.spark, fontSize: 24, fontWeight: "800" }}>
                {user.creditBalance}
              </Text>
              <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
                Credits
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: radius.card,
                backgroundColor: colors.panel,
                padding: spacing(4),
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.violet, fontSize: 24, fontWeight: "800" }}>
                {user.promptCount}
              </Text>
              <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
                Prompts
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={{
              marginTop: spacing(5),
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: colors.panelEdge,
              paddingVertical: 14,
              alignItems: "center",
              minHeight: 44,
            }}
          >
            <Text style={{ color: colors.lumenDim, fontWeight: "700", fontSize: 14 }}>
              Sign out
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
