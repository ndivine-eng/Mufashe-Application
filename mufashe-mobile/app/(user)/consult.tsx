import React, { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

function buildApiUrl(path: string) {
  const base = String(BASE_URL || "").replace(/\/$/, "");
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; sources?: any[] };

export default function Consult() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;

    setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Missing token. Please login again.");

      const url = buildApiUrl("/qa/ask");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ question: q, topK: 6 }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), role: "assistant", text: data?.answer || "No answer.", sources: data?.sources || [] },
      ]);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 2), role: "assistant", text: `Error: ${e?.message || "Unknown error"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 18, fontWeight: "900", marginBottom: 10 }}>Consult</Text>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 12 }}
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            return (
              <View style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "92%", marginBottom: 10 }}>
                <View style={{ padding: 12, borderRadius: 14, backgroundColor: isUser ? "#111827" : "#E5E7EB" }}>
                  <Text style={{ color: isUser ? "#fff" : "#111827", lineHeight: 20 }}>{item.text}</Text>

                  {"sources" in item && item.sources?.length ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontWeight: "900" }}>Sources:</Text>
                      {item.sources.slice(0, 6).map((s: any) => (
                        <Text key={String(s.n)} style={{ marginTop: 4 }}>
                          [{s.n}] {s.title} {s.pageStart != null ? `(p.${s.pageStart}-${s.pageEnd ?? s.pageStart})` : ""}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question about your uploaded laws…"
            style={{ flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!canSend}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: canSend ? "#0F3D63" : "#9CA3AF" }}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Send</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}