import React, { useEffect, useMemo, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../../components/BottomNav";

/**
 * SettingsScreen (FULL FILE)
 * ✅ Ionicons (no emojis)
 * ✅ Font size dropdown (modal)
 * ✅ Persists settings in AsyncStorage
 * ✅ BottomNav included + content padding so it won't overlap
 *
 * NOTE: Update STORAGE_KEYS.chatMessages/chatThreads to match your real app keys.
 */

const STORAGE_KEYS = {
  settings: "@mufashe_settings_v2",
  chatMessages: "@mufashe_chat_messages",
  chatThreads: "@mufashe_chat_threads",
};

type FontSize = "Small" | "Default" | "Large";

type SettingsState = {
  pushNotifications: boolean;
  emailUpdates: boolean;
  highContrast: boolean;
  fontSize: FontSize;
};

const DEFAULT_SETTINGS: SettingsState = {
  pushNotifications: true,
  emailUpdates: false,
  highContrast: false,
  fontSize: "Default",
};

// Adjust this to match your BottomNav height (most are ~70–90)
const BOTTOM_NAV_SPACE = 92;

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);

  const [pushNotifications, setPushNotifications] = useState(DEFAULT_SETTINGS.pushNotifications);
  const [emailUpdates, setEmailUpdates] = useState(DEFAULT_SETTINGS.emailUpdates);
  const [highContrast, setHighContrast] = useState(DEFAULT_SETTINGS.highContrast);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_SETTINGS.fontSize);

  const [fontModalOpen, setFontModalOpen] = useState(false);

  const theme = useMemo(() => makeTheme(highContrast), [highContrast]);
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, fontSize)), [theme, fontSize]);

  // Load saved settings
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SettingsState>;
          setPushNotifications(parsed.pushNotifications ?? DEFAULT_SETTINGS.pushNotifications);
          setEmailUpdates(parsed.emailUpdates ?? DEFAULT_SETTINGS.emailUpdates);
          setHighContrast(parsed.highContrast ?? DEFAULT_SETTINGS.highContrast);
          setFontSize(parsed.fontSize ?? DEFAULT_SETTINGS.fontSize);
        }
      } catch {
        // ignore corrupted settings
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist settings
  useEffect(() => {
    if (loading) return;
    const state: SettingsState = { pushNotifications, emailUpdates, highContrast, fontSize };
    AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state)).catch(() => {});
  }, [pushNotifications, emailUpdates, highContrast, fontSize, loading]);

  const onExportData = async () => {
    try {
      // Example export payload (you can expand later)
      const payload = {
        exportedAt: new Date().toISOString(),
        settings: { pushNotifications, emailUpdates, highContrast, fontSize },
      };
      const json = JSON.stringify(payload, null, 2);
      Alert.alert("Export Ready", `Export prepared (${json.length} chars).`);
    } catch {
      Alert.alert("Export Failed", "Could not prepare export.");
    }
  };

  const onClearChatHistory = () => {
    Alert.alert(
      "Clear Chat History",
      "This will remove your chat history from this device. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([STORAGE_KEYS.chatMessages, STORAGE_KEYS.chatThreads]);
              Alert.alert("Done", "Chat history cleared.");
            } catch {
              Alert.alert("Error", "Could not clear chat history.");
            }
          },
        },
      ]
    );
  };

  const pickFontSize = (size: FontSize) => {
    setFontSize(size);
    setFontModalOpen(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.textSub, fontWeight: "800" }}>Loading settings…</Text>
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

          <Text style={styles.topTitle}>App Settings</Text>

          <View style={{ width: 38 }} />
        </View>

        {/* Scroll Content */}
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: BOTTOM_NAV_SPACE }]}
          showsVerticalScrollIndicator={false}
        >
          {/* NOTIFICATIONS */}
          <Text style={styles.sectionLabel}>NOTIFICATION SETTINGS</Text>
          <View style={styles.card}>
            <RowToggle
              icon="notifications-outline"
              title="Push Notifications"
              subtitle="Get important alerts and reminders."
              value={pushNotifications}
              onChange={setPushNotifications}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowToggle
              icon="mail-outline"
              title="Email Updates"
              subtitle="Receive updates by email."
              value={emailUpdates}
              onChange={setEmailUpdates}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* PRIVACY & DATA */}
          <Text style={styles.sectionLabel}>PRIVACY & DATA</Text>
          <View style={styles.card}>
            <RowNav
              icon="download-outline"
              title="Export My Data"
              subtitle="Download a copy of your settings."
              onPress={onExportData}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowNav
              icon="trash-outline"
              title="Clear Chat History"
              subtitle="Remove saved chats from this device."
              danger
              onPress={onClearChatHistory}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* ACCESSIBILITY */}
          <Text style={styles.sectionLabel}>ACCESSIBILITY</Text>
          <View style={styles.card}>
            <RowRightText
              icon="text-outline"
              title="Font Size"
              subtitle="Choose the text size you prefer."
              rightText={fontSize}
              onPress={() => setFontModalOpen(true)}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowToggle
              icon="contrast-outline"
              title="High Contrast"
              subtitle="Increase contrast for readability."
              value={highContrast}
              onChange={setHighContrast}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* ABOUT */}
          <Text style={styles.sectionLabel}>ABOUT MUFASHE</Text>
          <View style={styles.card}>
            <RowNav
              icon="document-text-outline"
              title="Terms of Service"
              subtitle="Read our terms and conditions."
              onPress={() => Alert.alert("Coming soon", "Terms will be available soon.")}
              theme={theme}
              styles={styles}
            />
            <Divider styles={styles} />
            <RowNav
              icon="shield-checkmark-outline"
              title="Privacy Policy"
              subtitle="How we protect your data."
              onPress={() => Alert.alert("Coming soon", "Privacy policy will be available soon.")}
              theme={theme}
              styles={styles}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>Mufashe Legal Awareness</Text>
            <Text style={styles.footerSub}>Version 1.0.2 (Build 42)</Text>
          </View>

          <View style={{ height: 14 }} />
        </ScrollView>

        {/* Bottom Nav */}
        <BottomNav />
      </View>

      {/* Font Size Dropdown Modal */}
      <Modal visible={fontModalOpen} transparent animationType="fade" onRequestClose={() => setFontModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFontModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Choose Font Size</Text>

            <Option label="Small" active={fontSize === "Small"} onPress={() => pickFontSize("Small")} styles={styles} theme={theme} />
            <Option label="Default" active={fontSize === "Default"} onPress={() => pickFontSize("Default")} styles={styles} theme={theme} />
            <Option label="Large" active={fontSize === "Large"} onPress={() => pickFontSize("Large")} styles={styles} theme={theme} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------------- Components ---------------- */

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

/* ---------------- Theme + Styles ---------------- */

function makeTheme(highContrast: boolean) {
  if (!highContrast) {
    return {
      bg: "#ffffff",
      card: "#ffffff",
      border: "#E5E7EB",
      divider: "#E5E7EB",
      text: "#111827",
      textSub: "#6B7280",
      muted: "#F3F4F6",
      blue: "#2563EB",
      danger: "#DC2626",
      dangerBg: "#FEE2E2",
      switchTrackOn: "#93C5FD",
      switchTrackOff: "#D1D5DB",
      switchThumb: "#ffffff",
      topBorder: "#EEF2F7",
      chevron: "#9CA3AF",
    };
  }

  return {
    bg: "#0B1220",
    card: "#0F1A2E",
    border: "#25324A",
    divider: "#25324A",
    text: "#F9FAFB",
    textSub: "#C7D2FE",
    muted: "#111C33",
    blue: "#60A5FA",
    danger: "#F87171",
    dangerBg: "#3B0D14",
    switchTrackOn: "#2563EB",
    switchTrackOff: "#334155",
    switchThumb: "#E5E7EB",
    topBorder: "#25324A",
    chevron: "#CBD5E1",
  };
}

function fontScale(fontSize: FontSize) {
  if (fontSize === "Small") return 0.92;
  if (fontSize === "Large") return 1.12;
  return 1;
}

function makeStyles(theme: any, fontSize: FontSize) {
  const s = fontScale(fontSize);

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

    dangerText: { color: theme.danger },
    dangerSub: { color: theme.danger },

    footer: { alignItems: "center", marginTop: 18, marginBottom: 6 },
    footerTitle: { fontSize: 12 * s, fontWeight: "800", color: theme.textSub },
    footerSub: { fontSize: 11 * s, fontWeight: "700", color: theme.chevron, marginTop: 4 },

    // Modal
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
    optionRowActive: {
      backgroundColor: theme.muted,
    },
    optionText: {
      fontSize: 13 * s,
      fontWeight: "800",
      color: theme.text,
    },
    optionTextActive: {
      color: theme.blue,
    },
  };
}
