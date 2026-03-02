import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function stripHtml(input?: string) {
  if (!input) return "";
  return String(input)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");
  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export default function QuestionDetails() {
  const params = useLocalSearchParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet(`/questions/${id}`);
      setItem(res?.item || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) load();
  }, [id, load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading answer…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
            <Ionicons name="chevron-back" size={18} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Answer</Text>
          <View style={{ width: 38 }} />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {item ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Question</Text>
              <Text style={styles.qText}>{stripHtml(item.question)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Answer</Text>
              <Text style={styles.aText}>{stripHtml(item.answer)}</Text>
            </View>

            {Array.isArray(item.sources) && item.sources.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.label}>Sources</Text>
                {item.sources.slice(0, 8).map((s: any, idx: number) => (
                  <View key={idx} style={styles.sourceRow}>
                    <Text style={styles.sourceTitle}>
                      [{s.n ?? idx + 1}] {stripHtml(s.title || "Source")}
                    </Text>
                    <Text style={styles.sourceMeta}>
                      {s.pageStart != null ? `p.${s.pageStart}-${s.pageEnd ?? s.pageStart}` : ""}
                    </Text>
                    {s.snippet ? <Text style={styles.sourceSnippet}>{stripHtml(s.snippet)}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  container: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18 },
  center: { alignItems: "center", justifyContent: "center" },
  muted: { marginTop: 10, color: "#6B7280", fontWeight: "800" },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "900", color: "#111827" },

  card: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 18, padding: 14, backgroundColor: "#fff", marginBottom: 12 },
  label: { fontSize: 11, color: "#6B7280", fontWeight: "900", marginBottom: 6 },
  qText: { fontSize: 13, fontWeight: "900", color: "#111827", lineHeight: 20 },
  aText: { fontSize: 13, fontWeight: "700", color: "#111827", lineHeight: 20 },

  sourceRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  sourceTitle: { fontSize: 12, fontWeight: "900", color: "#111827" },
  sourceMeta: { fontSize: 11, color: "#6B7280", fontWeight: "800", marginTop: 2 },
  sourceSnippet: { marginTop: 6, fontSize: 12, color: "#374151", fontWeight: "700", lineHeight: 18 },

  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", marginBottom: 12 },
  errorText: { flex: 1, color: "#7F1D1D", fontWeight: "800" },
  retryBtn: { backgroundColor: "#B91C1C", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
});