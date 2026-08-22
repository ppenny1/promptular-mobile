// The Library tab: v0 skeleton. Lists prompts from /api/prompts with search;
// detail, variables, and collections come next.

import { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

interface PromptRow {
  id: number;
  title: string;
  text: string;
  favorite: number;
  times_used: number;
  updated_at: string;
}

export default function LibraryScreen() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "signedout" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);

  async function toggleFavorite(item: PromptRow) {
    const next = item.favorite ? 0 : 1;
    setPrompts((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, favorite: next } : p))
    );
    try {
      await api(`/api/prompts/${item.id}`, {
        method: "PUT",
        body: { favorite: next === 1 },
      });
    } catch {
      setPrompts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, favorite: item.favorite } : p))
      );
    }
  }

  const load = useCallback(async (query: string) => {
    try {
      const res = await api<{ prompts: PromptRow[] }>(
        `/api/prompts?q=${encodeURIComponent(query)}`
      );
      setPrompts(res.prompts);
      setState("ready");
    } catch (err) {
      setState(err instanceof ApiError && err.status === 401 ? "signedout" : "error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(q);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, paddingTop: spacing(16) }}>
      <View style={{ paddingHorizontal: spacing(5) }}>
        <Text style={{ color: colors.lumen, fontSize: 28, fontWeight: "800" }}>
          Library
        </Text>
        <TextInput
          value={q}
          onChangeText={(t) => {
            setQ(t);
            load(t);
          }}
          placeholder="Search your prompts..."
          placeholderTextColor={colors.lumenDim + "88"}
          style={{
            marginTop: spacing(4),
            borderRadius: radius.button,
            borderWidth: 1,
            borderColor: colors.panelEdge,
            backgroundColor: colors.panel,
            color: colors.lumen,
            paddingHorizontal: spacing(4),
            paddingVertical: 12,
            fontSize: 16,
            minHeight: 44,
          }}
        />
      </View>

      {state === "signedout" && (
        <Text style={{ color: colors.lumenDim, padding: spacing(5), fontSize: 15 }}>
          Sign in on the Account tab to see your library.
        </Text>
      )}
      {state === "error" && (
        <Text style={{ color: colors.danger, padding: spacing(5), fontSize: 15 }}>
          Couldn&apos;t load your library. Pull to retry.
        </Text>
      )}
      {state === "ready" && prompts.length === 0 && (
        <Text style={{ color: colors.lumenDim, padding: spacing(5), fontSize: 15 }}>
          No prompts yet. Enhance something and save it, and it lands here.
        </Text>
      )}

      <FlatList
        data={prompts}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: spacing(5), gap: spacing(3) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.lumenDim}
            onRefresh={async () => {
              setRefreshing(true);
              await load(q);
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/prompt/${item.id}`)}
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
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text
                  style={{ color: colors.lumen, fontWeight: "700", fontSize: 15, flex: 1 }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={{ color: colors.lumenDim, fontSize: 11 }}>
                  used {item.times_used}x
                </Text>
              </View>
              <Text
                style={{ color: colors.lumenDim, marginTop: 6, fontSize: 13, lineHeight: 19 }}
                numberOfLines={3}
              >
                {item.text}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                toggleFavorite(item);
              }}
              hitSlop={10}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={item.favorite ? "heart" : "heart-outline"}
                size={22}
                color={item.favorite ? colors.danger : colors.lumenDim}
              />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}
