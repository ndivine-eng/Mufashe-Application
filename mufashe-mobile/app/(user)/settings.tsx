// app/(user)/settings.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ScrollView,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BottomNav from "../../components/BottomNav";
import { FontSize, Language, useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

const BOTTOM_NAV_SPACE = 92;
const RECENT_CACHE_KEY = "@mufashe_recent_questions_cache_v1";

export default function SettingsScreen() {
  const { loading, settings, theme, scale, updateSettings, resetSettings } = useAppSettings();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [fontModalOpen, setFontModalOpen] = useState(false);

  const pickFontSize = (size: FontSize) => {
    updateSettings({ fontSize: size });
    setFontModalOpen(false);
  };

  const pickLanguage = (lang: Language) => {
    updateSettings({ language: lang });
  };

  const onExportData = async () => {
    try {
      const payload = { exportedAt: new Date().toISOString(), settings };
      const json = JSON.stringify(payload, null, 2);
      Alert.alert(t("exportReadyTitle"), t("exportReadyMsg", { n: String(json.length) }));
    } catch {
      Alert.alert(t("exportFailedTitle"), t("exportFailedMsg"));
    }
  };

  const onClearLocalCache = async () => {
    Alert.alert(t("clearCacheTitle"), t("clearCacheMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("clear"),
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(RECENT_CACHE_KEY);
            Alert.alert(t("doneTitle"), t("cacheClearedMsg"));
          } catch {
            Alert.alert(t("errorTitle"), t("clearCacheFailedMsg"));
          }
        },
      },
    ]);
  };

  const onReset = () => {
    Alert.alert(t("resetTitle"), t("resetMsg"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("reset"), style: "destructive", onPress: resetSettings },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.textSub, fontWeight: "800" }}>{t("loadingSettings")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <Text style={styles.topTitle}>{t("settings")}</Text>

          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: BOTTOM_NAV_SPACE }]}
          showsVerticalScrollIndicator={false}
        >
          {/* APPEARANCE */}
          <Text style={styles.sectionLabel}>{t("appearance")}</Text>
          <View style={styles.card}>
            <RowToggle
              icon="moon-outline"
              title={t("darkMode")}
              subtitle={t("darkModeSub")}
              value={settings.themeMode === "dark"}
              onChange={(v) => updateSettings({ themeMode: v ? "dark" : "light" })}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />

            <RowRightText
              icon="text-outline"
              title={t("fontSize")}
              subtitle={t("fontSizeSub")}
              rightText={settings.fontSize}
              onPress={() => setFontModalOpen(true)}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />

            <RowToggle
              icon="contrast-outline"
              title={t("highContrast")}
              subtitle={t("highContrastSub")}
              value={settings.highContrast}
              onChange={(v) => updateSettings({ highContrast: v })}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* LANGUAGE */}
          <Text style={styles.sectionLabel}>{t("language")}</Text>
          <View style={styles.card}>
            <RowPills
              icon="language-outline"
              title={t("appLanguage")}
              subtitle={t("appLanguageSub")}
              options={["English", "Kinyarwanda"]}
              value={settings.language}
              onPick={(v) => pickLanguage(v as Language)}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* NOTIFICATIONS */}
          <Text style={styles.sectionLabel}>{t("notifications")}</Text>
          <View style={styles.card}>
            <RowToggle
              icon="notifications-outline"
              title={t("pushNotifications")}
              subtitle={t("pushNotificationsSub")}
              value={settings.pushNotifications}
              onChange={(v) => updateSettings({ pushNotifications: v })}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowToggle
              icon="mail-outline"
              title={t("emailUpdates")}
              subtitle={t("emailUpdatesSub")}
              value={settings.emailUpdates}
              onChange={(v) => updateSettings({ emailUpdates: v })}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* PRIVACY & DATA */}
          <Text style={styles.sectionLabel}>{t("privacyData")}</Text>
          <View style={styles.card}>
            <RowNav
              icon="download-outline"
              title={t("exportSettings")}
              subtitle={t("exportSettingsSub")}
              onPress={onExportData}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowNav
              icon="trash-outline"
              title={t("clearLocalCache")}
              subtitle={t("clearLocalCacheSub")}
              danger
              onPress={onClearLocalCache}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* ABOUT */}
          <Text style={styles.sectionLabel}>{t("about")}</Text>
          <View style={styles.card}>
            <RowNav
              icon="document-text-outline"
              title={t("terms")}
              subtitle={t("termsSub")}
              onPress={() => Alert.alert(t("comingSoonTitle"), t("termsSoonMsg"))}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowNav
              icon="shield-checkmark-outline"
              title={t("privacyPolicy")}
              subtitle={t("privacyPolicySub")}
              onPress={() => Alert.alert(t("comingSoonTitle"), t("privacySoonMsg"))}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* ADVANCED */}
          <Text style={styles.sectionLabel}>{t("advanced")}</Text>
          <View style={styles.card}>
            <RowNav
              icon="refresh-outline"
              title={t("resetSettings")}
              subtitle={t("resetSettingsSub")}
              danger
              onPress={onReset}
              theme={theme}
              styles={styles}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerTitle}>Mufashe Legal Awareness</Text>
            <Text style={styles.footerSub}>Version 1.0</Text>
          </View>
        </ScrollView>

        <BottomNav />
      </View>

      {/* Font size modal */}
      <Modal visible={fontModalOpen} transparent animationType="fade" onRequestClose={() => setFontModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFontModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("chooseFontSize")}</Text>

            <Option label="Small" active={settings.fontSize === "Small"} onPress={() => pickFontSize("Small")} styles={styles} theme={theme} />
            <Option label="Default" active={settings.fontSize === "Default"} onPress={() => pickFontSize("Default")} styles={styles} theme={theme} />
            <Option label="Large" active={settings.fontSize === "Large"} onPress={() => pickFontSize("Large")} styles={styles} theme={theme} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* Components */

function Divider({ styles }: { styles: any }) {
  return <View style={styles.divider} />;
}

function RowToggle({
  icon,
  title,
  subtitle,
  value,
  onChange,
  styles,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  styles: any;
  theme: any;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={theme.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
        thumbColor={theme.switchThumb}
      />
    </View>
  );
}

function RowNav({
  icon,
  title,
  subtitle,
  danger,
  onPress,
  styles,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  danger?: boolean;
  onPress: () => void;
  styles: any;
  theme: any;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
          <Ionicons name={icon} size={18} color={danger ? theme.danger : theme.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, danger && styles.dangerText]}>{title}</Text>
          {!!subtitle && <Text style={[styles.rowSub, danger && styles.dangerSub]}>{subtitle}</Text>}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.chevron} />
    </TouchableOpacity>
  );
}

function RowRightText({
  icon,
  title,
  subtitle,
  rightText,
  onPress,
  styles,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  rightText: string;
  onPress: () => void;
  styles: any;
  theme: any;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={theme.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
      </View>

      <View style={styles.rightWrap}>
        <Text style={styles.rightText}>{rightText}</Text>
        <Ionicons name="chevron-forward" size={18} color={theme.chevron} />
      </View>
    </TouchableOpacity>
  );
}

function RowPills({
  icon,
  title,
  subtitle,
  options,
  value,
  onPick,
  styles,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  options: string[];
  value: string;
  onPick: (v: string) => void;
  styles: any;
  theme: any;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={theme.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}

          <View style={styles.pillsRow}>
            {options.map((opt) => {
              const active = opt === value;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => onPick(opt)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function Option({
  label,
  active,
  onPress,
  styles,
  theme,
}: {
  label: FontSize;
  active: boolean;
  onPress: () => void;
  styles: any;
  theme: any;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.optionRow, active && styles.optionRowActive]}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
      {active ? <Ionicons name="checkmark" size={18} color={theme.blue} /> : <View style={{ width: 18 }} />}
    </TouchableOpacity>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    safe: { flex: 1, backgroundColor: theme.bg },
    screen: { flex: 1, backgroundColor: theme.bg },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.topBorder,
      backgroundColor: theme.bg,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: { fontSize: 14 * s, fontWeight: "900", color: theme.text },

    container: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },

    sectionLabel: {
      marginTop: 12,
      marginBottom: 10,
      fontSize: 11 * s,
      color: theme.textSub,
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.card,
      overflow: "hidden",
    },

    row: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 10 },

    iconBox: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBoxDanger: { backgroundColor: theme.dangerBg },

    rowTitle: { fontSize: 13 * s, fontWeight: "900", color: theme.text },
    rowSub: { marginTop: 3, fontSize: 11.2 * s, color: theme.textSub, fontWeight: "700" },

    divider: { height: 1, backgroundColor: theme.divider },

    rightWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
    rightText: { fontSize: 12 * s, color: theme.textSub, fontWeight: "800" },

    pillsRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
    pill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    pillActive: {
      borderColor: theme.blue,
      backgroundColor: theme.muted, // ✅ safe (no theme.chipBg dependency)
    },
    pillText: { fontSize: 11 * s, fontWeight: "800", color: theme.textSub },
    pillTextActive: { color: theme.blue },

    dangerText: { color: theme.danger },
    dangerSub: { color: theme.danger },

    footer: { alignItems: "center", marginTop: 18, marginBottom: 6 },
    footerTitle: { fontSize: 12 * s, fontWeight: "800", color: theme.textSub },
    footerSub: { fontSize: 11 * s, fontWeight: "700", color: theme.chevron, marginTop: 4 },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      padding: 18,
    },
    modalCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    modalTitle: {
      fontSize: 14 * s,
      fontWeight: "900",
      color: theme.text,
      marginBottom: 10,
    },
    optionRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    optionRowActive: { backgroundColor: theme.muted },
    optionText: { fontSize: 13 * s, fontWeight: "800", color: theme.text },
    optionTextActive: { color: theme.blue },
  };
}