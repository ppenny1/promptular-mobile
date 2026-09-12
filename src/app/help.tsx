// In-app Help: fetched live from GET /api/help on open, per the standard.
// Help copy lives in the web repo (src/lib/helpContent.ts) and deploys with
// the website, so it updates here instantly with no app build or review.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useColors } from "@/lib/theme";
import { api } from "@/lib/api";

interface HelpSection {
  title: string;
  items: { q: string; a: string }[];
}

interface HelpFooter {
  title: string;
  body: string;
}

// Fallback if the API response predates the footer field.
const DEFAULT_FOOTER: HelpFooter = {
  title: "Still stuck or have an idea?",
  body: "Tell us what's broken or what you wish Promptular could do. Feature requests shape what we build next, and a human answers every email.",
};

export default function HelpScreen() {
  const colors = useColors();
  const router = useRouter();
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [footer, setFooter] = useState<HelpFooter>(DEFAULT_FOOTER);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ sections: HelpSection[]; footer?: HelpFooter }>("/api/help", {
        auth: false,
      });
      setSections(res.sections);
      if (res.footer?.title && res.footer?.body) setFooter(res.footer);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
          Help
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
      {state === "error" && (
        <Text style={{ color: colors.danger, padding: spacing(5), fontSize: 15 }}>
          Couldn&apos;t load help. Check your connection and reopen this screen.
        </Text>
      )}

      {state === "ready" && (
        <ScrollView
          contentContainerStyle={{ padding: spacing(5), paddingTop: 0, paddingBottom: spacing(10) }}
        >
          {sections.map((section) => (
            <View key={section.title} style={{ marginTop: spacing(5) }}>
              <Text
                style={{
                  color: colors.violet,
                  fontWeight: "800",
                  fontSize: 12,
                  letterSpacing: 1,
                }}
              >
                {section.title.toUpperCase()}
              </Text>
              <View
                style={{
                  marginTop: spacing(2),
                  borderRadius: radius.card,
                  backgroundColor: colors.panel,
                  paddingHorizontal: spacing(4),
                }}
              >
                {section.items.map((item, i) => {
                  const key = `${section.title}-${i}`;
                  const open = openKey === key;
                  return (
                    <View key={key}>
                      {i > 0 && (
                        <View style={{ height: 1, backgroundColor: colors.panelEdge }} />
                      )}
                      <Pressable
                        onPress={() => setOpenKey(open ? null : key)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing(3),
                          paddingVertical: 14,
                          minHeight: 44,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.lumen,
                            fontSize: 15,
                            fontWeight: "600",
                            flex: 1,
                          }}
                        >
                          {item.q}
                        </Text>
                        <Ionicons
                          name={open ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.lumenDim}
                        />
                      </Pressable>
                      {open && (
                        <Text
                          style={{
                            color: colors.lumenDim,
                            fontSize: 14,
                            lineHeight: 21,
                            paddingBottom: 14,
                          }}
                        >
                          {item.a}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          <View
            style={{
              marginTop: spacing(6),
              borderRadius: radius.card,
              backgroundColor: colors.panel,
              padding: spacing(4),
            }}
          >
            <Text style={{ color: colors.lumen, fontWeight: "700", fontSize: 15 }}>
              {footer.title}
            </Text>
            <Text style={{ color: colors.lumenDim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {footer.body}
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL("mailto:promptular@appsthathelp.com").catch(() => {})
              }
              style={{ marginTop: spacing(2), minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.violet, fontWeight: "700", fontSize: 14 }}>
                promptular@appsthathelp.com
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
