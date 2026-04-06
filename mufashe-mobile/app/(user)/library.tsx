// app/(user)/library.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNav from "../../components/BottomNav";
import { useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

type Doc = {
  _id: string;
  title: string;
  category: "FAMILY" | "LAND" | "LABOR" | "BUSINESS";
  docType: "LAW" | "CASE" | "CONTRACT" | "OTHER";
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  jurisdiction?: string;
  createdAt?: string;
  readCount?: number;
  lastReadAt?: string;
};

type DocDetails = Doc & {
  content?: string;
  summary?: string;
  extractedText?: string;
  body?: string;
  description?: string;
  fileUrl?: string;
  pdfUrl?: string;
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const SAVED_DOCS_KEY = "@mufashe_saved_docs_v1";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

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

function extractReadableText(doc: Partial<DocDetails> | null) {
  if (!doc) return "";
  return (
    String(doc.content || "").trim() ||
    String(doc.summary || "").trim() ||
    String(doc.extractedText || "").trim() ||
    String(doc.body || "").trim() ||
    String(doc.description || "").trim()
  );
}

async function apiGet(path: string) {
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

async function apiPost(path: string, body?: any) {
  const token = await AsyncStorage.getItem("token");
  const url = joinUrl(BASE_URL, path);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
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
  { key: "all", icon: "apps-outline" },
  { key: "land", icon: "map-outline" },
  { key: "labor", icon: "briefcase-outline" },
  { key: "family", icon: "people-outline" },
  { key: "business", icon: "business-outline" },
] as const;

export default function LibraryScreen() {
  const { theme, scale, settings } = useAppSettings();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const params = useLocalSearchParams();
  const presetRaw = typeof params?.category === "string" ? params.category : "all";
  const preset =
    presetRaw === "civil" ? "business" : presetRaw === "employment" ? "labor" : presetRaw;

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>(preset);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [savedIds, setSavedIds] = useState<string[]>([]);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerDoc, setReaderDoc] = useState<DocDetails | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);

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
    parts.push("status=READY");
    if (cat) parts.push(`category=${encodeURIComponent(cat)}`);
    if (query.length > 0) parts.push(`q=${encodeURIComponent(query)}`);

    return `/documents?${parts.join("&")}`;
  }, [filter, q]);

  const loadSavedDocs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_DOCS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedIds([]);
    }
  }, []);

  const persistSavedDocs = useCallback(async (ids: string[]) => {
    await AsyncStorage.setItem(SAVED_DOCS_KEY, JSON.stringify(ids));
    setSavedIds(ids);
  }, []);

  const toggleSaveDoc = useCallback(
    async (docId: string) => {
      try {
        const exists = savedIds.includes(docId);
        const next = exists ? savedIds.filter((id) => id !== docId) : [...savedIds, docId];
        await persistSavedDocs(next);

        Alert.alert(
          exists
            ? settings.language === "Kinyarwanda"
              ? "Inyandiko yavanywe mu zabitswe"
              : "Removed from saved"
            : settings.language === "Kinyarwanda"
            ? "Inyandiko yabitswe"
            : "Document saved"
        );
      } catch {
        Alert.alert(
          settings.language === "Kinyarwanda" ? "Byanze kubika inyandiko" : "Failed to save document"
        );
      }
    },
    [persistSavedDocs, savedIds, settings.language]
  );

  const loadDocs = useCallback(async () => {
    try {
      setErrorMsg(null);
      setLoading(true);

      const res = await apiGet(queryPath);
      setItems(res?.items || res?.documents || []);
    } catch (e: any) {
      setItems([]);
      const msg = String(e?.message || "Failed to load documents");
      setErrorMsg(msg.includes("<!DOCTYPE") ? "Server error. Check API URL." : msg);
    } finally {
      setLoading(false);
    }
  }, [queryPath]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await apiGet(queryPath);
      setItems(res?.items || res?.documents || []);
      await loadSavedDocs();
    } catch (e: any) {
      const msg = String(e?.message || "Failed to refresh");
      setErrorMsg(msg);
    } finally {
      setRefreshing(false);
    }
  }, [queryPath, loadSavedDocs]);

  useEffect(() => {
    loadSavedDocs();
  }, [loadSavedDocs]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      loadDocs();
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, filter, loadDocs]);

  const visibleItems = useMemo(() => {
    const base = showSavedOnly ? items.filter((item) => savedIds.includes(item._id)) : items;
    return base;
  }, [items, savedIds, showSavedOnly]);

  const openReader = useCallback(async (doc: Doc) => {
    try {
      setReaderOpen(true);
      setReaderLoading(true);
      setReaderError(null);
      setReaderDoc(null);

      const res = await apiGet(`/documents/${doc._id}`);
      const detail = res?.item || res?.document || res;

      const merged: DocDetails = {
        ...doc,
        ...(detail || {}),
      };

      setReaderDoc(merged);

      try {
        await apiPost(`/documents/${doc._id}/read`, { action: "READ" });
      } catch (readErr) {
        console.log("Failed to record read event:", readErr);
      }
    } catch (e: any) {
      setReaderError(e?.message || "Failed to open document");
    } finally {
      setReaderLoading(false);
    }
  }, []);

  const closeReader = useCallback(() => {
    setReaderOpen(false);
    setReaderDoc(null);
    setReaderError(null);
    setReaderLoading(false);
  }, []);

  const askAboutDocument = useCallback((doc: Doc) => {
    router.push({
      pathname: "/(user)/consult",
      params: {
        documentId: doc._id,
        title: doc.title,
        category: doc.category,
      },
    });
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.title}>
          {settings.language === "Kinyarwanda" ? "Isomero ry'Amategeko" : "Legal Library"}
        </Text>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowSavedOnly((prev) => !prev)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={showSavedOnly ? "bookmark" : "bookmark-outline"}
            size={20}
            color={theme.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={theme.textSub} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={settings.language === "Kinyarwanda" ? "Shaka inyandiko." : "Search documents."}
          placeholderTextColor={theme.textSub}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const tint = f.key === "all" ? "#0F3D63" : tagColorByCategory(f.key);

            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: tint, borderColor: tint },
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={f.icon}
                  size={17}
                  color={active ? "#fff" : tint}
                  style={styles.filterChipIcon}
                />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filterLabel(f.key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>
            {settings.language === "Kinyarwanda" ? "Turimo kuzana inyandiko..." : "Loading documents..."}
          </Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
          <Text style={styles.muted}>{errorMsg}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {visibleItems.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="folder-open-outline" size={28} color={theme.textSub} />
              <Text style={styles.muted}>
                {settings.language === "Kinyarwanda" ? "Nta nyandiko zabonetse" : "No documents found"}
              </Text>
            </View>
          ) : (
            visibleItems.map((doc) => {
              const saved = savedIds.includes(doc._id);
              const textColor = tagColorByCategory(doc.category);

              return (
                <View key={doc._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleWrap}>
                      <View style={[styles.docIconWrap, { backgroundColor: `${textColor}18` }]}>
                        <Ionicons name={docIcon(doc.docType)} size={18} color={textColor} />
                      </View>

                      <View style={styles.cardTextWrap}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {doc.title}
                        </Text>

                        <View style={styles.metaRow}>
                          <View style={[styles.tag, { backgroundColor: `${textColor}14` }]}>
                            <Text style={[styles.tagText, { color: textColor }]}>
                              {doc.category}
                            </Text>
                          </View>

                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.metaText}>{doc.docType}</Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => toggleSaveDoc(doc._id)}
                      style={styles.saveBtn}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={saved ? "bookmark" : "bookmark-outline"}
                        size={20}
                        color={saved ? "#0F3D63" : theme.textSub}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => openReader(doc)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="book-outline" size={16} color={theme.text} />
                      <Text style={styles.actionText}>
                        {settings.language === "Kinyarwanda" ? "Soma" : "Read"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.primaryBtn]}
                      onPress={() => askAboutDocument(doc)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>
                        {settings.language === "Kinyarwanda" ? "Baza" : "Ask AI"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={readerOpen} animationType="slide" onRequestClose={closeReader}>
        <SafeAreaView style={styles.readerScreen}>
          <View style={styles.readerHeader}>
            <Text style={styles.readerTitle} numberOfLines={2}>
              {readerDoc?.title || (settings.language === "Kinyarwanda" ? "Soma inyandiko" : "Read document")}
            </Text>

            <TouchableOpacity onPress={closeReader} style={styles.iconBtn}>
              <Ionicons name="close-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {readerLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" />
              <Text style={styles.muted}>
                {settings.language === "Kinyarwanda" ? "Turimo gufungura inyandiko..." : "Opening document..."}
              </Text>
            </View>
          ) : readerError ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
              <Text style={styles.muted}>{readerError}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.readerContent} showsVerticalScrollIndicator={false}>
              {readerDoc ? (
                <>
                  <View style={styles.readerMetaRow}>
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: `${tagColorByCategory(readerDoc.category)}14` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          { color: tagColorByCategory(readerDoc.category) },
                        ]}
                      >
                        {readerDoc.category}
                      </Text>
                    </View>

                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaText}>{readerDoc.docType}</Text>
                  </View>

                  <Text style={styles.readerBody}>
                    {extractReadableText(readerDoc) ||
                      (settings.language === "Kinyarwanda"
                        ? "Nta bisobanuro by'inyandiko byabonetse."
                        : "No readable document content found.")}
                  </Text>
                </>
              ) : null}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const makeStyles = (theme: any, scale: number) => {
  const s = scale || 1;

  return {
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
    },

    title: {
      fontSize: 24 * s,
      fontWeight: "800",
      color: theme.text,
    },

    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 12,
      paddingHorizontal: 14,
      height: 50,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },

    searchInput: {
      flex: 1,
      marginLeft: 8,
      color: theme.text,
      fontSize: 14 * s,
    },

    filtersWrap: {
      height: 58,
      marginBottom: 6,
    },

    filterRow: {
      paddingHorizontal: 16,
      alignItems: "center",
      paddingRight: 26,
    },

    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 42,
      paddingHorizontal: 18,
      borderRadius: 21,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 10,
    },

    filterChipIcon: {
      marginRight: 8,
    },

    filterChipText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 14 * s,
    },

    filterChipTextActive: {
      color: "#fff",
    },

    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 120,
      paddingTop: 6,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 30,
    },

    muted: {
      marginTop: 10,
      color: theme.textSub,
      textAlign: "center",
      fontSize: 14 * s,
      lineHeight: 20 * s,
    },

    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOpacity: theme.bg === "#000" ? 0.12 : 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },

    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
    },

    cardTitleWrap: {
      flexDirection: "row",
      flex: 1,
      paddingRight: 10,
    },

    docIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    cardTextWrap: {
      flex: 1,
    },

    cardTitle: {
      color: theme.text,
      fontSize: 15 * s,
      fontWeight: "800",
      lineHeight: 22 * s,
      marginBottom: 8,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },

    tag: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },

    tagText: {
      fontSize: 11 * s,
      fontWeight: "800",
    },

    metaDot: {
      marginHorizontal: 7,
      color: theme.textSub,
      fontWeight: "700",
    },

    metaText: {
      color: theme.textSub,
      fontSize: 12 * s,
      fontWeight: "600",
    },

    saveBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.border,
    },

    cardActions: {
      flexDirection: "row",
      gap: 10,
    },

    actionBtn: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },

    actionText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 13 * s,
    },

    primaryBtn: {
      backgroundColor: "#0F3D63",
      borderColor: "#0F3D63",
    },

    primaryBtnText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 13 * s,
    },

    readerScreen: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    readerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    readerTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 18 * s,
      fontWeight: "800",
      paddingRight: 12,
    },

    readerContent: {
      padding: 16,
      paddingBottom: 40,
    },

    readerMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      flexWrap: "wrap",
    },

    readerBody: {
      color: theme.text,
      fontSize: 14 * s,
      lineHeight: 24 * s,
    },
  };
};