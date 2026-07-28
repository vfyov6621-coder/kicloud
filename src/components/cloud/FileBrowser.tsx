"use client";

/**
 * kicloud — FileBrowser
 * ТЗ 6.2.2: основной экран. Тулбар (поиск, Grid/List, сортировка, Upload).
 * Grid — карточки 4-6 колонок. List — таблица.
 * Drag-and-drop: overlay с подсветкой.
 */

import { useState, useCallback, useRef, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  Upload,
  Download,
  Trash2,
  Lock,
  Star,
  Info,
  Pencil,
  FolderInput,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { useStorageStore } from "@/stores/storage-store";
import { useSettingsStore } from "@/stores/settings-store";
import { t } from "@/lib/i18n";
import { formatFileSize, formatDate, getFileIcon, cn } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";
import { GlassButton } from "./GlassButton";
import { FileCard } from "./FileCard";
import { Progress } from "@/components/ui/progress";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileBrowserProps {
  onRenameFile: (file: { id: string; name: string }) => void;
  onMoveFile: (file: { id: string; name: string }) => void;
  onFileInfo: (file: { id: string }) => void;
}

export function FileBrowser({ onRenameFile, onMoveFile, onFileInfo }: FileBrowserProps) {
  const lang = useSettingsStore((s) => s.language);
  const viewMode = useSettingsStore((s) => s.viewMode);
  const sortBy = useSettingsStore((s) => s.sortBy);
  const encryptionEnabled = useSettingsStore((s) => s.encryptionEnabled);
  const encryptionPassword = useSettingsStore((s) => s.encryptionPassword);
  const setViewMode = useSettingsStore((s) => s.setViewMode);
  const setSortBy = useSettingsStore((s) => s.setSortBy);
  const {
    folders,
    currentFolderId,
    files,
    uploads,
    downloads,
    searchQuery,
    searchResults,
    setSearch,
    uploadFiles,
    downloadFile,
    deleteFile,
    renameFile,
    moveFile,
    toggleFavorite,
  } = useStorageStore();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const displayedFiles = searchQuery.trim() && searchResults ? searchResults : files;

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (!currentFolderId) return;
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length === 0) return;
      await uploadFiles(dropped, currentFolderId, encryptionEnabled, encryptionPassword);
    },
    [currentFolderId, uploadFiles, encryptionEnabled, encryptionPassword]
  );

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !currentFolderId) return;
    const selected = Array.from(e.target.files);
    await uploadFiles(selected, currentFolderId, encryptionEnabled, encryptionPassword);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    try {
      const blob = await downloadFile(file, encryptionPassword);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    if (!confirm(t("files.deleteConfirm", lang, { name: file.name }))) return;
    await deleteFile(fileId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="surface-panel m-4 mb-2 p-3 flex items-center gap-3 flex-wrap" style={{ borderRadius: 16 }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("files.searchPlaceholder", lang)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-colors"
            style={{
              background: "rgba(0, 0, 0, 0.04)",
              border: "1px solid transparent",
              color: "var(--kc-primary)",
            }}
          />
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(0, 0, 0, 0.04)" }}>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              viewMode === "grid" ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-50"
            )}
            style={viewMode === "grid" ? { background: "var(--kc-surface)" } : {}}
            title={t("files.gridView", lang)}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              viewMode === "list" ? "bg-white dark:bg-white/10 shadow-sm" : "opacity-50"
            )}
            style={viewMode === "list" ? { background: "var(--kc-surface)" } : {}}
            title={t("files.listView", lang)}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Sort */}
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as typeof sortBy)}
        >
          <SelectTrigger className="w-auto gap-2 border-none" style={{ background: "rgba(0, 0, 0, 0.04)" }}>
            <ArrowUpDown className="w-4 h-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">{t("files.sortByName", lang)} ↑</SelectItem>
            <SelectItem value="name-desc">{t("files.sortByName", lang)} ↓</SelectItem>
            <SelectItem value="size-asc">{t("files.sortBySize", lang)} ↑</SelectItem>
            <SelectItem value="size-desc">{t("files.sortBySize", lang)} ↓</SelectItem>
            <SelectItem value="date-asc">{t("files.sortByDate", lang)} ↑</SelectItem>
            <SelectItem value="date-desc">{t("files.sortByDate", lang)} ↓</SelectItem>
          </SelectContent>
        </Select>

        {/* Upload button */}
        <GlassButton
          onClick={() => fileInputRef.current?.click()}
          size="sm"
        >
          <Upload className="w-4 h-4" />
          {t("files.upload", lang)}
        </GlassButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Active downloads/uploads progress (floating) */}
      {(uploads.length > 0 || downloads.length > 0) && (
        <div className="mx-4 mb-2 space-y-2">
          <AnimatePresence>
            {uploads.map((u) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <GlassPanel className="p-3 flex items-center gap-3" style={{ borderRadius: 12 }}>
                  {u.status === "error" ? (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : u.status === "done" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: "var(--kc-link)" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{u.fileName}</span>
                      <span className="text-xs opacity-50">
                        {u.status === "encrypting"
                          ? t("files.progress.encrypting", lang)
                          : u.status === "uploading"
                          ? `${u.percent}%`
                          : u.status === "done"
                          ? t("files.progress.done", lang)
                          : u.status === "error"
                          ? t("files.progress.error", lang)
                          : t("files.progress.uploading", lang)}
                      </span>
                    </div>
                    <Progress value={u.percent} className="h-1.5 mt-1.5" />
                  </div>
                  <span className="text-xs opacity-50 flex-shrink-0">
                    {formatFileSize(u.size, lang)}
                  </span>
                </GlassPanel>
              </motion.div>
            ))}
            {downloads.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <GlassPanel className="p-3 flex items-center gap-3" style={{ borderRadius: 12 }}>
                  {d.status === "error" ? (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : d.status === "done" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Download className="w-5 h-5 animate-bounce flex-shrink-0" style={{ color: "var(--kc-link)" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{d.fileName}</span>
                      <span className="text-xs opacity-50">
                        {d.status === "decrypting"
                          ? t("files.progress.decrypting", lang)
                          : d.status === "downloading"
                          ? `${d.percent}%`
                          : d.status === "done"
                          ? t("files.progress.done", lang)
                          : d.status === "error"
                          ? t("files.progress.error", lang)
                          : t("files.progress.downloading", lang)}
                      </span>
                    </div>
                    <Progress value={d.percent} className="h-1.5 mt-1.5" />
                  </div>
                </GlassPanel>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Files area */}
      <div
        className="flex-1 m-4 mt-2 relative overflow-y-auto"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 rounded-2xl dropzone-active flex items-center justify-center"
            >
              <div className="text-center">
                <FileUp className="w-16 h-16 mx-auto mb-3" style={{ color: "var(--kc-link)" }} />
                <p className="text-section-title">
                  {t("files.uploadDropActive", lang)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {displayedFiles.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="text-7xl mb-4 opacity-30">📂</div>
              <p className="text-section-title mb-2">
                {searchQuery.trim() ? t("files.noResults", lang) : t("files.empty", lang)}
              </p>
              {!searchQuery.trim() && (
                <p className="text-secondary">{t("files.emptyHint", lang)}</p>
              )}
            </div>
          </div>
        )}

        {/* Grid view */}
        {viewMode === "grid" && displayedFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayedFiles.map((file, idx) => (
              <FileCard
                key={file.id}
                file={file}
                index={idx}
                onDownload={() => handleDownload(file.id)}
                onDelete={() => handleDelete(file.id)}
                onRename={() => onRenameFile({ id: file.id, name: file.name })}
                onMove={() => onMoveFile({ id: file.id, name: file.name })}
                onToggleFavorite={() => toggleFavorite(file.id)}
                onInfo={() => onFileInfo({ id: file.id })}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && displayedFiles.length > 0 && (
          <GlassPanel className="overflow-hidden" style={{ borderRadius: 16 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--kc-border)" }}>
                  <th className="text-left p-3 text-caption uppercase tracking-wider opacity-50 font-medium">
                    {t("files.column.name", lang)}
                  </th>
                  <th className="text-left p-3 text-caption uppercase tracking-wider opacity-50 font-medium w-32">
                    {t("files.column.size", lang)}
                  </th>
                  <th className="text-left p-3 text-caption uppercase tracking-wider opacity-50 font-medium w-40">
                    {t("files.column.date", lang)}
                  </th>
                  <th className="p-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {displayedFiles.map((file, idx) => (
                  <ContextMenu key={file.id}>
                    <ContextMenuTrigger asChild>
                      <tr
                        className={cn(
                          "border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors cursor-pointer",
                          idx === 0 && "border-t-0"
                        )}
                        style={{ borderColor: "var(--kc-border)" }}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl flex-shrink-0">{getFileIcon(file.mimeType, file.name)}</span>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                {file.name}
                                {file.encrypted && <Lock className="w-3 h-3 opacity-50" />}
                                {file.isFavorite && <Star className="w-3 h-3 fill-current text-yellow-500" />}
                              </div>
                              <div className="text-xs opacity-50">{file.mimeType}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm opacity-70">
                          {formatFileSize(file.size, lang)}
                        </td>
                        <td className="p-3 text-sm opacity-70">
                          {formatDate(file.createdAt, lang)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(file.id); }}
                              className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                              title={t("files.download", lang)}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                              className="p-1.5 rounded-md hover:bg-red-100 transition-colors"
                              title={t("files.delete", lang)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleDownload(file.id)}>
                        <Download className="w-4 h-4 mr-2" />
                        {t("files.download", lang)}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onFileInfo({ id: file.id })}>
                        <Info className="w-4 h-4 mr-2" />
                        {t("files.info", lang)}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onRenameFile({ id: file.id, name: file.name })}>
                        <Pencil className="w-4 h-4 mr-2" />
                        {t("files.rename", lang)}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onMoveFile({ id: file.id, name: file.name })}>
                        <FolderInput className="w-4 h-4 mr-2" />
                        {t("files.move", lang)}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => toggleFavorite(file.id)}>
                        <Star className="w-4 h-4 mr-2" />
                        {file.isFavorite ? t("files.unfavorite", lang) : t("files.favorite", lang)}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleDelete(file.id)} className="text-red-500">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("files.delete", lang)}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </tbody>
            </table>
          </GlassPanel>
        )}
      </div>

      {/* Folder header (title) */}
      {currentFolder && !searchQuery.trim() && (
        <div className="px-4 pb-2">
          <p className="text-caption opacity-50">
            {currentFolder.icon} {currentFolder.name} · {t("folders.fileCount", lang, { count: currentFolder.fileCount })}
          </p>
        </div>
      )}
    </div>
  );
}
