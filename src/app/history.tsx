// Enhance history: every past enhancement, newest first, served by
// GET /api/enhance. Opens as a modal from the clock icon on the Enhance tab.
// Rows expand on tap; copy and save-to-library on each row.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useColors } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

interface HistoryRow {
  id: number;
  mode: string;
  strength: string;
  input_text: string;
  output_text: string | null;
  why_note: string | null;
  credits_spent: number;
  status: string;
  prompt_id: number | null;
  created_at: string;
}

const MODE_LABELS: Record<string, string> = {
  general: "General",
  image: "Image",
  coding: "Coding",
  writing: "Writing",
};

function timeAgo(iso: string) {
  // D1 stores UTC without a zone marker; treat it as UTC.
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function HistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signedout" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ history: HistoryRow[] }>("/api/enhance");
      setRows(res.history);
      setState("ready");
    } catch (err) {
      setState(err instanceof ApiError && err.status === 401 ? "signedout" : "error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function copyRow(item: HistoryRow) {
    if (!item.output_text) return;
    await Clipboard.setStringAsync(item.output_text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function saveRow(item: HistoryRow) {
    if (!item.output_text || savingId || item.prompt_id) return;
    setSavingId(item.id);
    setError("");
    try {
      const raw = item.input_text.trim().replace(/\s+/g, " ");
      const title =
        (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 60) +
        (raw.length > 60 ? "..." : "");
      const res = await api<{ prompt: { id: number } }>("/api/prompts", {
        method: "POST",
        body: { title, text: item.output_text, enhanceId: item.id },
      });
      // The server also links this on its side, so the state survives
      // closing and reopening History.
      setRows((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, prompt_id: res.prompt.id } : r))
      );
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === "prompt_limit") {
        setError("Your free library is full (25 prompts). Pro is unlimited.");
      } else {
        setError("Couldn't save. Please try again.");
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing(5),
          paddingTop: spacing(5),
          paddingBottom: spacing(3),
        }}
      >
        <Text style={{ color: colors.lumen, fontSize: 22, fontWeight: "800" }}>
          Enhance History
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={26} color={colors.lumenDim} />
        </Pressable>
      </View>

      {state === "loading" && (
        <ActivityIndicator color={colors.lumenDim} style={{ marginTop: spacing(10) }} />
      )}
      {state === "signedout" && (
        <Text style={{ color: colors.lumenDim, padding: spacing(5), fontSize: 15 }}>
          Sign in on the Account tab to see your history.
        </Text>
      )}
      {state === "error" && (
        <Text style={{ color: colors.danger, padding: spacing(5), fontSize: 15 }}>
          Couldn&apos;t load your history. Pull to retry.
        </Text>
      )}
      {state === "ready" && rows.length === 0 && (
        <Text style={{ color: colors.lumenDim, padding: spacing(5), fontSize: 15 }}>
          Nothing here yet. Every enhancement you run lands in this list.
        </Text>
      )}
      {error !== "" && (
        <Text style={{ color: colors.danger, paddingHorizontal: spacing(5), fontSize: 13 }}>
          {error}
        </Text>
      )}

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: spacing(5), gap: spacing(3), paddingTop: spacing(2) }}
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
        renderItem={({ item }) => {
          const expanded = expandedId === item.id;
          const failed = item.status !== "ok" || !item.output_text;
          return (
            <Pressable
              onPress={() => setExpandedId(expanded ? null : item.id)}
              style={{
                borderRadius: radius.card,
                backgroundColor: colors.panel,
                padding: spacing(4),
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  style={{
                    color: colors.violet,
                    fontWeight: "800",
                    fontSize: 11,
                    letterSpacing: 1,
                  }}
                >
                  {(MODE_LABELS[item.mode] || item.mode).toUpperCase()}
                </Text>
                {item.strength === "full" && (
                  <Text style={{ color: colors.violet, fontWeight: "700", fontSize: 11 }}>
                    FULL REWORK
                  </Text>
                )}
                <View style={{ flex: 1 }} />
                <Text style={{ color: colors.lumenDim, fontSize: 11 }}>
                  {item.credits_spent} {item.credits_spent === 1 ? "credit" : "credits"}
                  {" · "}
                  {timeAgo(item.created_at)}
                </Text>
              </View>

              <Text
                style={{ color: colors.lumenDim, marginTop: 8, fontSize: 12, lineHeight: 17 }}
                numberOfLines={expanded ? undefined : 1}
              >
                {item.input_text}
              </Text>

              {failed ? (
                <Text style={{ color: colors.danger, marginTop: 6, fontSize: 13 }}>
                  This one failed. The credit was refunded.
                </Text>
              ) : (
                <Text
                  style={{ color: colors.lumen, marginTop: 6, fontSize: 14, lineHeight: 21 }}
                  numberOfLines={expanded ? undefined : 3}
                >
                  {item.output_text}
                </Text>
              )}

              {expanded && !failed && item.why_note && (
                <Text style={{ color: colors.good, marginTop: 8, fontSize: 12 }}>
                  {item.why_note}
                </Text>
              )}

              {!failed && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: spacing(2),
                    marginTop: spacing(3),
                  }}
                >
                  {item.prompt_id ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/prompt/${item.prompt_id}`);
                      }}
                      hitSlop={6}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: radius.button,
                        borderWidth: 1,
                        borderColor: colors.violet + "66",
                        paddingHorizontal: 14,
                        minHeight: 44,
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="checkmark" size={16} color={colors.violet} />
                      <Text style={{ color: colors.violet, fontWeight: "700", fontSize: 13 }}>
                        In Library
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        saveRow(item);
                      }}
                      hitSlop={6}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: radius.button,
                        backgroundColor: colors.spark,
                        paddingHorizontal: 14,
                        minHeight: 44,
                        justifyContent: "center",
                        opacity: savingId === item.id ? 0.6 : 1,
                      }}
                    >
                      {savingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.onSpark} />
                      ) : (
                        <Ionicons name="bookmark-outline" size={16} color={colors.onSpark} />
                      )}
                      <Text style={{ color: colors.onSpark, fontWeight: "700", fontSize: 13 }}>
                        Save to Library
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      copyRow(item);
                    }}
                    hitSlop={6}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: radius.button,
                      backgroundColor: colors.ink,
                      paddingHorizontal: 14,
                      minHeight: 44,
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={copiedId === item.id ? "checkmark" : "copy-outline"}
                      size={16}
                      color={copiedId === item.id ? colors.good : colors.lumen}
                    />
                    <Text
                      style={{
                        color: copiedId === item.id ? colors.good : colors.lumen,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      {copiedId === item.id ? "Copied" : "Copy"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
