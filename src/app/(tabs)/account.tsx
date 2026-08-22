// The Account tab: v0 skeleton. Shows the signed-in card and credit balance
// once auth is wired (Apple/Google sign-in buttons land here next, then
// Restore Purchases, Leave a Review, and Delete Account per the standard).

import { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

interface Account {
  user: {
    name: string | null;
    email: string | null;
    authProvider: string;
    isPro: boolean;
    creditBalance: number;
    promptCount: number;
  };
}

export default function AccountScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const res = await api<Account>("/api/account");
          setAccount(res);
          setState("ready");
        } catch (err) {
          setState(err instanceof ApiError && err.status === 401 ? "signedout" : "signedout");
        }
      })();
    }, [])
  );

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
            to any device. Apple and Google sign-in buttons land here in the
            next build step.
          </Text>
        </View>
      )}

      {state === "ready" && account && (
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
              {account.user.name || account.user.email || "Signed in"}
            </Text>
            <Text style={{ color: colors.lumenDim, marginTop: 4, fontSize: 13 }}>
              Signed in with{" "}
              {account.user.authProvider === "apple" ? "Apple" : "Google"}
              {" · "}
              {account.user.isPro ? "Pro" : "Free"}
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
                {account.user.creditBalance}
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
                {account.user.promptCount}
              </Text>
              <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
                Prompts
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
