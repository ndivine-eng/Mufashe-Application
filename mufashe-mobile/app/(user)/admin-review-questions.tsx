// app/(user)/admin-review-questions.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

type StoredUser = {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string | null;
  role?: string;
};

type QuestionRow = {
  _id: string;
  question: string;
  answer?: string;
  category?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
  updatedAt?: string;
  owner?: {
    fullName?: string;
    name?: string;
    username?: string;
    email?: string;
  };
};

//  You keep /api in env (example: https://xxxx.ngrok-free.dev/api)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function pickDisplayName(u: StoredUser | null) {
  if (!u) return "Admin";
  const direct = u.name?.trim() || u.fullName?.trim() || u.username?.trim();
  if (direct) return direct;
  if (u.email) return u.email.includes("@") ? u.email.split("@")[0] : u.email;
  return "Admin";
}

function pickOwnerName(o?: QuestionRow["owner"]) {
  if (!o) return "Unknown";
  return (
    o.fullName ||
    o.name ||
    o.username ||
    (o.email ? o.email.split("@")[0] : "Unknown")
  );
}

function normStatus(s?: string) {
  return String(s || "UNKNOWN").toUpperCase();
}

function badgeStyle(status: string) {
  const s = normStatus(status);
  if (s === "APPROVED") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#065F46" };
  if (s === "PENDING") return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
  if (s === "REJECTED") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" };
}

async function apiRequest(method: "GET" | "POST", path: string, body?: any) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");

  const url = joinUrl(BASE_URL, path);
  console.log(`${method} =>`, url);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body || {}) } : {}),
  });

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

export default function AdminReviewQuestions() {
  const [displayName, setDisplayName] = useState("...");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const protect = useCallback(async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      router.replace("/(auth)/login");
      return null;
    }

    const rawUser = await AsyncStorage.getItem("user");
    const user: StoredUser | null = rawUser ? JSON.parse(rawUser) : null;

    if (!user) {
      await AsyncStorage.removeItem("token");
      router.replace("/(auth)/login");
      return null;
    }

    if (String(user.role || "").toLowerCase() !== "admin") {
      router.replace("/(user)/dashboard");
      return null;
    }

    return user;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const user = await protect();
      if (!user) return;

      setDisplayName(pickDisplayName(user));

      const q = search.trim();
      const query = q ? `&q=${encodeURIComponent(q)}` : "";
      const res = await apiRequest("GET", `/questions?status=${status}${query}`);

      setItems(res?.items || []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load questions");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [protect, status, search]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const approve = useCallback(
    async (id: string) => {
      try {
        setBusyIds((p) => ({ ...p, [id]: true }));
        await apiRequest("POST", `/questions/${id}/approve`);
        await load();
      } catch (e: any) {
        Alert.alert("Approve failed ❌", e?.message || "Failed");
      } finally {
        setBusyIds((p) => ({ ...p, [id]: false }));
      }
    },
    [load]
  );

  const reject = useCallback(
    async (id: string) => {
      Alert.alert("Reject question?", "This will mark it as REJECTED.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyIds((p) => ({ ...p, [id]: true }));
              await apiRequest("POST", `/questions/${id}/reject`, { reviewNote: "" });
              await load();
            } catch (e: any) {
              Alert.alert("Reject failed ❌", e?.message || "Failed");
            } finally {
              setBusyIds((p) => ({ ...p, [id]: false }));
            }
          },
        },
      ]);
    },
    [load]
  );

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === "PENDING").length;
    const approved = items.filter((i) => i.status === "APPROVED").length;
    const rejected = items.filter((i) => i.status === "REJECTED").length;
    return { pending, approved, rejected };
  }, [items]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading review questions…</Text>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={18} color="#111827" />
            </TouchableOpacity>

            <View>
              <Text style={styles.userName}>Review questions</Text>
              <Text style={styles.subText}>Hi, {displayName} • Moderation center</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>
              {errorMsg}
              {"\n"}BASE_URL: {BASE_URL}
              {"\n"}Endpoint: {joinUrl(BASE_URL, `/questions?status=${status}`)}
            </Text>
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.tab, status === s && styles.tabActive]}
              onPress={() => setStatus(s)}
              activeOpacity={0.9}
            >
              <Text style={[styles.tabText, status === s && styles.tabTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search question text…"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={load}
          />
          <TouchableOpacity onPress={load} style={styles.searchBtn} activeOpacity={0.9}>
            <Text style={styles.searchBtnText}>Go</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metaBar}>
          <Text style={styles.metaText}>
            Showing: {status} • {items.length} item(s)
          </Text>
          <Text style={styles.metaText}>
            P:{counts.pending} • A:{counts.approved} • R:{counts.rejected}
          </Text>
        </View>

        {/* List */}
        <View style={{ gap: 10 }}>
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={18} color="#6B7280" />
              <Text style={styles.emptyTitle}>No questions found</Text>
              <Text style={styles.emptyText}>Try another tab or search keyword.</Text>
            </View>
          ) : (
            items.map((q) => {
              const badge = badgeStyle(q.status);
              const busy = !!busyIds[q._id];

              return (
                <View key={q._id} style={styles.card}>
                  <View style={styles.rowTop}>
                    <Ionicons name="help-circle-outline" size={18} color="#111827" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.qText} numberOfLines={2}>
                        {q.question}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {(q.category || "OTHER").toUpperCase()} • by {pickOwnerName(q.owner)}
                      </Text>
                    </View>

                    <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{q.status}</Text>
                    </View>
                  </View>

                  {/* Optional answer preview */}
                  {q.answer ? (
                    <View style={styles.answerBox}>
                      <Text style={styles.answerLabel}>Answer (preview)</Text>
                      <Text style={styles.answerText} numberOfLines={3}>
                        {q.answer}
                      </Text>
                    </View>
                  ) : null}

                  {q.status === "PENDING" ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnApprove, busy && { opacity: 0.7 }]}
                        disabled={busy}
                        onPress={() => approve(q._id)}
                        activeOpacity={0.9}
                      >
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Approve</Text>}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btn, styles.btnReject, busy && { opacity: 0.7 }]}
                        disabled={busy}
                        onPress={() => reject(q._id)}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.btnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  center: { alignItems: "center", justifyContent: "center" },

  loadingText: { marginTop: 10, color: "#6B7280", fontWeight: "800" },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  userName: { fontSize: 16, fontWeight: "900", color: "#111827" },
  subText: { fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: "800" },

  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },
  errorText: { color: "#7F1D1D", fontWeight: "800", flex: 1 },

  tabs: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: "#0F3D63", borderColor: "#0F3D63" },
  tabText: { fontWeight: "900", color: "#111827", fontSize: 12 },
  tabTextActive: { color: "#fff" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#111827" },
  searchBtn: {
    marginLeft: 8,
    backgroundColor: "#0F3D63",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  searchBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  metaBar: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: { color: "#6B7280", fontWeight: "800", fontSize: 12 },

  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    gap: 10,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start" },
  qText: { fontSize: 13, fontWeight: "900", color: "#111827" },
  rowMeta: { marginTop: 3, fontSize: 11, color: "#6B7280", fontWeight: "800" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginLeft: 10 },
  badgeText: { fontSize: 10, fontWeight: "900" },

  answerBox: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 10, backgroundColor: "#F9FAFB" },
  answerLabel: { fontSize: 11, color: "#6B7280", fontWeight: "900", marginBottom: 4 },
  answerText: { fontSize: 12, color: "#111827", fontWeight: "700" },

  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center" },
  btnApprove: { backgroundColor: "#059669" },
  btnReject: { backgroundColor: "#EF4444" },
  btnText: { color: "#fff", fontWeight: "900" },

  emptyCard: {
    marginTop: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    padding: 14,
    gap: 6,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "900", color: "#111827" },
  emptyText: { color: "#6B7280", fontWeight: "700", textAlign: "center" },
});