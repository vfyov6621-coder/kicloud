/**
 * kicloud — Settings store (Zustand + persist)
 * ТЗ 1.1, 5.3: настройки сохраняются в IndexedDB.
 * Пароль шифрования хранится ТОЛЬКО в памяти (не персистится).
 */
import { create } from "zustand";
import type { UserSettings, Language, ThemeMode, ViewMode, SortBy } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/db";

const DEFAULT_SETTINGS: UserSettings = {
  language: "ru",
  themeMode: "light",
  themePrimary: "#0f172a",
  themeAccent: "#64748b",
  themeBackground: "#ffffff",
  encryptionEnabled: false,
  encryptionPassword: undefined,
  viewMode: "grid",
  sortBy: "date-desc",
};

interface SettingsStore extends UserSettings {
  loaded: boolean;
  load: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setColors: (colors: Partial<Pick<UserSettings, "themePrimary" | "themeAccent" | "themeBackground">>) => Promise<void>;
  setEncryptionEnabled: (enabled: boolean) => Promise<void>;
  setEncryptionPassword: (password: string | undefined) => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  setSortBy: (sortBy: SortBy) => Promise<void>;
  applyThemeToDom: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const stored = await getSettings();
      const merged = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
      // Пароль шифрования не восстанавливаем из IndexedDB (только в памяти)
      merged.encryptionPassword = undefined;
      set({ ...merged, loaded: true });
      get().applyThemeToDom();
    } catch (e) {
      console.warn("[settings] load failed", e);
      set({ ...DEFAULT_SETTINGS, loaded: true });
      get().applyThemeToDom();
    }
  },

  setLanguage: async (language) => {
    set({ language });
    await persistSettings(get());
  },

  setThemeMode: async (themeMode) => {
    set({ themeMode });
    get().applyThemeToDom();
    await persistSettings(get());
  },

  setColors: async (colors) => {
    set(colors);
    get().applyThemeToDom();
    await persistSettings(get());
  },

  setEncryptionEnabled: async (encryptionEnabled) => {
    set({ encryptionEnabled });
    await persistSettings(get());
  },

  // Пароль шифрования — ТОЛЬКО в памяти
  setEncryptionPassword: (encryptionPassword) => {
    set({ encryptionPassword });
  },

  setViewMode: async (viewMode) => {
    set({ viewMode });
    await persistSettings(get());
  },

  setSortBy: async (sortBy) => {
    set({ sortBy });
    await persistSettings(get());
  },

  applyThemeToDom: () => {
    if (typeof document === "undefined") return;
    const s = get();
    const root = document.documentElement;

    // Theme mode
    if (s.themeMode === "dark") {
      root.classList.add("dark");
    } else if (s.themeMode === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }

    // Custom RGB colors — только если они отличаются от дефолтных монохромных
    // Пользовательские цвета применяются поверх базовых CSS-переменных
    const style = root.style;
    if (s.themePrimary && s.themePrimary !== DEFAULT_SETTINGS.themePrimary) {
      style.setProperty("--kc-primary", s.themePrimary);
      // Выводим accent из primary через luminance
      style.setProperty("--kc-link", s.themePrimary);
    }
    if (s.themeAccent && s.themeAccent !== DEFAULT_SETTINGS.themeAccent) {
      style.setProperty("--kc-accent", s.themeAccent);
    }
    if (s.themeBackground && s.themeBackground !== DEFAULT_SETTINGS.themeBackground) {
      style.setProperty("--kc-bg", s.themeBackground);
      style.setProperty("--background", s.themeBackground);
    }
  },
}));

async function persistSettings(state: SettingsStore) {
  try {
    // ТЗ 5.5: пароль шифрования не персистится в IndexedDB (только в памяти).
    // Извлекаем только сериализуемые UserSettings-поля, исключая функции и transient-флаги.
    const persistable: UserSettings = {
      language: state.language,
      themeMode: state.themeMode,
      themePrimary: state.themePrimary,
      themeAccent: state.themeAccent,
      themeBackground: state.themeBackground,
      encryptionEnabled: state.encryptionEnabled,
      // encryptionPassword НЕ сохраняем
      viewMode: state.viewMode,
      sortBy: state.sortBy,
    };
    await saveSettings(persistable);
  } catch (e) {
    console.warn("[settings] persist failed", e);
  }
}
