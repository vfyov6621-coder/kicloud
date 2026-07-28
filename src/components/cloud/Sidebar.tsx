"use client";

/**
 * TCloud — Sidebar
 * ТЗ 3.4.3: Glass Sidebar 260px / 72px свёрнутый, emoji-иконки, корзина/настройки внизу.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderPlus,
  Trash2,
  Settings,
  Cloud,
  ChevronLeft,
  MoreHorizontal,
  Pencil,
  Trash,
  HardDrive,
} from "lucide-react";
import { useStorageStore } from "@/stores/storage-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { getInitials, getAvatarColor, cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  onCreateFolder: () => void;
  onRenameFolder: (folderId: string, currentName: string) => void;
}

const FOLDER_ICONS = ["📁", "📂", "📄", "🖼️", "🎬", "🎵", "📦", "🔐", "💼", "🎓", "⚡", "🌟"];

export function Sidebar({ onCreateFolder, onRenameFolder }: SidebarProps) {
  const lang = useSettingsStore((s) => s.language);
  const session = useAuthStore((s) => s.session);
  const {
    folders,
    currentFolderId,
    currentView,
    setCurrentFolder,
    setCurrentView,
    deleteFolder,
  } = useStorageStore();
  const [collapsed, setCollapsed] = useState(false);

  const userName = session ? `${session.firstName ?? ""} ${session.lastName ?? ""}`.trim() || "User" : "User";

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="glass-panel flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        borderRadius: 0,
        borderRight: "1px solid var(--tc-border)",
        borderLeft: "none",
        borderTop: "none",
        borderBottom: "none",
      }}
    >
      {/* Header: Logo + collapse */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--tc-border)" }}>
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--tc-link) 0%, var(--tc-primary) 100%)",
                }}
              >
                <Cloud className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-[17px]">TCloud</span>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
              style={{
                background: "linear-gradient(135deg, var(--tc-link) 0%, var(--tc-primary) 100%)",
              }}
            >
              <Cloud className="w-5 h-5 text-white" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Folders list */}
      <div className="flex-1 overflow-y-auto p-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-caption uppercase tracking-wider opacity-50">
              {t("folders.title", lang)}
            </span>
          </div>
        )}

        <div className="space-y-0.5">
          {folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => {
                    setCurrentFolder(folder.id);
                    setCurrentView("files");
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                    "hover:bg-black/5 dark:hover:bg-white/5",
                    currentFolderId === folder.id && currentView === "files" && "bg-black/[0.08] dark:bg-white/[0.1]",
                    collapsed && "justify-center px-0"
                  )}
                  title={collapsed ? folder.name : undefined}
                >
                  <span className="text-xl flex-shrink-0">{folder.icon}</span>
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] truncate">{folder.name}</div>
                      <div className="text-[11px] opacity-50">
                        {t("folders.fileCount", lang, { count: folder.fileCount })}
                      </div>
                    </div>
                  )}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onRenameFolder(folder.id, folder.name)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t("folders.rename", lang)}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    if (confirm(t("folders.deleteConfirm", lang, { name: folder.name }))) {
                      deleteFolder(folder.id);
                    }
                  }}
                  className="text-red-500"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  {t("folders.delete", lang)}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>

        {/* Create folder */}
        <button
          onClick={onCreateFolder}
          className={cn(
            "mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
            "hover:bg-black/5 dark:hover:bg-white/5 text-[14px] font-medium",
            "border border-dashed opacity-70 hover:opacity-100",
            collapsed && "justify-center px-0"
          )}
          style={{ borderColor: "var(--tc-border)" }}
          title={collapsed ? t("folders.create", lang) : undefined}
        >
          <FolderPlus className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>{t("folders.create", lang)}</span>}
        </button>
      </div>

      {/* Footer: account + trash + settings */}
      <div className="border-t p-2 space-y-0.5" style={{ borderColor: "var(--tc-border)" }}>
        <button
          onClick={() => setCurrentView("trash")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
            "hover:bg-black/5 dark:hover:bg-white/5",
            currentView === "trash" && "bg-black/[0.08] dark:bg-white/[0.1]",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? t("nav.trash", lang) : undefined}
        >
          <Trash2 className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-[14px] font-medium">{t("nav.trash", lang)}</span>}
        </button>

        <button
          onClick={() => setCurrentView("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
            "hover:bg-black/5 dark:hover:bg-white/5",
            currentView === "settings" && "bg-black/[0.08] dark:bg-white/[0.1]",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? t("nav.settings", lang) : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-[14px] font-medium">{t("nav.settings", lang)}</span>}
        </button>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mt-2",
                "hover:bg-black/5 dark:hover:bg-white/5",
                collapsed && "justify-center px-0"
              )}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: getAvatarColor(userName) }}
              >
                {getInitials(userName)}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-[13px] truncate">{userName}</div>
                  <div className="text-[11px] opacity-50 truncate">
                    {session?.phone ?? session?.username ?? "demo"}
                  </div>
                </div>
              )}
              {!collapsed && <MoreHorizontal className="w-4 h-4 opacity-50" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setCollapsed(!collapsed)}>
              <ChevronLeft className="w-4 h-4 mr-2 rotate-180" />
              {collapsed ? "Развернуть" : "Свернуть"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentView("settings")}>
              <Settings className="w-4 h-4 mr-2" />
              {t("nav.settings", lang)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentView("trash")}>
              <HardDrive className="w-4 h-4 mr-2" />
              {t("nav.trash", lang)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}
