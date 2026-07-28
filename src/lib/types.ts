/**
 * TCloud — типы данных
 * ТЗ раздел 5.3: IndexedDB Schema
 */

export interface UserSession {
  userId: string;
  sessionString: string;
  dcId: number;
  authKey?: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  topicId: number; // Telegram forum topic ID
  name: string;
  icon: string; // emoji
  sortOrder: number;
  fileCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CloudFile {
  id: string;
  folderId: string;
  messageId: number; // Telegram message ID
  teleFileId?: string; // Telegram file ID
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  encrypted: boolean;
  isFavorite: boolean;
  sharedLink?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TrashItem {
  id: string;
  fileId: string;
  itemType: "file" | "folder";
  name: string;
  mimeType?: string;
  size: number;
  metadata: Partial<CloudFile>;
  deletedAt: number;
  expiresAt: number; // deletedAt + 30 days
}

export type ThemeMode = "light" | "dark";
export type ViewMode = "grid" | "list";
export type SortBy = "name-asc" | "name-desc" | "size-asc" | "size-desc" | "date-asc" | "date-desc";
export type Language = "ru" | "en";

export interface UserSettings {
  language: Language;
  themeMode: ThemeMode;
  themePrimary: string;
  themeAccent: string;
  themeBackground: string;
  encryptionEnabled: boolean;
  encryptionPassword?: string; // только в памяти (Zustand), не персистится
  viewMode: ViewMode;
  sortBy: SortBy;
}

export type AppView =
  | "files"
  | "trash"
  | "settings";

export type AuthStep = "phone" | "code" | "password" | "done";

export interface UploadProgress {
  id: string;
  fileName: string;
  size: number;
  uploaded: number;
  percent: number;
  speed: number; // bytes/sec
  status: "queued" | "uploading" | "encrypting" | "done" | "error";
  error?: string;
}

export interface DownloadProgress {
  id: string;
  fileName: string;
  size: number;
  downloaded: number;
  percent: number;
  status: "queued" | "downloading" | "decrypting" | "done" | "error";
  error?: string;
}
