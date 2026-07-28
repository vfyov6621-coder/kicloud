/**
 * kicloud — Auth store (Zustand)
 * ТЗ 2.2.2: сессия сохраняется в IndexedDB, при повторном визите восстанавливается.
 */
import { create } from "zustand";
import type { UserSession, AuthStep } from "@/lib/types";
import {
  saveSession,
  getAnySession,
  deleteSession,
  wipeAll,
} from "@/lib/db";
import { getCloudClient } from "@/lib/mtproto";

interface AuthStore {
  // State
  session: UserSession | null;
  authStep: AuthStep;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Phone step
  phoneCodeHash: string | null;
  phoneNumber: string;
  resendTimer: number;

  // Actions
  init: () => Promise<void>;
  sendCode: (phone: string) => Promise<{ needsCode: boolean }>;
  verifyCode: (code: string) => Promise<{ needsPassword: boolean }>;
  checkPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  cancelAuth: () => void;
  setAuthStep: (step: AuthStep) => void;
  setResendTimer: (sec: number) => void;
  setError: (err: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  authStep: "phone",
  isLoading: false,
  isInitialized: false,
  error: null,
  phoneCodeHash: null,
  phoneNumber: "",
  resendTimer: 0,

  init: async () => {
    try {
      const stored = await getAnySession();
      if (stored) {
        // ТЗ A-04: проверка валидности через users.getFullUser
        const client = getCloudClient();
        const valid = await client.validateSession(stored);
        if (valid) {
          set({ session: stored, authStep: "done", isInitialized: true });
          return;
        }
        // Сессия просрочена — очищаем
        await deleteSession(stored.userId);
      }
    } catch (e) {
      console.warn("[auth] init failed", e);
    }
    set({ isInitialized: true });
  },

  sendCode: async (phone) => {
    set({ isLoading: true, error: null, phoneNumber: phone });
    try {
      const client = getCloudClient();
      const result = await client.sendCode(phone);
      set({
        phoneCodeHash: result.phoneCodeHash,
        authStep: "code",
        isLoading: false,
        resendTimer: 60,
      });
      return { needsCode: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  verifyCode: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const client = getCloudClient();
      const result = await client.signIn({
        phone: get().phoneNumber,
        code,
        phoneCodeHash: get().phoneCodeHash ?? "",
      });
      if (result.needsPassword) {
        set({ authStep: "password", isLoading: false });
        return { needsPassword: true };
      }
      if (result.session) {
        await saveSession(result.session);
        set({ session: result.session, authStep: "done", isLoading: false });
      }
      return { needsPassword: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid code";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  checkPassword: async (password) => {
    set({ isLoading: true, error: null });
    try {
      const client = getCloudClient();
      const session = await client.checkPassword(password);
      await saveSession(session);
      set({ session, authStep: "done", isLoading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid password";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  signOut: async () => {
    const session = get().session;
    if (session) {
      try {
        const client = getCloudClient();
        await client.logOut(session);
      } catch (e) {
        console.warn("[auth] logout error", e);
      }
    }
    // ТЗ A-05: auth.logOut + очистка IndexedDB + удаление данных
    await wipeAll();
    set({
      session: null,
      authStep: "phone",
      phoneCodeHash: null,
      phoneNumber: "",
      error: null,
    });
  },

  cancelAuth: () => {
    set({
      authStep: "phone",
      phoneCodeHash: null,
      isLoading: false,
      error: null,
      resendTimer: 0,
    });
  },

  setAuthStep: (authStep) => set({ authStep }),
  setResendTimer: (resendTimer) => set({ resendTimer }),
  setError: (error) => set({ error }),
}));
