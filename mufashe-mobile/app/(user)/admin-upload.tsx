// app/(user)/admin-upload.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
const CATEGORIES = ["FAMILY", "LAND", "LABOR", "BUSINESS"] as const;

type PickedFile = { uri: string; name: string };

function buildApiUrl(path: string) {
  const base = String(BASE_URL || "").replace(/\/$/, "");
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

function normalizePickedName(name?: string) {
  const n = (name || "document.pdf").trim();
  return n.toLowerCase().endsWith(".pdf") ? n : `${n}.pdf`;
}

export default function AdminUpload() {
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("LABOR");
  const [picked, setPicked] = useState<PickedFile | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(
    () => title.trim().length >= 3 && !!picked && !loading,
    [title, picked, loading]
  );

  const pickPdf = useCallback(async () => {
    setError("");
    setSuccessMsg("");

    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled) return;

    const file = res.assets?.[0];
    if (!file?.uri) return;

    const name = normalizePickedName(file.name);

    setPicked({ uri: file.uri, name });

    if (!title.trim() && file.name) {
      setTitle(
        file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim()
      );
    }
  }, [title]);

  const upload = useCallback(async () => {
    if (!canSubmit || !picked) return;

    try {
      setLoading(true);
      setError("");
      setSuccessMsg("");

      const token = await AsyncStorage.getItem("token");
      const rawUser = await AsyncStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : null;

      if (!token || !user) {
        router.replace("/(auth)/login");
        return;
      }

      const url = buildApiUrl("/documents/upload");
      console.log("BASE_URL =", BASE_URL);
      console.log("UPLOAD URL =", url);

      // ---------- WEB ----------
      if (Platform.OS === "web") {
        const resp = await fetch(picked.uri);
        const blob = await resp.blob();

        const form = new FormData();
        form.append("file", blob, picked.name);
        form.append("title", title.trim());
        form.append("category", category);

        const r = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        const data = await r.json().catch(() => ({}));
        console.log("UPLOAD RESPONSE (WEB):", data);

        if (!r.ok) throw new Error(data?.message || `Upload failed (${r.status})`);

        setSuccessMsg("Uploaded successfully ✅");
        Alert.alert("Success", "PDF uploaded successfully.");
        setTitle("");
        setCategory("LABOR");
        setPicked(null);

        setTimeout(() => router.replace("/(user)/admin-dashboard"), 400);
        return;
      }

      // ---------- NATIVE (Expo Go safe) ----------
      // 1) Ensure we have a readable file:// uri (Android can give content://)
      let fileUri = picked.uri;

      if (fileUri.startsWith("content://")) {
        const dest = (FileSystem.cacheDirectory || "") + picked.name;
        await FileSystem.copyAsync({ from: fileUri, to: dest });
        fileUri = dest;
      }

      // 2) Use fetch + FormData (MOST stable across Expo Go versions)
      const form = new FormData();
      form.append("title", title.trim());
      form.append("category", category);

      form.append(
        "file",
        {
          uri: fileUri,
          name: picked.name,
          type: "application/pdf",
        } as any
      );

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          // ⚠️ Do NOT set Content-Type manually for FormData in React Native
        },
        body: form,
      });

      const data = await r.json().catch(() => ({}));
      console.log("UPLOAD RESPONSE (NATIVE):", data);

      if (!r.ok) throw new Error(data?.message || `Upload failed (${r.status})`);

      setSuccessMsg("Uploaded successfully ✅");
      Alert.alert("Success", "PDF uploaded successfully.");

      setTitle("");
      setCategory("LABOR");
      setPicked(null);

      setTimeout(() => router.replace("/(user)/admin-dashboard"), 400);
    } catch (e: any) {
      console.log("UPLOAD ERROR:", e);
      setError(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, picked, title, category]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Upload Document</Text>

        <Text style={styles.label}>TITLE</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter document title"
          style={styles.input}
          autoCapitalize="sentences"
        />

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.pill, category === c && styles.activePill]}
              activeOpacity={0.9}
            >
              <Text style={[styles.pillText, category === c && styles.activeText]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>PDF FILE</Text>
        <TouchableOpacity style={styles.fileBox} onPress={pickPdf} activeOpacity={0.9}>
          <Text style={{ fontWeight: "700", color: picked ? "#111827" : "#6B7280" }}>
            {picked?.name || "Choose PDF"}
          </Text>
          <Text style={{ marginTop: 4, color: "#6B7280", fontSize: 12 }}>
            Tip: try a small PDF first (under 1–2MB) while testing.
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !canSubmit && { opacity: 0.5 }]}
          disabled={!canSubmit}
          onPress={upload}
          activeOpacity={0.9}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Upload</Text>}
        </TouchableOpacity>

        <Text style={styles.note}>
          Using API: {BASE_URL}
          {"\n"}Endpoint: /documents/upload (field name: file)
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20 },
  header: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  label: { marginTop: 12, fontWeight: "bold", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  row: { flexDirection: "row", marginTop: 8, gap: 8, flexWrap: "wrap" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
  },
  activePill: {
    backgroundColor: "#0F3D63",
    borderColor: "#0F3D63",
  },
  pillText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  activeText: { color: "#fff" },
  fileBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  button: {
    backgroundColor: "#0F3D63",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  error: { color: "red", marginTop: 10, fontWeight: "700" },
  success: { marginTop: 10, color: "#059669", fontWeight: "800" },
  note: { fontSize: 12, marginTop: 14, color: "#6B7280" },
});