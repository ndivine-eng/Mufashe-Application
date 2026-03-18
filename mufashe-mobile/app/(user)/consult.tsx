// app/(user)/consult.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Keyboard,
  LayoutChangeEvent,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "../../components/BottomNav";
import { useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
const CONSULT_CACHE_KEY = "@mufashe_consult_session_v1";
const NAV_HEIGHT = 84;

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
  | { id: string; role: "assistant"; text: string; sources?: Source[]; pending?: boolean };

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

  const [kbVisible, setKbVisible] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(96);

  const scrollRef = useRef<ScrollView>(null);
  const didLoadSessionRef = useRef(false);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent as any, (e) => {
      setKbVisible(true);
      setKbHeight(e?.endCoordinates?.height ?? 0);
      setTimeout(() => scrollToBottom(true), 100);
    });

    const hideSub = Keyboard.addListener(hideEvent as any, () => {
      setKbVisible(false);
      setKbHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const raw = await AsyncStorage.getItem(CONSULT_CACHE_KEY);
        if (!raw) {
          didLoadSessionRef.current = true;
          return;
        }

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages);
        if (typeof parsed?.input === "string") setInput(parsed.input);
        if (typeof parsed?.loading === "boolean") setLoading(parsed.loading);

        setTimeout(() => scrollToBottom(false), 150);
      } catch (e) {
        console.log("Failed to load consult session", e);
      } finally {
        didLoadSessionRef.current = true;
      }
    };

    loadSession();
  }, [scrollToBottom]);

  useEffect(() => {
    const saveSession = async () => {
      try {
        await AsyncStorage.setItem(
          CONSULT_CACHE_KEY,
          JSON.stringify({
            messages,
            input,
            loading,
            documentId: documentId || null,
            category: category || null,
            updatedAt: Date.now(),
          })
        );
      } catch (e) {
        console.log("Failed to save consult session", e);
      }
    };

    if (didLoadSessionRef.current) {
      saveSession();
    }
  }, [messages, input, loading, documentId, category]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Msg = { id: String(Date.now()), role: "user", text: q };
    const tempId = `temp-${Date.now()}`;
    const pendingMsg: Msg = {
      id: tempId,
      role: "assistant",
      text: "Thinking...",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => scrollToBottom(true), 120);

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
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          question: q,
          topK: 3,
          ...(documentId ? { documentId } : {}),
          ...(category ? { category } : {}),
        }),
      });

      const text = await res.text();
      const data = safeParseJson(text);

      if (!res.ok) {
        const msg = data?.message || `Request failed (${res.status})`;
        throw new Error(
          looksLikeHtml(text)
            ? "Server returned HTML instead of JSON. Check API route or tunnel."
            : msg
        );
      }

      const answer = (data?.answer || data?.finalAnswer || "No answer.").toString();
      const sources: Source[] = Array.isArray(data?.sources) ? data.sources : [];

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                id: String(Date.now() + 1),
                role: "assistant",
                text: answer,
                sources,
              }
            : m
        )
      );

      setTimeout(() => scrollToBottom(true), 160);
    } catch (e: any) {
      const msg = String(e?.message || "Unknown error");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                id: String(Date.now() + 2),
                role: "assistant",
                text: `Error: ${msg}`,
              }
            : m
        )
      );

      setTimeout(() => scrollToBottom(true), 160);
    } finally {
      setLoading(false);
    }
  }, [input, loading, documentId, category, scrollToBottom]);

  const clearChat = useCallback(() => {
    Alert.alert("Clear chat", "Do you want to remove this conversation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setMessages([]);
          setInput("");
          setLoading(false);
          try {
            await AsyncStorage.removeItem(CONSULT_CACHE_KEY);
          } catch (e) {
            console.log("Failed to clear consult session", e);
          }
        },
      },
    ]);
  }, []);

  const handleComposerLayout = useCallback((e: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(e.nativeEvent.layout.height);
    if (nextHeight > 0) setComposerHeight(nextHeight);
  }, []);

  const inputBottom = kbVisible ? Math.max(kbHeight - insets.bottom, 8) : NAV_HEIGHT + 8;
  const contentBottomSpace = composerHeight + (kbVisible ? 28 : NAV_HEIGHT + insets.bottom + 36);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerWrap}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.topIconBtn}
            activeOpacity={0.9}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>{t("consult")}</Text>
            <Text style={styles.titleSub}>Legal Q&A</Text>
          </View>

          <TouchableOpacity onPress={clearChat} style={styles.topIconBtn} activeOpacity={0.9}>
            <Ionicons name="trash-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {documentId ? (
          <View style={styles.contextWrap}>
            <View style={styles.contextPill}>
              <Ionicons name="document-text-outline" size={14} color={theme.textSub} />
              <Text style={styles.contextText} numberOfLines={1}>
                {settingsHint(category)}
              </Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomSpace }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.emptyTitle}>Start your consultation</Text>
              <Text style={styles.emptyText}>
                Ask a legal question and read the answer comfortably.
              </Text>
            </View>
          ) : (
            messages.map((item) => {
              const isUser = item.role === "user";

              return (
                <View
                  key={item.id}
                  style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}
                >
                  {!isUser && (
                    <View style={styles.aiAvatar}>
                      {item.pending ? (
                        <ActivityIndicator size="small" color="#8B5CF6" />
                      ) : (
                        <Ionicons name="sparkles-outline" size={16} color="#8B5CF6" />
                      )}
                    </View>
                  )}

                  <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                    {!isUser && (
                      <View style={styles.assistantTop}>
                        <Text style={styles.assistantName}>Mufashe AI</Text>
                      </View>
                    )}

                    {isUser ? (
                      <Text style={[styles.msgText, styles.userText]}>{item.text}</Text>
                    ) : (
                      <ScrollView
                        style={styles.answerScroll}
                        contentContainerStyle={styles.answerScrollContent}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        <Text style={[styles.msgText, styles.aiText]}>{item.text}</Text>
                      </ScrollView>
                    )}

                    {"sources" in item && item.sources?.length ? (
                      <View style={styles.sourcesCard}>
                        <Text style={styles.sourcesTitle}>{t("sources")}</Text>

                        {item.sources.slice(0, 4).map((s, idx) => (
                          <View key={`${String(s.n ?? idx)}-${idx}`} style={styles.sourceItem}>
                            <View style={styles.sourceBadge}>
                              <Text style={styles.sourceBadgeText}>{s.n ?? idx + 1}</Text>
                            </View>

                            <View style={styles.sourceTextWrap}>
                              <Text style={styles.sourceText}>{s.title || "Document"}</Text>

                              {s.pageStart != null ? (
                                <Text style={styles.sourceMeta}>
                                  Page {s.pageStart}
                                  {s.pageEnd != null && s.pageEnd !== s.pageStart
                                    ? ` - ${s.pageEnd}`
                                    : ""}
                                </Text>
                              ) : null}

                              {!!s.snippet ? (
                                <Text style={styles.sourceSnippet} numberOfLines={3}>
                                  {s.snippet}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View
          style={[styles.inputArea, { bottom: inputBottom }]}
          onLayout={handleComposerLayout}
        >
          <View style={styles.inputShell}>
            <View style={styles.inputTopRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t("askLegalQuestion")}
                placeholderTextColor={theme.textSub}
                style={styles.input}
                multiline
                textAlignVertical="top"
                returnKeyType="send"
                blurOnSubmit={false}
                onFocus={() => setTimeout(() => scrollToBottom(true), 100)}
                onSubmitEditing={() => {
                  if (Platform.OS !== "ios") send();
                }}
              />
            </View>

            <View style={styles.inputFooter}>
              <Text style={styles.inputHint}>
                {loading ? "Generating answer..." : "Ask clearly and briefly"}
              </Text>

              <TouchableOpacity
                onPress={send}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#fff" />
                    <Text style={styles.sendText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!kbVisible ? <BottomNav /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function settingsHint(cat?: string) {
    if (!cat) return "Document context enabled";
    return `Document context • ${String(cat).toUpperCase()}`;
  }
}

function makeStyles(theme: any, s: number) {
  const bg = theme?.bg ?? "#F8F6FC";
  const card = theme?.card ?? "#FFFFFF";
  const border = theme?.border ?? "#E7E5EF";
  const muted = theme?.muted ?? "#F3F1FA";
  const text = theme?.text ?? "#1F2937";
  const textSub = theme?.textSub ?? "#6B7280";
  const blue = theme?.primary ?? theme?.blue ?? "#8B5CF6";

  return {
    flex: { flex: 1 },

    safe: {
      flex: 1,
      backgroundColor: bg,
    },

    headerWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 8,
      backgroundColor: bg,
    },

    topIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      alignItems: "center",
      justifyContent: "center",
    },

    titleWrap: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 10,
    },

    title: {
      fontSize: 17 * s,
      fontWeight: "900",
      color: text,
    },

    titleSub: {
      marginTop: 2,
      fontSize: 11 * s,
      color: textSub,
      fontWeight: "600",
    },

    contextWrap: {
      paddingHorizontal: 14,
      paddingBottom: 8,
    },

    contextPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      flexDirection: "row",
      alignItems: "center",
      maxWidth: "100%",
    },

    contextText: {
      color: textSub,
      fontWeight: "700",
      fontSize: 11 * s,
      marginLeft: 6,
      flexShrink: 1,
    },

    scroll: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: 14,
      paddingTop: 6,
      flexGrow: 1,
    },

    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 72,
      paddingHorizontal: 24,
    },

    emptyIcon: {
      width: 62,
      height: 62,
      borderRadius: 20,
      backgroundColor: "#F3E8FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },

    emptyTitle: {
      fontSize: 17 * s,
      fontWeight: "900",
      color: text,
      textAlign: "center",
    },

    emptyText: {
      marginTop: 8,
      color: textSub,
      fontSize: 13 * s,
      textAlign: "center",
      lineHeight: 20,
      fontWeight: "600",
      maxWidth: 300,
    },

    msgRow: {
      flexDirection: "row",
      marginBottom: 16,
      alignItems: "flex-end",
    },

    msgRowUser: {
      justifyContent: "flex-end",
    },

    msgRowAi: {
      justifyContent: "flex-start",
    },

    aiAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#F3E8FF",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      marginBottom: 6,
    },

    bubble: {
      maxWidth: "88%",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 20,
      borderWidth: 1,
    },

    userBubble: {
      backgroundColor: blue,
      borderColor: blue,
      borderBottomRightRadius: 8,
    },

    aiBubble: {
      backgroundColor: card,
      borderColor: border,
      borderBottomLeftRadius: 8,
    },

    assistantTop: {
      marginBottom: 6,
    },

    assistantName: {
      fontSize: 11.5 * s,
      fontWeight: "900",
      color: text,
    },

    answerScroll: {
      maxHeight: 260,
    },

    answerScrollContent: {
      paddingRight: 4,
    },

    msgText: {
      lineHeight: 24,
    },

    userText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14 * s,
    },

    aiText: {
      color: text,
      fontWeight: "500",
      fontSize: 14 * s,
    },

    sourcesCard: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: muted,
      borderRadius: 14,
      padding: 10,
    },

    sourcesTitle: {
      fontWeight: "900",
      color: text,
      fontSize: 12 * s,
      marginBottom: 6,
    },

    sourceItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      padding: 9,
      marginTop: 7,
    },

    sourceBadge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#EDE9FE",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      marginTop: 1,
      marginRight: 8,
    },

    sourceBadgeText: {
      color: "#7C3AED",
      fontWeight: "900",
      fontSize: 10 * s,
    },

    sourceTextWrap: {
      flex: 1,
    },

    sourceText: {
      color: text,
      fontWeight: "800",
      fontSize: 11 * s,
      lineHeight: 16,
    },

    sourceMeta: {
      color: textSub,
      fontWeight: "700",
      fontSize: 10 * s,
      marginTop: 2,
    },

    sourceSnippet: {
      color: textSub,
      fontSize: 10.5 * s,
      lineHeight: 16,
      marginTop: 4,
      fontWeight: "500",
    },

    inputArea: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: "transparent",
    },

    inputShell: {
      backgroundColor: card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    inputTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },

    input: {
      flex: 1,
      color: text,
      fontSize: 14 * s,
      fontWeight: "500",
      minHeight: 42,
      maxHeight: 110,
      paddingTop: 6,
      paddingBottom: 6,
    },

    inputFooter: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    inputHint: {
      color: textSub,
      fontSize: 10.5 * s,
      fontWeight: "700",
      flex: 1,
      marginRight: 8,
    },

    sendBtn: {
      minWidth: 84,
      height: 38,
      borderRadius: 12,
      backgroundColor: blue,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      paddingHorizontal: 14,
    },

    sendBtnDisabled: {
      opacity: 0.5,
    },

    sendText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 12 * s,
      marginLeft: 5,
    },
  };
}