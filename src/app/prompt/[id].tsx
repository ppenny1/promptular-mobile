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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useColors } from "@/lib/theme";
import { api } from "@/lib/api";

interface PromptData {
  id: number;
  title: string;
  text: string;
  tags: string | null;
  favorite: number;
  times_used: number;
  collection_id: number | null;
  share_slug: string | null;
}

interface CollectionRow {
  id: number;
  name: string;
  prompt_count: number;
}

interface PlatformDef {
  id?: string | number;
  name: string;
  web?: string;
  url?: string;
  prefill?: string;
  color?: string;
  isCustom?: boolean;
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
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Collection picker state
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [colPickerOpen, setColPickerOpen] = useState(false);

  // Custom platform form state (create and edit share the sheet)
  const [addPlatOpen, setAddPlatOpen] = useState(false);
  const [editPlatId, setEditPlatId] = useState<number | null>(null);
  const [platName, setPlatName] = useState("");
  const [platUrl, setPlatUrl] = useState("");
  const [platBusy, setPlatBusy] = useState(false);
  const [platError, setPlatError] = useState("");

  function mergePlatforms(res: { platforms: PlatformDef[]; custom: PlatformDef[] }) {
    setPlatforms([
      ...res.platforms,
      ...res.custom.map((c) => ({ ...c, isCustom: true })),
    ]);
  }

  // Enhance-this-prompt state
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState("");
  const [enhanceResult, setEnhanceResult] = useState<{
    enhanced: string;
    why: string;
    balance: number;
  } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [resultCopied, setResultCopied] = useState(false);

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
      // Collections load alongside so the chip can show the real name.
      api<{ collections: CollectionRow[] }>("/api/collections")
        .then((c) => setCollections(c.collections))
        .catch(() => {});
    } catch {
      router.back();
    }
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openCollectionPicker() {
    if (collections.length === 0) {
      try {
        const res = await api<{ collections: CollectionRow[] }>("/api/collections");
        setCollections(res.collections);
      } catch {
        Alert.alert("Couldn't load collections", "Check your connection.");
        return;
      }
    }
    setColPickerOpen(true);
  }

  async function moveToCollection(collectionId: number | null) {
    if (!prompt) return;
    setColPickerOpen(false);
    const prev = prompt.collection_id;
    setPrompt({ ...prompt, collection_id: collectionId });
    try {
      await api(`/api/prompts/${prompt.id}`, {
        method: "PUT",
        body: { collectionId },
      });
    } catch {
      setPrompt((p) => (p ? { ...p, collection_id: prev } : p));
      Alert.alert("Couldn't move", "Please try again.");
    }
  }

  async function saveCustomPlatform() {
    if (!platName.trim() || !platUrl.trim() || platBusy) return;
    setPlatBusy(true);
    setPlatError("");
    try {
      let url = platUrl.trim();
      if (!/^https?:\/\//.test(url)) url = `https://${url}`;
      if (editPlatId !== null) {
        await api(`/api/platforms/${editPlatId}`, {
          method: "PUT",
          body: { name: platName.trim(), url },
        });
      } else {
        await api("/api/platforms", {
          method: "POST",
          body: { name: platName.trim(), url },
        });
      }
      // Refresh the list so the change appears immediately.
      const res = await api<{ platforms: PlatformDef[]; custom: PlatformDef[] }>(
        "/api/platforms"
      );
      mergePlatforms(res);
      setAddPlatOpen(false);
      setEditPlatId(null);
      setPlatName("");
      setPlatUrl("");
    } catch (err) {
      const apiErr = err as { status?: number; body?: { error?: string }; message?: string };
      if (apiErr.body?.error === "pro_required") {
        setPlatError("Custom platforms are a Pro feature. Upgrade on the Account tab.");
      } else {
        setPlatError(apiErr.message || "Couldn't save. Check the name and URL.");
      }
    } finally {
      setPlatBusy(false);
    }
  }

  function confirmDeletePlatform() {
    if (editPlatId === null) return;
    const platId = editPlatId;
    Alert.alert("Remove this platform?", "It disappears from your Launch menu everywhere.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await api(`/api/platforms/${platId}`, { method: "DELETE" }).catch(() => {});
          const res = await api<{ platforms: PlatformDef[]; custom: PlatformDef[] }>(
            "/api/platforms"
          ).catch(() => null);
          if (res) mergePlatforms(res);
          setAddPlatOpen(false);
          setEditPlatId(null);
          setPlatName("");
          setPlatUrl("");
        },
      },
    ]);
  }

  async function runEnhance(strength: "light" | "full") {
    if (!prompt || enhancing) return;
    setEnhancing(true);
    setEnhanceError("");
    try {
      const res = await api<{ enhanced: string; why: string; balance: number }>(
        "/api/enhance",
        {
          method: "POST",
          body: { prompt: prompt.text, mode: "general", strength },
        }
      );
      setEnhanceResult(res);
    } catch (err) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 402) {
        setEnhanceError("Not enough credits. Grab a pack on the Account tab.");
      } else {
        setEnhanceError("Enhancement didn't work. Please try again.");
      }
    } finally {
      setEnhancing(false);
    }
  }

  async function replaceWithEnhanced() {
    if (!prompt || !enhanceResult || replacing) return;
    setReplacing(true);
    try {
      const res = await api<{ prompt: PromptData }>(`/api/prompts/${prompt.id}`, {
        method: "PUT",
        body: { text: enhanceResult.enhanced },
      });
      setPrompt(res.prompt);
      setEnhanceOpen(false);
      setEnhanceResult(null);
    } catch {
      Alert.alert("Couldn't update", "Please try again.");
    } finally {
      setReplacing(false);
    }
  }

  async function handleShare() {
    if (!prompt) return;
    if (prompt.share_slug) {
      // Already shared: offer the link again or turn sharing off.
      const link = `https://www.promptular.app/p/${prompt.share_slug}`;
      Alert.alert("Shared prompt", "Anyone with the link can view and copy this prompt.", [
        {
          text: "Copy link",
          onPress: async () => {
            await Clipboard.setStringAsync(link);
          },
        },
        {
          text: "Stop sharing",
          style: "destructive",
          onPress: async () => {
            await api(`/api/prompts/${prompt.id}`, {
              method: "PUT",
              body: { share: false },
            }).catch(() => {});
            setPrompt({ ...prompt, share_slug: null });
          },
        },
        { text: "Done", style: "cancel" },
      ]);
      return;
    }
    try {
      const res = await api<{ shareSlug: string }>(`/api/prompts/${prompt.id}`, {
        method: "PUT",
        body: { share: true },
      });
      setPrompt({ ...prompt, share_slug: res.shareSlug });
      const link = `https://www.promptular.app/p/${res.shareSlug}`;
      await Clipboard.setStringAsync(link);
      Alert.alert(
        "Link copied",
        "Anyone with the link can view and copy this prompt. Turn sharing off anytime from the share icon."
      );
    } catch {
      Alert.alert("Couldn't share", "Please try again.");
    }
  }

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
        mergePlatforms(res);
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
          <Pressable onPress={handleShare} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
            <Ionicons
              name={prompt.share_slug ? "link" : "share-outline"}
              size={22}
              color={prompt.share_slug ? colors.violet : colors.lumenDim}
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
              style={{ flex: 1, borderRadius: radius.button, backgroundColor: colors.spark, paddingVertical: 13, alignItems: "center", opacity: busy ? 0.6 : 1, minHeight: 44 }}
            >
              <Text style={{ color: colors.onSpark, fontWeight: "700" }}>
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

          <Pressable
            onPress={openCollectionPicker}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              marginTop: spacing(2),
              paddingHorizontal: 12,
              borderRadius: radius.button,
              backgroundColor: colors.panel,
              minHeight: 38,
            }}
          >
            <Ionicons name="folder-outline" size={14} color={colors.lumenDim} />
            <Text style={{ color: colors.lumenDim, fontWeight: "700", fontSize: 13 }}>
              {collections.find((c) => c.id === prompt.collection_id)?.name ||
                (prompt.collection_id ? "Collection" : "Add to collection")}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.lumenDim} />
          </Pressable>

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
              <Ionicons name="rocket" size={18} color={colors.onSpark} />
              <Text style={{ color: colors.onSpark, fontWeight: "900", fontSize: 16 }}>
                Launch
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              setEnhanceError("");
              setEnhanceResult(null);
              setEnhanceOpen(true);
            }}
            style={{
              marginTop: spacing(3),
              borderRadius: radius.button,
              backgroundColor: colors.spark,
              paddingVertical: 14,
              alignItems: "center",
              minHeight: 44,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="sparkles-outline" size={16} color={colors.onSpark} />
              <Text style={{ color: colors.onSpark, fontWeight: "700", fontSize: 14 }}>
                Enhance this prompt
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

      {/* Enhance this prompt */}
      <Modal
        visible={enhanceOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !enhancing && setEnhanceOpen(false)}
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
              maxHeight: "85%",
            }}
          >
            {!enhanceResult ? (
              <>
                <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 18 }}>
                  Enhance this prompt
                </Text>
                <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                  AI rewrites your saved prompt into a stronger version. You
                  choose whether to keep it.
                </Text>
                {enhancing ? (
                  <View style={{ paddingVertical: spacing(8), alignItems: "center" }}>
                    <ActivityIndicator color={colors.violet} />
                    <Text style={{ color: colors.lumenDim, marginTop: spacing(3), fontSize: 13 }}>
                      Enhancing...
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: spacing(4), gap: spacing(3) }}>
                    <Pressable
                      onPress={() => runEnhance("light")}
                      style={{
                        borderRadius: radius.card,
                        borderWidth: 1,
                        borderColor: colors.violet,
                        padding: spacing(4),
                      }}
                    >
                      <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 15 }}>
                        Light Touch
                      </Text>
                      <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
                        Quick polish. 1 credit.
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => runEnhance("full")}
                      style={{
                        borderRadius: radius.card,
                        borderWidth: 1,
                        borderColor: colors.panelEdge,
                        padding: spacing(4),
                      }}
                    >
                      <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 15 }}>
                        Full Rework
                      </Text>
                      <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
                        Deep rewrite with the bigger model. 2 credits.
                      </Text>
                    </Pressable>
                  </View>
                )}
                {enhanceError !== "" && (
                  <Text style={{ color: colors.danger, marginTop: spacing(3), fontSize: 13 }}>
                    {enhanceError}
                  </Text>
                )}
                {!enhancing && (
                  <Pressable
                    onPress={() => setEnhanceOpen(false)}
                    style={{ marginTop: spacing(4), alignItems: "center", minHeight: 44, justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.lumenDim, fontWeight: "700", fontSize: 14 }}>
                      Cancel
                    </Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: colors.violet, fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>
                  ENHANCED VERSION
                </Text>
                <ScrollView style={{ marginTop: spacing(2), maxHeight: 320 }}>
                  <Text style={{ color: colors.lumen, fontSize: 14, lineHeight: 21 }}>
                    {enhanceResult.enhanced}
                  </Text>
                  <Text style={{ color: colors.good, marginTop: spacing(2), fontSize: 12 }}>
                    {enhanceResult.why}
                  </Text>
                </ScrollView>
                <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: spacing(2) }}>
                  {enhanceResult.balance} {enhanceResult.balance === 1 ? "credit" : "credits"} left
                </Text>
                <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(3) }}>
                  <Pressable
                    onPress={async () => {
                      await Clipboard.setStringAsync(enhanceResult.enhanced);
                      setResultCopied(true);
                      setTimeout(() => setResultCopied(false), 1500);
                    }}
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
                    <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 13 }}>
                      {resultCopied ? "✓ Copied" : "Copy"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={replaceWithEnhanced}
                    disabled={replacing}
                    style={{
                      flex: 1,
                      borderRadius: radius.button,
                      backgroundColor: colors.spark,
                      paddingVertical: 13,
                      alignItems: "center",
                      opacity: replacing ? 0.6 : 1,
                      minHeight: 44,
                    }}
                  >
                    {replacing ? (
                      <ActivityIndicator size="small" color={colors.onSpark} />
                    ) : (
                      <Text style={{ color: colors.onSpark, fontWeight: "700", fontSize: 13 }}>
                        Replace my prompt
                      </Text>
                    )}
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => {
                    setEnhanceOpen(false);
                    setEnhanceResult(null);
                  }}
                  style={{ marginTop: spacing(3), alignItems: "center", minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={{ color: colors.lumenDim, fontWeight: "700", fontSize: 13 }}>
                    Keep my original
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Collection picker */}
      <Modal
        visible={colPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setColPickerOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: "#00000099" }} onPress={() => setColPickerOpen(false)}>
          <View
            style={{
              marginTop: "auto",
              backgroundColor: colors.panel,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing(5),
              paddingBottom: spacing(10),
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "800", fontSize: 18 }}>
              Move to collection
            </Text>
            {collections.length === 0 && (
              <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: spacing(2) }}>
                No collections yet. Create one from the Library tab with the New chip.
              </Text>
            )}
            <ScrollView style={{ marginTop: spacing(2), maxHeight: 380 }}>
              <Pressable
                onPress={() => moveToCollection(null)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, minHeight: 44 }}
              >
                <Ionicons
                  name={prompt.collection_id === null ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={prompt.collection_id === null ? colors.violet : colors.lumenDim}
                />
                <Text style={{ color: colors.lumen, fontSize: 16, fontWeight: "600" }}>
                  No collection
                </Text>
              </Pressable>
              {collections.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => moveToCollection(c.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, minHeight: 44 }}
                >
                  <Ionicons
                    name={prompt.collection_id === c.id ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={prompt.collection_id === c.id ? colors.violet : colors.lumenDim}
                  />
                  <Text style={{ color: colors.lumen, fontSize: 16, fontWeight: "600" }}>
                    {c.name}
                  </Text>
                  <Text style={{ color: colors.lumenDim, fontSize: 13 }}>
                    {c.prompt_count}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

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
                  key={`${p.isCustom ? "c" : "d"}-${p.id ?? i}`}
                  onPress={() => launchTo(p)}
                  onLongPress={
                    p.isCustom
                      ? () => {
                          setPickerOpen(false);
                          setEditPlatId(Number(p.id));
                          setPlatName(p.name);
                          setPlatUrl(p.url || "");
                          setPlatError("");
                          setAddPlatOpen(true);
                        }
                      : undefined
                  }
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
                      backgroundColor: p.isCustom
                        ? colors.spark
                        : p.color || colors.violet,
                    }}
                  />
                  <Text
                    style={{ color: colors.lumen, fontSize: 16, fontWeight: "600", flex: 1 }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {p.isCustom && (
                    <Text style={{ color: colors.lumenDim + "88", fontSize: 11 }}>
                      hold to edit
                    </Text>
                  )}
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setPickerOpen(false);
                  setEditPlatId(null);
                  setPlatName("");
                  setPlatUrl("");
                  setPlatError("");
                  setAddPlatOpen(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  minHeight: 44,
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.violet} />
                <Text style={{ color: colors.violet, fontSize: 15, fontWeight: "700" }}>
                  Add your own platform
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Add custom platform */}
      <Modal
        visible={addPlatOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddPlatOpen(false)}
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
              {editPlatId !== null ? "Edit your platform" : "Add your own platform"}
            </Text>
            <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {editPlatId !== null
                ? "Change the name or web address, or remove it from your Launch menu."
                : "Use an AI that isn't on the list? Add its name and web address and it joins your Launch menu on every prompt."}
            </Text>
            <TextInput
              value={platName}
              onChangeText={setPlatName}
              placeholder="Name (e.g. DeepSeek)"
              placeholderTextColor={colors.lumenDim + "66"}
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
            <TextInput
              value={platUrl}
              onChangeText={setPlatUrl}
              placeholder="Web address (e.g. chat.deepseek.com)"
              placeholderTextColor={colors.lumenDim + "66"}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
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
            {platError !== "" && (
              <Text style={{ color: colors.danger, marginTop: spacing(2), fontSize: 13 }}>
                {platError}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
              <Pressable
                onPress={() => setAddPlatOpen(false)}
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
                <Text style={{ color: colors.lumenDim, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveCustomPlatform}
                disabled={platBusy || !platName.trim() || !platUrl.trim()}
                style={{
                  flex: 1,
                  borderRadius: radius.button,
                  backgroundColor: colors.spark,
                  paddingVertical: 13,
                  alignItems: "center",
                  opacity: platBusy || !platName.trim() || !platUrl.trim() ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {platBusy ? (
                  <ActivityIndicator size="small" color={colors.onSpark} />
                ) : (
                  <Text style={{ color: colors.onSpark, fontWeight: "700" }}>
                    {editPlatId !== null ? "Save" : "Add"}
                  </Text>
                )}
              </Pressable>
            </View>
            {editPlatId !== null && (
              <Pressable
                onPress={confirmDeletePlatform}
                style={{ marginTop: spacing(4), alignItems: "center", minHeight: 44, justifyContent: "center" }}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: "700",
                    fontSize: 13,
                    textDecorationLine: "underline",
                  }}
                >
                  Remove platform
                </Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Variables fill form */}
      <Modal visible={varsOpen} transparent animationType="slide" onRequestClose={() => setVarsOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" }}
        >
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
              <Text style={{ color: colors.onSpark, fontWeight: "900", fontSize: 15 }}>
                Copy and launch
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
