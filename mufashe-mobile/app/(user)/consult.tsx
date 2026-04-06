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
  pageStart?: number | null;
  pageEnd?: number | null;
  snippet?: string;
  documentId?: string;
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

const SUGGESTIONS = [
  "I bought a phone and later learned it was stolen. What can I do?",
  "My employer dismissed me without notice. What are my rights?",
  "Someone borrowed money and refuses to pay me back. What steps can I take?",
  "What can I do if my landlord wants to evict me without notice in Rwanda?",
];

function sectionizeAnswer(text: string) {
  const raw = String(text || "").trim();

  const titles = [
    "Summary:",
    "What this may mean for you:",
    "What you can do next:",
    "What to prepare:",
    "Urgent note:",
    "Sources used:",
  ];

  const sections: { title: string; body: string }[] = [];

  for (let i = 0; i < titles.length; i++) {
    const start = raw.indexOf(titles[i]);
    if (start === -1) continue;

    let end = raw.length;
    for (let j = i + 1; j < titles.length; j++) {
      const next = raw.indexOf(titles[j], start + titles[i].length);
      if (next !== -1) {
        end = next;
        break;
      }
    }

    const chunk = raw.slice(start, end).trim();
    const [head, ...rest] = chunk.split("\n");
    sections.push({
      title: head.replace(":", "").trim(),
      body: rest.join("\n").trim(),
    });
  }

  if (!sections.length) {
    return [{ title: "Guidance", body: raw }];
  }

  return sections;
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

  const openSourceInLibrary = useCallback((source: Source) => {
    if (!source?.documentId) {
      Alert.alert("Source not available", "This source is missing its document reference.");
      return;
    }

    router.push({
      pathname: "/(user)/library",
      params: {
        documentId: String(source.documentId),
        title: source.title || "Document",
        from: "consult",
      },
    });
  }, []);

  const send = useCallback(
    async (prefilled?: string) => {
      const q = String(prefilled ?? input).trim();
      if (!q || loading) return;

      const userMsg: Msg = { id: String(Date.now()), role: "user", text: q };
      const tempId = `temp-${Date.now()}`;
      const pendingMsg: Msg = {
        id: tempId,
        role: "assistant",
        text: "MUFASHE is reviewing legal sources and preparing guidance...",
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
            topK: 4,
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
                  text:
                    `Guidance could not be loaded right now.\n\n` +
                    `What you can do next:\n` +
                    `- Check your internet connection.\n` +
                    `- Make sure the server is running.\n` +
                    `- Try asking again in a moment.\n\n` +
                    `Technical message: ${msg}`,
                }
              : m
          )
        );

        setTimeout(() => scrollToBottom(true), 160);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, documentId, category, scrollToBottom]
  );

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
            <Text style={styles.titleSub}>Legal guidance in simple language</Text>
          </View>

          <TouchableOpacity onPress={clearChat} style={styles.topIconBtn} activeOpacity={0.9}>
            <Ionicons name="trash-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBanner}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#7C3AED" />
          </View>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>Guidance based on legal sources</Text>
            <Text style={styles.infoText}>
              MUFASHE explains uploaded legal information in a clearer way and shows the sources used.
            </Text>
          </View>
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

              <Text style={styles.emptyTitle}>Ask your legal question with confidence</Text>
              <Text style={styles.emptyText}>
                You will get simple legal guidance, practical next steps, and legal sources used for the answer.
              </Text>

              <View style={styles.suggestionWrap}>
                {SUGGESTIONS.map((item, idx) => (
                  <TouchableOpacity
                    key={`${item}-${idx}`}
                    style={styles.suggestionChip}
                    activeOpacity={0.9}
                    onPress={() => send(item)}
                  >
                    <Ionicons name="sparkles-outline" size={14} color="#7C3AED" />
                    <Text style={styles.suggestionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
                        <Ionicons name="shield-checkmark-outline" size={16} color="#8B5CF6" />
                      )}
                    </View>
                  )}

                  <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                    {!isUser && (
                      <View style={styles.assistantTop}>
                        <Text style={styles.assistantName}>MUFASHE Guidance</Text>
                        <Text style={styles.assistantSub}>
                          Clear explanation • practical next steps • source-based
                        </Text>
                      </View>
                    )}

                    {isUser ? (
                      <Text style={[styles.msgText, styles.userText]}>{item.text}</Text>
                    ) : item.pending ? (
                      <Text style={[styles.msgText, styles.aiText]}>{item.text}</Text>
                    ) : (
                      <View>
                        {sectionizeAnswer(item.text).map((section, idx) => (
                          <View
                            key={`${section.title}-${idx}`}
                            style={[
                              styles.answerSection,
                              idx === 0 ? null : styles.answerSectionSpacing,
                            ]}
                          >
                            <Text style={styles.answerSectionTitle}>{section.title}</Text>
                            <Text style={[styles.msgText, styles.aiText]}>{section.body}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {"sources" in item && item.sources?.length ? (
                      <View style={styles.sourcesCard}>
                        <Text style={styles.sourcesTitle}>Legal sources used</Text>

                        {item.sources.slice(0, 4).map((s, idx) => {
                          const clickable = !!s.documentId;

                          return (
                            <TouchableOpacity
                              key={`${String(s.n ?? idx)}-${idx}`}
                              style={[
                                styles.sourceItem,
                                clickable && styles.sourceItemClickable,
                              ]}
                              activeOpacity={clickable ? 0.85 : 1}
                              disabled={!clickable}
                              onPress={() => openSourceInLibrary(s)}
                            >
                              <View style={styles.sourceBadge}>
                                <Text style={styles.sourceBadgeText}>{s.n ?? idx + 1}</Text>
                              </View>

                              <View style={styles.sourceTextWrap}>
                                <View style={styles.sourceHeaderRow}>
                                  <Text style={styles.sourceText}>{s.title || "Document"}</Text>
                                  {clickable ? (
                                    <View style={styles.openTag}>
                                      <Ionicons
                                        name="open-outline"
                                        size={11}
                                        color="#7C3AED"
                                      />
                                      <Text style={styles.openTagText}>Open</Text>
                                    </View>
                                  ) : null}
                                </View>

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

                                {clickable ? (
                                  <Text style={styles.sourceHint}>
                                    Tap to read this source in Library
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
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
                placeholder="Describe your legal issue clearly..."
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
                {loading
                  ? "Preparing grounded legal guidance..."
                  : "Include useful details like agreement, receipt, date, money, landlord, employer, police, or witness"}
              </Text>

              <TouchableOpacity
                onPress={() => send()}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#fff" />
                    <Text style={styles.sendText}>Ask</Text>
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

    infoBanner: {
      marginHorizontal: 14,
      marginBottom: 10,
      backgroundColor: "#F6F0FF",
      borderWidth: 1,
      borderColor: "#E9D5FF",
      borderRadius: 16,
      padding: 12,
      flexDirection: "row",
      alignItems: "flex-start",
    },

    infoIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    infoTextWrap: {
      flex: 1,
    },

    infoTitle: {
      color: text,
      fontWeight: "900",
      fontSize: 12.5 * s,
      marginBottom: 2,
    },

    infoText: {
      color: textSub,
      fontWeight: "600",
      fontSize: 11 * s,
      lineHeight: 18,
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
      paddingTop: 54,
      paddingHorizontal: 18,
    },

    emptyIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
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
      lineHeight: 21,
      fontWeight: "600",
      maxWidth: 320,
    },

    suggestionWrap: {
      width: "100%",
      marginTop: 18,
    },

    suggestionChip: {
      width: "100%",
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "flex-start",
    },

    suggestionText: {
      flex: 1,
      marginLeft: 8,
      color: text,
      fontWeight: "700",
      fontSize: 12 * s,
      lineHeight: 18,
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
      marginBottom: 10,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },

    assistantName: {
      fontSize: 12 * s,
      fontWeight: "900",
      color: text,
    },

    assistantSub: {
      marginTop: 2,
      fontSize: 10.5 * s,
      fontWeight: "700",
      color: textSub,
    },

    answerSection: {},

    answerSectionSpacing: {
      marginTop: 12,
    },

    answerSectionTitle: {
      color: blue,
      fontWeight: "900",
      fontSize: 12 * s,
      marginBottom: 4,
    },

    msgText: {
      lineHeight: 23,
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
      marginTop: 14,
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

    sourceItemClickable: {
      borderWidth: 1,
      borderColor: "#E9D5FF",
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

    sourceHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },

    sourceText: {
      flex: 1,
      color: text,
      fontWeight: "800",
      fontSize: 11 * s,
      lineHeight: 16,
    },

    openTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F5F3FF",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginLeft: 8,
    },

    openTagText: {
      color: "#7C3AED",
      fontWeight: "800",
      fontSize: 9.5 * s,
      marginLeft: 4,
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

    sourceHint: {
      marginTop: 6,
      color: blue,
      fontWeight: "800",
      fontSize: 10 * s,
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
      maxHeight: 120,
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
      lineHeight: 16,
    },

    sendBtn: {
      minWidth: 84,
      height: 40,
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