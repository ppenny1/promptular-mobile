// Admin broadcast banner, per the standard: polls GET /api/banner on mount
// and whenever the app returns to the foreground. The failsafe for
// messaging every user instantly without a store release (outages, notices,
// launch announcements). Set and cleared from the web admin dashboard.

import { useCallback, useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/lib/theme";
import { api } from "@/lib/api";

interface BannerData {
  text: string;
  severity: string; // info | warning | critical
}

const STYLES: Record<string, { bg: string; fg: string; icon: string }> = {
  info: { bg: colors.violet, fg: colors.lumen, icon: "information-circle" },
  warning: { bg: colors.spark, fg: colors.ink, icon: "warning" },
  critical: { bg: colors.danger, fg: colors.ink, icon: "alert-circle" },
};

export default function Banner() {
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<BannerData | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await api<{ banner: BannerData | null }>("/api/banner", {
        auth: false,
      });
      setBanner(res.banner && res.banner.text ? res.banner : null);
    } catch {
      // Network hiccup: keep whatever we last showed.
    }
  }, []);

  useEffect(() => {
    poll();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") poll();
    });
    return () => sub.remove();
  }, [poll]);

  if (!banner) {
    // No banner: still mask the status bar zone so scrolling content never
    // collides with the clock and battery. Solid ink, pinned on top.
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: colors.ink,
          zIndex: 10,
        }}
      />
    );
  }
  const style = STYLES[banner.severity] || STYLES.info;

  return (
    <View
      style={{
        backgroundColor: style.bg,
        paddingTop: insets.top,
        paddingHorizontal: spacing(4),
        paddingBottom: spacing(2),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingTop: spacing(2),
        }}
      >
        <Ionicons
          name={style.icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={style.fg}
        />
        <Text
          style={{
            color: style.fg,
            fontSize: 13,
            fontWeight: "700",
            flex: 1,
            lineHeight: 18,
          }}
        >
          {banner.text}
        </Text>
      </View>
    </View>
  );
}
