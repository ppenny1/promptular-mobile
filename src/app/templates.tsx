// Template browser: 123 ready-made prompts served live from
// GET /api/templates (the web repo's gallery), so new templates appear
// with every website deploy and never require an app build. Starter
// content for fresh libraries; every template saves straight in.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

interface Template {
  slug: string;
  title: string;
  intro: string;
  prompt: string;
}

interface TemplateGroup {
  category: string;
  templates: Template[];
}

export default function TemplatesScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ groups: TemplateGroup[] }>("/api/templates", {
        auth: false,
      });
      setGroups(res.groups);
      if (res.groups.length > 0) setActiveCategory(res.groups[0].category);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (state === "loading") load();
    }, [load, state])
  );

  async function saveTemplate(t: Template) {
    if (saving || savedSlugs.has(t.slug)) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/prompts", {
        method: "POST",
        body: { title: t.title, text: t.prompt },
      });
      setSavedSlugs((prev) => new Set(prev).add(t.slug));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Sign in on the Account tab to save templates.");
      } else if (err instanceof ApiError && err.body?.error === "prompt_limit") {
        setError("Your free library is full (25 prompts). Pro is unlimited.");
      } else {
        setError("Couldn't save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const activeGroup = groups.find((g) => g.category === activeCategory);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing(5),
          paddingTop: spacing(5),
          paddingBottom: spacing(2),
        }}
      >
        <Text style={{ color: colors.lumen, fontSize: 22, fontWeight: "800" }}>
          {selected ? selected.title : "Templates"}
        </Text>
        <Pressable
          onPress={() => (selected ? setSelected(null) : router.back())}
          hitSlop={10}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons
            name={selected ? "arrow-back" : "close"}
            size={26}
            color={colors.lumenDim}
          />
        </Pressable>
      </View>

      {state === "loading" && (
        <ActivityIndicator color={colors.lumenDim} style={{ marginTop: spacing(10) }} />
      )}
      {state === "error" && (
        <Text style={{ color: colors.danger, padding: spacing(5), fontSize: 15 }}>
          Couldn&apos;t load templates. Check your connection and reopen.
        </Text>
      )}

      {state === "ready" && !selected && (
        <>
          <Text
            style={{
              color: colors.lumenDim,
              fontSize: 13,
              paddingHorizontal: spacing(5),
              lineHeight: 19,
            }}
          >
            Ready-made prompts to start your library. Save one, then fill in
            the [BRACKETS] with your details.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing(3), flexGrow: 0, height: 46 }}
            contentContainerStyle={{
              paddingHorizontal: spacing(5),
              gap: 8,
              alignItems: "center",
            }}
          >
            {groups.map((g) => {
              const active = g.category === activeCategory;
              return (
                <Pressable
                  key={g.category}
                  onPress={() => setActiveCategory(g.category)}
                  style={{
                    paddingHorizontal: 14,
                    borderRadius: radius.button,
                    backgroundColor: active ? colors.violet : colors.panel,
                    minHeight: 38,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.lumen : colors.lumenDim,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {g.category} ({g.templates.length})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <FlatList
            data={activeGroup?.templates ?? []}
            keyExtractor={(t) => t.slug}
            contentContainerStyle={{ padding: spacing(5), gap: spacing(3) }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setError("");
                  setCopied(false);
                  setSelected(item);
                }}
                style={{
                  borderRadius: radius.card,
                  backgroundColor: colors.panel,
                  padding: spacing(4),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing(3),
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ color: colors.lumen, fontWeight: "700", fontSize: 15 }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: colors.lumenDim, marginTop: 4, fontSize: 13, lineHeight: 19 }}
                    numberOfLines={2}
                  >
                    {item.intro}
                  </Text>
                </View>
                {savedSlugs.has(item.slug) ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.good} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.lumenDim} />
                )}
              </Pressable>
            )}
          />
        </>
      )}

      {state === "ready" && selected && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(2) }}
          >
            <Text style={{ color: colors.lumenDim, fontSize: 14, lineHeight: 20 }}>
              {selected.intro}
            </Text>
            <View
              style={{
                marginTop: spacing(4),
                borderRadius: radius.card,
                backgroundColor: colors.panel,
                padding: spacing(4),
              }}
            >
              <Text style={{ color: colors.violet, fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>
                THE PROMPT
              </Text>
              <Text style={{ color: colors.lumen, marginTop: 8, fontSize: 14, lineHeight: 21 }}>
                {selected.prompt}
              </Text>
            </View>
            {error !== "" && (
              <Text style={{ color: colors.danger, marginTop: spacing(3), fontSize: 13 }}>
                {error}
              </Text>
            )}
          </ScrollView>
          <View
            style={{
              flexDirection: "row",
              gap: spacing(3),
              padding: spacing(5),
              paddingBottom: spacing(10),
            }}
          >
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(selected.prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              style={{
                flex: 1,
                borderRadius: radius.button,
                borderWidth: 1,
                borderColor: colors.panelEdge,
                paddingVertical: 14,
                alignItems: "center",
                minHeight: 44,
              }}
            >
              <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 14 }}>
                {copied ? "✓ Copied" : "Copy"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => saveTemplate(selected)}
              disabled={saving || savedSlugs.has(selected.slug)}
              style={{
                flex: 1,
                borderRadius: radius.button,
                backgroundColor: savedSlugs.has(selected.slug) ? colors.ink : colors.violet,
                borderWidth: savedSlugs.has(selected.slug) ? 1 : 0,
                borderColor: colors.good + "88",
                paddingVertical: 14,
                alignItems: "center",
                opacity: saving ? 0.6 : 1,
                minHeight: 44,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.lumen} />
              ) : (
                <Text
                  style={{
                    color: savedSlugs.has(selected.slug) ? colors.good : colors.lumen,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  {savedSlugs.has(selected.slug) ? "✓ In your library" : "Save to Library"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
