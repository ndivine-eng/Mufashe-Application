// app/(user)/library.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNav from "../../components/BottomNav";

type Doc = {
  _id: string;
  title: string;
  category: "FAMILY" | "LAND" | "LABOR" | "BUSINESS";
  docType: "LAW" | "CASE" | "CONTRACT" | "OTHER";
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  jurisdiction?: string;
  createdAt?: string;
};

// ✅ You keep /api in env (example: https://xxxx.ngrok-free.dev/api)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

// backend expects FAMILY/LAND/LABOR/BUSINESS
function normalizeCategoryKey(input?: string) {
  const k = String(input || "").toLowerCase().trim();
  if (k === "family") return "FAMILY";
  if (k === "land") return "LAND";
  if (k === "labor" || k === "employment" || k === "work") return "LABOR";
  if (k === "business" || k === "civil") return "BUSINESS";
  return null;
}

function docIcon(docType?: string): keyof typeof Ionicons.glyphMap {
  const t = String(docType || "").toUpperCase();
  if (t === "LAW") return "document-text-outline";
  if (t === "CASE") return "book-outline";
  if (t === "CONTRACT") return "receipt-outline";
  return "folder-outline";
}

function tagColorByCategory(category?: string) {
  const c = String(category || "").toUpperCase();
  if (c === "LAND") return "#2563EB";
  if (c === "LABOR") return "#16A34A";
  if (c === "FAMILY") return "#7C3AED";
  if (c === "BUSINESS") return "#F97316";
  return "#6B7280";
}

async function apiGetPublic(path: string) {
  // documents list is public in your backend, but if token exists we can send it (harmless)
  const token = await AsyncStorage.getItem("token");
  const url = joinUrl(BASE_URL, path);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

const FILTERS = [
  { key: "all", label: "All" },
  { key: "land", label: "Land" },
  { key: "labor", label: "Work" },
  { key: "family", label: "Family" },
  { key: "business", label: "Business" },
] as const;

export default function LibraryScreen() {
  const params = useLocalSearchParams();
  const presetRaw = typeof params?.category === "string" ? params.category : "all";

  // map preset from dashboard (civil -> business)
  const preset =
    presetRaw === "civil" ? "business" : presetRaw === "employment" ? "labor" : presetRaw;

  const [lang, setLang] = useState<"English" | "Kinyarwanda">("English");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>(preset);

  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debounceRef = useRef<any>(null);

  const queryPath = useMemo(() => {
    const cat = filter === "all" ? null : normalizeCategoryKey(filter);
    const query = q.trim();

    const parts: string[] = [];
    parts.push("status=READY"); // ✅ users should only see READY
    if (cat) parts.push(`category=${encodeURIComponent(cat)}`);
    if (query.length > 0) parts.push(`q=${encodeURIComponent(query)}`);

    return `/documents?${parts.join("&")}`;
  }, [filter, q]);

  const loadDocs = useCallback(async () => {
    try {
      setErrorMsg(null);
      setLoading(true);

      const res = await apiGetPublic(queryPath);
      setItems(res?.items || []);
    } catch (e: any) {
      setItems([]);
      setErrorMsg(e?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [queryPath]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await apiGetPublic(queryPath);
      setItems(res?.items || []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [queryPath]);

  // initial load on focus
  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // debounced reload for search/filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadDocs();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filter, q, loadDocs]);

  const openAskAboutDoc = useCallback((doc: Doc) => {
    router.push({
      pathname: "/(user)/consult",
      params: {
        documentId: doc._id,
        category: doc.category, // useful if your consult screen supports it
      },
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={18} color="#111827" />
            </TouchableOpacity>

            <Text style={styles.title}>Library</Text>

            <TouchableOpacity
              onPress={() => Alert.alert("Saved", "Saved documents feature is next.")}
              style={styles.iconBtn}
              activeOpacity={0.9}
            >
              <Ionicons name="bookmark-outline" size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Language segmented (UI only for now) */}
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segItem, lang === "English" && styles.segActive]}
              onPress={() => setLang("English")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, lang === "English" && styles.segTextActive]}>English</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segItem, lang === "Kinyarwanda" && styles.segActive]}
              onPress={() => Alert.alert("Coming soon", "Kinyarwanda library content will be added later.")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, lang === "Kinyarwanda" && styles.segTextActive]}>Kinyarwanda</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search laws, cases, contracts…"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={loadDocs}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter pills */}
          <View style={styles.pillsRow}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setFilter(f.key)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <Text style={styles.sectionSub}>{items.length} items</Text>
          </View>

          {/* Error */}
          {errorMsg ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadDocs} activeOpacity={0.9}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Loading */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingLabel}>Loading documents…</Text>
            </View>
          ) : null}

          {/* Document cards */}
          <View style={{ marginTop: 10, gap: 12 }}>
            {!loading && items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={18} color="#6B7280" />
                <Text style={styles.emptyTitle}>No documents found</Text>
                <Text style={styles.emptyText}>Try another category or search term.</Text>
              </View>
            ) : (
              items.map((d) => {
                const tagColor = tagColorByCategory(d.category);
                return (
                  <TouchableOpacity
                    key={d._id}
                    style={styles.guideCard}
                    activeOpacity={0.9}
                    onPress={() => openAskAboutDoc(d)}
                  >
                    <View style={[styles.guideIcon, { backgroundColor: `${tagColor}12` }]}>
                      <Ionicons name={docIcon(d.docType)} size={20} color={tagColor} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.guideTitle} numberOfLines={1}>
                        {d.title}
                      </Text>

                      <Text style={styles.guideDesc} numberOfLines={1}>
                        {(d.docType || "OTHER").toUpperCase()} • {(d.jurisdiction || "Rwanda").toUpperCase()}
                      </Text>

                      <View style={styles.metaRow}>
                        <View style={[styles.tag, { backgroundColor: `${tagColor}18` }]}>
                          <Text style={[styles.tagText, { color: tagColor }]}>{d.category}</Text>
                        </View>
                        <Text style={styles.minutes}>READY</Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>

        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "900", color: "#111827" },

  segment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  segActive: { backgroundColor: "#ffffff" },
  segText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  segTextActive: { color: "#2563EB" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#111827" },

  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginBottom: 14 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  pillActive: { backgroundColor: "#2563EB" },
  pillText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  pillTextActive: { color: "#ffffff" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  sectionSub: { fontSize: 11, color: "#9CA3AF", fontWeight: "800" },

  loadingBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  loadingLabel: { color: "#6B7280", fontWeight: "800" },

  errorCard: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { flex: 1, color: "#7F1D1D", fontWeight: "800" },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
  },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 12 },

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

  guideCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#ffffff",
  },
  guideIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  guideTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  guideDesc: { fontSize: 11.5, color: "#6B7280", marginTop: 4, lineHeight: 16 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: "900" },
  minutes: { fontSize: 10.5, color: "#9CA3AF", fontWeight: "800" },
});