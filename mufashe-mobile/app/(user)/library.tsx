// app/(user)/library.tsx
// This file implements the Library screen of the Mufashe mobile app, where users can browse, search, and read legal documents.
// It includes features such as filtering by category, saving favorite documents, and asking questions about specific documents.
// The screen fetches document data from the backend API and displays it in a user-friendly interface with support for both English and Kinyarwanda languages.

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

async function apiGetPublic(path: string) {
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

      const res = await apiGetPublic(queryPath);
      setItems(res?.items || []);
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
      const res = await apiGetPublic(queryPath);
      setItems(res?.items || []);
      await loadSavedDocs();
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [queryPath, loadSavedDocs]);

  useEffect(() => {
    loadDocs();
    loadSavedDocs();
  }, [loadDocs, loadSavedDocs]);

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

  const pickLanguage = useCallback(
    (lang: Language) => {
      updateSettings({ language: lang });
    },
    [updateSettings]
  );

  const openReader = useCallback(async (doc: Doc) => {
    try {
      setReaderOpen(true);
      setReaderLoading(true);
      setReaderError(null);
      setReaderDoc(null);

      const res = await apiGetPublic(`/documents/${doc._id}`);
      const detail = res?.item || res?.document || res;

      const merged: DocDetails = {
        ...doc,
        ...(detail || {}),
      };

      setReaderDoc(merged);
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

  const displayedItems = useMemo(() => {
    if (!showSavedOnly) return items;
    return items.filter((doc) => savedIds.includes(doc._id));
  }, [items, savedIds, showSavedOnly]);

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

            <TouchableOpacity
              onPress={() => setShowSavedOnly((prev) => !prev)}
              style={[styles.iconBtn, showSavedOnly && styles.iconBtnActive]}
              activeOpacity={0.9}
            >
              <Ionicons
                name={savedIds.length > 0 ? "bookmark" : "bookmark-outline"}
                size={18}
                color={showSavedOnly ? "#fff" : theme.text}
              />
            </TouchableOpacity>
          </View>

          {/* Language pills */}
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segItem, settings.language === "English" && styles.segActive]}
              onPress={() => pickLanguage("English")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, settings.language === "English" && styles.segTextActive]}>
                English
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segItem, settings.language === "Kinyarwanda" && styles.segActive]}
              onPress={() => pickLanguage("Kinyarwanda")}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.segText,
                  settings.language === "Kinyarwanda" && styles.segTextActive,
                ]}
              >
                Kinyarwanda
              </Text>
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

          {/* Filters */}
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
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {filterLabel(f.key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {showSavedOnly
                ? settings.language === "Kinyarwanda"
                  ? "Inyandiko zabitswe"
                  : "Saved documents"
                : t("documents")}
            </Text>
            <Text style={styles.sectionSub}>{displayedItems.length} items</Text>
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

          {/* Documents */}
          <View style={{ marginTop: 10, gap: 12 }}>
            {!loading && displayedItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={18} color={theme.textSub} />
                <Text style={styles.emptyTitle}>
                  {showSavedOnly
                    ? settings.language === "Kinyarwanda"
                      ? "Nta nyandiko zabitswe zirimo"
                      : "No saved documents"
                    : t("noDocs")}
                </Text>
                <Text style={styles.emptyText}>
                  {showSavedOnly
                    ? settings.language === "Kinyarwanda"
                      ? "Bika inyandiko kugira ngo zigaragare hano."
                      : "Save documents to see them here."
                    : t("tryAnother")}
                </Text>
              </View>
            ) : (
              displayedItems.map((d) => {
                const tagColor = tagColorByCategory(d.category);
                const isSaved = savedIds.includes(d._id);

                return (
                  <View key={d._id} style={styles.docCard}>
                    <TouchableOpacity
                      style={styles.docTop}
                      activeOpacity={0.9}
                      onPress={() => openReader(d)}
                    >
                      <View style={[styles.docIcon, { backgroundColor: `${tagColor}12` }]}>
                        <Ionicons name={docIcon(d.docType)} size={20} color={tagColor} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle} numberOfLines={1}>
                          {d.title}
                        </Text>

                        <Text style={styles.docDesc} numberOfLines={1}>
                          {(d.docType || "OTHER").toUpperCase()} •{" "}
                          {(d.jurisdiction || "Rwanda").toUpperCase()}
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

                    <View style={styles.docActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openReader(d)}
                        activeOpacity={0.9}
                      >
                        <Ionicons name="document-text-outline" size={16} color={theme.blue} />
                        <Text style={styles.actionText}>
                          {settings.language === "Kinyarwanda" ? "Soma" : "Read"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openAskAboutDoc(d)}
                        activeOpacity={0.9}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.blue} />
                        <Text style={styles.actionText}>
                          {settings.language === "Kinyarwanda" ? "Baza" : "Ask"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, isSaved && styles.actionBtnSaved]}
                        onPress={() => toggleSaveDoc(d._id)}
                        activeOpacity={0.9}
                      >
                        <Ionicons
                          name={isSaved ? "bookmark" : "bookmark-outline"}
                          size={16}
                          color={isSaved ? "#fff" : theme.blue}
                        />
                        <Text style={[styles.actionText, isSaved && styles.actionTextSaved]}>
                          {isSaved
                            ? settings.language === "Kinyarwanda"
                              ? "Byabitswe"
                              : "Saved"
                            : settings.language === "Kinyarwanda"
                            ? "Bika"
                            : "Save"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 92 }} />
        </ScrollView>

        <BottomNav />
      </View>

      {/* Reader modal */}
      <Modal visible={readerOpen} transparent animationType="slide" onRequestClose={closeReader}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTopBar}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {readerDoc?.title ||
                  (settings.language === "Kinyarwanda" ? "Inyandiko" : "Document")}
              </Text>

              <View style={styles.modalActions}>
                {readerDoc?._id ? (
                  <TouchableOpacity
                    style={styles.modalIconBtn}
                    onPress={() => toggleSaveDoc(readerDoc._id)}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name={savedIds.includes(readerDoc._id) ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color={theme.text}
                    />
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.modalIconBtn} onPress={closeReader} activeOpacity={0.9}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {readerLoading ? (
                <View style={styles.readerLoadingBox}>
                  <ActivityIndicator />
                  <Text style={styles.readerLoadingText}>
                    {settings.language === "Kinyarwanda"
                      ? "Birimo gufungura inyandiko…"
                      : "Opening document…"}
                  </Text>
                </View>
              ) : readerError ? (
                <View style={styles.readerStateCard}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                  <Text style={styles.readerStateTitle}>
                    {settings.language === "Kinyarwanda"
                      ? "Ntibyashobotse gufungura inyandiko"
                      : "Failed to open document"}
                  </Text>
                  <Text style={styles.readerStateText}>{readerError}</Text>
                </View>
              ) : readerDoc ? (
                <>
                  <View style={styles.readerMetaCard}>
                    <Text style={styles.readerDocTitle}>{readerDoc.title}</Text>
                    <Text style={styles.readerDocMeta}>
                      {(readerDoc.docType || "OTHER").toUpperCase()} •{" "}
                      {(readerDoc.category || "OTHER").toUpperCase()} •{" "}
                      {(readerDoc.jurisdiction || "Rwanda").toUpperCase()}
                    </Text>
                  </View>

                  {extractReadableText(readerDoc) ? (
                    <View style={styles.readerContentCard}>
                      <Text style={styles.readerSectionTitle}>
                        {settings.language === "Kinyarwanda" ? "Ibirimo" : "Content"}
                      </Text>
                      <Text style={styles.readerContentText}>{extractReadableText(readerDoc)}</Text>
                    </View>
                  ) : (
                    <View style={styles.readerStateCard}>
                      <Ionicons name="document-outline" size={20} color={theme.textSub} />
                      <Text style={styles.readerStateTitle}>
                        {settings.language === "Kinyarwanda"
                          ? "Nta nyandiko isomeka yabonetse"
                          : "No readable document text found"}
                      </Text>
                      <Text style={styles.readerStateText}>
                        {settings.language === "Kinyarwanda"
                          ? "Backend yawe igomba kohereza content, summary, extractedText, body, cyangwa fileUrl kugira ngo inyandiko isomwe hano."
                          : "Your backend should return content, summary, extractedText, body, or fileUrl so the document can be read here."}
                      </Text>
                    </View>
                  )}

                  <View style={styles.readerBottomActions}>
                    <TouchableOpacity
                      style={styles.readerSecondaryBtn}
                      onPress={() =>
                        readerDoc?._id &&
                        router.push({
                          pathname: "/(user)/consult",
                          params: {
                            documentId: readerDoc._id,
                            category: readerDoc.category,
                          },
                        })
                      }
                      activeOpacity={0.9}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.blue} />
                      <Text style={styles.readerSecondaryBtnText}>
                        {settings.language === "Kinyarwanda" ? "Baza kuri iyi nyandiko" : "Ask about this document"}
                      </Text>
                    </TouchableOpacity>

                    {readerDoc?._id ? (
                      <TouchableOpacity
                        style={styles.readerPrimaryBtn}
                        onPress={() => toggleSaveDoc(readerDoc._id)}
                        activeOpacity={0.9}
                      >
                        <Ionicons
                          name={savedIds.includes(readerDoc._id) ? "bookmark" : "bookmark-outline"}
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.readerPrimaryBtnText}>
                          {savedIds.includes(readerDoc._id)
                            ? settings.language === "Kinyarwanda"
                              ? "Byabitswe"
                              : "Saved"
                            : settings.language === "Kinyarwanda"
                            ? "Bika inyandiko"
                            : "Save document"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  const blue = theme?.blue ?? theme?.primary ?? "#2563EB";
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
    iconBtnActive: {
      backgroundColor: blue,
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
      borderWidth: 1,
      borderColor: border,
      borderRadius: 18,
      padding: 14,
      backgroundColor: card,
    },
    docTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    docIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    docTitle: { fontSize: 13 * s, fontWeight: "900", color: text },
    docDesc: { fontSize: 11.5 * s, color: textSub, marginTop: 4, lineHeight: 16 },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    tagText: { fontSize: 10 * s, fontWeight: "900" },
    statusText: { fontSize: 10.5 * s, color: chevron, fontWeight: "800" },

    docActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
      flexWrap: "wrap",
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: muted,
    },
    actionBtnSaved: {
      backgroundColor: blue,
    },
    actionText: {
      fontSize: 11.5 * s,
      fontWeight: "900",
      color: blue,
    },
    actionTextSaved: {
      color: "#fff",
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      height: "88%",
      backgroundColor: bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      borderWidth: 1,
      borderColor: border,
    },
    modalTopBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    modalTitle: {
      flex: 1,
      fontSize: 15 * s,
      fontWeight: "900",
      color: text,
      marginRight: 12,
    },
    modalActions: {
      flexDirection: "row",
      gap: 8,
    },
    modalIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: muted,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBody: {
      padding: 18,
      paddingBottom: 28,
    },

    readerLoadingBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      gap: 10,
    },
    readerLoadingText: {
      color: textSub,
      fontWeight: "800",
    },

    readerMetaCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
    },
    readerDocTitle: {
      fontSize: 16 * s,
      fontWeight: "900",
      color: text,
      lineHeight: 22,
    },
    readerDocMeta: {
      marginTop: 8,
      fontSize: 11.5 * s,
      color: textSub,
      fontWeight: "700",
      lineHeight: 16,
    },

    readerContentCard: {
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 18,
      padding: 14,
    },
    readerSectionTitle: {
      fontSize: 13 * s,
      fontWeight: "900",
      color: text,
      marginBottom: 10,
    },
    readerContentText: {
      fontSize: 13 * s,
      color: text,
      lineHeight: 22,
      fontWeight: "500",
    },

    readerStateCard: {
      borderWidth: 1,
      borderColor: border,
      borderRadius: 18,
      backgroundColor: card,
      padding: 16,
      alignItems: "center",
    },
    readerStateTitle: {
      marginTop: 10,
      fontSize: 14 * s,
      fontWeight: "900",
      color: text,
      textAlign: "center",
    },
    readerStateText: {
      marginTop: 8,
      fontSize: 12 * s,
      fontWeight: "700",
      color: textSub,
      lineHeight: 18,
      textAlign: "center",
    },

    readerBottomActions: {
      gap: 10,
      marginTop: 16,
    },
    readerSecondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: muted,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 12,
    },
    readerSecondaryBtnText: {
      fontSize: 12.5 * s,
      fontWeight: "900",
      color: blue,
    },
    readerPrimaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: blue,
      paddingHorizontal: 12,
    },
    readerPrimaryBtnText: {
      fontSize: 12.5 * s,
      fontWeight: "900",
      color: "#fff",
    },
  };
}