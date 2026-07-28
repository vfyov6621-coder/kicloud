"use client";

/**
 * kicloud — Dashboard
 * ТЗ 6.1, 6.2.2: основной лейаут (Sidebar + Content).
 * Навигация через Zustand currentView, не URL-роутинг (ТЗ 6.1).
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useStorageStore } from "@/stores/storage-store";
import { Sidebar } from "./Sidebar";
import { FileBrowser } from "./FileBrowser";
import { TrashView } from "./TrashView";
import { SettingsPanel } from "./SettingsPanel";
import {
  CreateFolderModal,
  RenameFolderModal,
  RenameFileModal,
  MoveFileModal,
  FileInfoModal,
} from "./Modals";
import { toast } from "sonner";

export function Dashboard() {
  const session = useAuthStore((s) => s.session);
  const loadFolders = useStorageStore((s) => s.loadFolders);
  const currentView = useStorageStore((s) => s.currentView);
  const lang = useSettingsStore((s) => s.language);

  // Modals state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolder, setRenameFolder] = useState<{ id: string; name: string } | null>(null);
  const [renameFile, setRenameFile] = useState<{ id: string; name: string } | null>(null);
  const [moveFile, setMoveFile] = useState<{ id: string; name: string } | null>(null);
  const [fileInfo, setFileInfo] = useState<{ id: string } | null>(null);

  // Mobile sidebar drawer
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    // Показать toast о demo-режиме
    toast.info(lang === "ru" ? "Demo-режим активен. Реальное хранилище не подключено." : "Demo mode is active. Real storage is not connected.", {
      duration: 4000,
    });
  }, [lang]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          onCreateFolder={() => setCreateFolderOpen(true)}
          onRenameFolder={(id, name) => setRenameFolder({ id, name })}
        />
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50"
            >
              <Sidebar
                onCreateFolder={() => {
                  setMobileSidebarOpen(false);
                  setCreateFolderOpen(true);
                }}
                onRenameFolder={(id, name) => {
                  setMobileSidebarOpen(false);
                  setRenameFolder({ id, name });
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center justify-between p-3 surface-panel"
          style={{ borderRadius: 0, borderBottom: "1px solid var(--kc-border)", borderTop: "none", borderLeft: "none", borderRight: "none" }}
        >
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-[15px]">kicloud</span>
          <div className="w-9" />
        </div>

        {/* View content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex overflow-hidden"
          >
            {currentView === "files" && (
              <FileBrowser
                onRenameFile={(f) => setRenameFile(f)}
                onMoveFile={(f) => setMoveFile(f)}
                onFileInfo={(f) => setFileInfo(f)}
              />
            )}
            {currentView === "trash" && <TrashView />}
            {currentView === "settings" && <SettingsPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <CreateFolderModal open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} />
      <RenameFolderModal
        open={renameFolder !== null}
        onClose={() => setRenameFolder(null)}
        folderId={renameFolder?.id ?? null}
        currentName={renameFolder?.name ?? ""}
      />
      <RenameFileModal
        open={renameFile !== null}
        onClose={() => setRenameFile(null)}
        fileId={renameFile?.id ?? null}
        currentName={renameFile?.name ?? ""}
      />
      <MoveFileModal
        open={moveFile !== null}
        onClose={() => setMoveFile(null)}
        fileId={moveFile?.id ?? null}
        fileName={moveFile?.name ?? ""}
      />
      <FileInfoModal
        open={fileInfo !== null}
        onClose={() => setFileInfo(null)}
        fileId={fileInfo?.id ?? null}
      />
    </div>
  );
}
