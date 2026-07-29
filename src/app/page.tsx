"use client";

/**
 * kicloud — Main page
 * Если сессии нет — AuthScreen, иначе — Dashboard.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { AuthScreen } from "@/components/cloud/AuthScreen";
import { Dashboard } from "@/components/cloud/Dashboard";

export default function Home() {
  const session = useAuthStore((s) => s.session);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const init = useAuthStore((s) => s.init);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);

  // Failsafe: через 8с принудительно показываем UI (даже если init завис)
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    loadSettings();
    init();
  }, [loadSettings, init]);

  if ((!isInitialized || !settingsLoaded) && !forceShow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--kc-link) 0%, var(--kc-primary) 100%)",
              boxShadow: "0 8px 24px rgba(59, 130, 246, 0.3)",
            }}
          >
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-secondary">kicloud loading…</p>
        </motion.div>
      </div>
    );
  }

  return session ? <Dashboard /> : <AuthScreen />;
}

