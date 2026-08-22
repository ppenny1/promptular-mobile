// The Enhance tab: the identity of the app. v0 skeleton with the real
// layout and a live call to /api/enhance once signed in.

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

const MODES = [
  { id: "general", label: "General" },
  { id: "image", label: "Image" },
  { id: "coding", label: "Coding" },
  { id: "writing", label: "Writing" },
] as const;

interface EnhanceResponse {
  ok: boolean;
  enhanced: string;
  why: string;
  balance: number;
}

export default function EnhanceScreen() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<string>("general");
  const [strength, setStrength] = useState<"light" | "full">("light");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnhanceResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleEnhance() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setCopied(false);
    setSaved(false);
    try {
      const res = await api<EnhanceResponse>("/api/enhance", {
        method: "POST",
        body: { prompt, mode, strength },
      });
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Sign in on the Account tab to start enhancing.");
      } else if (err instanceof ApiError && err.status === 402) {
        setError("Not enough credits. Grab a pack on the Account tab.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
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
        body: { title, text: result.enhanced },
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
      <Text
        style={{
          color: colors.lumen,
          fontSize: 28,
          fontWeight: "800",
        }}
      >
        Enhance
      </Text>
      <Text style={{ color: colors.lumenDim, marginTop: 4, fontSize: 15 }}>
        Turn a lazy prompt into a great one.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: spacing(5), flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMode(m.id)}
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
        <Text style={{ color: colors.danger, marginTop: spacing(4), fontSize: 14 }}>
          {error}
        </Text>
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
              {result.balance} credits left
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
