// app/(user)/history.tsx
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

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

// ✅ Works whether BASE_URL contains "/api" or not
function buildApiUrl(path: string) {
  const base = String(BASE_URL || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base.includes("/api") ? `${base}${p}` : `${base}/api${p}`;
}

type QuestionRow = {
  _id?: string;
  id?: string;
  question?: string;
  category?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function safeCategoryLabel(cat?: string | null) {
  return String(cat || "OTHER").toUpperCase();
}

function extractList(res: any): QuestionRow[] {
  // supports many backend shapes
  const candidates = [
    res?.items,
    res?.data,
    res?.questions,
    res?.results,
    res?.docs,
    res?.items?.items, // sometimes nested
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  // sometimes backend returns an object with "items" inside it
  if (res && typeof res === "object") {
    const vals = Object.values(res);
    for (const v of vals) {
      if (Array.isArray(v)) return v as any;
    }
  }

  return [];
}

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Missing token");
  }

  const res = await fetch(buildApiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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

export default function HistoryScreen() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [q, setQ] = useState("");
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ We try multiple endpoints; the first one that works will be used.
  // Put the one you KNOW works first.
  const ENDPOINTS = useMemo(
    () => [
      "/questions/recent?limit=200", // ✅ this works for you already in dashboard, just bigger limit
      "/questions/mine",
      "/questions/my",
      "/questions/me",
      "/questions?mine=true&limit=200",
      "/questions?limit=200",
    ],
    []
  );

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);

    let lastError: any = null;

    try {
      for (const ep of ENDPOINTS) {
        try {
          const res = await apiGet(ep);
          const list = extractList(res);

          // accept if it looks like questions
          if (Array.isArray(list) && list.length >= 0) {
            // If backend returns mixed data, keep only rows having "question"
            const cleaned = list.filter((x: any) => typeof x?.question === "string" && x.question.trim().length > 0);
            setItems(cleaned);
            setLoading(false);
            return;
          }
        } catch (e: any) {
          lastError = e;
        }
      }

      throw lastError || new Error("No endpoint returned questions.");
    } catch (e: any) {
      setErr(e?.message || "Failed to load history");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ENDPOINTS]);

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((x) => String(x.question || "").toLowerCase().includes(needle));
  }, [items, q]);

  const prettyDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity onPress={load} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={theme.textSub} style={{ marginRight: 8 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search your questions..."
          placeholderTextColor={theme.textSub}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {q.length > 0 ? (
          <TouchableOpacity onPress={() => setQ("")} style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading history...</Text>
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <Text style={[styles.muted, { color: theme.danger }]}>{err}</Text>
          <Text style={styles.mutedSmall}>
            Tip: your dashboard uses /questions/recent. This screen now tries that first.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => String(x._id || x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.textSub} />
              <Text style={styles.muted}>No questions found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const qid = String(item._id || item.id);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => router.push({ pathname: "/(user)/question-details", params: { id: qid } })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.text} />
                  <Text style={styles.qText} numberOfLines={2}>
                    {item.question}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{safeCategoryLabel(item.category)}</Text>
                  </View>
                  <Text style={styles.dateText}>{prettyDate(item.updatedAt || item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
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
    mutedSmall: { color: theme.textSub, fontWeight: "700", textAlign: "center", marginTop: 6 },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingBottom: 8,
    },
    title: { fontSize: 16 * s, fontWeight: "900", color: theme.text },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
    },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.card,
      gap: 10,
    },
    searchInput: { flex: 1, fontSize: 13 * s, color: theme.text, fontWeight: "700" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12 },
    qText: { flex: 1, marginLeft: 10, color: theme.text, fontWeight: "800", fontSize: 13 * s },

    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
    },
    chipText: { fontSize: 10 * s, fontWeight: "900", color: theme.text },
    dateText: { color: theme.textSub, fontWeight: "800", fontSize: 11 * s },
  };
}