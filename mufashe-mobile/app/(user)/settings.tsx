// app/(user)/settings.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

type RowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  theme: any;
};

function SettingRow({ icon, title, subtitle, onPress, right, theme }: RowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: theme.muted }]}>
          {icon}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
          {!!subtitle && (
            <Text style={[styles.rowSubtitle, { color: theme.textSub }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {right ?? <Feather name="chevron-right" size={20} color={theme.chevron} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const { loading, settings, theme, updateSettings, resetSettings } = useAppSettings();

  const isDark = settings.themeMode === "dark";

  const chooseFontSize = () => {
    Alert.alert(t("chooseFontSize"), "", [
      {
        text: "Small",
        onPress: () => updateSettings({ fontSize: "Small" }),
      },
      {
        text: "Default",
        onPress: () => updateSettings({ fontSize: "Default" }),
      },
      {
        text: "Large",
        onPress: () => updateSettings({ fontSize: "Large" }),
      },
      {
        text: t("cancel"),
        style: "cancel",
      },
    ]);
  };

  const chooseLanguage = () => {
    Alert.alert(t("appLanguage"), "", [
      {
        text: "English",
        onPress: () => updateSettings({ language: "English" }),
      },
      {
        text: "Kinyarwanda",
        onPress: () => updateSettings({ language: "Kinyarwanda" }),
      },
      {
        text: t("cancel"),
        style: "cancel",
      },
    ]);
  };

  const handleExportSettings = async () => {
    try {
      const payload = JSON.stringify(settings, null, 2);
      Alert.alert(
        t("exportReadyTitle"),
        t("exportReadyMsg", { n: String(payload.length) })
      );
    } catch {
      Alert.alert(t("exportFailedTitle"), t("exportFailedMsg"));
    }
  };

  const handleClearCache = () => {
    Alert.alert(t("clearCacheTitle"), t("clearCacheMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("clear"),
        style: "destructive",
        onPress: async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();

            const removableKeys = keys.filter((k) =>
              [
                "@mufashe_recent_questions_cache_v1",
                "@mufashe_consult_session_v1",
                "@mufashe_saved_docs_v1",
              ].includes(k)
            );

            if (removableKeys.length > 0) {
              await AsyncStorage.multiRemove(removableKeys);
            }

            Alert.alert(t("doneTitle"), t("cacheClearedMsg"));
          } catch {
            Alert.alert(t("errorTitle"), t("clearCacheFailedMsg"));
          }
        },
      },
    ]);
  };

  const handleReset = () => {
    Alert.alert(t("resetTitle"), t("resetMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("reset"),
        style: "destructive",
        onPress: () => resetSettings(),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.bg, borderBottomColor: theme.topBorder },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t("settings")}
          </Text>

          <View style={{ width: 40 }} />
        </View>

        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: theme.textSub }]}>
            {t("loadingSettings")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.bg, borderBottomColor: theme.topBorder },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("settings")}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: theme.muted }]}>
            <Ionicons name="settings-outline" size={24} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>
              {t("settings")}
            </Text>
            <Text style={[styles.heroSub, { color: theme.textSub }]}>
              Manage app appearance, language, notifications, privacy, and more.
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          {t("appearance")}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SettingRow
            theme={theme}
            icon={<Ionicons name="moon-outline" size={20} color={theme.blue} />}
            title={t("darkMode")}
            subtitle={t("darkModeSub")}
            right={
              <Switch
                value={isDark}
                onValueChange={(value) =>
                  updateSettings({ themeMode: value ? "dark" : "light" })
                }
                trackColor={{
                  false: theme.switchTrackOff,
                  true: theme.switchTrackOn,
                }}
                thumbColor={theme.switchThumb}
              />
            }
          />

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <SettingRow
            theme={theme}
            icon={<Feather name="type" size={20} color={theme.blue} />}
            title={t("fontSize")}
            subtitle={`${t("fontSizeSub")} (${settings.fontSize})`}
            onPress={chooseFontSize}
            right={
              <View style={[styles.badge, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.badgeText, { color: theme.blue }]}>
                  {settings.fontSize}
                </Text>
              </View>
            }
          />

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <SettingRow
            theme={theme}
            icon={
              <MaterialIcons name="contrast" size={20} color={theme.blue} />
            }
            title={t("highContrast")}
            subtitle={t("highContrastSub")}
            right={
              <Switch
                value={settings.highContrast}
                onValueChange={(value) =>
                  updateSettings({ highContrast: value })
                }
                trackColor={{
                  false: theme.switchTrackOff,
                  true: theme.switchTrackOn,
                }}
                thumbColor={theme.switchThumb}
              />
            }
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          {t("language")}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SettingRow
            theme={theme}
            icon={
              <MaterialIcons name="language" size={20} color={theme.blue} />
            }
            title={t("appLanguage")}
            subtitle={t("appLanguageSub")}
            onPress={chooseLanguage}
            right={
              <View style={[styles.badge, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.badgeText, { color: theme.blue }]}>
                  {settings.language}
                </Text>
              </View>
            }
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          {t("notifications")}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SettingRow
            theme={theme}
            icon={
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.blue}
              />
            }
            title={t("pushNotifications")}
            subtitle={t("pushNotificationsSub")}
            right={
              <Switch
                value={settings.pushNotifications}
                onValueChange={(value) =>
                  updateSettings({ pushNotifications: value })
                }
                trackColor={{
                  false: theme.switchTrackOff,
                  true: theme.switchTrackOn,
                }}
                thumbColor={theme.switchThumb}
              />
            }
          />

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <SettingRow
            theme={theme}
            icon={<Feather name="mail" size={20} color={theme.blue} />}
            title={t("emailUpdates")}
            subtitle={t("emailUpdatesSub")}
            right={
              <Switch
                value={settings.emailUpdates}
                onValueChange={(value) =>
                  updateSettings({ emailUpdates: value })
                }
                trackColor={{
                  false: theme.switchTrackOff,
                  true: theme.switchTrackOn,
                }}
                thumbColor={theme.switchThumb}
              />
            }
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          {t("privacyData")}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SettingRow
            theme={theme}
            icon={<Feather name="download" size={20} color={theme.blue} />}
            title={t("exportSettings")}
            subtitle={t("exportSettingsSub")}
            onPress={handleExportSettings}
          />

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <SettingRow
            theme={theme}
            icon={<Feather name="trash-2" size={20} color={theme.danger} />}
            title={t("clearLocalCache")}
            subtitle={t("clearLocalCacheSub")}
            onPress={handleClearCache}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          {t("about")}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SettingRow
            theme={theme}
            icon={<Feather name="file-text" size={20} color={theme.blue} />}
            title={t("terms")}
            subtitle={t("termsSub")}
            onPress={() => Alert.alert(t("terms"), t("termsSoonMsg"))}
          />

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <SettingRow
            theme={theme}
            icon={<Feather name="shield" size={20} color={theme.blue} />}
            title={t("privacyPolicy")}
            subtitle={t("privacyPolicySub")}
            onPress={() =>
              Alert.alert(t("privacyPolicy"), t("privacySoonMsg"))
            }
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          {t("advanced")}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SettingRow
            theme={theme}
            icon={<Ionicons name="refresh-outline" size={20} color={theme.danger} />}
            title={t("resetSettings")}
            subtitle={t("resetSettingsSub")}
            onPress={handleReset}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 18,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    marginLeft: 66,
  },
  badge: {
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});