// The Collections tab: every collection in one vertical list. Tap to open
// a collection's prompts, long-press to rename or delete, + to create.
// Collections are a Pro feature server-side; create surfaces the Pro nudge.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useColors } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

interface CollectionRow {
  id: number;
  name: string;
  prompt_count: number;
}

export default function CollectionsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signedout" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ collections: CollectionRow[] }>("/api/collections");
      setCollections(res.collections);
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

  function openCreate() {
    setEditing(null);
    setName("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(col: CollectionRow) {
    setEditing(col);
    setName(col.name);
    setError("");
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api(`/api/collections/${editing.id}`, {
          method: "PUT",
          body: { name: name.trim() },
        });
      } else {
        await api("/api/collections", {
          method: "POST",
          body: { name: name.trim() },
        });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === "pro_required") {
        setError("Collections are a Pro feature. Upgrade on the Account tab.");
      } else {
        setError("Couldn't save. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!editing) return;
    const col = editing;
    Alert.alert(
      `Delete "${col.name}"?`,
      "Your prompts are kept. They just leave this collection.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await api(`/api/collections/${col.id}`, { method: "DELETE" }).catch(() => {});
            setModalOpen(false);
            load();
          },
        },
      ]
    );
  }

  function openCollection(col: CollectionRow) {
    router.push(`/collection/${col.id}?name=${encodeURIComponent(col.name)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, paddingTop: spacing(16) }}>
      <View
        style={{
          paddingHorizontal: spacing(5),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.lumen, fontSize: 28, fontWeight: "800" }}>
          Collections
        </Text>
        <Pressable
          onPress={openCreate}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.spark,
            borderRadius: radius.button,
            paddingHorizontal: 14,
            minHeight: 38,
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={16} color={colors.onSpark} />
          <Text style={{ color: colors.onSpark, fontWeight: "700", fontSize: 13 }}>New</Text>
        </Pressable>
      </View>

      {state === "signedout" && (
        <Text style={{ color: colors.lumenDim, padding: spacing(5), fontSize: 15 }}>
          Sign in on the Account tab to use collections.
        </Text>
      )}
      {state === "error" && (
        <Text style={{ color: colors.danger, padding: spacing(5), fontSize: 15 }}>
          Couldn&apos;t load your collections. Pull to retry.
        </Text>
      )}
      {state === "ready" && collections.length === 0 && (
        <View style={{ padding: spacing(5) }}>
          <Text style={{ color: colors.lumenDim, fontSize: 15, lineHeight: 22 }}>
            No collections yet. Collections group your prompts by project or
            topic, like folders. Tap New to make your first one.
          </Text>
        </View>
      )}

      <FlatList
        data={collections}
        keyExtractor={(c) => String(c.id)}
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
            onPress={() => openCollection(item)}
            onLongPress={() => openEdit(item)}
            style={{
              borderRadius: radius.card,
              backgroundColor: colors.panel,
              padding: spacing(4),
              flexDirection: "row",
              alignItems: "center",
              gap: spacing(3),
              minHeight: 44,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: colors.violet + "22",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="folder" size={18} color={colors.violet} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: colors.lumen, fontWeight: "700", fontSize: 15 }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={{ color: colors.lumenDim, fontSize: 12, marginTop: 2 }}>
                {item.prompt_count} {item.prompt_count === 1 ? "prompt" : "prompts"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.lumenDim} />
          </Pressable>
        )}
      />

      <Text
        style={{
          color: colors.lumenDim + "88",
          fontSize: 12,
          textAlign: "center",
          paddingBottom: spacing(3),
        }}
      >
        Tip: long-press a collection to rename or delete it.
      </Text>

      {/* Create / rename */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
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
              {editing ? "Rename collection" : "New collection"}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Collection name..."
              placeholderTextColor={colors.lumenDim + "66"}
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
            {error !== "" && (
              <Text style={{ color: colors.danger, marginTop: spacing(2), fontSize: 13 }}>
                {error}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
              <Pressable
                onPress={() => setModalOpen(false)}
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
                onPress={save}
                disabled={busy || !name.trim()}
                style={{
                  flex: 1,
                  borderRadius: radius.button,
                  backgroundColor: colors.spark,
                  paddingVertical: 13,
                  alignItems: "center",
                  opacity: busy || !name.trim() ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.onSpark} />
                ) : (
                  <Text style={{ color: colors.onSpark, fontWeight: "700" }}>
                    {editing ? "Save" : "Create"}
                  </Text>
                )}
              </Pressable>
            </View>
            {editing && (
              <Pressable
                onPress={confirmDelete}
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
                  Delete collection
                </Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
