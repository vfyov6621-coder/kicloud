"use client";

/**
 * kicloud — TrashView
 * ТЗ 6.1 + 4.5: список удалённых файлов, восстановление, удаление навсегда, авто-очистка 30 дней.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, RotateCcw, AlertTriangle, Trash } from "lucide-react";
import { useStorageStore } from "@/stores/storage-store";
import { useSettingsStore } from "@/stores/settings-store";
import { t } from "@/lib/i18n";
import { formatFileSize, formatDate, getFileIcon, cn } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";
import { GlassButton } from "./GlassButton";

export function TrashView() {
  const lang = useSettingsStore((s) => s.language);
  const { trash, loadTrash, restoreFromTrash, deleteFromTrashForever, clearTrash } = useStorageStore();

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const daysLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="surface-panel m-4 mb-2 p-4 flex items-center justify-between" style={{ borderRadius: 16 }}>
        <div>
          <h2 className="text-section-title flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            {t("trash.title", lang)}
          </h2>
          <p className="text-secondary text-sm mt-1">
            {t("trash.autoCleanup", lang)}
          </p>
        </div>
        {trash.length > 0 && (
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(t("trash.clearAllConfirm", lang))) {
                clearTrash();
              }
            }}
          >
            <Trash className="w-4 h-4" />
            {t("trash.clearAll", lang)}
          </GlassButton>
        )}
      </div>

      {/* List */}
      <div className="flex-1 m-4 mt-2 overflow-y-auto">
        {trash.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-7xl mb-4 opacity-30">🗑️</div>
              <p className="text-section-title mb-2">{t("trash.empty", lang)}</p>
              <p className="text-secondary">{t("trash.emptyHint", lang)}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {trash.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                >
                  <GlassPanel className="p-3 flex items-center gap-3" style={{ borderRadius: 12 }}>
                    <span className="text-2xl flex-shrink-0">
                      {getFileIcon(item.mimeType ?? "application/octet-stream", item.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.name}</div>
                      <div className="text-xs opacity-50 flex items-center gap-2">
                        <span>{formatFileSize(item.size, lang)}</span>
                        <span>·</span>
                        <span>{formatDate(item.deletedAt, lang)}</span>
                        <span>·</span>
                        <span style={{ color: "var(--kc-warning)" }}>
                          {t("trash.expiresIn", lang, { days: daysLeft(item.expiresAt) })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => restoreFromTrash(item.id)}
                        className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title={t("trash.restore", lang)}
                      >
                        <RotateCcw className="w-4 h-4" style={{ color: "var(--kc-link)" }} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t("files.deleteConfirm", lang, { name: item.name }))) {
                            deleteFromTrashForever(item.id);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                        title={t("trash.deleteForever", lang)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </GlassPanel>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
