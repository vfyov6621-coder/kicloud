"use client";

/**
 * TCloud — Modals
 * ТЗ 3.4.5 + 6.1: CreateFolderModal, FilePreview, FileInfoModal, RenameModal, MoveModal.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderPlus, Pencil, FolderInput, Info, Lock, Star } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { useStorageStore } from "@/stores/storage-store";
import { t } from "@/lib/i18n";
import { formatFileSize, formatDate, getFileIcon } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";
import { GlassButton } from "./GlassButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FOLDER_EMOJIS = ["📁", "📂", "📄", "🖼️", "🎬", "🎵", "📦", "🔐", "💼", "🎓", "⚡", "🌟", "🔥", "💎", "🚀", "🎯"];

/* ============ Create Folder Modal ============ */
export function CreateFolderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lang = useSettingsStore((s) => s.language);
  const createFolder = useStorageStore((s) => s.createFolder);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setIcon("📁");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await createFolder(name.trim(), icon);
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel-strong p-0 overflow-hidden border-0" style={{ borderRadius: 20, maxWidth: 440 }}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <FolderPlus className="w-5 h-5" />
            {t("folders.createTitle", lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">
              {t("folders.iconLabel", lang)}
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {FOLDER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    icon === emoji ? "bg-black/10 dark:bg-white/10 scale-110" : "hover:bg-black/5"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">
              {t("folders.namePlaceholder", lang)}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("folders.namePlaceholder", lang)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: "rgba(0, 0, 0, 0.04)",
                border: "1px solid var(--tc-border)",
                color: "var(--tc-primary)",
              }}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <GlassButton variant="ghost" size="sm" onClick={onClose}>
              {t("folders.cancel", lang)}
            </GlassButton>
            <GlassButton size="sm" onClick={handleSubmit} disabled={!name.trim() || isCreating}>
              {t("folders.createButton", lang)}
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Rename Folder Modal ============ */
export function RenameFolderModal({
  open,
  onClose,
  folderId,
  currentName,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
  currentName: string;
}) {
  const lang = useSettingsStore((s) => s.language);
  const renameFolder = useStorageStore((s) => s.renameFolder);
  const [name, setName] = useState(currentName);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация состояния формы при открытии модала с новыми props
    setName(currentName);
  }, [currentName, open]);

  const handleSubmit = async () => {
    if (!folderId || !name.trim()) return;
    await renameFolder(folderId, name.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel-strong p-0 overflow-hidden border-0" style={{ borderRadius: 20, maxWidth: 440 }}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <Pencil className="w-5 h-5" />
            {t("folders.renameTitle", lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: "rgba(0, 0, 0, 0.04)",
              border: "1px solid var(--tc-border)",
              color: "var(--tc-primary)",
            }}
          />
          <div className="flex gap-2 justify-end">
            <GlassButton variant="ghost" size="sm" onClick={onClose}>
              {t("folders.cancel", lang)}
            </GlassButton>
            <GlassButton size="sm" onClick={handleSubmit}>
              {t("common.save", lang)}
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Rename File Modal ============ */
export function RenameFileModal({
  open,
  onClose,
  fileId,
  currentName,
}: {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  currentName: string;
}) {
  const lang = useSettingsStore((s) => s.language);
  const renameFile = useStorageStore((s) => s.renameFile);
  const [name, setName] = useState(currentName);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация состояния формы при открытии модала с новыми props
    setName(currentName);
  }, [currentName, open]);

  const handleSubmit = async () => {
    if (!fileId || !name.trim()) return;
    await renameFile(fileId, name.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel-strong p-0 overflow-hidden border-0" style={{ borderRadius: 20, maxWidth: 440 }}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <Pencil className="w-5 h-5" />
            {t("files.renameTitle", lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: "rgba(0, 0, 0, 0.04)",
              border: "1px solid var(--tc-border)",
              color: "var(--tc-primary)",
            }}
          />
          <div className="flex gap-2 justify-end">
            <GlassButton variant="ghost" size="sm" onClick={onClose}>
              {t("folders.cancel", lang)}
            </GlassButton>
            <GlassButton size="sm" onClick={handleSubmit}>
              {t("common.save", lang)}
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Move File Modal ============ */
export function MoveFileModal({
  open,
  onClose,
  fileId,
  fileName,
}: {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName: string;
}) {
  const lang = useSettingsStore((s) => s.language);
  const { folders, currentFolderId, moveFile } = useStorageStore();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс выбора при закрытии/открытии модала
    setSelected(null);
  }, [open]);

  const handleSubmit = async () => {
    if (!fileId || !selected) return;
    await moveFile(fileId, selected);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel-strong p-0 overflow-hidden border-0" style={{ borderRadius: 20, maxWidth: 440 }}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <FolderInput className="w-5 h-5" />
            {t("files.moveTitle", lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3">
          <p className="text-sm opacity-50">{fileName}</p>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelected(folder.id)}
                disabled={folder.id === currentFolderId}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left disabled:opacity-40 ${
                  selected === folder.id ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/5"
                }`}
              >
                <span className="text-xl">{folder.icon}</span>
                <span className="flex-1 text-sm font-medium">{folder.name}</span>
                {selected === folder.id && <span style={{ color: "var(--tc-link)" }}>✓</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <GlassButton variant="ghost" size="sm" onClick={onClose}>
              {t("folders.cancel", lang)}
            </GlassButton>
            <GlassButton size="sm" onClick={handleSubmit} disabled={!selected}>
              {t("files.move", lang)}
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ File Info Modal ============ */
export function FileInfoModal({
  open,
  onClose,
  fileId,
}: {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
}) {
  const lang = useSettingsStore((s) => s.language);
  const files = useStorageStore((s) => s.files);
  const folders = useStorageStore((s) => s.folders);

  const file = fileId ? files.find((f) => f.id === fileId) : null;
  if (!file) return null;
  const folder = folders.find((f) => f.id === file.folderId);

  const rows: { label: string; value: string }[] = [
    { label: t("files.info.name", lang), value: file.name },
    { label: t("files.info.size", lang), value: formatFileSize(file.size, lang) },
    { label: t("files.info.type", lang), value: file.mimeType },
    { label: t("files.info.folder", lang), value: folder ? `${folder.icon} ${folder.name}` : "—" },
    { label: t("files.info.created", lang), value: formatDate(file.createdAt, lang) },
    { label: t("files.info.modified", lang), value: formatDate(file.updatedAt, lang) },
    { label: t("files.info.encrypted", lang), value: file.encrypted ? `✓ ${t("files.encrypted", lang)}` : "—" },
    { label: t("files.info.messageId", lang), value: String(file.messageId) },
    { label: t("files.info.fileId", lang), value: file.id.slice(0, 8) + "…" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel-strong p-0 overflow-hidden border-0" style={{ borderRadius: 20, maxWidth: 440 }}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <Info className="w-5 h-5" />
            {t("files.infoTitle", lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          <div className="flex items-center gap-4 mb-4 p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.03)" }}>
            <span className="text-5xl">{getFileIcon(file.mimeType, file.name)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{file.name}</div>
              <div className="text-sm opacity-50">{formatFileSize(file.size, lang)}</div>
              <div className="flex items-center gap-2 mt-1">
                {file.encrypted && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,122,255,0.1)", color: "var(--tc-link)" }}>
                    <Lock className="w-3 h-3 inline mr-1" />
                    {t("files.encrypted", lang)}
                  </span>
                )}
                {file.isFavorite && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,149,0,0.1)", color: "var(--tc-warning)" }}>
                    <Star className="w-3 h-3 inline mr-1 fill-current" />
                    {t("files.favorite", lang)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between py-2 border-b" style={{ borderColor: "var(--tc-border)" }}>
                <span className="text-sm opacity-50">{row.label}</span>
                <span className="text-sm font-medium text-right ml-3 break-all">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <GlassButton size="sm" onClick={onClose}>
              {t("common.close", lang)}
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
