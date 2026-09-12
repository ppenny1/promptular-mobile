// One collection's prompts. Pushed from the Collections tab (or the Library
// chip bar). Rows open the standard prompt detail; hearts toggle in place.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useColors } from "@/lib/theme";
import { api } from "@/lib/api";

interface PromptRow {
  id: number;
  title: string;
  text: string;
  favorite: number;
  times_used: number;
  updated_at: string;
}

export default function CollectionScreen() {
  const colors = useColors();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ prompts: PromptRow[] }>(
        `/api/prompts?collectionId=${id}`
      );
      setPrompts(res.prompts);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, paddingTop: spacing(14) }}>
      <View
        style={{
          paddingHorizontal: spacing(5),
          flexDirection: "row",
          alignItems: "center",
          gap: spacing(3),
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.lumenDim} />
        </Pressable>
        <Ionicons name="folder" size={20} color={colors.violet} />
        <Text
          style={{ color: colors.lumen, fontSize: 22, fontWeight: "800", flex: 1 }}
          numberOfLines={1}
        >
          {name || "Collection"}
        </Text>
      </View>

      {state === "error" && (
        <Text style={{ color: colors.danger, padding: spacing(5), fontSize: 15 }}>
          Couldn&apos;t load this collection. Pull to retry.
        </Text>
      )}
      {state === "ready" && prompts.length === 0 && (
        <Text style={{ color: colors.lumenDim, padding: spacing(5), fontSize: 15 }}>
          Nothing in here yet. Open a prompt and use its collection chip to
          move it in.
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
              await load();
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
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons
                name={item.favorite ? "heart" : "heart-outline"}
                size={22}
                color={item.favorite ? colors.heart : colors.lumenDim}
              />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}
