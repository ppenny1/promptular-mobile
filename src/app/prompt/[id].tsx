// Prompt detail: view, favorite, edit, share, delete, and the Launch flow.
// Launch fills {{variables}} if present, copies the final text, opens the
// chosen platform, and bumps times_used.

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/lib/theme";
import { api } from "@/lib/api";

interface PromptData {
  id: number;
  title: string;
  text: string;
  tags: string | null;
  favorite: number;
  times_used: number;
  share_slug: string | null;
}

interface PlatformDef {
  id?: string;
  name: string;
  web?: string;
  url?: string;
  prefill?: string;
  color?: string;
}

// Prompts longer than this go clipboard-only even on prefill platforms;
// very long URLs get truncated or rejected by browsers and servers.
const PREFILL_CHAR_CAP = 1500;

function extractVariables(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    found.add(m[1]);
  }
  return [...found];
}

export default function PromptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Launch flow state
  const [platforms, setPlatforms] = useState<PlatformDef[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [pendingPlatform, setPendingPlatform] = useState<PlatformDef | null>(null);

  const variables = useMemo(
    () => (prompt ? extractVariables(prompt.text) : []),
    [prompt]
  );

  const load = useCallback(async () => {
    try {
      const res = await api<{ prompt: PromptData }>(`/api/prompts/${id}`);
      setPrompt(res.prompt);
    } catch {
      router.back();
    }
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleFavorite() {
    if (!prompt) return;
    const next = prompt.favorite ? 0 : 1;
    setPrompt({ ...prompt, favorite: next });
    await api(`/api/prompts/${prompt.id}`, {
      method: "PUT",
      body: { favorite: next === 1 },
    }).catch(() => setPrompt(prompt));
  }

  async function saveEdit() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      const res = await api<{ prompt: PromptData }>(`/api/prompts/${prompt.id}`, {
        method: "PUT",
        body: { title: editTitle, text: editText },
      });
      setPrompt(res.prompt);
      setEditing(false);
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!prompt) return;
    Alert.alert("Delete this prompt?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api(`/api/prompts/${prompt.id}`, { method: "DELETE" }).catch(() => {});
          router.back();
        },
      },
    ]);
  }

  async function handleCopy(text: string) {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function finalText(): string {
    if (!prompt) return "";
    let out = prompt.text;
    for (const v of variables) {
      out = out.replaceAll(new RegExp(`\\{\\{\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g"), varValues[v] || "");
    }
    return out;
  }

  async function startLaunch() {
    if (platforms.length === 0) {
      try {
        const res = await api<{ platforms: PlatformDef[]; custom: PlatformDef[] }>(
          "/api/platforms"
        );
        setPlatforms([...res.platforms, ...res.custom]);
      } catch {
        Alert.alert("Couldn't load platforms", "Check your connection.");
        return;
      }
    }
    setPickerOpen(true);
  }

  async function launchTo(platform: PlatformDef) {
    setPickerOpen(false);
    if (variables.length > 0 && !varsOpen) {
      // Collect variable values first, then come back here.
      setPendingPlatform(platform);
      setVarsOpen(true);
      return;
    }
    await doLaunch(platform);
  }

  async function doLaunch(platform: PlatformDef) {
    if (!prompt) return;
    const text = finalText();
    // Clipboard always, even on prefill platforms: the reliable fallback.
    await Clipboard.setStringAsync(text);
    api(`/api/prompts/${prompt.id}`, { method: "PUT", body: { action: "used" } }).catch(
      () => {}
    );
    setPrompt({ ...prompt, times_used: prompt.times_used + 1 });

    // Prefill when the platform supports it and the prompt fits in a URL.
    const url =
      platform.prefill && text.length <= PREFILL_CHAR_CAP
        ? platform.prefill.replace("{q}", encodeURIComponent(text))
        : platform.web || platform.url;
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert("Copied!", "Your prompt is on the clipboard. Paste it anywhere.");
      });
    }
  }

  if (!prompt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.lumenDim }}>Loading...</Text>
      </View>
    );
  }

  const tags: string[] = (() => {
    try {
      return prompt.tags ? JSON.parse(prompt.tags) : [];
    } catch {
      return [];
    }
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(14) }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
          <Ionicons name="chevron-down" size={26} color={colors.lumenDim} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: spacing(4), alignItems: "center" }}>
          <Pressable onPress={toggleFavorite} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
            <Ionicons
              name={prompt.favorite ? "heart" : "heart-outline"}
              size={24}
              color={prompt.favorite ? colors.heart : colors.lumenDim}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              setEditTitle(prompt.title);
              setEditText(prompt.text);
              setEditing(true);
            }}
            hitSlop={12}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Ionicons name="pencil" size={22} color={colors.lumenDim} />
          </Pressable>
          <Pressable onPress={confirmDelete} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
            <Ionicons name="trash-outline" size={22} color={colors.lumenDim} />
          </Pressable>
        </View>
      </View>

      {editing ? (
        <>
          <TextInput
            value={editTitle}
            onChangeText={setEditTitle}
            style={{
              marginTop: spacing(4),
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: colors.panelEdge,
              backgroundColor: colors.panel,
              color: colors.lumen,
              padding: spacing(3),
              fontSize: 18,
              fontWeight: "700",
            }}
          />
          <TextInput
            value={editText}
            onChangeText={setEditText}
            multiline
            style={{
              marginTop: spacing(3),
              minHeight: 180,
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: colors.panelEdge,
              backgroundColor: colors.panel,
              color: colors.lumen,
              padding: spacing(3),
              fontSize: 16,
              lineHeight: 23,
              textAlignVertical: "top",
            }}
          />
          <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
            <Pressable
              onPress={() => setEditing(false)}
              style={{ flex: 1, borderRadius: radius.button, borderWidth: 1, borderColor: colors.panelEdge, paddingVertical: 13, alignItems: "center", minHeight: 44 }}
            >
              <Text style={{ color: colors.lumenDim, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              disabled={busy}
              style={{ flex: 1, borderRadius: radius.button, backgroundColor: colors.violet, paddingVertical: 13, alignItems: "center", opacity: busy ? 0.6 : 1, minHeight: 44 }}
            >
              <Text style={{ color: colors.lumen, fontWeight: "700" }}>
                {busy ? "Saving..." : "Save changes"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={{ color: colors.lumen, fontSize: 24, fontWeight: "800", marginTop: spacing(4) }}>
            {prompt.title}
          </Text>
          {tags.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing(2) }}>
              {tags.map((t) => (
                <Text
                  key={t}
                  style={{
                    color: colors.lumenDim,
                    fontSize: 12,
                    backgroundColor: colors.panel,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  {t}
                </Text>
              ))}
            </View>
          )}
          <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: spacing(2) }}>
            Used {prompt.times_used} {prompt.times_used === 1 ? "time" : "times"}
            {variables.length > 0 ? ` · ${variables.length} fill-in ${variables.length === 1 ? "variable" : "variables"}` : ""}
          </Text>

          <View
            style={{
              marginTop: spacing(4),
              borderRadius: radius.card,
              backgroundColor: colors.panel,
              padding: spacing(4),
            }}
          >
            <Text style={{ color: colors.lumen, fontSize: 15, lineHeight: 23 }}>
              {prompt.text}
            </Text>
          </View>

          <Pressable
            onPress={startLaunch}
            style={{
              marginTop: spacing(5),
              backgroundColor: colors.spark,
              borderRadius: radius.button,
              paddingVertical: 16,
              alignItems: "center",
              minHeight: 44,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="rocket" size={18} color={colors.violetDeep} />
              <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>
                Launch
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleCopy(prompt.text)}
            style={{
              marginTop: spacing(3),
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: colors.panelEdge,
              paddingVertical: 14,
              alignItems: "center",
              minHeight: 44,
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 14 }}>
              {copied ? "✓ Copied" : "Copy prompt"}
            </Text>
          </Pressable>
        </>
      )}

      {/* Platform picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "#00000099" }} onPress={() => setPickerOpen(false)}>
          <View style={{ marginTop: "auto", backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing(5), paddingBottom: spacing(10) }}>
            <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 18 }}>
              Launch to...
            </Text>
            <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
              Your prompt is copied automatically. Paste when you arrive.
            </Text>
            <ScrollView style={{ marginTop: spacing(3), maxHeight: 380 }}>
              {platforms.map((p, i) => (
                <Pressable
                  key={p.id || `custom-${i}`}
                  onPress={() => launchTo(p)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 13,
                    minHeight: 44,
                  }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: p.color || colors.violet,
                    }}
                  />
                  <Text style={{ color: colors.lumen, fontSize: 16, fontWeight: "600" }}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Variables fill form */}
      <Modal visible={varsOpen} transparent animationType="slide" onRequestClose={() => setVarsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing(5), paddingBottom: spacing(10) }}>
            <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 18 }}>
              Fill in the blanks
            </Text>
            {variables.map((v) => (
              <View key={v} style={{ marginTop: spacing(3) }}>
                <Text style={{ color: colors.lumenDim, fontSize: 13, marginBottom: 6 }}>
                  {v}
                </Text>
                <TextInput
                  value={varValues[v] || ""}
                  onChangeText={(t) => setVarValues((prev) => ({ ...prev, [v]: t }))}
                  placeholder={`Enter ${v}...`}
                  placeholderTextColor={colors.lumenDim + "66"}
                  style={{
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
              </View>
            ))}
            <Pressable
              onPress={async () => {
                setVarsOpen(false);
                if (pendingPlatform) await doLaunch(pendingPlatform);
                setPendingPlatform(null);
              }}
              style={{
                marginTop: spacing(5),
                backgroundColor: colors.spark,
                borderRadius: radius.button,
                paddingVertical: 15,
                alignItems: "center",
                minHeight: 44,
              }}
            >
              <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 15 }}>
                Copy and launch
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
