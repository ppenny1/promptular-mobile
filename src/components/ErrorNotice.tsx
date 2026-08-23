// Friendly error display with one-tap issue reporting. Raw technical
// errors never reach the user's eyes: friendlyError() translates them,
// and "Report this issue" posts the raw text to /api/report-issue, which
// emails the admin. "Contact support" opens an in-app form (no Mail app
// required) that sends the user's own words through the same pipeline.

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/lib/theme";
import { api } from "@/lib/api";

// Translate raw errors into plain language. Anything unrecognized gets a
// generic line; the raw text still travels with the report.
export function friendlyError(err: unknown): { message: string; raw: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("could not connect") ||
    lower.includes("network request failed") ||
    lower.includes("fetch failed") ||
    lower.includes("timed out") ||
    lower.includes("offline")
  ) {
    return {
      message: "Couldn't reach Promptular. Check your internet connection and try again.",
      raw,
    };
  }
  return { message: "Something went wrong on our end. Please try again.", raw };
}

function deviceMeta() {
  return {
    appVersion: Constants.expoConfig?.version || "unknown",
    platform: Platform.OS,
  };
}

export default function ErrorNotice({
  message,
  raw,
  screen,
  onDismiss,
}: {
  message: string;
  raw?: string;
  screen: string;
  onDismiss?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [formOpen, setFormOpen] = useState(false);
  const [note, setNote] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function report() {
    if (status !== "idle") return;
    setStatus("sending");
    try {
      await api("/api/report-issue", {
        method: "POST",
        body: { screen, message, raw: raw || "", ...deviceMeta() },
      });
      setStatus("sent");
    } catch {
      setStatus("idle");
      // Can't reach the server either; the form at least lets them keep
      // their words for a retry.
      setFormOpen(true);
    }
  }

  async function sendForm() {
    if (!note.trim() || formStatus === "sending") return;
    setFormStatus("sending");
    try {
      await api("/api/report-issue", {
        method: "POST",
        body: { screen, message, raw: raw || "", note: note.trim(), ...deviceMeta() },
      });
      setFormStatus("sent");
    } catch {
      setFormStatus("failed");
    }
  }

  return (
    <View
      style={{
        marginTop: spacing(4),
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.danger + "55",
        backgroundColor: colors.danger + "14",
        padding: spacing(4),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20, flex: 1 }}>
          {message}
        </Text>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={10}>
            <Ionicons name="close" size={18} color={colors.lumenDim} />
          </Pressable>
        )}
      </View>
      {raw ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(4), marginTop: spacing(2) }}>
          {status === "sent" ? (
            <Text style={{ color: colors.good, fontSize: 13, fontWeight: "700" }}>
              ✓ Reported. Thank you!
            </Text>
          ) : (
            <Pressable onPress={report} hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
              {status === "sending" ? (
                <ActivityIndicator size="small" color={colors.lumenDim} />
              ) : (
                <Text style={{ color: colors.lumen, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" }}>
                  Report this issue
                </Text>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              setFormStatus("idle");
              setFormOpen(true);
            }}
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors.lumenDim, fontSize: 13 }}>Contact support</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Contact support form */}
      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
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
              Contact support
            </Text>
            <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              Tell us what happened in your own words. The error details come
              along automatically, and a real person reads every message.
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="What were you trying to do?"
              placeholderTextColor={colors.lumenDim + "66"}
              style={{
                marginTop: spacing(3),
                minHeight: 100,
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
            {formStatus === "sent" && (
              <Text style={{ color: colors.good, marginTop: spacing(2), fontSize: 13 }}>
                Sent. Thank you, we&apos;re on it!
              </Text>
            )}
            {formStatus === "failed" && (
              <Text style={{ color: colors.danger, marginTop: spacing(2), fontSize: 13 }}>
                Couldn&apos;t send right now. Your message is kept here, try
                again in a moment or email promptular@appsthathelp.com.
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
              <Pressable
                onPress={() => setFormOpen(false)}
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
                  {formStatus === "sent" ? "Done" : "Cancel"}
                </Text>
              </Pressable>
              {formStatus !== "sent" && (
                <Pressable
                  onPress={sendForm}
                  disabled={formStatus === "sending" || !note.trim()}
                  style={{
                    flex: 1,
                    borderRadius: radius.button,
                    backgroundColor: colors.violet,
                    paddingVertical: 13,
                    alignItems: "center",
                    opacity: formStatus === "sending" || !note.trim() ? 0.6 : 1,
                    minHeight: 44,
                  }}
                >
                  {formStatus === "sending" ? (
                    <ActivityIndicator size="small" color={colors.lumen} />
                  ) : (
                    <Text style={{ color: colors.lumen, fontWeight: "700" }}>Send</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
