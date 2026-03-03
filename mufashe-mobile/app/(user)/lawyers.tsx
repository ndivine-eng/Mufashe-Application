// app/(user)/lawyers.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Missing token");
  }

  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

type LawyerItem = {
  _id: string;
  name: string;
  specialization?: string;
  location?: string;
  bio?: string;
  lawyerStatus?: "AVAILABLE" | "BUSY" | "OFFLINE";
  feeMin?: number;
  feeMax?: number;
  feeNegotiable?: boolean;
  feeNote?: string;
};

const fmtMoney = (n?: number) => Number(n || 0).toLocaleString();

export default function Lawyers() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [q, setQ] = useState("");
  const [items, setItems] = useState<LawyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const res = await apiGet(`/lawyers?q=${encodeURIComponent(q.trim())}`);
      setItems(res?.items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load lawyers");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

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

  // ✅ Open the Lawyer profile screen (from (lawyer)/profile)
  const openLawyerProfile = useCallback((lawyerId: string) => {
    router.push({
      pathname: "/(lawyer)/profile",
      params: { lawyerId }, // profile.tsx should read this param
    });
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Lawyers</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={theme.textSub} style={{ marginRight: 8 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name, specialization, location"
          placeholderTextColor={theme.textSub}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={load}
        />
        <TouchableOpacity onPress={load} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading lawyers...</Text>
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <Text style={[styles.muted, { color: theme.danger }]}>{err}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={20} color={theme.textSub} />
              <Text style={styles.muted}>No lawyers available yet.</Text>
              <Text style={[styles.muted, { fontWeight: "700" }]}>
                Check again later or try a different search.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = item.lawyerStatus || "OFFLINE";

            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {(item.specialization || "General") + (item.location ? ` • ${item.location}` : "")}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{status}</Text>
                      </View>

                      <View style={styles.chip}>
                        <Text style={styles.chipText}>
                          Fee: RWF {fmtMoney(item.feeMin)} - {fmtMoney(item.feeMax)}
                        </Text>
                      </View>

                      {item.feeNegotiable ? (
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>NEGOTIABLE</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* keep quick booking button */}
                  <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() =>
                      router.push({ pathname: "/(user)/book-appointment", params: { lawyerId: item._id } })
                    }
                    activeOpacity={0.9}
                  >
                    <Text style={styles.bookBtnText}>Book now</Text>
                  </TouchableOpacity>
                </View>

                {item.bio ? <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text> : null}
                {item.feeNote ? <Text style={styles.note} numberOfLines={2}>Fee note: {item.feeNote}</Text> : null}

                {/* ✅ “Review full profile” opens (lawyer)/profile */}
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => openLawyerProfile(item._id)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.reviewBtnText}>Review full profile →</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
    muted: { color: theme.textSub, fontWeight: "800", textAlign: "center" },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
    title: { fontSize: 16 * s, fontWeight: "900", color: theme.text },
    iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" },

    searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.card, gap: 10 },
    searchInput: { flex: 1, fontSize: 13 * s, color: theme.text, fontWeight: "700" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#0F3D63", alignItems: "center", justifyContent: "center" },

    name: { color: theme.text, fontWeight: "900", fontSize: 14 * s },
    meta: { color: theme.textSub, fontWeight: "800", marginTop: 2 },
    bio: { marginTop: 10, color: theme.textSub, fontWeight: "700" },
    note: { marginTop: 6, color: theme.textSub, fontWeight: "800" },

    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.muted },
    chipText: { fontSize: 10 * s, fontWeight: "900", color: theme.text },

    bookBtn: { backgroundColor: theme.blue, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
    bookBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 * s },

    // ✅ review button
    reviewBtn: { marginTop: 12, alignSelf: "flex-start" },
    reviewBtnText: { color: theme.blue, fontWeight: "900", fontSize: 13 * s },
  };
}