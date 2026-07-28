"use client";

/**
 * kicloud — AuthScreen
 * Современный минималистичный экран авторизации.
 * 3 шага: phone → code → password (2FA, если включена).
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Phone, ArrowRight, ArrowLeft, Lock, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 5;

export function AuthScreen() {
  const lang = useSettingsStore((s) => s.language);
  const { authStep, isLoading, error, sendCode, verifyCode, checkPassword, cancelAuth, setResendTimer, resendTimer } = useAuthStore();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      const next = resendTimer - 1;
      setResendTimer(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer, setResendTimer]);

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    try {
      await sendCode(phone.trim());
    } catch {
      // error is set in store
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const codeStr = code.join("");
    if (codeStr.length < CODE_LENGTH) return;
    try {
      await verifyCode(codeStr);
    } catch {
      // error is set in store
    }
  };

  const handleCheckPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      await checkPassword(password);
    } catch {
      // error is set in store
    }
  };

  const handleCodeChange = (idx: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[idx] = value;
    setCode(next);
    if (value && idx < CODE_LENGTH - 1) {
      codeRefs.current[idx + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((c, i) => (next[i] = c));
    setCode(next);
    codeRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await sendCode(phone);
    } catch {
      // ignore
    }
  };

  const isDemo = process.env.NEXT_PUBLIC_KICLOUD_DEMO_MODE === "true";

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="auth-bg" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-10 w-full max-w-[400px]"
      >
        <div className="surface-panel p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                boxShadow: "0 8px 24px rgba(59, 130, 246, 0.3)",
              }}
            >
              <Cloud className="w-7 h-7 text-white" strokeWidth={2.5} />
            </motion.div>
            <h1 className="text-screen-title text-center tracking-tight">kicloud</h1>
            <p className="text-secondary text-center mt-1">{t("auth.subtitle", lang)}</p>
          </div>

          {/* Demo mode banner */}
          {isDemo && (
            <div
              className="mb-6 px-4 py-3 rounded-xl text-caption text-center"
              style={{
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                color: "var(--kc-link)",
              }}
            >
              {t("auth.demoMode", lang)}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Phone */}
            {authStep === "phone" && (
              <motion.form
                key="phone"
                onSubmit={handleSendCode}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <label className="block text-subtitle mb-2">
                  {t("auth.phoneLabel", lang)}
                </label>
                <div className="relative mb-4">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("auth.phonePlaceholder", lang)}
                    autoFocus
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl text-body outline-none transition-colors"
                    style={{
                      background: "var(--kc-surface-muted)",
                      border: "1px solid var(--kc-border)",
                      color: "var(--kc-primary)",
                    }}
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm mb-4 text-center"
                    style={{ color: "var(--kc-error)" }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !phone.trim()}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("auth.sendingCode", lang)}
                    </>
                  ) : (
                    <>
                      {t("auth.sendCode", lang)}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* Step 2: Code */}
            {authStep === "code" && (
              <motion.form
                key="code"
                onSubmit={handleVerifyCode}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={cancelAuth}
                  className="flex items-center gap-1 text-secondary mb-4 hover:opacity-70 transition-opacity"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("auth.back", lang)}
                </button>

                <label className="block text-subtitle mb-2">
                  {t("auth.codeLabel", lang)}
                </label>
                <p className="text-secondary mb-4">{t("auth.codeHint", lang)}</p>

                <div className="flex gap-2 mb-4 justify-between" onPaste={handleCodePaste}>
                  {code.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { codeRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(idx, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className="w-12 h-14 text-center text-xl font-semibold rounded-xl outline-none transition-all"
                      style={{
                        background: "var(--kc-surface-muted)",
                        border: `2px solid ${digit ? "var(--kc-link)" : "var(--kc-border)"}`,
                        color: "var(--kc-primary)",
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm mb-4 text-center"
                    style={{ color: "var(--kc-error)" }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || code.join("").length < CODE_LENGTH}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("auth.signingIn", lang)}
                    </>
                  ) : (
                    <>
                      {t("auth.verifyCode", lang)}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="w-full mt-4 text-secondary text-sm hover:opacity-70 transition-opacity disabled:opacity-40"
                >
                  {resendTimer > 0
                    ? t("auth.resendIn", lang, { sec: resendTimer })
                    : t("auth.resendCode", lang)}
                </button>
              </motion.form>
            )}

            {/* Step 3: 2FA Password */}
            {authStep === "password" && (
              <motion.form
                key="password"
                onSubmit={handleCheckPassword}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={cancelAuth}
                  className="flex items-center gap-1 text-secondary mb-4 hover:opacity-70 transition-opacity"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("auth.back", lang)}
                </button>

                <label className="block text-subtitle mb-2">
                  {t("auth.passwordLabel", lang)}
                </label>
                <p className="text-secondary mb-4">{t("auth.passwordHint", lang)}</p>

                <div className="relative mb-4">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl text-body outline-none transition-colors"
                    style={{
                      background: "var(--kc-surface-muted)",
                      border: "1px solid var(--kc-border)",
                      color: "var(--kc-primary)",
                    }}
                  />
                </div>

                {isDemo && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-caption text-center"
                    style={{
                      background: "rgba(59, 130, 246, 0.06)",
                      color: "var(--kc-link)",
                    }}
                  >
                    {t("auth.demoModePassword", lang)}
                  </div>
                )}

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm mb-4 text-center"
                    style={{ color: "var(--kc-error)" }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("auth.signingIn", lang)}
                    </>
                  ) : (
                    <>
                      {t("auth.signIn", lang)}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-caption mt-6 opacity-50">
          kicloud v2.0 · файлы до 2 ГБ · шифрование AES-256
        </p>
      </motion.div>
    </div>
  );
}
