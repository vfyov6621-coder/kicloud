/**
 * TCloud — IndexedDB-схема
 * ТЗ раздел 5.3: Database: tcloud-db (version 1)
 *
 * Stores:
 *  - sessions  { key: userId, value: UserSession }
 *  - folders   { key: id, value: Folder, indexes: [topicId, name] }
 *  - files     { key: id, value: CloudFile, indexes: [folderId, name, isFavorite] }
 *  - trash     { key: id, value: TrashItem, indexes: [deletedAt] }
 *  - settings  { key: 'user-settings', value: UserSettings }
 *  - blobs     { key: id, value: ArrayBuffer } — для demo-режима: хранение содержимого
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  UserSession,
  Folder,
  CloudFile,
  TrashItem,
  UserSettings,
} from "@/lib/types";

const DB_NAME = "tcloud-db";
const DB_VERSION = 1;

interface TCloudDB extends DBSchema {
  sessions: {
    key: string;
    value: UserSession;
  };
  folders: {
    key: string;
    value: Folder;
    indexes: { topicId: number; name: string };
  };
  files: {
    key: string;
    value: CloudFile;
    indexes: { folderId: string; name: string; isFavorite: boolean };
  };
  trash: {
    key: string;
    value: TrashItem;
    indexes: { deletedAt: number };
  };
  settings: {
    key: string;
    value: UserSettings;
  };
  blobs: {
    key: string;
    value: { id: string; blob: ArrayBuffer; createdAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<TCloudDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TCloudDB>> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB доступен только в браузере");
  }
  if (!dbPromise) {
    dbPromise = openDB<TCloudDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // sessions
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "userId" });
        }
        // folders
        if (!db.objectStoreNames.contains("folders")) {
          const store = db.createObjectStore("folders", { keyPath: "id" });
          store.createIndex("topicId", "topicId");
          store.createIndex("name", "name");
        }
        // files
        if (!db.objectStoreNames.contains("files")) {
          const store = db.createObjectStore("files", { keyPath: "id" });
          store.createIndex("folderId", "folderId");
          store.createIndex("name", "name");
          store.createIndex("isFavorite", "isFavorite");
        }
        // trash
        if (!db.objectStoreNames.contains("trash")) {
          const store = db.createObjectStore("trash", { keyPath: "id" });
          store.createIndex("deletedAt", "deletedAt");
        }
        // settings
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
        // blobs (для demo-режима)
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/* ============ Sessions ============ */
export async function saveSession(session: UserSession): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

export async function getSession(userId: string): Promise<UserSession | undefined> {
  const db = await getDB();
  return db.get("sessions", userId);
}

export async function getAnySession(): Promise<UserSession | undefined> {
  const db = await getDB();
  const all = await db.getAll("sessions");
  return all[0];
}

export async function deleteSession(userId: string): Promise<void> {
  const db = await getDB();
  await db.delete("sessions", userId);
}

/* ============ Folders ============ */
export async function putFolder(folder: Folder): Promise<void> {
  const db = await getDB();
  await db.put("folders", folder);
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  const db = await getDB();
  return db.get("folders", id);
}

export async function getAllFolders(): Promise<Folder[]> {
  const db = await getDB();
  const all = await db.getAll("folders");
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("folders", id);
  // Удалить все файлы папки
  const files = await db.getAllFromIndex("files", "folderId", id);
  await Promise.all(files.map((f) => db.delete("files", f.id)));
}

/* ============ Files ============ */
export async function putFile(file: CloudFile): Promise<void> {
  const db = await getDB();
  await db.put("files", file);
}

export async function getFile(id: string): Promise<CloudFile | undefined> {
  const db = await getDB();
  return db.get("files", id);
}

export async function getFilesByFolder(folderId: string): Promise<CloudFile[]> {
  const db = await getDB();
  return db.getAllFromIndex("files", "folderId", folderId);
}

export async function getAllFiles(): Promise<CloudFile[]> {
  const db = await getDB();
  return db.getAll("files");
}

export async function getFavoriteFiles(): Promise<CloudFile[]> {
  const db = await getDB();
  return db.getAllFromIndex("files", "isFavorite", true as unknown as never);
}

export async function deleteFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("files", id);
}

export async function searchFiles(query: string): Promise<CloudFile[]> {
  const db = await getDB();
  const all = await db.getAll("files");
  const q = query.toLowerCase();
  return all.filter((f) => f.name.toLowerCase().includes(q));
}

/* ============ Trash ============ */
export async function putTrashItem(item: TrashItem): Promise<void> {
  const db = await getDB();
  await db.put("trash", item);
}

export async function getTrashItems(): Promise<TrashItem[]> {
  const db = await getDB();
  const all = await db.getAll("trash");
  return all.sort((a, b) => b.deletedAt - a.deletedAt);
}

export async function deleteTrashItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("trash", id);
}

export async function clearTrash(): Promise<void> {
  const db = await getDB();
  await db.clear("trash");
}

export async function cleanupExpiredTrash(): Promise<number> {
  const db = await getDB();
  const now = Date.now();
  const all = await db.getAll("trash");
  const expired = all.filter((item) => item.expiresAt < now);
  await Promise.all(expired.map((item) => db.delete("trash", item.id)));
  return expired.length;
}

/* ============ Settings ============ */
const SETTINGS_KEY = "user-settings";

export async function getSettings(): Promise<UserSettings | undefined> {
  const db = await getDB();
  return db.get("settings", SETTINGS_KEY);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDB();
  await db.put("settings", settings, SETTINGS_KEY);
}

/* ============ Blobs (demo-режим) ============ */
export async function putBlob(id: string, blob: ArrayBuffer): Promise<void> {
  const db = await getDB();
  await db.put("blobs", { id, blob, createdAt: Date.now() });
}

export async function getBlob(id: string): Promise<ArrayBuffer | undefined> {
  const db = await getDB();
  const rec = await db.get("blobs", id);
  return rec?.blob;
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("blobs", id);
}

/* ============ Cleanup ============ */
export async function wipeAll(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear("sessions"),
    db.clear("folders"),
    db.clear("files"),
    db.clear("trash"),
    db.clear("settings"),
    db.clear("blobs"),
  ]);
}
