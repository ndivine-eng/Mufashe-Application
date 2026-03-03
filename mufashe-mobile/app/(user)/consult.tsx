// app/(user)/consult.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "../../components/BottomNav";
import { useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

function buildApiUrl(path: string) {
  const base = String(BASE_URL || "").replace(/\/$/, "");
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

type Source = {
  n?: number;
  title?: string;
  pageStart?: number;
  pageEnd?: number;
  snippet?: string;
};

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; sources?: Source[] };

function safeParseJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function looksLikeHtml(text: string) {
  const s = String(text || "").trim().toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html") || s.includes("<body");
}

export default function Consult() {
  const { theme, scale } = useAppSettings();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams();
  const documentId = typeof params?.documentId === "string" ? params.documentId : undefined;
  const category = typeof params?.category === "string" ? params.category : undefined;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ keyboard-aware positioning for absolute input bar
  const [kbVisible, setKbVisible] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  const listRef = useRef<FlatList<Msg>>(null);

  // If you know BottomNav height, keep it here (matches your old bottom: 74)
  const NAV_HEIGHT = 74;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent as any, (e) => {
      setKbVisible(true);
      setKbHeight(e?.endCoordinates?.height ?? 0);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    });

    const hideSub = Keyboard.addListener(hideEvent as any, () => {
      setKbVisible(false);
      setKbHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Msg = { id: String(Date.now()), role: "user", text: q };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Session", "Please login again.");
        router.replace("/(auth)/login");
        return;
      }

      const url = buildApiUrl("/qa/ask");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          question: q,
          topK: 6,
          ...(documentId ? { documentId } : {}),
          ...(category ? { category } : {}),
        }),
      });

      const text = await res.text();
      const data = safeParseJson(text);

      if (!res.ok) {
        const msg = data?.message || `Request failed (${res.status})`;
        throw new Error(looksLikeHtml(msg) ? "Server returned HTML. Check API URL." : msg);
      }

      const answer = (data?.answer || data?.finalAnswer || "No answer.").toString();
      const sources: Source[] = Array.isArray(data?.sources) ? data.sources : [];

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          text: answer,
          sources,
        },
      ]);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      const msg = String(e?.message || "Unknown error");
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 2), role: "assistant", text: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, documentId, category]);

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";

    return (
      <View style={[styles.msgRow, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.msgText, isUser ? styles.userText : styles.aiText]}>{item.text}</Text>

          {"sources" in item && item.sources?.length ? (
            <View style={styles.sourcesBox}>
              <View style={styles.sourcesHeader}>
                <Ionicons name="documents-outline" size={16} color={theme.text} />
                <Text style={styles.sourcesTitle}>{t("sources")}:</Text>
              </View>

              {item.sources.slice(0, 6).map((s, idx) => (
                <View key={`${String(s.n ?? idx)}-${idx}`} style={styles.sourceRow}>
                  <Text style={styles.sourceIndex}>[{s.n ?? idx + 1}]</Text>
                  <Text style={styles.sourceText} numberOfLines={2}>
                    {s.title || "Document"}{" "}
                    {s.pageStart != null ? `(p.${s.pageStart}-${s.pageEnd ?? s.pageStart})` : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  // ✅ Dynamic bottom: if keyboard open -> sit above keyboard; else -> sit above BottomNav
  const inputBottom = (kbVisible ? kbHeight : NAV_HEIGHT) + insets.bottom;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.title}>{t("consult")}</Text>

            <TouchableOpacity onPress={() => setMessages([])} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="trash-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Optional context pill */}
          {documentId ? (
            <View style={styles.contextPill}>
              <Ionicons name="document-text-outline" size={16} color={theme.textSub} />
              <Text style={styles.contextText} numberOfLines={1}>
                {settingsHint(category)}
              </Text>
            </View>
          ) : null}

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: 160 }]}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Input */}
          <View style={[styles.inputBar, { bottom: inputBottom }]}>
            <View style={styles.inputWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.textSub} />
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t("askLegalQuestion")}
                placeholderTextColor={theme.textSub}
                style={styles.input}
                multiline
                textAlignVertical="top" // ✅ important on Android so text stays visible
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (!Platform.OS.includes("ios")) send();
                }}
              />
            </View>

            <TouchableOpacity
              onPress={send}
              disabled={!canSend}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>

          {/* ✅ Hide BottomNav while keyboard is open (so it doesn’t fight space / get covered) */}
          {!kbVisible ? <BottomNav /> : null}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );

  function settingsHint(cat?: string) {
    if (!cat) return "Document context enabled";
    return `Document context • ${String(cat).toUpperCase()}`;
  }
}

function makeStyles(theme: any, s: number) {
  const bg = theme?.bg ?? "#ffffff";
  const card = theme?.card ?? bg;
  const border = theme?.border ?? "#E5E7EB";
  const muted = theme?.muted ?? "#F3F4F6";
  const text = theme?.text ?? "#111827";
  const textSub = theme?.textSub ?? "#6B7280";
  const blue = theme?.blue ?? "#0F3D63";
  const chevron = theme?.chevron ?? "#9CA3AF";

  return {
    safe: { flex: 1, backgroundColor: bg },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: border,
      backgroundColor: bg,
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

    contextPill: {
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    contextText: { color: textSub, fontWeight: "800", fontSize: 12 * s },

    listContent: { paddingHorizontal: 16, paddingTop: 12 },

    msgRow: { flexDirection: "row", marginBottom: 10 },
    bubble: {
      maxWidth: "92%",
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
    },

    userBubble: { backgroundColor: blue, borderColor: blue },
    aiBubble: { backgroundColor: card },

    msgText: { lineHeight: 20 },
    userText: { color: "#fff", fontWeight: "700", fontSize: 13 * s },
    aiText: { color: text, fontWeight: "700", fontSize: 13 * s },

    sourcesBox: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: muted,
      borderRadius: 14,
      padding: 10,
    },
    sourcesHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    sourcesTitle: { fontWeight: "900", color: text, fontSize: 12 * s },

    sourceRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    sourceIndex: { color: chevron, fontWeight: "900", fontSize: 11 * s },
    sourceText: { flex: 1, color: textSub, fontWeight: "800", fontSize: 11 * s },

    inputBar: {
      position: "absolute",
      left: 0,
      right: 0,
      // bottom is set dynamically inline
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: bg,
      borderTopWidth: 1,
      borderTopColor: border,
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-end",
    },
    inputWrap: {
      flex: 1,
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-end",
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: card,
    },
    input: {
      flex: 1,
      color: text,
      fontSize: 13 * s,
      fontWeight: "700",
      maxHeight: 110,
      minHeight: 40,
    },

    sendBtn: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: blue,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.55 },
  };
}