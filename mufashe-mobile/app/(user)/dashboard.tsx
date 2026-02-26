import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../../components/BottomNav";

/* =========================
   DATA (clean + icon-first)
========================= */

const categories = [
  { key: "family", title: "Family", icon: "people-outline", bg: "#E8F0FF" },
  { key: "land", title: "Land", icon: "map-outline", bg: "#E9FBEF" },
  { key: "labor", title: "Labor", icon: "briefcase-outline", bg: "#ECFDF3" },
  { key: "civil", title: "Business", icon: "shield-checkmark-outline", bg: "#EFF6FF" },
];

// Sample (replace with backend later)
const recent = [
  { id: "1", title: "Land transfer", meta: "Yesterday" },
  { id: "2", title: "Contract end", meta: "Oct 24" },
];

/* =========================
   USER TYPE
========================= */
type StoredUser = {
  id?: string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
  emailOrPhone?: string;
};

function pickDisplayName(u: StoredUser | null) {
  if (!u) return "Guest";
  const directName = u.name?.trim() || u.fullName?.trim() || u.username?.trim();
  if (directName) return directName;
  if (u.email) return u.email.includes("@") ? u.email.split("@")[0] : u.email;
  if (u.emailOrPhone) return u.emailOrPhone.trim();
  if (u.phone) return u.phone;
  return "User";
}

export default function Dashboard() {
  const [displayName, setDisplayName] = useState("...");
  const [loadingUser, setLoadingUser] = useState(true);

  const loadAndProtect = useCallback(async () => {
    try {
      setLoadingUser(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const rawUser = await AsyncStorage.getItem("user");
      const user: StoredUser | null = rawUser ? JSON.parse(rawUser) : null;

      if (!user) {
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
        return;
      }

      setDisplayName(pickDisplayName(user));
    } catch {
      router.replace("/(auth)/login");
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAndProtect();
    }, [loadAndProtect])
  );

  if (loadingUser) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.appIconBox}>
              <Image
                source={require("../../assets/images/splash-icon.png")}
                style={styles.appIcon}
                resizeMode="contain"
              />
            </View>

            <View>
              <Text style={styles.userName}>Hi, {displayName}</Text>
              <Text style={styles.subText}>Ask • Learn • Get help</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => alert("Notifications (later)")}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications-outline" size={18} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/(user)/profile")}
              activeOpacity={0.85}
            >
              <Ionicons name="person-outline" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search (compact) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/(user)/consult")}
          style={styles.searchWrap}
        >
          <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ask a legal question…"
            placeholderTextColor="#9CA3AF"
            editable={false}
          />
          <View style={styles.micBtn}>
            <Ionicons name="mic-outline" size={18} color="#2563EB" />
          </View>
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => router.push("/(user)/library")} activeOpacity={0.8}>
            <Ionicons name="chevron-forward" size={18} color="#2563EB" />
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catCard, { backgroundColor: c.bg }]}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/(user)/library",
                  params: { category: c.key },
                })
              }
            >
              <View style={styles.catIconBox}>
                <Ionicons name={c.icon as any} size={20} color="#111827" />
              </View>
              <Text style={styles.catTitle}>{c.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent (minimal rows) */}
        <View style={[styles.sectionRow, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => router.push("/(user)/history")} activeOpacity={0.8}>
            <Ionicons name="time-outline" size={18} color="#2563EB" />
          </TouchableOpacity>
        </View>

        <View style={styles.recentList}>
          {recent.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.recentItem}
              activeOpacity={0.9}
              onPress={() => router.push("/(user)/history")}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#111827" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.recentTitle}>{r.title}</Text>
              </View>
              <Text style={styles.recentMeta}>{r.meta}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency (clean card) */}
        <View style={styles.helpCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={styles.helpIcon}>
              <Ionicons name="alert-circle" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.helpTitle}>Urgent help</Text>
              <Text style={styles.helpText}>National Legal Aid</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => alert("Call (later: Linking to phone)")}
            activeOpacity={0.9}
          >
            <Ionicons name="call-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

/* =========================
   STYLES (clean + spacing)
========================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  center: { alignItems: "center", justifyContent: "center" },

  loadingText: { marginTop: 10, color: "#6B7280", fontWeight: "800" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  appIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#0F3D63",
    alignItems: "center",
    justifyContent: "center",
  },
  appIcon: { width: 22, height: 22 },

  userName: { fontSize: 16, fontWeight: "900", color: "#111827" },
  subText: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    marginBottom: 18,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#111827" },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  catCard: {
    width: "48%",
    borderRadius: 18,
    padding: 12,
    minHeight: 94,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  catTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },

  recentList: { gap: 10 },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
  },
  recentTitle: { fontSize: 13, fontWeight: "800", color: "#111827" },
  recentMeta: { fontSize: 11, color: "#6B7280", marginRight: 8 },

  helpCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  helpIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  helpTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  helpText: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
});
