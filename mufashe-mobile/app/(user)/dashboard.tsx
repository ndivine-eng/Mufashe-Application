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
  RefreshControl,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../../components/BottomNav";

const categories = [
  { key: "family", title: "Family", icon: "people-outline", bg: "#E8F0FF" },
  { key: "land", title: "Land", icon: "map-outline", bg: "#E9FBEF" },
  { key: "labor", title: "Labor", icon: "briefcase-outline", bg: "#ECFDF3" },
  { key: "civil", title: "Business", icon: "shield-checkmark-outline", bg: "#EFF6FF" },
] as const;

type StoredUser = {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
  emailOrPhone?: string;
  role?: string;
};

type RecentQuestion = {
  _id: string;
  question: string;
  category?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
  updatedAt?: string;
};

// ✅ You keep /api in env (example: https://xxxx.ngrok-free.dev/api)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

// cache key
const RECENT_CACHE_KEY = "@mufashe_recent_questions_cache_v1";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function pickDisplayName(u: StoredUser | null) {
  if (!u) return "Guest";
  const directName = u.name?.trim() || u.fullName?.trim() || u.username?.trim();
  if (directName) return directName;
  if (u.email) return u.email.includes("@") ? u.email.split("@")[0] : u.email;
  if (u.emailOrPhone) return u.emailOrPhone.trim();
  if (u.phone) return u.phone;
  return "User";
}

function prettyMeta(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return "Today";

  const y = new Date(now.getTime() - oneDay);
  const isYesterday =
    d.getDate() === y.getDate() &&
    d.getMonth() === y.getMonth() &&
    d.getFullYear() === y.getFullYear();
  if (isYesterday) return "Yesterday";

  return d.toLocaleDateString();
}

function normStatus(s?: string) {
  return String(s || "PENDING").toUpperCase();
}

function statusChipStyle(status?: RecentQuestion["status"]) {
  const s = normStatus(status);
  if (s === "APPROVED") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#065F46" };
  if (s === "REJECTED") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  // PENDING default
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
}

function safeCategoryLabel(cat?: string | null) {
  const c = String(cat || "OTHER").toUpperCase();
  return c;
}

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");

  const url = joinUrl(BASE_URL, path);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  // ✅ If token expired, logout cleanly
  if (res.status === 401 || res.status === 403) {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    throw new Error("Session expired. Please login again.");
  }

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export default function Dashboard() {
  const [displayName, setDisplayName] = useState("...");

  const [loadingUser, setLoadingUser] = useState(true);

  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadCachedRecent = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.items)) {
        setRecent(parsed.items);
        if (parsed?.ts) setLastUpdated(new Date(parsed.ts).toLocaleString());
      }
    } catch {
      // ignore cache errors
    }
  }, []);

  const saveRecentCache = useCallback(async (items: RecentQuestion[]) => {
    try {
      const payload = { items, ts: Date.now() };
      await AsyncStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(payload));
      setLastUpdated(new Date(payload.ts).toLocaleString());
    } catch {
      // ignore cache write errors
    }
  }, []);

  const loadRecent = useCallback(
    async (showSpinner = true) => {
      try {
        setRecentError(null);
        if (showSpinner) setLoadingRecent(true);

        const res = await apiGet("/questions/recent?limit=5");
        const items: RecentQuestion[] = res?.items || [];

        setRecent(items);
        await saveRecentCache(items);
      } catch (e: any) {
        const msg = e?.message || "Failed to load recent questions";
        setRecentError(msg);

        // if session expired -> go login
        if (String(msg).toLowerCase().includes("login")) {
          router.replace("/(auth)/login");
          return;
        }
      } finally {
        if (showSpinner) setLoadingRecent(false);
      }
    },
    [saveRecentCache]
  );

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

      // ✅ show cached recent instantly (fast UX)
      await loadCachedRecent();

      // ✅ then fetch fresh
      await loadRecent(true);
    } catch {
      router.replace("/(auth)/login");
    } finally {
      setLoadingUser(false);
    }
  }, [loadCachedRecent, loadRecent]);

  useFocusEffect(
    useCallback(() => {
      loadAndProtect();
    }, [loadAndProtect])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRecent(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadRecent]);

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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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
              onPress={() => Alert.alert("Notifications", "Coming next (we’ll connect it).")}
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

        {/* Search */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/(user)/consult")} style={styles.searchWrap}>
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

        {/* Quick Actions (new, but small) */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(user)/consult")} activeOpacity={0.9}>
            <Ionicons name="help-circle-outline" size={16} color="#0F3D63" />
            <Text style={styles.quickText}>Ask</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(user)/history")} activeOpacity={0.9}>
            <Ionicons name="time-outline" size={16} color="#0F3D63" />
            <Text style={styles.quickText}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(user)/library")} activeOpacity={0.9}>
            <Ionicons name="library-outline" size={16} color="#0F3D63" />
            <Text style={styles.quickText}>Library</Text>
          </TouchableOpacity>
        </View>

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

        {/* Recent */}
        <View style={[styles.sectionRow, { marginTop: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {lastUpdated ? <Text style={styles.mutedTiny}>• {lastUpdated}</Text> : null}
          </View>

          <TouchableOpacity onPress={() => loadRecent(true)} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={18} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {recentError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Could not load recent</Text>
              <Text style={styles.errorText}>{recentError}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadRecent(true)} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.recentList}>
          {loadingRecent ? (
            <View style={[styles.recentItem, { justifyContent: "center" }]}>
              <ActivityIndicator />
              <Text style={{ marginLeft: 10, color: "#6B7280", fontWeight: "800" }}>Loading recent…</Text>
            </View>
          ) : recent.length === 0 ? (
            <View style={[styles.recentItem, { justifyContent: "center" }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7280" />
              <Text style={{ marginLeft: 10, color: "#6B7280", fontWeight: "800" }}>
                No recent questions yet
              </Text>
            </View>
          ) : (
            recent.map((r) => {
              const chip = statusChipStyle(r.status);
              return (
                <TouchableOpacity
                  key={r._id}
                  style={styles.recentItem}
                  activeOpacity={0.9}
                  onPress={() => router.push("/(user)/history")}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#111827" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {r.question}
                    </Text>

                    {/* category + status chips */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <View style={styles.catChip}>
                        <Text style={styles.catChipText}>{safeCategoryLabel(r.category)}</Text>
                      </View>

                      <View style={[styles.statusChip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
                        <Text style={[styles.statusChipText, { color: chip.text }]}>{normStatus(r.status)}</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.recentMeta}>{prettyMeta(r.updatedAt || r.createdAt)}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Emergency */}
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
            onPress={() => Alert.alert("Call", "Add the real Legal Aid phone number here when you’re ready.")}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  center: { alignItems: "center", justifyContent: "center" },

  loadingText: { marginTop: 10, color: "#6B7280", fontWeight: "800" },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
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
    marginBottom: 12,
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

  quickRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
  },
  quickText: { fontWeight: "900", color: "#111827", fontSize: 12 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  mutedTiny: { fontSize: 10, color: "#9CA3AF", fontWeight: "800" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
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

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 10,
  },
  errorTitle: { color: "#7F1D1D", fontWeight: "900" },
  errorText: { color: "#7F1D1D", fontWeight: "700", marginTop: 2 },
  retryBtn: {
    backgroundColor: "#B91C1C",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 12 },

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

  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  catChipText: { fontSize: 10, fontWeight: "900", color: "#374151" },

  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: "900" },

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