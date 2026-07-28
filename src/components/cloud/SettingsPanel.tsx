"use client";

/**
 * kicloud — SettingsPanel
 * ТЗ 6.2.3: iOS Settings-style. Секции: Аккаунт, Шифрование, Оформление, Язык, Хранилище, О приложении.
 * ТЗ S-01..S-06.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Lock,
  Palette,
  Languages,
  HardDrive,
  Info,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { useStorageStore } from "@/stores/storage-store";
import { t } from "@/lib/i18n";
import { formatFileSize, cn } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";
import { GlassButton } from "./GlassButton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const COLOR_PRESETS = [
  { id: "mono", name: "settings.presetMono", primary: "#0f172a", accent: "#64748b", bg: "#ffffff" },
  { id: "blue", name: "settings.presetBlue", primary: "#1e40af", accent: "#3b82f6", bg: "#eff6ff" },
  { id: "green", name: "settings.presetGreen", primary: "#15803d", accent: "#10b981", bg: "#ecfdf5" },
  { id: "red", name: "settings.presetRed", primary: "#b91c1c", accent: "#ef4444", bg: "#fef2f2" },
  { id: "purple", name: "settings.presetPurple", primary: "#7c3aed", accent: "#a855f7", bg: "#faf5ff" },
];

export function SettingsPanel() {
  const {
    language,
    themeMode,
    themePrimary,
    themeAccent,
    themeBackground,
    encryptionEnabled,
    encryptionPassword,
    setLanguage,
    setThemeMode,
    setColors,
    setEncryptionEnabled,
    setEncryptionPassword,
  } = useSettingsStore();

  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const getStats = useStorageStore((s) => s.getStats);

  const [stats, setStats] = useState<{ filesCount: number; foldersCount: number; totalSize: number }>({ filesCount: 0, foldersCount: 0, totalSize: 0 });
  const [passwordDraft, setPasswordDraft] = useState(encryptionPassword ?? "");

  useEffect(() => {
    getStats().then(setStats);
  }, [getStats]);

  const handleSignOut = async () => {
    if (!confirm(t("settings.signOutConfirm", language))) return;
    await signOut();
  };

  const handleEncryptionToggle = async (enabled: boolean) => {
    await setEncryptionEnabled(enabled);
    if (enabled) {
      toast.success(t("toasts.encryptionEnabled", language));
    } else {
      setEncryptionPassword(undefined);
      setPasswordDraft("");
      toast.success(t("toasts.encryptionDisabled", language));
    }
  };

  const handleSavePassword = () => {
    if (passwordDraft && passwordDraft.length < 8) {
      toast.error(t("settings.passwordTooShort", language));
      return;
    }
    setEncryptionPassword(passwordDraft || undefined);
    toast.success(passwordDraft ? t("settings.passwordSet", language) : t("settings.passwordCleared", language));
  };

  const handlePreset = (preset: typeof COLOR_PRESETS[number]) => {
    setColors({
      themePrimary: preset.primary,
      themeAccent: preset.accent,
      themeBackground: preset.bg,
    });
    toast.success(t("settings.presets", language));
  };

  const userName = session ? `${session.firstName ?? ""} ${session.lastName ?? ""}`.trim() || "User" : "User";

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-screen-title mb-6 px-2">{t("settings.title", language)}</h1>

        <div className="space-y-6">
          {/* Account section */}
          <Section title={t("settings.account", language)} icon={<User className="w-4 h-4" />}>
            <div className="p-4 flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: "var(--kc-link)" }}
              >
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[15px]">{userName}</div>
                <div className="text-sm opacity-50">{session?.phone ?? session?.username}</div>
              </div>
            </div>
            <Row label={t("settings.name", language)} value={userName} />
            <Row label={t("settings.phone", language)} value={session?.phone ?? "—"} />
            <Row label={t("settings.username", language)} value={session?.username ? `@${session.username}` : "—"} />
            <div className="p-3">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t("settings.signOut", language)}
              </button>
            </div>
          </Section>

          {/* Encryption section */}
          <Section title={t("settings.encryption", language)} icon={<Lock className="w-4 h-4" />}>
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium text-[15px]">{t("settings.encryptionEnabled", language)}</div>
                <div className="text-sm opacity-50 mt-0.5">{t("settings.encryptionHint", language)}</div>
              </div>
              <Switch
                checked={encryptionEnabled}
                onCheckedChange={handleEncryptionToggle}
              />
            </div>

            {encryptionEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      {t("settings.encryptionPassword", language)}
                    </label>
                    <input
                      type="password"
                      value={passwordDraft}
                      onChange={(e) => setPasswordDraft(e.target.value)}
                      placeholder={t("settings.encryptionPasswordPlaceholder", language)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{
                        background: "rgba(0, 0, 0, 0.04)",
                        border: "1px solid var(--kc-border)",
                        color: "var(--kc-primary)",
                      }}
                    />
                    <p className="text-xs opacity-50 mt-1">
                      {t("settings.encryptionPasswordHint", language)}
                    </p>
                  </div>
                  <GlassButton size="sm" onClick={handleSavePassword}>
                    <Check className="w-4 h-4" />
                    {t("common.save", language)}
                  </GlassButton>
                  <div
                    className="flex items-start gap-2 p-3 rounded-xl text-xs"
                    style={{
                      background: "rgba(255, 149, 0, 0.08)",
                      color: "var(--kc-warning)",
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{t("settings.encryptionFormat", language)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </Section>

          {/* Appearance section */}
          <Section title={t("settings.appearance", language)} icon={<Palette className="w-4 h-4" />}>
            <div className="p-4">
              <div className="font-medium text-[15px] mb-3">{t("settings.theme", language)}</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "light", label: t("settings.light", language), icon: <Sun className="w-4 h-4" /> },
                  { id: "dark", label: t("settings.dark", language), icon: <Moon className="w-4 h-4" /> },
                  { id: "system", label: t("settings.system", language), icon: <Monitor className="w-4 h-4" /> },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setThemeMode(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                      themeMode === opt.id
                        ? "border-current opacity-100"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                    style={{
                      background: themeMode === opt.id ? "rgba(0, 122, 255, 0.08)" : "rgba(0,0,0,0.03)",
                    }}
                  >
                    {opt.icon}
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t" style={{ borderColor: "var(--kc-border)" }}>
              <div className="font-medium text-[15px] mb-3">{t("settings.presets", language)}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-xl border transition-all",
                      themePrimary === preset.primary
                        ? "border-current opacity-100"
                        : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    style={{
                      background: preset.bg,
                    }}
                  >
                    <div className="flex gap-0.5">
                      <div className="w-4 h-4 rounded-full" style={{ background: preset.primary }} />
                      <div className="w-4 h-4 rounded-full" style={{ background: preset.accent }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: preset.primary }}>
                      {t(preset.name, language)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t" style={{ borderColor: "var(--kc-border)" }}>
              <div className="font-medium text-[15px] mb-3">{t("settings.colors", language)}</div>
              <ColorRow
                label={t("settings.primaryColor", language)}
                value={themePrimary}
                onChange={(v) => setColors({ themePrimary: v })}
              />
              <ColorRow
                label={t("settings.accentColor", language)}
                value={themeAccent}
                onChange={(v) => setColors({ themeAccent: v })}
              />
              <ColorRow
                label={t("settings.backgroundColor", language)}
                value={themeBackground}
                onChange={(v) => setColors({ themeBackground: v })}
              />
            </div>
          </Section>

          {/* Language section */}
          <Section title={t("settings.language", language)} icon={<Languages className="w-4 h-4" />}>
            <div className="p-4">
              <p className="text-sm opacity-50 mb-3">{t("settings.languageHint", language)}</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "ru", label: t("settings.russian", language) },
                  { id: "en", label: t("settings.english", language) },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setLanguage(opt.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      language === opt.id
                        ? "border-current opacity-100"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                    style={{
                      background: language === opt.id ? "rgba(0, 122, 255, 0.08)" : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <span className="font-medium">{opt.label}</span>
                    {language === opt.id && <Check className="w-4 h-4" style={{ color: "var(--kc-link)" }} />}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Storage section */}
          <Section title={t("settings.storage", language)} icon={<HardDrive className="w-4 h-4" />}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-[15px]">{t("settings.storageUsed", language)}</span>
                <span className="text-sm opacity-50">
                  {formatFileSize(stats.totalSize, language)}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0, 0, 0, 0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (stats.totalSize / (2 * 1024 * 1024 * 1024)) * 100)}%`,
                    background: "var(--kc-link)",
                  }}
                />
              </div>
              <p className="text-xs opacity-50 mt-2">
                {t("settings.totalSize", language, { size: formatFileSize(stats.totalSize, language) })}
              </p>
            </div>
            <Row
              label={t("settings.filesCount", language, { count: stats.filesCount })}
              value={String(stats.filesCount)}
            />
            <Row
              label={t("settings.foldersCount", language, { count: stats.foldersCount })}
              value={String(stats.foldersCount)}
            />
          </Section>

          {/* About section */}
          <Section title={t("settings.about", language)} icon={<Info className="w-4 h-4" />}>
            <Row label={t("settings.version", language)} value="2.0.0" />
            <Row label="Движок" value="gramjs" />
            <Row label="Encryption" value="AES-256-CBC + gzip" />
            <Row label="Format" value=".kienc" />
            <div className="p-4 text-center text-xs opacity-50">
              {t("settings.buildBy", language)}
            </div>
          </Section>
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 mb-2 text-caption uppercase tracking-wider opacity-50">
        {icon}
        {title}
      </div>
      <GlassPanel className="overflow-hidden" style={{ borderRadius: 16 }}>
        {children}
      </GlassPanel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-4 py-3 flex items-center justify-between border-t"
      style={{ borderColor: "var(--kc-border)" }}
    >
      <span className="text-sm">{label}</span>
      <span className="text-sm opacity-50 font-medium">{value}</span>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono opacity-50">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent"
        />
      </div>
    </div>
  );
}
