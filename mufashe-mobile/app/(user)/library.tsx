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

import { useAppSettings, Language } from "../lib/appSettings";
import { useT } from "../lib/i18n";

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

  // IMPORTANT: read text first to avoid HTML showing in UI
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text }; // if server returns HTML
  }

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

const FILTERS = [
  { key: "all" },
  { key: "land" },
  { key: "labor" },
  { key: "family" },
  { key: "business" },
] as const;

export default function LibraryScreen() {
  const { theme, scale, settings, updateSettings } = useAppSettings();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const params = useLocalSearchParams();
  const presetRaw = typeof params?.category === "string" ? params.category : "all";

  // map preset from dashboard (civil -> business)
  const preset =
    presetRaw === "civil" ? "business" : presetRaw === "employment" ? "labor" : presetRaw;

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>(preset);

  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debounceRef = useRef<any>(null);

  const filterLabel = useCallback(
    (key: string) => {
      const lang = settings.language;
      if (key === "all") return lang === "Kinyarwanda" ? "Byose" : "All";
      if (key === "land") return t("land");
      if (key === "labor") return lang === "Kinyarwanda" ? "Umurimo" : "Work";
      if (key === "family") return t("family");
      if (key === "business") return t("business");
      return key;
    },
    [settings.language, t]
  );

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
      // If server returned HTML, show a clean message
      const msg = String(e?.message || "Failed to load documents");
      setErrorMsg(msg.includes("<!DOCTYPE") ? "Server error. Check API URL." : msg);
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

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

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
        category: doc.category,
      },
    });
  }, []);

  const onSaved = useCallback(() => {
    const msg =
      settings.language === "Kinyarwanda"
        ? "Kubika inyandiko biraje vuba."
        : "Saved documents feature is next.";
    Alert.alert(t("saved"), msg);
  }, [settings.language, t]);

  const pickLanguage = useCallback(
    (lang: Language) => {
      updateSettings({ language: lang });
    },
    [updateSettings]
  );

  const loadingDocsLabel =
    settings.language === "Kinyarwanda" ? "Birimo gutegurwa inyandiko…" : "Loading documents…";

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
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.title}>{t("library")}</Text>

            <TouchableOpacity onPress={onSaved} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="bookmark-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Language pills (REAL) */}
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segItem, settings.language === "English" && styles.segActive]}
              onPress={() => pickLanguage("English")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, settings.language === "English" && styles.segTextActive]}>English</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segItem, settings.language === "Kinyarwanda" && styles.segActive]}
              onPress={() => pickLanguage("Kinyarwanda")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, settings.language === "Kinyarwanda" && styles.segTextActive]}>Kinyarwanda</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={theme.textSub} style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("searchDocs")}
              placeholderTextColor={theme.textSub}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={loadDocs}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={18} color={theme.textSub} />
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
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{filterLabel(f.key)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("documents")}</Text>
            <Text style={styles.sectionSub}>{items.length} items</Text>
          </View>

          {/* Error */}
          {errorMsg ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
              <Text style={styles.errorText} numberOfLines={3}>
                {errorMsg}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadDocs} activeOpacity={0.9}>
                <Text style={styles.retryText}>{t("retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Loading */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingLabel}>{loadingDocsLabel}</Text>
            </View>
          ) : null}

          {/* Document cards */}
          <View style={{ marginTop: 10, gap: 12 }}>
            {!loading && items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={18} color={theme.textSub} />
                <Text style={styles.emptyTitle}>{t("noDocs")}</Text>
                <Text style={styles.emptyText}>{t("tryAnother")}</Text>
              </View>
            ) : (
              items.map((d) => {
                const tagColor = tagColorByCategory(d.category);
                return (
                  <TouchableOpacity
                    key={d._id}
                    style={styles.docCard}
                    activeOpacity={0.9}
                    onPress={() => openAskAboutDoc(d)}
                  >
                    <View style={[styles.docIcon, { backgroundColor: `${tagColor}12` }]}>
                      <Ionicons name={docIcon(d.docType)} size={20} color={tagColor} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.docTitle} numberOfLines={1}>
                        {d.title}
                      </Text>

                      <Text style={styles.docDesc} numberOfLines={1}>
                        {(d.docType || "OTHER").toUpperCase()} • {(d.jurisdiction || "Rwanda").toUpperCase()}
                      </Text>

                      <View style={styles.metaRow}>
                        <View style={[styles.tag, { backgroundColor: `${tagColor}18` }]}>
                          <Text style={[styles.tagText, { color: tagColor }]}>{d.category}</Text>
                        </View>
                        <Text style={styles.statusText}>READY</Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={theme.chevron} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={{ height: 92 }} />
        </ScrollView>

        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any, s: number) {
  const bg = theme?.bg ?? "#ffffff";
  const card = theme?.card ?? bg;
  const border = theme?.border ?? "#E5E7EB";
  const muted = theme?.muted ?? "#F3F4F6";
  const text = theme?.text ?? "#111827";
  const textSub = theme?.textSub ?? "#6B7280";
  const blue = theme?.blue ?? "#2563EB";
  const danger = theme?.danger ?? "#DC2626";
  const dangerBg = theme?.dangerBg ?? "#FEE2E2";
  const chevron = theme?.chevron ?? "#9CA3AF";

  return {
    safe: { flex: 1, backgroundColor: bg },
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
      backgroundColor: muted,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 14 * s, fontWeight: "900", color: text },

    segment: {
      flexDirection: "row",
      backgroundColor: muted,
      borderRadius: 14,
      padding: 4,
      marginBottom: 12,
    },
    segItem: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
    segActive: { backgroundColor: card },
    segText: { fontSize: 12 * s, fontWeight: "800", color: textSub },
    segTextActive: { color: blue },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: card,
    },
    searchInput: { flex: 1, fontSize: 13 * s, color: text },

    pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginBottom: 14 },
    pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: muted },
    pillActive: { backgroundColor: blue },
    pillText: { fontSize: 12 * s, fontWeight: "800", color: textSub },
    pillTextActive: { color: "#ffffff" },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 2,
    },
    sectionTitle: { fontSize: 14 * s, fontWeight: "900", color: text },
    sectionSub: { fontSize: 11 * s, color: chevron, fontWeight: "800" },

    loadingBox: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      backgroundColor: muted,
      borderWidth: 1,
      borderColor: border,
    },
    loadingLabel: { color: textSub, fontWeight: "800" },

    errorCard: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      backgroundColor: dangerBg,
      borderWidth: 1,
      borderColor: dangerBg,
    },
    errorText: { flex: 1, color: danger, fontWeight: "800" },
    retryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: danger },
    retryText: { color: "#fff", fontWeight: "900", fontSize: 12 * s },

    emptyCard: {
      marginTop: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      padding: 14,
      gap: 6,
      alignItems: "center",
    },
    emptyTitle: { fontWeight: "900", color: text },
    emptyText: { color: textSub, fontWeight: "700", textAlign: "center" },

    docCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 18,
      padding: 14,
      backgroundColor: card,
    },
    docIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    docTitle: { fontSize: 13 * s, fontWeight: "900", color: text },
    docDesc: { fontSize: 11.5 * s, color: textSub, marginTop: 4, lineHeight: 16 },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    tagText: { fontSize: 10 * s, fontWeight: "900" },
    statusText: { fontSize: 10.5 * s, color: chevron, fontWeight: "800" },
  };
}