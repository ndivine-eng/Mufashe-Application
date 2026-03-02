import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";

import { useAppSettings } from "../app/lib/appSettings";
import { useT } from "../app/lib/i18n";

type Tab = {
  key: "home" | "ask" | "library" | "profile" | "settings";
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const TABS: Tab[] = [
  { key: "home", icon: "home-outline", route: "/(user)/dashboard" },
  { key: "ask", icon: "chatbubble-ellipses-outline", route: "/(user)/consult" },
  { key: "library", icon: "book-outline", route: "/(user)/library" },
  { key: "profile", icon: "person-outline", route: "/(user)/profile" },
  { key: "settings", icon: "settings-outline", route: "/(user)/settings" },
];

function normalize(path: string) {
  return path.replace("/(user)", "").replace(/\/+$/, "") || "/";
}

function isDarkHex(hex?: string) {
  if (!hex || typeof hex !== "string") return false;
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // relative luminance (simple)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 140;
}

export default function BottomNav() {
  const { theme, scale } = useAppSettings();
  const t = useT();

  const pathname = normalize(usePathname());
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const dark = isDarkHex(theme?.bg);

  // ✅ Hard fallbacks so icons NEVER become black by default
  const inactiveIconColor =
    theme?.navIcon ??
    theme?.textSub ??
    (dark ? "#CBD5E1" : "#6B7280");

  const activeIconColor =
    theme?.navActiveIcon ??
    "#FFFFFF";

  const labelFor = (key: Tab["key"]) => {
    if (key === "home") return "Home";
    if (key === "ask") return t("ask");
    if (key === "library") return t("library");
    if (key === "profile") return t("profile");
    if (key === "settings") return t("settings");
    return key;
  };

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const tabPath = normalize(tab.route);
        const isActive = pathname === tabPath || pathname.startsWith(tabPath + "/");

        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            activeOpacity={0.85}
            onPress={() => router.replace(tab.route)}
          >
            <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
              <Ionicons
                name={tab.icon}
                size={isActive ? 24 : 20}
                color={isActive ? activeIconColor : inactiveIconColor}
              />
            </View>

            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {labelFor(tab.key)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  const border = theme?.border ?? "#E5E7EB";
  const bg = theme?.card ?? theme?.bg ?? "#ffffff";
  const muted = theme?.muted ?? "#F3F4F6";
  const blue = theme?.blue ?? "#2563EB";
  const textSub = theme?.textSub ?? "#6B7280";
  const chevron = theme?.chevron ?? textSub;

  return {
    container: {
      borderTopWidth: 1,
      borderTopColor: border,
      backgroundColor: bg,
      paddingVertical: 10,
      paddingHorizontal: 8,
      flexDirection: "row" as const,
      justifyContent: "space-around" as const,
    },
    tab: { alignItems: "center" as const, justifyContent: "center" as const },

    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: "transparent",
    },
    activeIconWrapper: {
      backgroundColor: blue,
      width: 46,
      height: 46,
      borderRadius: 23,
    },

    label: {
      fontSize: 11 * s,
      fontWeight: "600" as const,
      color: chevron,
      marginTop: 4,
    },
    activeLabel: {
      color: blue,
      fontWeight: "800" as const,
    },
  };
}