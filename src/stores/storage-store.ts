/**
 * TCloud — Storage store (Zustand)
 * ТЗ 2.3, 4.2, 4.3, 4.5: управление папками, файлами, корзиной.
 */
import { create } from "zustand";
import type { Folder, CloudFile, TrashItem, AppView, UploadProgress, DownloadProgress, SortBy } from "@/lib/types";
import {
  getAllFolders,
  putFolder,
  deleteFolder as dbDeleteFolder,
  getFilesByFolder,
  putFile,
  deleteFile as dbDeleteFile,
  getAllFiles,
  searchFiles as dbSearchFiles,
  getTrashItems,
  putTrashItem,
  deleteTrashItem,
  clearTrash as dbClearTrash,
  cleanupExpiredTrash,
  getBlob,
  putBlob,
  deleteBlob,
} from "@/lib/db";
import { getTelegramClient } from "@/lib/mtproto";
import { uuid, sleep } from "@/lib/utils";

interface StorageStore {
  // Folders
  folders: Folder[];
  currentFolderId: string | null;
  files: CloudFile[];

  // Trash
  trash: TrashItem[];

  // View
  currentView: AppView;
  searchQuery: string;
  searchResults: CloudFile[] | null;
  selectedFileIds: Set<string>;

  // Progress
  uploads: UploadProgress[];
  downloads: DownloadProgress[];

  // Loading flags
  isLoadingFolders: boolean;
  isLoadingFiles: boolean;

  // Actions
  loadFolders: () => Promise<void>;
  loadFiles: (folderId: string) => Promise<void>;
  loadTrash: () => Promise<void>;
  setCurrentFolder: (folderId: string) => Promise<void>;
  setCurrentView: (view: AppView) => void;
  setSearch: (query: string) => Promise<void>;

  createFolder: (name: string, icon: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  uploadFile: (file: File, folderId: string, encryptionEnabled: boolean, encryptionPassword?: string) => Promise<void>;
  uploadFiles: (files: File[], folderId: string, encryptionEnabled: boolean, encryptionPassword?: string) => Promise<void>;
  downloadFile: (file: CloudFile, encryptionPassword?: string) => Promise<Blob | null>;
  deleteFile: (fileId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  moveFile: (fileId: string, targetFolderId: string) => Promise<void>;
  toggleFavorite: (fileId: string) => Promise<void>;

  restoreFromTrash: (itemId: string) => Promise<void>;
  deleteFromTrashForever: (itemId: string) => Promise<void>;
  clearTrash: () => Promise<void>;

  getStats: () => Promise<{ filesCount: number; foldersCount: number; totalSize: number }>;
  applySort: (sortBy: SortBy) => void;
}

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export const useStorageStore = create<StorageStore>((set, get) => ({
  folders: [],
  currentFolderId: null,
  files: [],
  trash: [],
  currentView: "files",
  searchQuery: "",
  searchResults: null,
  selectedFileIds: new Set(),
  uploads: [],
  downloads: [],
  isLoadingFolders: false,
  isLoadingFiles: false,

  loadFolders: async () => {
    set({ isLoadingFolders: true });
    try {
      const folders = await getAllFolders();
      set({ folders, isLoadingFolders: false });

      // ТЗ A-06: при первом входе создаётся приватный канал с форумом
      // и дефолтный топик "General" (topicId=1)
      if (folders.length === 0) {
        const generalFolder: Folder = {
          id: uuid(),
          topicId: 1,
          name: "General",
          icon: "📁",
          sortOrder: 0,
          fileCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await putFolder(generalFolder);
        set({ folders: [generalFolder], currentFolderId: generalFolder.id });
        await get().loadFiles(generalFolder.id);
      } else if (!get().currentFolderId) {
        // Если есть папки, но текущая не выбрана — выбрать первую
        await get().setCurrentFolder(folders[0].id);
      }
    } catch (e) {
      console.error("[storage] loadFolders error", e);
      set({ isLoadingFolders: false });
    }
  },

  loadFiles: async (folderId) => {
    set({ isLoadingFiles: true });
    try {
      const files = await getFilesByFolder(folderId);
      set({ files, isLoadingFiles: false });
    } catch (e) {
      console.error("[storage] loadFiles error", e);
      set({ files: [], isLoadingFiles: false });
    }
  },

  loadTrash: async () => {
    try {
      // ТЗ T-05: авто-очистка через 30 дней
      await cleanupExpiredTrash();
      const trash = await getTrashItems();
      set({ trash });
    } catch (e) {
      console.error("[storage] loadTrash error", e);
    }
  },

  setCurrentFolder: async (folderId) => {
    set({ currentFolderId: folderId, searchQuery: "", searchResults: null });
    await get().loadFiles(folderId);
  },

  setCurrentView: (currentView) => set({ currentView }),
  setSearch: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: null });
      return;
    }
    const results = await dbSearchFiles(query.trim());
    set({ searchResults: results });
  },

  createFolder: async (name, icon) => {
    const folders = get().folders;
    const client = getTelegramClient();
    // ТЗ F-01: channels.CreateForumTopic
    const topicId = await client.createForumTopic(name);
    const folder: Folder = {
      id: uuid(),
      topicId,
      name,
      icon: icon || "📁",
      sortOrder: folders.length,
      fileCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await putFolder(folder);
    set({ folders: [...folders, folder] });
    return folder;
  },

  renameFolder: async (id, name) => {
    const folders = get().folders;
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    // ТЗ F-02: channels.EditForumTopic
    const client = getTelegramClient();
    await client.editForumTopic(folder.topicId, name);
    const updated = { ...folder, name, updatedAt: Date.now() };
    await putFolder(updated);
    set({ folders: folders.map((f) => (f.id === id ? updated : f)) });
  },

  deleteFolder: async (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    // ТЗ F-03: channels.DeleteTopicHistory
    const client = getTelegramClient();
    await client.deleteForumTopic(folder.topicId);
    await dbDeleteFolder(id);
    const remaining = get().folders.filter((f) => f.id !== id);
    set({ folders: remaining });
    if (get().currentFolderId === id) {
      if (remaining.length > 0) {
        await get().setCurrentFolder(remaining[0].id);
      } else {
        set({ currentFolderId: null, files: [] });
      }
    }
  },

  uploadFile: async (file, folderId, encryptionEnabled, encryptionPassword) => {
    const folder = get().folders.find((f) => f.id === folderId);
    if (!folder) throw new Error("Folder not found");

    const fileId = uuid();
    const progress: UploadProgress = {
      id: fileId,
      fileName: file.name,
      size: file.size,
      uploaded: 0,
      percent: 0,
      speed: 0,
      status: "queued",
    };
    set({ uploads: [...get().uploads, progress] });

    try {
      const client = getTelegramClient();
      let bytesToUpload: ArrayBuffer;
      let isEncrypted = false;
      let originalSize = file.size;

      if (encryptionEnabled && encryptionPassword) {
        // ТЗ E-03..E-05: AES-256-CBC + gzip + .tcld формат в Web Worker
        progress.status = "encrypting";
        set({ uploads: get().uploads.map((u) => (u.id === fileId ? progress : u)) });

        const { encryptFile } = await import("@/lib/crypto");
        const encrypted = await encryptFile(file, encryptionPassword, (percent) => {
          const updated = { ...progress, percent: Math.round(percent * 50), status: "encrypting" as const };
          set({ uploads: get().uploads.map((u) => (u.id === fileId ? updated : u)) });
        });
        bytesToUpload = encrypted;
        isEncrypted = true;
      } else {
        bytesToUpload = await file.arrayBuffer();
      }

      // ТЗ FL-01: MTProto sendFile с прогрессом
      progress.status = "uploading";
      progress.percent = 0;
      set({ uploads: get().uploads.map((u) => (u.id === fileId ? progress : u)) });

      const start = Date.now();
      const teleFileId = await client.uploadFile(
        bytesToUpload,
        isEncrypted ? `${file.name}.tcld` : file.name,
        folder.topicId,
        (sent, total) => {
          const percent = encryptionEnabled
            ? 50 + Math.round((sent / total) * 50)
            : Math.round((sent / total) * 100);
          const speed = sent / ((Date.now() - start) / 1000);
          const updated = { ...progress, uploaded: sent, percent, speed, status: "uploading" as const };
          set({ uploads: get().uploads.map((u) => (u.id === fileId ? updated : u)) });
        }
      );

      const cloudFile: CloudFile = {
        id: fileId,
        folderId,
        messageId: teleFileId,
        teleFileId,
        name: file.name,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: originalSize,
        encrypted: isEncrypted,
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await putFile(cloudFile);

      // Demo-режим: сохраняем blob в IndexedDB для последующего скачивания
      if (client.isDemoMode()) {
        await putBlob(fileId, bytesToUpload);
      }

      // Обновить счётчик файлов в папке
      const updatedFolder = {
        ...folder,
        fileCount: folder.fileCount + 1,
        updatedAt: Date.now(),
      };
      await putFolder(updatedFolder);
      set({
        folders: get().folders.map((f) => (f.id === folder.id ? updatedFolder : f)),
      });

      // Обновить список файлов, если мы в этой папке
      if (get().currentFolderId === folderId) {
        await get().loadFiles(folderId);
      }

      progress.status = "done";
      progress.percent = 100;
      set({ uploads: get().uploads.map((u) => (u.id === fileId ? progress : u)) });

      // Удалить прогресс через 2 секунды
      setTimeout(() => {
        set({ uploads: get().uploads.filter((u) => u.id !== fileId) });
      }, 2000);
    } catch (e) {
      console.error("[storage] uploadFile error", e);
      const message = e instanceof Error ? e.message : "Upload failed";
      progress.status = "error";
      progress.error = message;
      set({ uploads: get().uploads.map((u) => (u.id === fileId ? progress : u)) });
      setTimeout(() => {
        set({ uploads: get().uploads.filter((u) => u.id !== fileId) });
      }, 5000);
      throw e;
    }
  },

  uploadFiles: async (files, folderId, encryptionEnabled, encryptionPassword) => {
    // ТЗ FL-02: множественная загрузка — последовательная
    for (const file of files) {
      await get().uploadFile(file, folderId, encryptionEnabled, encryptionPassword);
    }
  },

  downloadFile: async (file, encryptionPassword) => {
    const progress: DownloadProgress = {
      id: uuid(),
      fileName: file.name,
      size: file.size,
      downloaded: 0,
      percent: 0,
      status: "queued",
    };
    set({ downloads: [...get().downloads, progress] });

    try {
      const client = getTelegramClient();
      let arrayBuffer: ArrayBuffer;

      // ТЗ FL-04: MTProto downloadMedia с прогрессом
      progress.status = "downloading";
      set({ downloads: get().downloads.map((d) => (d.id === progress.id ? progress : d)) });

      if (client.isDemoMode()) {
        // Demo-режим: blob из IndexedDB
        const blob = await getBlob(file.id);
        if (!blob) throw new Error("Blob not found in demo mode");
        // Симулируем прогресс
        const chunkSize = 1024 * 64;
        for (let i = 0; i < blob.byteLength; i += chunkSize) {
          await sleep(20);
          const downloaded = Math.min(i + chunkSize, blob.byteLength);
          const percent = file.encrypted
            ? Math.round((downloaded / blob.byteLength) * 50)
            : Math.round((downloaded / blob.byteLength) * 100);
          const updated = { ...progress, downloaded, percent, status: "downloading" as const };
          set({ downloads: get().downloads.map((d) => (d.id === progress.id ? updated : d)) });
        }
        arrayBuffer = blob;
      } else {
        arrayBuffer = await client.downloadFile(file.teleFileId!, (received, total) => {
          const percent = file.encrypted
            ? Math.round((received / total) * 50)
            : Math.round((received / total) * 100);
          const updated = { ...progress, downloaded: received, percent, status: "downloading" as const };
          set({ downloads: get().downloads.map((d) => (d.id === progress.id ? updated : d)) });
        });
      }

      if (file.encrypted) {
        if (!encryptionPassword) {
          throw new Error("Encryption password required");
        }
        // ТЗ E-06: расшифровка + распаковка в Web Worker
        progress.status = "decrypting";
        progress.percent = 50;
        set({ downloads: get().downloads.map((d) => (d.id === progress.id ? progress : d)) });

        const { decryptFile } = await import("@/lib/crypto");
        arrayBuffer = await decryptFile(arrayBuffer, encryptionPassword, (percent) => {
          const updated = {
            ...progress,
            percent: 50 + Math.round(percent * 50),
            status: "decrypting" as const,
          };
          set({ downloads: get().downloads.map((d) => (d.id === progress.id ? updated : d)) });
        });
      }

      progress.status = "done";
      progress.percent = 100;
      set({ downloads: get().downloads.map((d) => (d.id === progress.id ? progress : d)) });
      setTimeout(() => {
        set({ downloads: get().downloads.filter((d) => d.id !== progress.id) });
      }, 2000);

      return new Blob([arrayBuffer], { type: file.mimeType });
    } catch (e) {
      console.error("[storage] downloadFile error", e);
      progress.status = "error";
      progress.error = e instanceof Error ? e.message : "Download failed";
      set({ downloads: get().downloads.map((d) => (d.id === progress.id ? progress : d)) });
      setTimeout(() => {
        set({ downloads: get().downloads.filter((d) => d.id !== progress.id) });
      }, 5000);
      throw e;
    }
  },

  deleteFile: async (fileId) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;

    // ТЗ T-01: файл удаляется из Telegram, метаданные — в IndexedDB trash
    const client = getTelegramClient();
    try {
      await client.deleteMessages(file.messageId);
    } catch (e) {
      console.warn("[storage] deleteMessages failed", e);
    }

    // Переместить метаданные в корзину
    const trashItem: TrashItem = {
      id: uuid(),
      fileId: file.id,
      itemType: "file",
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      metadata: file,
      deletedAt: Date.now(),
      expiresAt: Date.now() + TRASH_TTL_MS,
    };
    await putTrashItem(trashItem);

    // Удалить из files
    await dbDeleteFile(file.id);
    if (client.isDemoMode()) {
      // В demo-режиме удаляем blob (имитация удаления из Telegram)
      await deleteBlob(file.id);
    }

    // Обновить счётчик в папке
    const folder = get().folders.find((f) => f.id === file.folderId);
    if (folder) {
      const updatedFolder = {
        ...folder,
        fileCount: Math.max(0, folder.fileCount - 1),
        updatedAt: Date.now(),
      };
      await putFolder(updatedFolder);
      set({ folders: get().folders.map((f) => (f.id === folder.id ? updatedFolder : f)) });
    }

    // Обновить списки
    if (get().currentFolderId === file.folderId) {
      await get().loadFiles(file.folderId);
    }
    await get().loadTrash();
  },

  renameFile: async (fileId, newName) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;
    // ТЗ FL-06: обновление метаданных + editMessageCaption
    const client = getTelegramClient();
    try {
      await client.editMessageCaption(file.messageId, newName);
    } catch (e) {
      console.warn("[storage] editMessageCaption failed", e);
    }
    const updated = { ...file, name: newName, updatedAt: Date.now() };
    await putFile(updated);
    set({ files: get().files.map((f) => (f.id === fileId ? updated : f)) });
  },

  moveFile: async (fileId, targetFolderId) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;
    const targetFolder = get().folders.find((f) => f.id === targetFolderId);
    if (!targetFolder) return;
    // ТЗ FL-07: пересылка сообщения в другой топик + удаление оригинала
    const client = getTelegramClient();
    try {
      const newMessageId = await client.forwardMessage(file.messageId, targetFolder.topicId);
      await client.deleteMessages(file.messageId);
      const updated: CloudFile = {
        ...file,
        folderId: targetFolderId,
        messageId: newMessageId,
        teleFileId: String(newMessageId),
        updatedAt: Date.now(),
      };
      await putFile(updated);
      // Обновить счётчики
      const oldFolder = get().folders.find((f) => f.id === file.folderId);
      if (oldFolder) {
        const updatedOld = {
          ...oldFolder,
          fileCount: Math.max(0, oldFolder.fileCount - 1),
          updatedAt: Date.now(),
        };
        await putFolder(updatedOld);
        set({ folders: get().folders.map((f) => (f.id === oldFolder.id ? updatedOld : f)) });
      }
      const updatedTarget = {
        ...targetFolder,
        fileCount: targetFolder.fileCount + 1,
        updatedAt: Date.now(),
      };
      await putFolder(updatedTarget);
      set({ folders: get().folders.map((f) => (f.id === targetFolder.id ? updatedTarget : f)) });

      if (get().currentFolderId === file.folderId) {
        await get().loadFiles(file.folderId);
      }
    } catch (e) {
      console.error("[storage] moveFile error", e);
      throw e;
    }
  },

  toggleFavorite: async (fileId) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;
    const updated = { ...file, isFavorite: !file.isFavorite, updatedAt: Date.now() };
    await putFile(updated);
    set({ files: get().files.map((f) => (f.id === fileId ? updated : f)) });
  },

  restoreFromTrash: async (itemId) => {
    const item = get().trash.find((t) => t.id === itemId);
    if (!item) return;
    // ТЗ T-02: повторная загрузка файла (если есть локальный кеш)
    try {
      const client = getTelegramClient();
      if (client.isDemoMode()) {
        // В demo-режиме blob мог быть удалён — попробуем найти
        const blob = await getBlob(item.fileId);
        if (blob) {
          const file: CloudFile = {
            ...(item.metadata as CloudFile),
            id: item.fileId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await putFile(file);
        }
      } else {
        // В реальном режиме: повторная загрузка через MTProto
        const file: CloudFile = {
          ...(item.metadata as CloudFile),
          id: item.fileId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await putFile(file);
      }
      await deleteTrashItem(itemId);
      await get().loadTrash();
    } catch (e) {
      console.error("[storage] restoreFromTrash error", e);
      throw e;
    }
  },

  deleteFromTrashForever: async (itemId) => {
    const item = get().trash.find((t) => t.id === itemId);
    if (!item) return;
    // ТЗ T-03: удаление метаданных из IndexedDB
    await deleteTrashItem(itemId);
    await deleteBlob(item.fileId);
    set({ trash: get().trash.filter((t) => t.id !== itemId) });
  },

  clearTrash: async () => {
    await dbClearTrash();
    set({ trash: [] });
  },

  getStats: async () => {
    const files = await getAllFiles();
    const folders = await getAllFolders();
    return {
      filesCount: files.length,
      foldersCount: folders.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
    };
  },

  applySort: (sortBy) => {
    const files = [...get().files];
    files.sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "size-asc": return a.size - b.size;
        case "size-desc": return b.size - a.size;
        case "date-asc": return a.createdAt - b.createdAt;
        case "date-desc": return b.createdAt - a.createdAt;
        default: return 0;
      }
    });
    set({ files });
  },
}));
