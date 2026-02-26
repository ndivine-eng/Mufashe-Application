// app/(user)/admin-dashboard.tsx

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

type Doc = {
  _id?: string;
  title?: string;
  category?: string;
  docType?: string;
  status?: string;
  createdAt?: string;
};

type UserRow = {
  _id?: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  createdAt?: string;
};

// ✅ You keep /api in env (example: https://xxxx.ngrok-free.dev/api)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

// Safe join to avoid double slashes
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

function normStatus(s?: string) {
  return String(s || "UNKNOWN").toUpperCase();
}

function badgeStyle(status: string) {
  const s = normStatus(status);
  if (s === "READY") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#065F46" };
  if (s === "PROCESSING") return { bg: "#EEF2FF", border: "#C7D2FE", text: "#1D4ED8" };
  if (s === "FAILED") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  if (s === "UPLOADED") return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
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

export default function AdminDashboard() {
  const [displayName, setDisplayName] = useState("...");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // per-document processing state
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const [processingAll, setProcessingAll] = useState(false);

  const stats = useMemo(() => {
    const totalDocs = docs.length;
    const ready = docs.filter((d) => normStatus(d.status) === "READY").length;
    const processing = docs.filter((d) => normStatus(d.status) === "PROCESSING").length;
    const failed = docs.filter((d) => normStatus(d.status) === "FAILED").length;
    const uploaded = docs.filter((d) => normStatus(d.status) === "UPLOADED").length;
    const totalUsers = users.length;
    return { totalDocs, ready, processing, failed, uploaded, totalUsers };
  }, [docs, users]);

  const protectAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

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

      if (String(user.role || "").toLowerCase() !== "admin") {
        router.replace("/(user)/dashboard");
        return;
      }

      setDisplayName(pickDisplayName(user));

      // ✅ your working endpoint: GET /api/documents
      // Since BASE_URL already contains /api, path becomes "/documents"
      const docsRes = await apiRequest("GET", "/documents");
      setDocs(docsRes?.items || []);

      // Optional: users if you have it
      try {
        const usersRes = await apiRequest("GET", "/users");
        setUsers(usersRes?.items || usersRes?.users || []);
      } catch {
        setUsers([]);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load admin data");
      setDocs([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      protectAndLoad();
    }, [protectAndLoad])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await protectAndLoad();
    } finally {
      setRefreshing(false);
    }
  }, [protectAndLoad]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    router.replace("/(auth)/login");
  }, []);

  // ✅ Process one doc: POST /api/documents/:id/process
  const processOne = useCallback(
    async (docId: string, title?: string) => {
      try {
        setProcessingIds((prev) => ({ ...prev, [docId]: true }));

        const res = await apiRequest("POST", `/documents/${docId}/process`);

        Alert.alert(
          "Processed ✅",
          `${title || "Document"} is now ${res?.document?.status || "READY"}`
        );

        await protectAndLoad();
      } catch (e: any) {
        Alert.alert("Processing failed ❌", e?.message || "Failed to process document");
      } finally {
        setProcessingIds((prev) => ({ ...prev, [docId]: false }));
      }
    },
    [protectAndLoad]
  );

  // ✅ Process all UPLOADED/FAILED docs (frontend loop)
  const processAll = useCallback(async () => {
    try {
      const candidates = docs.filter((d) => {
        const s = normStatus(d.status);
        return (s === "UPLOADED" || s === "FAILED") && !!d._id;
      });

      if (candidates.length === 0) {
        Alert.alert("Nothing to process", "No UPLOADED/FAILED documents found.");
        return;
      }

      Alert.alert(
        "Process All",
        `This will process ${candidates.length} document(s). Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes",
            style: "default",
            onPress: async () => {
              setProcessingAll(true);

              let ok = 0;
              let fail = 0;

              // sequential to avoid hammering server/OpenAI
              for (const d of candidates) {
                try {
                  const id = String(d._id);
                  setProcessingIds((prev) => ({ ...prev, [id]: true }));
                  await apiRequest("POST", `/documents/${id}/process`);
                  ok++;
                } catch {
                  fail++;
                } finally {
                  const id = String(d._id);
                  setProcessingIds((prev) => ({ ...prev, [id]: false }));
                }
              }

              setProcessingAll(false);
              await protectAndLoad();

              Alert.alert(
                "Process All complete ✅",
                `Success: ${ok}\nFailed: ${fail}`
              );
            },
          },
        ]
      );
    } catch (e: any) {
      setProcessingAll(false);
      Alert.alert("Process all failed ❌", e?.message || "Failed");
    }
  }, [docs, protectAndLoad]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading admin dashboard…</Text>
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.userName}>Hi, {displayName}</Text>
            <Text style={styles.subText}>MUFASHE • Admin Center</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={18} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={logout} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {errorMsg ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>
              {errorMsg}
              {"\n"}BASE_URL: {BASE_URL}
              {"\n"}Docs endpoint: {joinUrl(BASE_URL, "/documents")}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Admin tools</Text>

          <TouchableOpacity
            style={[styles.processAllBtn, processingAll && { opacity: 0.7 }]}
            disabled={processingAll}
            onPress={processAll}
            activeOpacity={0.9}
          >
            {processingAll ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cog-outline" size={16} color="#fff" />
                <Text style={styles.processAllText}>Process All</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#EEF2FF" }]}
            activeOpacity={0.9}
            onPress={() => router.push("/(user)/admin-upload")}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#1D4ED8" />
            <Text style={styles.actionTitle}>Upload documents</Text>
            <Text style={styles.actionMeta}>PDF → Extract → Index</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#ECFDF3" }]}
            activeOpacity={0.9}
            onPress={() => Alert.alert("Coming soon", "Review questions feature next.")}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#059669" />
            <Text style={styles.actionTitle}>Review questions</Text>
            <Text style={styles.actionMeta}>Moderation + quality</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionRow, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Overview</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalDocs}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.ready}</Text>
            <Text style={styles.statLabel}>READY</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.processing}</Text>
            <Text style={styles.statLabel}>PROCESSING</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.failed}</Text>
            <Text style={styles.statLabel}>FAILED</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.uploaded}</Text>
            <Text style={styles.statLabel}>UPLOADED</Text>
          </View>
        </View>

        <View style={[styles.sectionRow, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Latest documents</Text>
        </View>

        <View style={{ gap: 10 }}>
          {docs.slice(0, 10).map((d, idx) => {
            const key = d._id || String(idx);
            const status = normStatus(d.status);
            const badge = badgeStyle(status);
            const canProcess = (status === "UPLOADED" || status === "FAILED") && !!d._id;
            const isBusy = !!processingIds[String(d._id || "")];

            return (
              <View key={key} style={styles.rowCard}>
                <Ionicons name="document-text-outline" size={18} color="#111827" />

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.rowTitle}>{d.title || "Untitled"}</Text>
                  <Text style={styles.rowMeta}>
                    {(d.category || "OTHER").toUpperCase()} • {(d.docType || "DOC").toUpperCase()}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{status}</Text>
                </View>

                {canProcess ? (
                  <TouchableOpacity
                    style={[styles.processBtn, isBusy && { opacity: 0.7 }]}
                    disabled={isBusy}
                    onPress={() => processOne(String(d._id), d.title)}
                    activeOpacity={0.9}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.processBtnText}>Process</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          {docs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="folder-open-outline" size={18} color="#6B7280" />
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptyText}>Upload your first legal PDF to start indexing.</Text>

              <TouchableOpacity
                style={styles.primarySmall}
                onPress={() => router.push("/(user)/admin-upload")}
                activeOpacity={0.9}
              >
                <Text style={styles.primarySmallText}>Upload now</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  center: { alignItems: "center", justifyContent: "center" },

  loadingText: { marginTop: 10, color: "#6B7280", fontWeight: "800" },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  userName: { fontSize: 16, fontWeight: "900", color: "#111827" },
  subText: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  errorCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", marginBottom: 12 },
  errorText: { color: "#7F1D1D", fontWeight: "800", flex: 1 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },

  processAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F3D63",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  processAllText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  actionGrid: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  actionCard: { width: "48%", borderRadius: 18, padding: 12, minHeight: 104, borderWidth: 1, borderColor: "#E5E7EB", justifyContent: "center" },
  actionTitle: { marginTop: 10, fontSize: 13, fontWeight: "900", color: "#111827" },
  actionMeta: { marginTop: 4, fontSize: 11, color: "#6B7280", fontWeight: "800" },

  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  statValue: { fontSize: 18, fontWeight: "900", color: "#111827" },
  statLabel: { marginTop: 4, fontSize: 11, color: "#6B7280", fontWeight: "800" },

  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    gap: 10,
  },
  rowTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  rowMeta: { marginTop: 2, fontSize: 11, color: "#6B7280", fontWeight: "800" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "900" },

  processBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  processBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  emptyCard: { marginTop: 6, borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff", padding: 14, gap: 6 },
  emptyTitle: { fontWeight: "900", color: "#111827" },
  emptyText: { color: "#6B7280", fontWeight: "700" },

  primarySmall: { marginTop: 10, backgroundColor: "#0F3D63", paddingVertical: 10, borderRadius: 14, alignItems: "center" },
  primarySmallText: { color: "#fff", fontWeight: "900" },
});