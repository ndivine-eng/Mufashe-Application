import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

function buildApiUrl(path: string) {
  const base = String(BASE_URL || "").replace(/\/$/, "");
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

function safeParseJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function looksLikeHtml(text: string) {
  const s = String(text || "").trim().toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html") || s.includes("<body");
}

export type Source = {
  n?: number;
  title?: string;
  pageStart?: number;
  pageEnd?: number;
  snippet?: string;
};

export type Msg =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      sources?: Source[];
      pending?: boolean;
      error?: boolean;
    };

type AskOptions = {
  documentId?: string;
  category?: string;
};

type ConsultState = {
  messages: Msg[];
  input: string;
  loading: boolean;
  currentDocumentId?: string;
  currentCategory?: string;
  hydrated: boolean;

  setHydrated: (value: boolean) => void;
  setInput: (value: string) => void;
  setContext: (opts: AskOptions) => void;
  clearChat: () => void;
  askQuestion: (question: string, opts?: AskOptions) => Promise<void>;
};

export const useConsultStore = create<ConsultState>()(
  persist(
    (set, get) => ({
      messages: [],
      input: "",
      loading: false,
      currentDocumentId: undefined,
      currentCategory: undefined,
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      setInput: (value) => set({ input: value }),

      setContext: ({ documentId, category }) =>
        set({
          currentDocumentId: documentId,
          currentCategory: category,
        }),

      clearChat: () =>
        set({
          messages: [],
          input: "",
          loading: false,
        }),

      askQuestion: async (question: string, opts?: AskOptions) => {
        const q = String(question || "").trim();
        if (!q) return;
        if (get().loading) return;

        const documentId = opts?.documentId ?? get().currentDocumentId;
        const category = opts?.category ?? get().currentCategory;

        const userMsg: Msg = {
          id: `user-${Date.now()}`,
          role: "user",
          text: q,
        };

        const pendingId = `assistant-pending-${Date.now()}`;

        const pendingMsg: Msg = {
          id: pendingId,
          role: "assistant",
          text: "Thinking...",
          pending: true,
        };

        set((state) => ({
          messages: [...state.messages, userMsg, pendingMsg],
          input: "",
          loading: true,
          currentDocumentId: documentId,
          currentCategory: category,
        }));

        try {
          const token = await AsyncStorage.getItem("token");
          if (!token) {
            throw new Error("Please login again.");
          }

          const res = await fetch(buildApiUrl("/qa/ask"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            body: JSON.stringify({
              question: q,
              topK: 6,
              ...(documentId ? { documentId } : {}),
              ...(category ? { category } : {}),
            }),
          });

          const text = await res.text();
          const data = safeParseJson(text);

          if (!res.ok) {
            const msg = data?.message || `Request failed (${res.status})`;
            throw new Error(looksLikeHtml(msg) ? "Server returned HTML. Check API URL." : msg);
          }

          const answer = String(data?.answer || data?.finalAnswer || "No answer.");
          const sources: Source[] = Array.isArray(data?.sources) ? data.sources : [];

          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === pendingId
                ? {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    text: answer,
                    sources,
                  }
                : m
            ),
            loading: false,
          }));
        } catch (error: any) {
          const msg = String(error?.message || "Unknown error");

          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === pendingId
                ? {
                    id: `assistant-error-${Date.now()}`,
                    role: "assistant",
                    text: `Error: ${msg}`,
                    error: true,
                  }
                : m
            ),
            loading: false,
          }));
        }
      },
    }),
    {
      name: "mufashe-consult-store-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages,
        input: state.input,
        loading: state.loading,
        currentDocumentId: state.currentDocumentId,
        currentCategory: state.currentCategory,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);