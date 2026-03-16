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
  LayoutChangeEvent,
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
  const [composerHeight, setComposerHeight] = useState(108);

  const listRef = useRef<FlatList<Msg>>(null);
  const NAV_HEIGHT = 84;

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent as any, (e) => {
      setKbVisible(true);
      setKbHeight(e?.endCoordinates?.height ?? 0);
      setTimeout(() => scrollToBottom(true), 90);
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
        if (!raw) return;

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed?.messages)) {
          setMessages(parsed.messages);
        }

        if (typeof parsed?.input === "string") {
          setInput(parsed.input);
        }

        if (typeof parsed?.loading === "boolean") {
          setLoading(parsed.loading);
        }

        setTimeout(() => scrollToBottom(false), 120);
      } catch (e) {
        console.log("Failed to load consult session", e);
      }
    };

    loadSession();
  }, [scrollToBottom]);

  useEffect(() => {
    const saveSession = async () => {
      try {
        const payload = {
          messages,
          input,
          loading,
          documentId: documentId || null,
          category: category || null,
          updatedAt: Date.now(),
        };

        await AsyncStorage.setItem(CONSULT_CACHE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.log("Failed to save consult session", e);
      }
    };

    saveSession();
  }, [messages, input, loading, documentId, category]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(true), 80);
    }
  }, [messages, scrollToBottom]);

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
    setTimeout(() => scrollToBottom(true), 50);

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

      setTimeout(() => scrollToBottom(true), 100);
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

  const handleComposerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(e.nativeEvent.layout.height);
      if (nextHeight > 0 && Math.abs(nextHeight - composerHeight) > 6) {
        setComposerHeight(nextHeight);
      }
    },
    [composerHeight]
  );

  const inputBottom = kbVisible
    ? Math.max(kbHeight - insets.bottom, 8)
    : NAV_HEIGHT + 8;

  const listBottomSpace =
    composerHeight + (kbVisible ? 28 : NAV_HEIGHT + insets.bottom + 28);

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons
              name={item.pending ? "time-outline" : "sparkles-outline"}
              size={18}
              color="#8B5CF6"
            />
          </View>
        )}

        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {!isUser && (
            <View style={styles.assistantTop}>
              <Text style={styles.assistantName}>Mufashe AI</Text>
              <Text style={styles.assistantHint}>
                {item.pending ? "Preparing response..." : "Legal guidance assistant"}
              </Text>
            </View>
          )}

          <Text style={[styles.msgText, isUser ? styles.userText : styles.aiText]}>
            {item.text}
          </Text>

          {"sources" in item && item.sources?.length ? (
            <View style={styles.sourcesCard}>
              <View style={styles.sourcesHeader}>
                <View style={styles.sourcesIconWrap}>
                  <Ionicons name="document-text-outline" size={15} color="#8B5CF6" />
                </View>
                <Text style={styles.sourcesTitle}>{t("sources")}</Text>
              </View>

              {item.sources.slice(0, 6).map((s, idx) => (
                <View key={`${String(s.n ?? idx)}-${idx}`} style={styles.sourceItem}>
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>{s.n ?? idx + 1}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceText} numberOfLines={2}>
                      {s.title || "Document"}
                    </Text>

                    {s.pageStart != null ? (
                      <Text style={styles.sourceMeta}>
                        Page {s.pageStart}
                        {s.pageEnd != null && s.pageEnd !== s.pageStart ? ` - ${s.pageEnd}` : ""}
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
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.headerWrap}>
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.topIconBtn}
                activeOpacity={0.9}
              >
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </TouchableOpacity>

              <View style={styles.titleWrap}>
                <Text style={styles.title}>{t("consult")}</Text>
                <Text style={styles.titleSub}>Ask legal questions and get guided answers</Text>
              </View>

              <TouchableOpacity onPress={clearChat} style={styles.topIconBtn} activeOpacity={0.9}>
                <Ionicons name="trash-outline" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                <View style={styles.heroIcon}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#8B5CF6" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Describe your legal issue clearly</Text>
                  <Text style={styles.heroText}>
                    Ask about family, land, labor, rights, contracts, or legal procedures.
                  </Text>
                </View>
              </View>
            </View>

            {documentId ? (
              <View style={styles.contextPill}>
                <Ionicons name="document-text-outline" size={16} color={theme.textSub} />
                <Text style={styles.contextText} numberOfLines={1}>
                  {settingsHint(category)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.listWrap}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: listBottomSpace },
              ]}
              onContentSizeChange={() => scrollToBottom(false)}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={28} color="#8B5CF6" />
                  </View>

                  <Text style={styles.emptyTitle}>Start your consultation</Text>
                  <Text style={styles.emptyText}>
                    Type your question below. Mufashe can help explain legal information in a simpler way.
                  </Text>

                  <View style={styles.suggestionRow}>
                    <View style={styles.suggestionChip}>
                      <Text style={styles.suggestionChipText}>Land dispute</Text>
                    </View>
                    <View style={styles.suggestionChip}>
                      <Text style={styles.suggestionChipText}>Labor rights</Text>
                    </View>
                    <View style={styles.suggestionChip}>
                      <Text style={styles.suggestionChipText}>Family law</Text>
                    </View>
                  </View>
                </View>
              }
            />
          </View>

          <View
            style={[styles.inputArea, { bottom: inputBottom }]}
            onLayout={handleComposerLayout}
          >
            <View style={styles.inputShell}>
              <View style={styles.inputTopRow}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="create-outline" size={18} color="#8B5CF6" />
                </View>

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
                  onFocus={() => setTimeout(() => scrollToBottom(true), 120)}
                  onSubmitEditing={() => {
                    if (Platform.OS !== "ios") send();
                  }}
                />
              </View>

              <View style={styles.inputFooter}>
                <Text style={styles.inputHint}>
                  {loading ? "Answer is loading..." : "Be specific for better answers"}
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
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.sendText}>Send</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

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
  const bg = theme?.bg ?? "#F8F6FC";
  const card = theme?.card ?? "#FFFFFF";
  const border = theme?.border ?? "#E7E5EF";
  const muted = theme?.muted ?? "#F3F1FA";
  const text = theme?.text ?? "#1F2937";
  const textSub = theme?.textSub ?? "#6B7280";
  const blue = theme?.primary ?? theme?.blue ?? "#8B5CF6";

  return {
    flex: {
      flex: 1,
    },

    safe: {
      flex: 1,
      backgroundColor: bg,
    },

    headerWrap: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
      backgroundColor: bg,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    topIconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    titleWrap: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 10,
    },

    title: {
      fontSize: 18 * s,
      fontWeight: "900",
      color: text,
      letterSpacing: -0.2,
    },

    titleSub: {
      marginTop: 2,
      fontSize: 11.5 * s,
      color: textSub,
      fontWeight: "600",
      textAlign: "center",
    },

    heroCard: {
      backgroundColor: card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: border,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      marginBottom: 10,
    },

    heroLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: "#F3E8FF",
      alignItems: "center",
      justifyContent: "center",
    },

    heroTitle: {
      fontSize: 14 * s,
      fontWeight: "900",
      color: text,
      marginBottom: 4,
    },

    heroText: {
      fontSize: 12 * s,
      lineHeight: 18,
      color: textSub,
      fontWeight: "600",
    },

    contextPill: {
      alignSelf: "flex-start",
      marginTop: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      maxWidth: "100%",
    },

    contextText: {
      color: textSub,
      fontWeight: "800",
      fontSize: 12 * s,
    },

    listWrap: {
      flex: 1,
    },

    listContent: {
      paddingHorizontal: 16,
      paddingTop: 10,
      flexGrow: 1,
    },

    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 36,
      paddingHorizontal: 20,
    },

    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: "#F3E8FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },

    emptyTitle: {
      fontSize: 18 * s,
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

    suggestionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginTop: 16,
    },

    suggestionChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
    },

    suggestionChipText: {
      color: blue,
      fontSize: 12 * s,
      fontWeight: "800",
    },

    msgRow: {
      flexDirection: "row",
      marginBottom: 14,
      alignItems: "flex-end",
    },

    msgRowUser: {
      justifyContent: "flex-end",
    },

    msgRowAi: {
      justifyContent: "flex-start",
    },

    aiAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#F3E8FF",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      marginBottom: 8,
    },

    bubble: {
      maxWidth: "86%",
      padding: 14,
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
      shadowColor: "#000",
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },

    assistantTop: {
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },

    assistantName: {
      fontSize: 12.5 * s,
      fontWeight: "900",
      color: text,
    },

    assistantHint: {
      fontSize: 10.5 * s,
      color: textSub,
      marginTop: 2,
      fontWeight: "700",
    },

    msgText: {
      lineHeight: 21,
    },

    userText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13.5 * s,
    },

    aiText: {
      color: text,
      fontWeight: "700",
      fontSize: 13.5 * s,
    },

    sourcesCard: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: muted,
      borderRadius: 16,
      padding: 10,
    },

    sourcesHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },

    sourcesIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },

    sourcesTitle: {
      fontWeight: "900",
      color: text,
      fontSize: 12.5 * s,
    },

    sourceItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      padding: 10,
      marginTop: 8,
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
    },

    sourceBadgeText: {
      color: "#7C3AED",
      fontWeight: "900",
      fontSize: 11 * s,
    },

    sourceText: {
      color: text,
      fontWeight: "800",
      fontSize: 11.5 * s,
      lineHeight: 16,
    },

    sourceMeta: {
      color: textSub,
      fontWeight: "700",
      fontSize: 10.5 * s,
      marginTop: 3,
    },

    inputArea: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: "transparent",
    },

    inputShell: {
      backgroundColor: card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: border,
      padding: 12,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },

    inputTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },

    inputIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: "#F3E8FF",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },

    input: {
      flex: 1,
      color: text,
      fontSize: 14 * s,
      fontWeight: "700",
      maxHeight: 110,
      minHeight: 42,
      paddingTop: 8,
      paddingBottom: 8,
    },

    inputFooter: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    inputHint: {
      color: textSub,
      fontSize: 11 * s,
      fontWeight: "700",
    },

    sendBtn: {
      minWidth: 88,
      height: 44,
      borderRadius: 14,
      backgroundColor: blue,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 14,
    },

    sendBtnDisabled: {
      opacity: 0.5,
    },

    sendText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 13 * s,
    },
  };
}