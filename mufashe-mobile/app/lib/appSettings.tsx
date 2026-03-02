import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";
export type FontSize = "Small" | "Default" | "Large";
export type Language = "English" | "Kinyarwanda";

export type SettingsState = {
  themeMode: ThemeMode;
  fontSize: FontSize;
  language: Language;

  pushNotifications: boolean;
  emailUpdates: boolean;

  highContrast: boolean;
};

const STORAGE_KEY = "@mufashe_settings_v3";

const DEFAULT_SETTINGS: SettingsState = {
  themeMode: "light",
  fontSize: "Default",
  language: "English",
  pushNotifications: true,
  emailUpdates: false,
  highContrast: false,
};

function fontScale(fontSize: FontSize) {
  if (fontSize === "Small") return 0.92;
  if (fontSize === "Large") return 1.12;
  return 1;
}

function makeTheme(mode: ThemeMode, highContrast: boolean) {
  const isDark = mode === "dark";

  // base palettes
  const light = {
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
    chevron: "#9CA3AF",
    chipBg: "#F9FAFB",
  };

  const dark = {
    bg: "#0B1220",
    card: "#0F1A2E",
    border: "#25324A",
    divider: "#25324A",
    text: "#F9FAFB",
    textSub: "#CBD5E1",
    muted: "#111C33",
    blue: "#60A5FA",
    danger: "#F87171",
    dangerBg: "#3B0D14",
    chevron: "#CBD5E1",
    chipBg: "#111C33",
  };

  const t = isDark ? dark : light;

  if (!highContrast) {
    return {
      ...t,
      switchTrackOn: isDark ? "#2563EB" : "#93C5FD",
      switchTrackOff: isDark ? "#334155" : "#D1D5DB",
      switchThumb: isDark ? "#E5E7EB" : "#ffffff",
      topBorder: isDark ? "#25324A" : "#EEF2F7",
    };
  }

  // high contrast tweaks
  return {
    ...t,
    textSub: isDark ? "#E5E7EB" : "#374151",
    border: isDark ? "#3B4B69" : "#D1D5DB",
    divider: isDark ? "#3B4B69" : "#D1D5DB",
    switchTrackOn: isDark ? "#3B82F6" : "#60A5FA",
    switchTrackOff: isDark ? "#475569" : "#9CA3AF",
    switchThumb: isDark ? "#F9FAFB" : "#ffffff",
    topBorder: isDark ? "#3B4B69" : "#D1D5DB",
  };
}

type Ctx = {
  loading: boolean;
  settings: SettingsState;
  theme: ReturnType<typeof makeTheme>;
  scale: number;
  updateSettings: (patch: Partial<SettingsState>) => void;
  resetSettings: () => void;
};

const AppSettingsContext = createContext<Ctx | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SettingsState>;
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loading]);

  const updateSettings = useCallback((patch: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const theme = useMemo(() => makeTheme(settings.themeMode, settings.highContrast), [settings.themeMode, settings.highContrast]);
  const scale = useMemo(() => fontScale(settings.fontSize), [settings.fontSize]);

  const value = useMemo(
    () => ({ loading, settings, theme, scale, updateSettings, resetSettings }),
    [loading, settings, theme, scale, updateSettings, resetSettings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}