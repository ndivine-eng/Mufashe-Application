// This is the bottom navigation bar component for the app. It displays 5 tabs: Home, Ask, Library, Profile, and Settings.
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";

import { useAppSettings } from "../app/lib/appSettings";
import { useT } from "../app/lib/i18n";

type Tab = {
  key: "home" | "ask" | "library" | "profile" | "settings";
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  route: string;
};

const TABS: Tab[] = [
  {
    key: "home",
    icon: "home-outline",
    activeIcon: "home",
    route: "/(user)/dashboard",
  },
  {
    key: "ask",
    icon: "chatbubble-ellipses-outline",
    activeIcon: "chatbubble-ellipses",
    route: "/(user)/consult",
  },
  {
    key: "library",
    icon: "book-outline",
    activeIcon: "book",
    route: "/(user)/library",
  },
  {
    key: "profile",
    icon: "person-outline",
    activeIcon: "person",
    route: "/(user)/profile",
  },
  {
    key: "settings",
    icon: "settings-outline",
    activeIcon: "settings",
    route: "/(user)/settings",
  },
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
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 140;
}

export default function BottomNav() {
  const { theme, scale } = useAppSettings();
  const t = useT();

  const pathname = normalize(usePathname());
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const dark = isDarkHex(theme?.bg);

  const inactiveIconColor =
    theme?.navIcon ??
    theme?.textSub ??
    (dark ? "#CBD5E1" : "#7C7C8A");

  const activeIconColor =
    theme?.navActiveIcon ??
    "#FFFFFF";

  const activeColor =
    theme?.primary ??
    theme?.blue ??
    "#8B5CF6";

  const activeBgSoft =
    theme?.primarySoft ??
    "#F3E8FF";

  const labelFor = (key: Tab["key"]) => {
    if (key === "home") return "Home";
    if (key === "ask") return t("ask");
    if (key === "library") return t("library");
    if (key === "profile") return t("profile");
    if (key === "settings") return t("settings");
    return key;
  };

  return (
    <View style={styles.outerWrap}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const tabPath = normalize(tab.route);
          const isActive = pathname === tabPath || pathname.startsWith(tabPath + "/");

          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tab}
              activeOpacity={0.88}
              onPress={() => router.replace(tab.route)}
            >
              <View
                style={[
                  styles.tabInner,
                  isActive && styles.activeTabInner,
                  isActive && { backgroundColor: activeBgSoft },
                ]}
              >
                <View
                  style={[
                    styles.iconWrapper,
                    isActive && styles.activeIconWrapper,
                    isActive && { backgroundColor: activeColor },
                  ]}
                >
                  <Ionicons
                    name={isActive ? (tab.activeIcon || tab.icon) : tab.icon}
                    size={isActive ? 22 : 21}
                    color={isActive ? activeIconColor : inactiveIconColor}
                  />
                </View>

                <Text
                  style={[
                    styles.label,
                    { color: isActive ? activeColor : inactiveIconColor },
                    isActive && styles.activeLabel,
                  ]}
                  numberOfLines={1}
                >
                  {labelFor(tab.key)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  const border = theme?.border ?? "#E9E7F0";
  const bg = theme?.card ?? "#FFFFFF";
  const navBg = theme?.card ?? theme?.bg ?? "#FFFFFF";

  return {
    outerWrap: {
      paddingHorizontal: 14,
      paddingBottom: Platform.OS === "ios" ? 18 : 10,
      paddingTop: 6,
      backgroundColor: "transparent",
    },

    container: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: navBg,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 28,
      paddingHorizontal: 8,
      paddingVertical: 8,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },

    tab: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    tabInner: {
      minWidth: 58,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 6,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    activeTabInner: {
      paddingHorizontal: 10,
    },

    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: "transparent",
    },

    activeIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },

    label: {
      fontSize: 11.5 * s,
      fontWeight: "700" as const,
      marginTop: 4,
    },

    activeLabel: {
      fontWeight: "900" as const,
    },
  };
}