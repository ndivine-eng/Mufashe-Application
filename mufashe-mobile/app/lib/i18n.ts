// app/lib/i18n.ts
import { useCallback } from "react";
import { useAppSettings } from "./appSettings";

type Key =
  // Dashboard / common
  | "hi"
  | "askLearnHelp"
  | "askLegalQuestion"
  | "categories"
  | "recent"
  | "urgentHelp"
  | "nationalLegalAid"
  | "loading"
  | "loadingRecent"
  | "noRecent"
  | "retry"
  | "ask"
  | "history"
  | "library"
  | "today"
  | "yesterday"
  // Library
  | "documents"
  | "searchDocs"
  | "noDocs"
  | "tryAnother"
  | "saved"
  // Consult
  | "consult"
  | "send"
  | "sources"
  // Categories
  | "family"
  | "land"
  | "labor"
  | "business"
  // Profile
  | "profile"
  | "removePhoto"
  | "account"
  | "personalInfo"
  | "updateDetails"
  | "security"
  | "securityDesc"
  | "myQuestions"
  | "viewHistory"
  | "signOut"
  // Alerts / system (Profile)
  | "notLoggedInTitle"
  | "notLoggedInMsg"
  | "permissionTitle"
  | "permissionMsg"
  | "uploadFailedTitle"
  | "uploadFailedMsg"
  | "comingSoonTitle"
  | "comingSoonPersonalInfo"
  | "comingSoonSecurity"
  // Settings screen UI
  | "settings"
  | "loadingSettings"
  | "appearance"
  | "darkMode"
  | "darkModeSub"
  | "fontSize"
  | "fontSizeSub"
  | "highContrast"
  | "highContrastSub"
  | "language"
  | "appLanguage"
  | "appLanguageSub"
  | "notifications"
  | "pushNotifications"
  | "pushNotificationsSub"
  | "emailUpdates"
  | "emailUpdatesSub"
  | "privacyData"
  | "exportSettings"
  | "exportSettingsSub"
  | "clearLocalCache"
  | "clearLocalCacheSub"
  | "about"
  | "terms"
  | "termsSub"
  | "privacyPolicy"
  | "privacyPolicySub"
  | "advanced"
  | "resetSettings"
  | "resetSettingsSub"
  | "chooseFontSize"
  // Settings alerts/buttons
  | "exportReadyTitle"
  | "exportReadyMsg"
  | "exportFailedTitle"
  | "exportFailedMsg"
  | "clearCacheTitle"
  | "clearCacheMsg"
  | "cancel"
  | "clear"
  | "doneTitle"
  | "cacheClearedMsg"
  | "errorTitle"
  | "clearCacheFailedMsg"
  | "resetTitle"
  | "resetMsg"
  | "reset"
  | "termsSoonMsg"
  | "privacySoonMsg";

const STRINGS: Record<"English" | "Kinyarwanda", Record<Key, string>> = {
  English: {
    hi: "Hi, {name}",
    askLearnHelp: "Ask • Learn • Get help",
    askLegalQuestion: "Ask a legal question…",
    categories: "Categories",
    recent: "Recent",
    urgentHelp: "Urgent help",
    nationalLegalAid: "National Legal Aid",
    loading: "Loading…",
    loadingRecent: "Loading recent…",
    noRecent: "No recent questions yet",
    retry: "Retry",
    ask: "Ask",
    history: "History",
    library: "Library",
    today: "Today",
    yesterday: "Yesterday",

    documents: "Documents",
    searchDocs: "Search laws, cases, contracts…",
    noDocs: "No documents found",
    tryAnother: "Try another category or search term.",
    saved: "Saved",

    consult: "Consult",
    send: "Send",
    sources: "Sources",

    family: "Family",
    land: "Land",
    labor: "Labor",
    business: "Business",

    profile: "Profile",
    removePhoto: "Remove photo",
    account: "Account",
    personalInfo: "Personal Information",
    updateDetails: "Update basic details",
    security: "Security",
    securityDesc: "Password and account protection",
    myQuestions: "My Questions",
    viewHistory: "View your Q&A history",
    signOut: "Sign Out",

    notLoggedInTitle: "Not logged in",
    notLoggedInMsg: "Please login first.",
    permissionTitle: "Permission needed",
    permissionMsg: "Please allow photo access to upload a profile picture.",
    uploadFailedTitle: "Upload failed",
    uploadFailedMsg: "Could not select a photo. Try again.",
    comingSoonTitle: "Coming soon",
    comingSoonPersonalInfo: "Personal info editing will be added.",
    comingSoonSecurity: "Security settings will be added.",

    settings: "Settings",
    loadingSettings: "Loading settings…",
    appearance: "Appearance",
    darkMode: "Dark Mode",
    darkModeSub: "Switch between light and dark theme.",
    fontSize: "Font Size",
    fontSizeSub: "Choose the text size you prefer.",
    highContrast: "High Contrast",
    highContrastSub: "Improve readability for low-contrast screens.",

    language: "Language",
    appLanguage: "App Language",
    appLanguageSub: "Choose your preferred language.",

    notifications: "Notifications",
    pushNotifications: "Push Notifications",
    pushNotificationsSub: "Get alerts and reminders.",
    emailUpdates: "Email Updates",
    emailUpdatesSub: "Receive updates by email.",

    privacyData: "Privacy & Data",
    exportSettings: "Export Settings",
    exportSettingsSub: "Download a copy of your settings.",
    clearLocalCache: "Clear Local Cache",
    clearLocalCacheSub: "Remove cached items on this device.",

    about: "About",
    terms: "Terms of Service",
    termsSub: "Read our terms and conditions.",
    privacyPolicy: "Privacy Policy",
    privacyPolicySub: "How we protect your data.",

    advanced: "Advanced",
    resetSettings: "Reset Settings",
    resetSettingsSub: "Restore default settings.",

    chooseFontSize: "Choose Font Size",

    exportReadyTitle: "Export Ready",
    exportReadyMsg: "Export prepared ({n} chars).",
    exportFailedTitle: "Export Failed",
    exportFailedMsg: "Could not prepare export.",

    clearCacheTitle: "Clear Cache",
    clearCacheMsg: "This clears local cached items on this device. Continue?",
    cancel: "Cancel",
    clear: "Clear",
    doneTitle: "Done",
    cacheClearedMsg: "Cache cleared.",
    errorTitle: "Error",
    clearCacheFailedMsg: "Could not clear cache.",

    resetTitle: "Reset Settings",
    resetMsg: "Restore default settings?",
    reset: "Reset",

    termsSoonMsg: "Terms will be available soon.",
    privacySoonMsg: "Privacy policy will be available soon.",
  },

  Kinyarwanda: {
    hi: "Muraho, {name}",
    askLearnHelp: "Baza • Wige • Fashwa",
    askLegalQuestion: "Baza ikibazo cy'amategeko…",
    categories: "Ibyiciro",
    recent: "Ibyaheruka",
    urgentHelp: "Ubufasha bwihuse",
    nationalLegalAid: "Ubufasha bw'amategeko bw'Igihugu",
    loading: "Birimo gutegurwa…",
    loadingRecent: "Birimo gutegurwa…",
    noRecent: "Nta bibazo biheruka biraboneka",
    retry: "Ongera ugerageze",
    ask: "Baza",
    history: "Amateka",
    library: "Isomero",
    today: "Uyu munsi",
    yesterday: "Ejo",

    documents: "Inyandiko",
    searchDocs: "Shakisha amategeko, imanza, amasezerano…",
    noDocs: "Nta nyandiko zabonetse",
    tryAnother: "Gerageza ikindi cyiciro cyangwa ijambo rindi.",
    saved: "Byabitswe",

    consult: "Kugisha inama",
    send: "Ohereza",
    sources: "Inkomoko",

    family: "Umuryango",
    land: "Ubutaka",
    labor: "Umurimo",
    business: "Ubucuruzi",

    profile: "Umwirondoro",
    removePhoto: "Kuraho ifoto",
    account: "Konti",
    personalInfo: "Amakuru y'umuntu",
    updateDetails: "Hindura amakuru y'ibanze",
    security: "Umutekano",
    securityDesc: "Ijambo ry'ibanga n'umutekano wa konti",
    myQuestions: "Ibibazo byanjye",
    viewHistory: "Reba amateka y'ibibazo n'ibisubizo",
    signOut: "Sohoka",

    notLoggedInTitle: "Ntabwo winjiye",
    notLoggedInMsg: "Banza winjire.",
    permissionTitle: "Uruhushya rurakenewe",
    permissionMsg: "Emera ko app ikoresha amafoto kugira ngo ushyireho ifoto.",
    uploadFailedTitle: "Byanze",
    uploadFailedMsg: "Ntibyashobotse. Ongera ugerageze.",
    comingSoonTitle: "Biraje vuba",
    comingSoonPersonalInfo: "Guhindura amakuru y'umwirondoro biraje.",
    comingSoonSecurity: "Igenamiterere y'umutekano iraje.",

    settings: "Igenamiterere",
    loadingSettings: "Birimo gutegurwa…",
    appearance: "Isura",
    darkMode: "Dark Mode",
    darkModeSub: "Hindura hagati ya light na dark.",
    fontSize: "Ingano y'inyuguti",
    fontSizeSub: "Hitamo ingano y'inyandiko.",
    highContrast: "Kongera itandukaniro",
    highContrastSub: "Bifasha gusoma neza ku mabara yegereye.",

    language: "Ururimi",
    appLanguage: "Ururimi rwa porogaramu",
    appLanguageSub: "Hitamo ururimi ukunda.",

    notifications: "Ubutumwa",
    pushNotifications: "Push Notifications",
    pushNotificationsSub: "Bona ubutumwa n'ibibutsa.",
    emailUpdates: "Email Updates",
    emailUpdatesSub: "Bona amakuru kuri email.",

    privacyData: "Ibanga & Amakuru",
    exportSettings: "Kuramo igenamiterere",
    exportSettingsSub: "Kuramo kopi y'igenamiterere.",
    clearLocalCache: "Gusiba Cache",
    clearLocalCacheSub: "Siba ibintu byabitswe kuri telefoni.",

    about: "Ibyerekeye",
    terms: "Amategeko yo gukoresha",
    termsSub: "Soma amategeko n'amabwiriza.",
    privacyPolicy: "Politiki y'ibanga",
    privacyPolicySub: "Uko turinda amakuru yawe.",

    advanced: "Ibindi",
    resetSettings: "Gusubiza ku bisanzwe",
    resetSettingsSub: "Subiza igenamiterere ku bisanzwe.",

    chooseFontSize: "Hitamo ingano y'inyuguti",

    exportReadyTitle: "Byiteguye",
    exportReadyMsg: "Byateguwe ({n} inyuguti).",
    exportFailedTitle: "Byanze",
    exportFailedMsg: "Ntibyashobotse gutegura export.",

    clearCacheTitle: "Gusiba Cache",
    clearCacheMsg: "Ibi bisiba cache kuri telefoni. Ukomeza?",
    cancel: "Oya",
    clear: "Siba",
    doneTitle: "Byarangiye",
    cacheClearedMsg: "Cache yasibwe.",
    errorTitle: "Ikosa",
    clearCacheFailedMsg: "Ntibyashobotse gusiba cache.",

    resetTitle: "Gusubiza ku bisanzwe",
    resetMsg: "Usubize igenamiterere ku bisanzwe?",
    reset: "Subiza",

    termsSoonMsg: "Amategeko azaboneka vuba.",
    privacySoonMsg: "Politiki y'ibanga izaboneka vuba.",
  },
};

export function useT() {
  const { settings } = useAppSettings();
  const lang = settings.language;

  return useCallback(
    (key: Key, vars?: Record<string, string>) => {
      let s = STRINGS[lang]?.[key] ?? STRINGS.English[key] ?? key;

      if (vars) {
        for (const k of Object.keys(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]);
        }
      }
      return s;
    },
    [lang]
  );
}