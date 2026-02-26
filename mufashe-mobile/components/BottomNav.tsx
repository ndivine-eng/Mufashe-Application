import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";

type Tab = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string; 
};

const TABS: Tab[] = [
  { label: "Home", icon: "home-outline", route: "/(user)/dashboard" },
  { label: "Ask", icon: "chatbubble-ellipses-outline", route: "/(user)/consult" },
  { label: "Library", icon: "book-outline", route: "/(user)/library" },
  { label: "Profile", icon: "person-outline", route: "/(user)/profile" },
  { label: "Settings", icon: "settings-outline", route: "/(user)/settings" },
];

// Normalize path to ensure consistent matching (handles trailing slashes and nested routes)
function normalize(path: string) {
  return path.replace("/(user)", "").replace(/\/+$/, "") || "/";
}

export default function BottomNav() {
  const pathname = normalize(usePathname());

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const tabPath = normalize(tab.route);

        // Works for exact + nested routes
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
                color={isActive ? "#ffffff" : "#6B7280"}
              />
            </View>

            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  tab: { alignItems: "center", justifyContent: "center" },

  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrapper: {
    backgroundColor: "#2563EB",
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 4,
  },
  activeLabel: {
    color: "#2563EB",
    fontWeight: "800",
  },
});
