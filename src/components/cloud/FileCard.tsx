"use client";

/**
 * TCloud — FileCard
 * ТЗ 3.4.4: квадратная карточка с glass-эффектом, иконка, имя, размер.
 * Hover: lift + shadow. Context menu.
 */

import { motion } from "framer-motion";
import { Download, Trash2, MoreVertical, Lock, Star, Info, Pencil, FolderInput } from "lucide-react";
import type { CloudFile } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { t } from "@/lib/i18n";
import { formatFileSize, formatDate, getFileIcon } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

interface FileCardProps {
  file: CloudFile;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
  onMove: () => void;
  onToggleFavorite: () => void;
  onInfo: () => void;
  index?: number;
}

export function FileCard({
  file,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onToggleFavorite,
  onInfo,
  index = 0,
}: FileCardProps) {
  const lang = useSettingsStore((s) => s.language);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.02, 0.3), type: "spring", stiffness: 300, damping: 25 }}
          whileHover={{ y: -4 }}
          className="glass-panel group relative cursor-pointer overflow-hidden"
          style={{ borderRadius: 16 }}
        >
          {/* Icon area */}
          <div
            className="aspect-square flex items-center justify-center text-5xl relative"
            style={{
              background: "linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)",
            }}
          >
            <span className="select-none">{getFileIcon(file.mimeType, file.name)}</span>

            {/* Encrypted badge */}
            {file.encrypted && (
              <div
                className="absolute top-2 left-2 p-1 rounded-md"
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(10px)",
                }}
                title={t("files.encrypted", lang)}
              >
                <Lock className="w-3 h-3 text-white" />
              </div>
            )}

            {/* Favorite badge */}
            {file.isFavorite && (
              <div
                className="absolute top-2 right-2 p-1 rounded-md"
                style={{
                  background: "rgba(255, 149, 0, 0.85)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Star className="w-3 h-3 text-white fill-white" />
              </div>
            )}

            {/* Hover actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!file.isFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  style={{ background: "rgba(255, 255, 255, 0.7)" }}
                  title={t("files.favorite", lang)}
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                style={{ background: "rgba(255, 255, 255, 0.7)" }}
                title={t("files.download", lang)}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-md hover:bg-red-100 transition-colors"
                style={{ background: "rgba(255, 255, 255, 0.7)" }}
                title={t("files.delete", lang)}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-3">
            <div className="font-medium text-[13px] truncate" title={file.name}>
              {file.name}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] opacity-50">
                {formatFileSize(file.size, lang)}
              </span>
              <span className="text-[11px] opacity-50">
                {formatDate(file.createdAt, lang)}
              </span>
            </div>
          </div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onDownload}>
          <Download className="w-4 h-4 mr-2" />
          {t("files.download", lang)}
        </ContextMenuItem>
        <ContextMenuItem onClick={onInfo}>
          <Info className="w-4 h-4 mr-2" />
          {t("files.info", lang)}
        </ContextMenuItem>
        <ContextMenuItem onClick={onRename}>
          <Pencil className="w-4 h-4 mr-2" />
          {t("files.rename", lang)}
        </ContextMenuItem>
        <ContextMenuItem onClick={onMove}>
          <FolderInput className="w-4 h-4 mr-2" />
          {t("files.move", lang)}
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          <Star className="w-4 h-4 mr-2" />
          {file.isFavorite ? t("files.unfavorite", lang) : t("files.favorite", lang)}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="text-red-500">
          <Trash2 className="w-4 h-4 mr-2" />
          {t("files.delete", lang)}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
