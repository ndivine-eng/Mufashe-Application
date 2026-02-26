import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
};

const initialMessages: Msg[] = [
  {
    id: "u1",
    role: "user",
    text: "How do I register a small business in Rwanda?",
    time: "10:42 AM",
  },
  {
    id: "a1",
    role: "assistant",
    text:
      "In Rwanda, business registration is managed by the Rwanda Development Board (RDB). It's a fast process designed to support entrepreneurs.\n\n" +
      "ACTIONABLE STEPS:\n" +
      "1. Choose a unique business name.\n" +
      "2. Prepare your National ID (for Rwandans) or Passport (for foreigners).\n" +
      "3. Visit the RDB online portal (org.rdb.rw) or go to their head office in Kigali.\n" +
      "4. Fill out the digital application form.\n\n" +
      "Registration is free of charge and typically takes about 6 hours to complete (depending on the application).",
  },
];

export default function ConsultScreen() {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");

  const listRef = useRef<FlatList<Msg>>(null);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const newMsg: Msg = {
      id: `u_${Date.now()}`,
      role: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    // Fake assistant reply (MVP UI only). Replace later with backend call.
    setTimeout(() => {
      const assistantMsg: Msg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        text:
          "Thanks — I can help. For the MVP, this is a placeholder response. Next, we will connect this chat to your backend and legal document search.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      listRef.current?.scrollToEnd({ animated: true });
    }, 600);

    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {/* left avatar for AI */}
        {!isUser ? (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>⚖️</Text>
          </View>
        ) : null} 

        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {isUser && item.time ? (
            <Text style={styles.timeRight}>You • {item.time}</Text>
          ) : null}

          {!isUser ? <Text style={styles.aiName}>Mufashe AI • Now</Text> : null}

          <Text style={[styles.msgText, isUser ? styles.userText : styles.aiText]}>{item.text}</Text>
        </View>

        {/* right avatar for user */}
        {isUser ? (
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>👤</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topIconBtn}>
            <Text style={styles.topIconText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>Mufashe AI</Text>
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.statusText}>LEGAL EXPERT ACTIVE</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => alert("Info (later)")} style={styles.topIconBtn}>
            <Text style={styles.topIconText}>i</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Composer */}
        <View style={styles.composerWrap}>
          <View style={styles.attachBtn}>
            <Text style={styles.attachIcon}>📎</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Type your legal question..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendDisabled]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.9}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          Mufashe AI provides information, not professional legal advice.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    backgroundColor: "#ffffff",
  },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  topIconText: { fontSize: 16, fontWeight: "900", color: "#111827" },

  topCenter: { alignItems: "center" },
  topTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#16A34A" },
  statusText: { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 0.8 },

  list: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 10 },

  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAI: { justifyContent: "flex-start" },

  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFEFEF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  aiAvatarText: { fontSize: 12 },

  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  userAvatarText: { fontSize: 12 },

  bubble: {
    maxWidth: "76%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: "#1677FF",
    borderColor: "#1677FF",
    borderTopRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    borderTopLeftRadius: 6,
  },

  timeRight: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "800", marginBottom: 6 },
  aiName: { color: "#64748B", fontSize: 10, fontWeight: "900", marginBottom: 6 },

  msgText: { fontSize: 13, lineHeight: 18 },
  userText: { color: "#ffffff", fontWeight: "700" },
  aiText: { color: "#111827", fontWeight: "600" },

  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: "#ffffff",
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  attachIcon: { fontSize: 14 },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#1677FF",
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
  sendIcon: { color: "#ffffff", fontWeight: "900", fontSize: 16 },

  footerNote: {
    textAlign: "center",
    paddingBottom: 10,
    paddingTop: 4,
    color: "#9CA3AF",
    fontSize: 10.5,
    fontWeight: "700",
  },
});
