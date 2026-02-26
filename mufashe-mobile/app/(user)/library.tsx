import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../../components/BottomNav";

type Guide = {
  id: string;
  title: string;
  desc: string;
  tag: string;
  tagColor: string;
  minutes: string;
  category: "land" | "employment" | "family" | "commercial";
  icon: keyof typeof Ionicons.glyphMap;
};

const GUIDES: Guide[] = [
  {
    id: "g1",
    title: "Land dispute",
    desc: "Mediation, titles, and key steps.",
    tag: "LAND",
    tagColor: "#2563EB",
    minutes: "5 min",
    category: "land",
    icon: "home-outline",
  },
  {
    id: "g2",
    title: "Employment contract",
    desc: "Working hours, leave, termination.",
    tag: "LABOR",
    tagColor: "#16A34A",
    minutes: "8 min",
    category: "employment",
    icon: "briefcase-outline",
  },
  {
    id: "g3",
    title: "Register a business",
    desc: "RDB steps and required documents.",
    tag: "BUSINESS",
    tagColor: "#F97316",
    minutes: "6 min",
    category: "commercial",
    icon: "receipt-outline",
  },
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "land", label: "Land" },
  { key: "employment", label: "Work" },
  { key: "family", label: "Family" },
];

export default function LibraryScreen() {
  const params = useLocalSearchParams();
  const preset = typeof params?.category === "string" ? params.category : "all";

  const [lang, setLang] = useState<"English" | "Kinyarwanda">("English");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>(preset);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return GUIDES.filter((g) => {
      const matchesFilter = filter === "all" ? true : g.category === (filter as any);
      const matchesQuery =
        query.length === 0 ? true : `${g.title} ${g.desc} ${g.tag}`.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [q, filter]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={18} color="#111827" />
            </TouchableOpacity>

            <Text style={styles.title}>Library</Text>

            <TouchableOpacity onPress={() => alert("Saved (later)")} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="bookmark-outline" size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Language segmented */}
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segItem, lang === "English" && styles.segActive]}
              onPress={() => setLang("English")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, lang === "English" && styles.segTextActive]}>
                English
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segItem, lang === "Kinyarwanda" && styles.segActive]}
              onPress={() => setLang("Kinyarwanda")}
              activeOpacity={0.9}
            >
              <Text style={[styles.segText, lang === "Kinyarwanda" && styles.segTextActive]}>
                Kinyarwanda
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search…"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
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
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Guides</Text>
            <Text style={styles.sectionSub}>{filtered.length} items</Text>
          </View>

          {/* Guide cards */}
          <View style={{ marginTop: 10, gap: 12 }}>
            {filtered.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.guideCard}
                activeOpacity={0.9}
                onPress={() => alert(`Open guide: ${g.title} (later)`)}
              >
                <View style={[styles.guideIcon, { backgroundColor: `${g.tagColor}12` }]}>
                  <Ionicons name={g.icon} size={20} color={g.tagColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.guideTitle}>{g.title}</Text>
                  <Text style={styles.guideDesc}>{g.desc}</Text>

                  <View style={styles.metaRow}>
                    <View style={[styles.tag, { backgroundColor: `${g.tagColor}18` }]}>
                      <Text style={[styles.tagText, { color: g.tagColor }]}>{g.tag}</Text>
                    </View>
                    <Text style={styles.minutes}>{g.minutes}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>

        
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "900", color: "#111827" },

  segment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  segActive: { backgroundColor: "#ffffff" },
  segText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  segTextActive: { color: "#2563EB" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#111827" },

  pillsRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 14 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  pillActive: { backgroundColor: "#2563EB" },
  pillText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  pillTextActive: { color: "#ffffff" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  sectionSub: { fontSize: 11, color: "#9CA3AF", fontWeight: "800" },

  guideCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#ffffff",
  },
  guideIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  guideTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  guideDesc: { fontSize: 11.5, color: "#6B7280", marginTop: 4, lineHeight: 16 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: "900" },
  minutes: { fontSize: 10.5, color: "#9CA3AF", fontWeight: "800" },
});
