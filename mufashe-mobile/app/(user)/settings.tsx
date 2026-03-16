// app/(user)/settings.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

  const ACCENT = theme?.primary || theme?.blue || "#8B5CF6";

  const [fontModalOpen, setFontModalOpen] = useState(false);

  const isDark = settings.themeMode === "dark";
  const themeActionTitle = isDark ? "Switch to light mode" : "Switch to dark mode";
  const themeActionSub = isDark
    ? "Use a brighter appearance for better daytime visibility."
    : "Enjoy a calmer look that is easier on the eyes at night.";
  const themeActionIcon = isDark ? "sunny-outline" : "moon-outline";

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
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>{t("loadingSettings")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: BOTTOM_NAV_SPACE }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.topTitle}>{t("settings")}</Text>

            <View style={styles.iconBtnGhost} />
          </View>

          {/* Hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="settings-outline" size={28} color={ACCENT} />
            </View>

            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>{t("settings")}</Text>
              <Text style={styles.heroSub}>
                Manage appearance, language, notifications, privacy, and app preferences.
              </Text>
            </View>
          </View>

          {/* Quick controls */}
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickCard, styles.quickPrimary]}
              activeOpacity={0.92}
              onPress={() =>
                updateSettings({
                  themeMode: isDark ? "light" : "dark",
                })
              }
            >
              <Ionicons name={themeActionIcon as any} size={24} color="#fff" />
              <Text style={styles.quickPrimaryTitle}>{themeActionTitle}</Text>
              <Text style={styles.quickPrimarySub}>{themeActionSub}</Text>
            </TouchableOpacity>

            <View style={styles.quickColumn}>
              <TouchableOpacity
                style={styles.quickMiniCard}
                activeOpacity={0.92}
                onPress={() => setFontModalOpen(true)}
              >
                <Ionicons name="text-outline" size={20} color={ACCENT} />
                <Text style={styles.quickMiniTitle}>{t("fontSize")}</Text>
                <Text style={styles.quickMiniSub}>{settings.fontSize}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickMiniCard} activeOpacity={0.92} onPress={onExportData}>
                <Ionicons name="download-outline" size={20} color={ACCENT} />
                <Text style={styles.quickMiniTitle}>{t("exportSettings")}</Text>
                <Text style={styles.quickMiniSub}>Backup preferences</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Appearance */}
          <SectionTitle title={t("appearance")} styles={styles} />
          <View style={styles.card}>
            <RowToggle
              icon={themeActionIcon as any}
              title={themeActionTitle}
              subtitle={themeActionSub}
              value={isDark}
              onChange={(v) => updateSettings({ themeMode: v ? "dark" : "light" })}
              styles={styles}
              theme={theme}
            />
            <Divider styles={styles} />
            <RowRightText
              icon="text-outline"
              title={t("fontSize")}
              subtitle={t("fontSizeSub")}
              rightText={settings.fontSize}
              onPress={() => setFontModalOpen(true)}
              styles={styles}
              theme={theme}
            />
            <Divider styles={styles} />
            <RowToggle
              icon="contrast-outline"
              title={t("highContrast")}
              subtitle={t("highContrastSub")}
              value={settings.highContrast}
              onChange={(v) => updateSettings({ highContrast: v })}
              styles={styles}
              theme={theme}
            />
          </View>

          {/* Language */}
          <SectionTitle title={t("language")} styles={styles} />
          <View style={styles.card}>
            <RowPills
              icon="language-outline"
              title={t("appLanguage")}
              subtitle={t("appLanguageSub")}
              options={["English", "Kinyarwanda"]}
              value={settings.language}
              onPick={(v) => pickLanguage(v as Language)}
              styles={styles}
              theme={theme}
            />
          </View>

          {/* Notifications */}
          <SectionTitle title={t("notifications")} styles={styles} />
          <View style={styles.card}>
            <RowToggle
              icon="notifications-outline"
              title={t("pushNotifications")}
              subtitle={t("pushNotificationsSub")}
              value={settings.pushNotifications}
              onChange={(v) => updateSettings({ pushNotifications: v })}
              styles={styles}
              theme={theme}
            />
            <Divider styles={styles} />
            <RowToggle
              icon="mail-outline"
              title={t("emailUpdates")}
              subtitle={t("emailUpdatesSub")}
              value={settings.emailUpdates}
              onChange={(v) => updateSettings({ emailUpdates: v })}
              styles={styles}
              theme={theme}
            />
          </View>

          {/* Privacy & data */}
          <SectionTitle title={t("privacyData")} styles={styles} />
          <View style={styles.card}>
            <RowNav
              icon="download-outline"
              title={t("exportSettings")}
              subtitle={t("exportSettingsSub")}
              onPress={onExportData}
              styles={styles}
              theme={theme}
            />
            <Divider styles={styles} />
            <RowNav
              icon="trash-outline"
              title={t("clearLocalCache")}
              subtitle={t("clearLocalCacheSub")}
              danger
              onPress={onClearLocalCache}
              styles={styles}
              theme={theme}
            />
          </View>

          {/* About */}
          <SectionTitle title={t("about")} styles={styles} />
          <View style={styles.card}>
            <RowNav
              icon="document-text-outline"
              title={t("terms")}
              subtitle={t("termsSub")}
              onPress={() => Alert.alert(t("comingSoonTitle"), t("termsSoonMsg"))}
              styles={styles}
              theme={theme}
            />
            <Divider styles={styles} />
            <RowNav
              icon="shield-checkmark-outline"
              title={t("privacyPolicy")}
              subtitle={t("privacyPolicySub")}
              onPress={() => Alert.alert(t("comingSoonTitle"), t("privacySoonMsg"))}
              styles={styles}
              theme={theme}
            />
          </View>

          {/* Advanced */}
          <SectionTitle title={t("advanced")} styles={styles} />
          <View style={styles.card}>
            <RowNav
              icon="refresh-outline"
              title={t("resetSettings")}
              subtitle={t("resetSettingsSub")}
              danger
              onPress={onReset}
              styles={styles}
              theme={theme}
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
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t("chooseFontSize")}</Text>

            <Option
              label="Small"
              active={settings.fontSize === "Small"}
              onPress={() => pickFontSize("Small")}
              styles={styles}
              theme={theme}
            />
            <Option
              label="Default"
              active={settings.fontSize === "Default"}
              onPress={() => pickFontSize("Default")}
              styles={styles}
              theme={theme}
            />
            <Option
              label="Large"
              active={settings.fontSize === "Large"}
              onPress={() => pickFontSize("Large")}
              styles={styles}
              theme={theme}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */

function SectionTitle({ title, styles }: { title: string; styles: any }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

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
  const ACCENT = theme?.primary || theme?.blue || "#8B5CF6";

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={ACCENT} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: theme.switchTrackOff,
          true: theme.switchTrackOn || ACCENT,
        }}
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
  const ACCENT = theme?.primary || theme?.blue || "#8B5CF6";

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
          <Ionicons name={icon} size={18} color={danger ? theme.danger : ACCENT} />
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
  const ACCENT = theme?.primary || theme?.blue || "#8B5CF6";

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={ACCENT} />
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
  const ACCENT = theme?.primary || theme?.blue || "#8B5CF6";

  return (
    <View style={styles.row}>
      <View style={styles.rowLeftStart}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={ACCENT} />
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.optionRow, active && styles.optionRowActive]}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
      {active ? <Ionicons name="checkmark" size={18} color={theme.blue || theme.primary} /> : <View style={{ width: 18 }} />}
    </TouchableOpacity>
  );
}

/* ---------- Styles ---------- */

function makeStyles(theme: any, s: number) {
  const ACCENT = theme?.primary || theme?.blue || "#8B5CF6";
  const ACCENT_SOFT = theme?.primarySoft || "#F3E8FF";
  const CARD_BG = theme?.card || "#FFFFFF";
  const BG = theme?.bg || "#F8F6FC";
  const TEXT = theme?.text || "#1F2937";
  const TEXT_SUB = theme?.textSub || "#6B7280";
  const BORDER = theme?.border || "#E7E5EF";
  const MUTED = theme?.muted || "#F3F1FA";
  const DIVIDER = theme?.divider || "#EEEAF6";
  const DANGER = theme?.danger || "#DC2626";
  const DANGER_BG = theme?.dangerBg || "#FEE2E2";
  const CHEVRON = theme?.chevron || "#A1A1AA";

  return {
    safe: {
      flex: 1,
      backgroundColor: BG,
    },

    screen: {
      flex: 1,
      backgroundColor: BG,
    },

    center: {
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      marginTop: 12,
      color: TEXT_SUB,
      fontWeight: "800",
      fontSize: 14 * s,
    },

    container: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 12,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: CARD_BG,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    iconBtnGhost: {
      width: 42,
      height: 42,
      opacity: 0,
    },

    topTitle: {
      fontSize: 16 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.2,
    },

    heroCard: {
      backgroundColor: CARD_BG,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 18,
      marginBottom: 18,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    heroIconWrap: {
      width: 62,
      height: 62,
      borderRadius: 20,
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },

    heroTextWrap: {
      flex: 1,
    },

    heroTitle: {
      fontSize: 20 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.3,
    },

    heroSub: {
      marginTop: 6,
      fontSize: 12.5 * s,
      color: TEXT_SUB,
      fontWeight: "600",
      lineHeight: 18,
    },

    quickGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },

    quickCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: BORDER,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    quickPrimary: {
      flex: 1.15,
      backgroundColor: ACCENT,
      borderColor: ACCENT,
      padding: 16,
      minHeight: 132,
      justifyContent: "space-between",
    },

    quickPrimaryTitle: {
      marginTop: 10,
      fontSize: 16 * s,
      color: "#fff",
      fontWeight: "900",
    },

    quickPrimarySub: {
      marginTop: 6,
      fontSize: 12 * s,
      color: "rgba(255,255,255,0.84)",
      fontWeight: "700",
      lineHeight: 17,
    },

    quickColumn: {
      flex: 1,
      gap: 10,
    },

    quickMiniCard: {
      flex: 1,
      minHeight: 61,
      backgroundColor: CARD_BG,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      gap: 4,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    quickMiniTitle: {
      fontSize: 12 * s,
      color: TEXT,
      fontWeight: "900",
      textAlign: "center",
    },

    quickMiniSub: {
      fontSize: 10.8 * s,
      color: TEXT_SUB,
      fontWeight: "700",
      textAlign: "center",
    },

    sectionTitle: {
      marginBottom: 10,
      marginTop: 2,
      fontSize: 18 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.2,
    },

    card: {
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 20,
      backgroundColor: CARD_BG,
      overflow: "hidden",
      marginBottom: 18,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    row: {
      paddingHorizontal: 14,
      paddingVertical: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      paddingRight: 10,
    },

    rowLeftStart: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      flex: 1,
      paddingRight: 10,
    },

    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
    },

    iconBoxDanger: {
      backgroundColor: DANGER_BG,
    },

    rowTitle: {
      fontSize: 13.5 * s,
      fontWeight: "900",
      color: TEXT,
    },

    rowSub: {
      marginTop: 4,
      fontSize: 11.3 * s,
      color: TEXT_SUB,
      fontWeight: "700",
      lineHeight: 16,
    },

    divider: {
      height: 1,
      backgroundColor: DIVIDER,
      marginLeft: 64,
    },

    rightWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 8,
    },

    rightText: {
      fontSize: 12 * s,
      color: TEXT_SUB,
      fontWeight: "800",
    },

    pillsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
      flexWrap: "wrap",
    },

    pill: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: CARD_BG,
    },

    pillActive: {
      borderColor: `${ACCENT}35`,
      backgroundColor: ACCENT_SOFT,
    },

    pillText: {
      fontSize: 11 * s,
      fontWeight: "800",
      color: TEXT_SUB,
    },

    pillTextActive: {
      color: ACCENT,
    },

    dangerText: {
      color: DANGER,
    },

    dangerSub: {
      color: DANGER,
    },

    footer: {
      alignItems: "center",
      marginTop: 8,
      marginBottom: 6,
    },

    footerTitle: {
      fontSize: 12 * s,
      fontWeight: "800",
      color: TEXT_SUB,
    },

    footerSub: {
      fontSize: 11 * s,
      fontWeight: "700",
      color: CHEVRON,
      marginTop: 4,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      padding: 18,
    },

    modalCard: {
      backgroundColor: CARD_BG,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 16,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },

    modalHandle: {
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: DIVIDER,
      alignSelf: "center",
      marginBottom: 14,
    },

    modalTitle: {
      fontSize: 15 * s,
      fontWeight: "900",
      color: TEXT,
      marginBottom: 12,
      textAlign: "center",
    },

    optionRow: {
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    optionRowActive: {
      backgroundColor: MUTED,
    },

    optionText: {
      fontSize: 13.5 * s,
      fontWeight: "800",
      color: TEXT,
    },

    optionTextActive: {
      color: ACCENT,
    },
  };
}