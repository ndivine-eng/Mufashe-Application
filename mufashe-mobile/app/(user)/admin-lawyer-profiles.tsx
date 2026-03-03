// app/(user)/admin-lawyer-profiles.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

type StoredUser = {
  role?: string;
};

type LawyerProfileRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  lawyerStatus?: string;

  specialization?: string;
  location?: string;
  officeAddress?: string;
  bio?: string;

  yearsExperience?: number;
  licenseNumber?: string;
  languages?: string[];

  feeMin?: number;
  feeMax?: number;
  feeNegotiable?: boolean;
  feeNote?: string;

  profileReviewStatus?: "PENDING" | "APPROVED" | "REJECTED";
  profileReviewNote?: string;
  profileUpdatedAt?: string;
};

async function apiRequest(method: "GET" | "PATCH", path: string, body?: any) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");

  const url = joinUrl(BASE_URL, path);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "PATCH" ? { body: JSON.stringify(body || {}) } : {}),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (res.status === 401 || res.status === 403) {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

function fmtMoney(n?: number) {
  return Number(n || 0).toLocaleString();
}

function chipStyle(status: string) {
  const s = String(status || "PENDING").toUpperCase();
  if (s === "APPROVED") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#065F46" };
  if (s === "REJECTED") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
}

export default function AdminLawyerProfiles() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusTab, setStatusTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LawyerProfileRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const protectAndLoad = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const rawUser = await AsyncStorage.getItem("user");
      const user: StoredUser | null = rawUser ? JSON.parse(rawUser) : null;
      if (String(user?.role || "").toLowerCase() !== "admin") {
        router.replace("/(user)/dashboard");
        return;
      }

      const res = await apiRequest("GET", `/admin/lawyer-profiles?status=${statusTab}`);
      const list: LawyerProfileRow[] = res?.items || [];

      const needle = q.trim().toLowerCase();
      const filtered = !needle
        ? list
        : list.filter((x) => {
            const hay = `${x.name || ""} ${x.email || ""} ${x.specialization || ""} ${x.location || ""}`.toLowerCase();
            return hay.includes(needle);
          });

      setItems(filtered);

      // preload existing review note
      const initNotes: Record<string, string> = {};
      for (const it of list) {
        if (it._id && it.profileReviewNote) initNotes[it._id] = it.profileReviewNote;
      }
      setNotes((prev) => ({ ...initNotes, ...prev }));
    } catch (e: any) {
      setErr(e?.message || "Failed to load lawyer profiles");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusTab, q]);

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

  const setReview = useCallback(
    async (id: string, nextStatus: "APPROVED" | "REJECTED") => {
      const note = (notes[id] || "").trim();

      Alert.alert(
        nextStatus === "APPROVED" ? "Approve profile" : "Reject profile",
        nextStatus === "APPROVED"
          ? "Make this lawyer profile visible to users?"
          : "Reject this profile? (You can include a note.)",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: nextStatus === "APPROVED" ? "Approve" : "Reject",
            style: nextStatus === "REJECTED" ? "destructive" : "default",
            onPress: async () => {
              try {
                setBusy((p) => ({ ...p, [id]: true }));
                await apiRequest("PATCH", `/admin/lawyer-profiles/${id}`, { status: nextStatus, note });
                Alert.alert("Updated ✅", `Profile is now ${nextStatus}.`);
                await protectAndLoad();
              } catch (e: any) {
                Alert.alert("Error", e?.message || "Failed to update profile");
              } finally {
                setBusy((p) => ({ ...p, [id]: false }));
              }
            },
          },
        ]
      );
    },
    [notes, protectAndLoad]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const tabs = useMemo(
    () => [
      { key: "PENDING" as const, label: "Pending" },
      { key: "APPROVED" as const, label: "Approved" },
      { key: "REJECTED" as const, label: "Rejected" },
    ],
    []
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading lawyer profiles…</Text>
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
        {/* top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={18} color="#111827" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Lawyer Profile Review</Text>
            <Text style={styles.subTitle}>Approve profiles so users can see and book</Text>
          </View>

          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* tabs */}
        <View style={styles.tabRow}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, statusTab === t.key && styles.tabActive]}
              onPress={() => setStatusTab(t.key)}
              activeOpacity={0.9}
            >
              <Text style={[styles.tabText, statusTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search name, email, specialization, location"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={protectAndLoad}
          />
          <TouchableOpacity onPress={protectAndLoad} style={styles.smallBtn} activeOpacity={0.9}>
            <Text style={styles.smallBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {err ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        {/* list */}
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={20} color="#6B7280" />
            <Text style={styles.emptyTitle}>No profiles found</Text>
            <Text style={styles.emptyText}>If a lawyer saved their profile, it will appear under “Pending”.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((it) => {
              const id = it._id;
              const isBusy = !!busy[id];
              const isExpanded = !!expanded[id];
              const chip = chipStyle(it.profileReviewStatus || "PENDING");

              return (
                <View key={id} style={styles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={18} color="#fff" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {it.name || "Lawyer"}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {it.email || "—"} {it.location ? `• ${it.location}` : ""}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {(it.specialization || "—").toUpperCase()} • STATUS: {String(it.lawyerStatus || "OFFLINE")}
                      </Text>

                      <View style={[styles.reviewChip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
                        <Text style={[styles.reviewChipText, { color: chip.text }]}>{String(it.profileReviewStatus || "PENDING")}</Text>
                      </View>
                    </View>

                    <TouchableOpacity onPress={() => toggleExpand(id)} style={styles.iconBtn} activeOpacity={0.85}>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#111827" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.feeLine}>
                    Fee: RWF {fmtMoney(it.feeMin)} - {fmtMoney(it.feeMax)} {it.feeNegotiable ? "• NEGOTIABLE" : ""}
                  </Text>
                  {it.feeNote ? <Text style={styles.note}>Fee note: {it.feeNote}</Text> : null}

                  {isExpanded ? (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      {it.officeAddress ? <Text style={styles.block}>Office: {it.officeAddress}</Text> : null}
                      {typeof it.yearsExperience === "number" ? (
                        <Text style={styles.block}>Experience: {it.yearsExperience} years</Text>
                      ) : null}
                      {it.languages?.length ? <Text style={styles.block}>Languages: {it.languages.join(", ")}</Text> : null}
                      {it.bio ? <Text style={styles.bio}>{it.bio}</Text> : <Text style={styles.bio}>No bio.</Text>}
                      {it.licenseNumber ? <Text style={styles.block}>License: {it.licenseNumber}</Text> : null}
                    </View>
                  ) : null}

                  <Text style={styles.label}>Admin note (optional)</Text>
                  <TextInput
                    value={notes[id] ?? ""}
                    onChangeText={(v) => setNotes((p) => ({ ...p, [id]: v }))}
                    placeholder="Write a reason (especially if rejecting)"
                    placeholderTextColor="#6B7280"
                    style={styles.noteInput}
                    multiline
                  />

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.approveBtn, isBusy && { opacity: 0.7 }]}
                      onPress={() => setReview(id, "APPROVED")}
                      disabled={isBusy}
                      activeOpacity={0.9}
                    >
                      {isBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Approve</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.rejectBtn, isBusy && { opacity: 0.7 }]}
                      onPress={() => setReview(id, "REJECTED")}
                      disabled={isBusy}
                      activeOpacity={0.9}
                    >
                      {isBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reject</Text>}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.smallMeta}>
                    {it.profileUpdatedAt ? `Updated: ${new Date(it.profileUpdatedAt).toLocaleString()}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  container: { padding: 16, paddingTop: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  muted: { color: "#6B7280", fontWeight: "800" },

  topBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "900", color: "#111827" },
  subTitle: { marginTop: 2, fontSize: 12, color: "#6B7280", fontWeight: "700" },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  tabRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#0F3D63", borderColor: "#0F3D63" },
  tabText: { fontWeight: "900", color: "#111827" },
  tabTextActive: { color: "#fff" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: "#111827", fontWeight: "700" },
  smallBtn: { backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  smallBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },
  errorText: { flex: 1, color: "#7F1D1D", fontWeight: "800" },

  emptyCard: {
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  emptyTitle: { fontWeight: "900", color: "#111827" },
  emptyText: { color: "#6B7280", fontWeight: "700", textAlign: "center" },

  card: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 12, backgroundColor: "#fff" },
  avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#0F3D63", alignItems: "center", justifyContent: "center" },

  name: { fontWeight: "900", color: "#111827" },
  meta: { marginTop: 2, color: "#6B7280", fontWeight: "800" },

  reviewChip: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  reviewChipText: { fontWeight: "900", fontSize: 11 },

  feeLine: { marginTop: 10, color: "#111827", fontWeight: "800" },
  note: { marginTop: 6, color: "#6B7280", fontWeight: "800" },

  block: { color: "#111827", fontWeight: "800" },
  bio: { color: "#6B7280", fontWeight: "700", marginTop: 2 },

  label: { marginTop: 12, color: "#6B7280", fontWeight: "900", fontSize: 11 },
  noteInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff",
    color: "#111827",
    fontWeight: "700",
    minHeight: 44,
  },

  approveBtn: { flex: 1, backgroundColor: "#16A34A", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  rejectBtn: { flex: 1, backgroundColor: "#DC2626", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900" },

  smallMeta: { marginTop: 10, color: "#6B7280", fontWeight: "800", fontSize: 11 },
});