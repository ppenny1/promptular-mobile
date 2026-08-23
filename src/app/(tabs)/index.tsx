// The Enhance tab: the identity of the app. v0 skeleton with the real
// layout and a live call to /api/enhance once signed in.

import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";
import { recordEnhanceAndMaybeAskReview } from "@/lib/reviewPrompt";
import ErrorNotice, { friendlyError } from "@/components/ErrorNotice";

const MODES = [
  { id: "general", label: "General" },
  { id: "image", label: "Image" },
  { id: "coding", label: "Coding" },
  { id: "writing", label: "Writing" },
] as const;

interface ModeTip {
  id: string;
  tip: string;
  example: string;
}

// Baked fallback; GET /api/modes overrides it live so wording and examples
// can be tuned from the web repo without an app build.
const DEFAULT_TIPS: ModeTip[] = [
  {
    id: "general",
    tip: "Good for anything: questions, plans, research, advice.",
    example: "help me plan a surprise 40th birthday party for my sister",
  },
  {
    id: "image",
    tip: "For AI art. Describe the subject; Enhance adds style, lighting, and composition.",
    example: "a cozy cabin in snowy woods at night",
  },
  {
    id: "coding",
    tip: "For code. Say what you're building; Enhance adds inputs, outputs, and edge cases.",
    example: "python script that renames my photos by the date they were taken",
  },
  {
    id: "writing",
    tip: "For emails, posts, and essays. Enhance adds audience, tone, and structure.",
    example: "email asking my landlord to finally fix the heater",
  },
];

const SHARE_HINT_KEY = "promptular.shareHintDismissed";

interface EnhanceResponse {
  ok: boolean;
  enhanceId: number;
  enhanced: string;
  why: string;
  balance: number;
}

export default function EnhanceScreen() {
  const router = useRouter();
  const { shared } = useLocalSearchParams<{ shared?: string }>();
  const [prompt, setPrompt] = useState("");

  // Text shared into the app (share extension / share target) prefills the
  // prompt box, ready to enhance.
  useEffect(() => {
    if (typeof shared === "string" && shared.trim()) {
      setPrompt(shared.trim().slice(0, 4000));
      setResult(null);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);
  const [mode, setMode] = useState<string>("general");
  const [strength, setStrength] = useState<"light" | "full">("light");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnhanceResponse | null>(null);
  const [error, setError] = useState("");
  const [errorRaw, setErrorRaw] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tips, setTips] = useState<ModeTip[]>(DEFAULT_TIPS);
  const [shareHintVisible, setShareHintVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SHARE_HINT_KEY)
      .then((v) => {
        if (!v) setShareHintVisible(true);
      })
      .catch(() => {});
  }, []);

  function dismissShareHint() {
    setShareHintVisible(false);
    AsyncStorage.setItem(SHARE_HINT_KEY, "1").catch(() => {});
  }

  useEffect(() => {
    api<{ modes: ModeTip[] }>("/api/modes", { auth: false })
      .then((res) => {
        if (Array.isArray(res.modes) && res.modes.length > 0) setTips(res.modes);
      })
      .catch(() => {});
  }, []);

  const activeTip = tips.find((t) => t.id === mode);

  async function handleEnhance() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setErrorRaw("");
    setCopied(false);
    setSaved(false);
    try {
      const res = await api<EnhanceResponse>("/api/enhance", {
        method: "POST",
        body: { prompt, mode, strength },
      });
      setResult(res);
      // A successful enhance is the app's happiest moment; review asks
      // ride on milestones of it (3rd, 15th, 40th), never on failures.
      recordEnhanceAndMaybeAskReview();
    } catch (err) {
      // Expected states get plain guidance; anything unexpected gets a
      // friendly line plus the one-tap Report this issue flow.
      if (err instanceof ApiError && err.status === 401) {
        setError("Sign in on the Account tab to start enhancing.");
      } else if (err instanceof ApiError && err.status === 402) {
        setError("Not enough credits. Grab a pack on the Account tab.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("That's a lot of enhancing! Give it a few seconds and try again.");
      } else if (err instanceof ApiError && err.status === 502) {
        setError("Enhancement didn't finish, and your credit was refunded. Try again.");
      } else {
        const fe = friendlyError(err);
        setError(fe.message);
        setErrorRaw(fe.raw);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result || saving || saved) return;
    setSaving(true);
    try {
      // Title from the original ask, tidied: "write an email to my landlord"
      // becomes "Write an email to my landlord".
      const raw = prompt.trim().replace(/\s+/g, " ");
      const title =
        (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 60) +
        (raw.length > 60 ? "..." : "");
      await api("/api/prompts", {
        method: "POST",
        body: { title, text: result.enhanced, enhanceId: result.enhanceId },
      });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === "prompt_limit") {
        setError("Your free library is full (25 prompts). Pro is unlimited.");
      } else {
        setError("Couldn't save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await Clipboard.setStringAsync(result.enhanced);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16) }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: colors.lumen,
            fontSize: 28,
            fontWeight: "800",
          }}
        >
          Enhance
        </Text>
        <Pressable
          onPress={() => router.push("/history")}
          hitSlop={10}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="time-outline" size={24} color={colors.lumenDim} />
        </Pressable>
      </View>
      <Text style={{ color: colors.lumenDim, marginTop: 4, fontSize: 15 }}>
        Turn a lazy prompt into a great one.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: spacing(5), flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => {
              setMode(m.id);
              // A mode switch starts a fresh round: the old result is safe
              // in History, and the new mode's tip takes the stage.
              setResult(null);
              setError("");
              setErrorRaw("");
              setCopied(false);
              setSaved(false);
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: radius.button,
              backgroundColor: mode === m.id ? colors.violet : colors.panel,
              minHeight: 44,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: mode === m.id ? colors.lumen : colors.lumenDim,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        multiline
        maxLength={4000}
        placeholder="Paste or type your rough prompt..."
        placeholderTextColor={colors.lumenDim + "88"}
        style={{
          marginTop: spacing(4),
          minHeight: 120,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: colors.panelEdge,
          backgroundColor: colors.panel,
          color: colors.lumen,
          padding: spacing(4),
          fontSize: 16,
          textAlignVertical: "top",
        }}
      />

      <View style={{ flexDirection: "row", gap: 8, marginTop: spacing(4) }}>
        {(
          [
            { id: "light", label: "Light Touch · 1 credit" },
            { id: "full", label: "Full Rework · 2 credits" },
          ] as const
        ).map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setStrength(s.id)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: strength === s.id ? colors.violet : colors.panelEdge,
              backgroundColor: strength === s.id ? colors.violet + "22" : colors.panel,
              alignItems: "center",
              minHeight: 44,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: strength === s.id ? colors.lumen : colors.lumenDim,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleEnhance}
        disabled={loading || !prompt.trim()}
        style={{
          marginTop: spacing(5),
          backgroundColor: colors.spark,
          borderRadius: radius.button,
          paddingVertical: 16,
          alignItems: "center",
          opacity: loading || !prompt.trim() ? 0.5 : 1,
          minHeight: 44,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="flash" size={18} color={colors.violetDeep} />
            <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>
              Enhance
            </Text>
          </View>
        )}
      </Pressable>

      {error !== "" && (
        <ErrorNotice
          message={error}
          raw={errorRaw || undefined}
          screen="Enhance"
          onDismiss={() => {
            setError("");
            setErrorRaw("");
          }}
        />
      )}

      {!result && !loading && activeTip && (
        <View
          style={{
            marginTop: spacing(5),
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.panelEdge,
            backgroundColor: colors.panel,
            padding: spacing(4),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="bulb-outline" size={14} color={colors.spark} />
            <Text style={{ color: colors.spark, fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>
              {MODES.find((m) => m.id === mode)?.label.toUpperCase()} MODE
            </Text>
          </View>
          <Text style={{ color: colors.lumenDim, marginTop: 6, fontSize: 13, lineHeight: 19 }}>
            {activeTip.tip}
          </Text>
          <Pressable
            onPress={() => setPrompt(activeTip.example)}
            hitSlop={6}
            style={{ marginTop: spacing(2), minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors.lumenDim, fontSize: 13, lineHeight: 19 }}>
              Try: <Text style={{ color: colors.violet, fontWeight: "600" }}>&quot;{activeTip.example}&quot;</Text>
            </Text>
          </Pressable>
        </View>
      )}

      {/* One-time discoverability hint for the share extension. Dismissal
          persists in AsyncStorage so it never nags. */}
      {!result && !loading && shareHintVisible && (
        <View
          style={{
            marginTop: spacing(3),
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.panelEdge,
            backgroundColor: colors.panel,
            padding: spacing(4),
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <Ionicons name="share-outline" size={16} color={colors.violet} />
          <Text style={{ color: colors.lumenDim, fontSize: 13, lineHeight: 19, flex: 1 }}>
            See text worth enhancing in Safari, Notes, or any other app?
            Highlight it, tap Share, and choose Promptular. It lands right
            here, ready to enhance.
          </Text>
          <Pressable onPress={dismissShareHint} hitSlop={10}>
            <Ionicons name="close" size={16} color={colors.lumenDim} />
          </Pressable>
        </View>
      )}

      {result && (
        <View
          style={{
            marginTop: spacing(5),
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.violet + "66",
            backgroundColor: colors.panel,
            padding: spacing(4),
          }}
        >
          <Text style={{ color: colors.violet, fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>
            ENHANCED
          </Text>
          <Text style={{ color: colors.lumen, marginTop: 8, fontSize: 15, lineHeight: 22 }}>
            {result.enhanced}
          </Text>
          <Text style={{ color: colors.good, marginTop: 10, fontSize: 12 }}>
            ✓ {result.why}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(3), alignItems: "center" }}>
            <Text style={{ color: colors.lumenDim, fontSize: 12 }}>
              {result.balance} {result.balance === 1 ? "credit" : "credits"} left
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={handleSave}
                disabled={saving || saved}
                style={{
                  backgroundColor: saved ? colors.ink : colors.violet,
                  borderRadius: radius.button,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  minHeight: 44,
                  justifyContent: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: saved ? colors.good : colors.lumen, fontWeight: "700", fontSize: 13 }}>
                  {saved ? "✓ Saved" : saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCopy}
                style={{
                  backgroundColor: colors.ink,
                  borderRadius: radius.button,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 13 }}>
                  {copied ? "✓ Copied" : "Copy"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
