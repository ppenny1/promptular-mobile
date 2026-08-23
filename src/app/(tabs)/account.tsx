// The Account tab: signed-in card (name, email, account id, provider,
// plan), credits + prompts stats, credit pack store, Pro card, promo code
// redemption, Restore Purchases, Leave a Review, Help, Sign out, and the
// red Delete Account flow (Apple 5.1.1(v)). Purchases go through the
// purchases lib, which degrades honestly until RevenueCat is wired in.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Share } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import {
  readAsStringAsync,
  writeAsStringAsync,
  cacheDirectory,
} from "expo-file-system/legacy";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Ionicons } from "@expo/vector-icons";
import { ensureGoogleConfigured } from "@/lib/googleAuth";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError, setToken, clearToken, getToken, API_BASE } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import {
  CREDIT_PACKS,
  PRO_PRODUCT,
  purchaseProduct,
  restorePurchases,
  identifyPurchaser,
  PurchasesUnavailableError,
  PurchaseCancelledError,
} from "@/lib/purchases";

// Real Apple App ID (ASC listing created Aug 22, 2026). The write-review
// deep link works once the app is live. Play listing URL joins at Android time.
const APP_STORE_ID = "6804114635";

interface AccountUser {
  id: number;
  name: string | null;
  email: string | null;
  authProvider: string;
  isPro: boolean;
  creditBalance: number;
  promptCount: number;
}

export default function AccountScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Promo code modal
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ user: AccountUser }>("/api/account");
      setUser(res.user);
      setState("ready");
      // Tie RevenueCat's customer to this user so purchase events carry
      // the right id to the webhook. Best-effort, never blocks the UI.
      identifyPurchaser(res.user.id);
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
      load();
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
      const idToken = result.type === "success" ? result.data.idToken : null;
      if (!idToken) {
        // User closed the sheet; not an error worth showing.
        return;
      }
      const name = result.type === "success" ? result.data.user.name ?? null : null;

      const deviceId = await getDeviceId();
      const res = await api<{ token: string; user: AccountUser }>("/api/auth/google", {
        method: "POST",
        auth: false,
        body: { idToken, name, platform: Platform.OS, deviceId },
      });
      await setToken(res.token);
      setUser(res.user);
      setState("ready");
      load();
    } catch (err) {
      console.log("Google sign-in error:", err);
      setError(
        err instanceof ApiError ? err.message : "Sign in didn't work. Please try again."
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

  async function handleBuy(productId: string) {
    try {
      await purchaseProduct(productId);
      // Credits and Pro land server-side via the RevenueCat webhook; give
      // it a moment, then refresh the balance.
      setTimeout(() => load(), 2500);
      load();
    } catch (err) {
      if (err instanceof PurchaseCancelledError) {
        // User closed the sheet; nothing to say.
      } else if (err instanceof PurchasesUnavailableError) {
        Alert.alert(
          "Purchases coming soon",
          "Buying isn't switched on in this build yet. It arrives with the App Store release."
        );
      } else {
        Alert.alert("Purchase didn't finish", "You weren't charged. Please try again.");
      }
    }
  }

  async function handleRestore() {
    try {
      await restorePurchases();
      load();
      Alert.alert("Restored", "Your purchases are back on this device.");
    } catch (err) {
      if (err instanceof PurchasesUnavailableError) {
        Alert.alert(
          "Purchases coming soon",
          "Restore works once purchases are switched on in the App Store release."
        );
      } else {
        Alert.alert("Couldn't restore", "Please try again.");
      }
    }
  }

  function handleLeaveReview() {
    if (Platform.OS === "ios") {
      if (!APP_STORE_ID) {
        Alert.alert("Almost", "The App Store page goes live at launch. Thanks for wanting to review!");
        return;
      }
      Linking.openURL(
        `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
      ).catch(() => {});
    } else {
      Linking.openURL(
        "https://play.google.com/store/apps/details?id=com.decalvenue.promptular"
      ).catch(() => {});
    }
  }

  async function redeemPromo() {
    if (!promoCode.trim() || promoBusy) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await api<{ balance: number | null; credits?: number }>("/api/redeem", {
        method: "POST",
        body: { code: promoCode.trim() },
      });
      setPromoMsg({ ok: true, text: "Code redeemed! Your credits are updated." });
      setPromoCode("");
      if (user && res.balance !== null && res.balance !== undefined) {
        setUser({ ...user, creditBalance: res.balance });
      }
      load();
    } catch (err) {
      setPromoMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "Couldn't redeem. Try again.",
      });
    } finally {
      setPromoBusy(false);
    }
  }

  async function exportLibrary(format: "csv" | "json") {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/prompts/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 402) {
        Alert.alert("Pro feature", "Export is part of Pro. Upgrade above to unlock it.");
        return;
      }
      if (!res.ok) throw new Error("export failed");
      const content =
        format === "csv"
          ? await res.text()
          : JSON.stringify((await res.json()).prompts, null, 2);
      // Write a named file so the share sheet says "promptular-export-...",
      // not "text".
      const date = new Date().toISOString().slice(0, 10);
      const fileUri = `${cacheDirectory}promptular-export-${date}.${format}`;
      await writeAsStringAsync(fileUri, content);
      await Share.share(
        Platform.OS === "ios" ? { url: fileUri } : { message: content }
      );
    } catch {
      Alert.alert("Couldn't export", "Please try again.");
    }
  }

  function chooseExport() {
    Alert.alert("Export your library", "Pick a format. It opens the share sheet so you can save or send the file.", [
      { text: "CSV (spreadsheets)", onPress: () => exportLibrary("csv") },
      { text: "JSON (backups)", onPress: () => exportLibrary("json") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  // Minimal CSV parser handling quoted fields; header row maps columns.
  function parseCsv(text: string): { title: string; text: string; tags?: string; collection?: string; favorite?: boolean }[] {
    const rows: string[][] = [];
    let field = "";
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.some((c) => c.trim() !== "")) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    if (rows.length < 2) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    return rows.slice(1).map((r) => ({
      title: r[idx("title")] ?? "",
      text: r[idx("text")] ?? "",
      tags: idx("tags") >= 0 ? r[idx("tags")] : undefined,
      collection: idx("collection") >= 0 ? r[idx("collection")] : undefined,
      favorite: idx("favorite") >= 0 ? r[idx("favorite")] === "1" || r[idx("favorite")]?.toLowerCase() === "true" : undefined,
    }));
  }

  async function pickImportFile() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/json", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const content = await readAsStringAsync(picked.assets[0].uri);
      setImportText(content);
      setImportMsg(null);
    } catch {
      setImportMsg({ ok: false, text: "Couldn't read that file. Try a .csv or .json file." });
    }
  }

  async function runImport() {
    if (!importText.trim() || importBusy) return;
    setImportBusy(true);
    setImportMsg(null);
    try {
      const raw = importText.trim();
      let prompts: unknown[] = [];
      if (raw.startsWith("[") || raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        prompts = Array.isArray(parsed) ? parsed : parsed.prompts || [];
      } else {
        prompts = parseCsv(raw);
      }
      if (prompts.length === 0) {
        setImportMsg({ ok: false, text: "Couldn't find any prompts in that. Paste CSV with a header row, or JSON." });
        return;
      }
      const res = await api<{ imported: number; skipped: number }>("/api/prompts/import", {
        method: "POST",
        body: { prompts },
      });
      setImportMsg({
        ok: true,
        text: `Imported ${res.imported} prompt${res.imported === 1 ? "" : "s"}${res.skipped ? `, skipped ${res.skipped} without a title or text` : ""}.`,
      });
      setImportText("");
      load();
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === "pro_required") {
        setImportMsg({ ok: false, text: "Import is part of Pro. Upgrade to unlock it." });
      } else {
        setImportMsg({ ok: false, text: "Import failed. Check the format and try again." });
      }
    } finally {
      setImportBusy(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, prompts, collections, history, and remaining credits. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              await api("/api/account/delete", { method: "POST" });
              await clearToken();
              setUser(null);
              setState("signedout");
            } catch {
              Alert.alert("Couldn't delete", "Please try again or email promptular@appsthathelp.com.");
            }
          },
        },
      ]
    );
  }

  const row = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing(3),
    paddingVertical: 14,
    minHeight: 44,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), paddingBottom: spacing(10) }}
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
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
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
          {/* Who is signed in */}
          <View
            style={{
              marginTop: spacing(5),
              borderRadius: radius.card,
              backgroundColor: colors.panel,
              padding: spacing(5),
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 17 }}>
              {user.name || "Signed in"}
            </Text>
            {user.email && (
              <Text style={{ color: colors.lumenDim, marginTop: 4, fontSize: 14 }}>
                {user.email}
              </Text>
            )}
            <Text style={{ color: colors.lumenDim, marginTop: 4, fontSize: 12 }}>
              Signed in with {user.authProvider === "apple" ? "Apple" : "Google"}
              {" · "}
              {user.isPro ? "Pro" : "Free"}
            </Text>
          </View>

          {/* Stats */}
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

          {/* Credit packs */}
          <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 17, marginTop: spacing(6) }}>
            Get more credits
          </Text>
          <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            1 credit per enhance, 2 for a Full Rework. Credits never expire.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(3), marginTop: spacing(3) }}>
            {CREDIT_PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                onPress={() => handleBuy(pack.id)}
                style={{
                  width: "47.5%",
                  borderRadius: radius.card,
                  backgroundColor: colors.panel,
                  borderWidth: 1,
                  borderColor: pack.tag ? colors.violet + "88" : colors.panelEdge,
                  padding: spacing(4),
                  alignItems: "center",
                  minHeight: 44,
                }}
              >
                {pack.tag && (
                  <Text style={{ color: colors.violet, fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>
                    {pack.tag.toUpperCase()}
                  </Text>
                )}
                <Text style={{ color: colors.lumen, fontSize: 20, fontWeight: "800", marginTop: pack.tag ? 4 : 0 }}>
                  {pack.credits}
                </Text>
                <Text style={{ color: colors.lumenDim, fontSize: 11 }}>credits</Text>
                <Text style={{ color: colors.spark, fontWeight: "800", fontSize: 14, marginTop: 6 }}>
                  {pack.price}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Pro */}
          {!user.isPro && (
            <Pressable
              onPress={() => handleBuy(PRO_PRODUCT.id)}
              style={{
                marginTop: spacing(4),
                borderRadius: radius.card,
                backgroundColor: colors.violet + "22",
                borderWidth: 1,
                borderColor: colors.violet,
                padding: spacing(5),
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 17 }}>
                  Promptular Pro
                </Text>
                <Text style={{ color: colors.spark, fontWeight: "800", fontSize: 17 }}>
                  {PRO_PRODUCT.price}
                </Text>
              </View>
              <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                One-time purchase, yours forever. Unlimited prompts, collections,
                variables, version history, import and export, custom platforms,
                plus 50 bonus credits included.
              </Text>
            </Pressable>
          )}

          {/* Rows */}
          <View
            style={{
              marginTop: spacing(6),
              borderRadius: radius.card,
              backgroundColor: colors.panel,
              paddingHorizontal: spacing(4),
            }}
          >
            <Pressable onPress={() => setPromoOpen(true)} style={row}>
              <Ionicons name="gift-outline" size={18} color={colors.lumenDim} />
              <Text style={{ color: colors.lumen, fontSize: 15, fontWeight: "600", flex: 1 }}>
                Redeem a code
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lumenDim} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.panelEdge }} />
            <Pressable onPress={chooseExport} style={row}>
              <Ionicons name="download-outline" size={18} color={colors.lumenDim} />
              <Text style={{ color: colors.lumen, fontSize: 15, fontWeight: "600", flex: 1 }}>
                Export library
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lumenDim} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.panelEdge }} />
            <Pressable
              onPress={() => {
                setImportMsg(null);
                setImportOpen(true);
              }}
              style={row}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={colors.lumenDim} />
              <Text style={{ color: colors.lumen, fontSize: 15, fontWeight: "600", flex: 1 }}>
                Import prompts
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lumenDim} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.panelEdge }} />
            <Pressable onPress={handleRestore} style={row}>
              <Ionicons name="refresh-outline" size={18} color={colors.lumenDim} />
              <Text style={{ color: colors.lumen, fontSize: 15, fontWeight: "600", flex: 1 }}>
                Restore Purchases
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lumenDim} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.panelEdge }} />
            <Pressable onPress={handleLeaveReview} style={row}>
              <Ionicons name="star-outline" size={18} color={colors.lumenDim} />
              <Text style={{ color: colors.lumen, fontSize: 15, fontWeight: "600", flex: 1 }}>
                Leave a Review
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lumenDim} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.panelEdge }} />
            <Pressable onPress={() => router.push("/help")} style={row}>
              <Ionicons name="help-circle-outline" size={18} color={colors.lumenDim} />
              <Text style={{ color: colors.lumen, fontSize: 15, fontWeight: "600", flex: 1 }}>
                Help
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lumenDim} />
            </Pressable>
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

          <Pressable
            onPress={confirmDeleteAccount}
            style={{ marginTop: spacing(5), alignItems: "center", minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                color: colors.danger,
                fontWeight: "700",
                fontSize: 14,
                textDecorationLine: "underline",
              }}
            >
              Delete Account
            </Text>
          </Pressable>

          <Text
            style={{
              marginTop: spacing(5),
              textAlign: "center",
              color: colors.lumenDim + "88",
              fontSize: 12,
            }}
          >
            Promptular v{Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </>
      )}

      {/* Import prompts */}
      <Modal
        visible={importOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImportOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" }}
        >
          <View
            style={{
              backgroundColor: colors.panel,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing(5),
              paddingBottom: spacing(10),
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 18 }}>
              Import prompts
            </Text>
            <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              Bring prompts in from anywhere. Pick a .csv or .json file, or
              paste the contents below. Collections are created automatically.
              Up to 500 prompts at a time.
            </Text>
            <Pressable
              onPress={pickImportFile}
              style={{
                marginTop: spacing(3),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: colors.violet + "88",
                paddingVertical: 13,
                minHeight: 44,
              }}
            >
              <Ionicons name="document-outline" size={16} color={colors.violet} />
              <Text style={{ color: colors.violet, fontWeight: "700", fontSize: 14 }}>
                Choose a file
              </Text>
            </Pressable>
            <TextInput
              value={importText}
              onChangeText={(t) => {
                setImportText(t);
                setImportMsg(null);
              }}
              multiline
              placeholder="Paste your CSV or JSON here..."
              placeholderTextColor={colors.lumenDim + "66"}
              style={{
                marginTop: spacing(3),
                minHeight: 140,
                maxHeight: 220,
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: colors.panelEdge,
                backgroundColor: colors.ink,
                color: colors.lumen,
                padding: spacing(3),
                fontSize: 16,
                textAlignVertical: "top",
              }}
            />
            {importMsg && (
              <Text
                style={{
                  color: importMsg.ok ? colors.good : colors.danger,
                  marginTop: spacing(2),
                  fontSize: 13,
                }}
              >
                {importMsg.text}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
              <Pressable
                onPress={() => setImportOpen(false)}
                style={{
                  flex: 1,
                  borderRadius: radius.button,
                  borderWidth: 1,
                  borderColor: colors.panelEdge,
                  paddingVertical: 13,
                  alignItems: "center",
                  minHeight: 44,
                }}
              >
                <Text style={{ color: colors.lumenDim, fontWeight: "700" }}>
                  {importMsg?.ok ? "Done" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                onPress={runImport}
                disabled={importBusy || !importText.trim()}
                style={{
                  flex: 1,
                  borderRadius: radius.button,
                  backgroundColor: colors.violet,
                  paddingVertical: 13,
                  alignItems: "center",
                  opacity: importBusy || !importText.trim() ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {importBusy ? (
                  <ActivityIndicator size="small" color={colors.lumen} />
                ) : (
                  <Text style={{ color: colors.lumen, fontWeight: "700" }}>Import</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Promo code */}
      <Modal
        visible={promoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPromoOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" }}
        >
          <View
            style={{
              backgroundColor: colors.panel,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing(5),
              paddingBottom: spacing(10),
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 18 }}>
              Redeem a code
            </Text>
            <TextInput
              value={promoCode}
              onChangeText={(t) => {
                setPromoCode(t);
                setPromoMsg(null);
              }}
              placeholder="Enter your code..."
              placeholderTextColor={colors.lumenDim + "66"}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              style={{
                marginTop: spacing(3),
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: colors.panelEdge,
                backgroundColor: colors.ink,
                color: colors.lumen,
                padding: spacing(3),
                fontSize: 16,
                minHeight: 44,
              }}
            />
            {promoMsg && (
              <Text
                style={{
                  color: promoMsg.ok ? colors.good : colors.danger,
                  marginTop: spacing(2),
                  fontSize: 13,
                }}
              >
                {promoMsg.text}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
              <Pressable
                onPress={() => setPromoOpen(false)}
                style={{
                  flex: 1,
                  borderRadius: radius.button,
                  borderWidth: 1,
                  borderColor: colors.panelEdge,
                  paddingVertical: 13,
                  alignItems: "center",
                  minHeight: 44,
                }}
              >
                <Text style={{ color: colors.lumenDim, fontWeight: "700" }}>
                  {promoMsg?.ok ? "Done" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                onPress={redeemPromo}
                disabled={promoBusy || !promoCode.trim()}
                style={{
                  flex: 1,
                  borderRadius: radius.button,
                  backgroundColor: colors.violet,
                  paddingVertical: 13,
                  alignItems: "center",
                  opacity: promoBusy || !promoCode.trim() ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {promoBusy ? (
                  <ActivityIndicator size="small" color={colors.lumen} />
                ) : (
                  <Text style={{ color: colors.lumen, fontWeight: "700" }}>Redeem</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
