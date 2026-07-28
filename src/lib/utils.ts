/**
 * TCloud — утилиты
 * Вспомогательные функции из ТЗ раздел 10 (src/lib/utils.ts)
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Форматирование размера файла в человекочитаемый вид.
 * ТЗ 3.3 + раздел 10: formatFileSize.
 */
export function formatFileSize(bytes: number, locale: string = "ru"): string {
  if (bytes === 0) return locale === "ru" ? "0 Б" : "0 B";
  const units = locale === "ru"
    ? ["Б", "КБ", "МБ", "ГБ", "ТБ"]
    : ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Иконка файла по MIME-типу (emoji fallback).
 * ТЗ 3.4.4: иконка типа файла (emoji или SVG).
 */
export function getFileIcon(mimeType: string, name: string = ""): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf" || ext === "pdf") return "📕";
  if (mimeType.startsWith("text/") || ["txt", "md", "log"].includes(ext)) return "📄";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "c", "cpp"].includes(ext)) return "⚙️";
  if (["json", "xml", "yaml", "yml"].includes(ext)) return "🔧";
  return "📦";
}

/**
 * Цветовое представление размера для прогресс-бара.
 */
export function getProgressColor(percent: number): string {
  if (percent < 30) return "var(--tc-link)";
  if (percent < 70) return "var(--tc-success)";
  if (percent < 95) return "var(--tc-warning)";
  return "var(--tc-success)";
}

/**
 * Форматирование даты через Intl с текущей локалью.
 * ТЗ раздел 7: форматирование дат через Intl.DateTimeFormat.
 */
export function formatDate(
  timestamp: number,
  locale: string = "ru"
): string {
  const localeCode = locale === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(localeCode, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/**
 * Относительная дата ("сейчас", "5 мин назад", "вчера").
 */
export function formatRelativeTime(
  timestamp: number,
  locale: string = "ru"
): string {
  const localeCode = locale === "ru" ? "ru-RU" : "en-US";
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const rtf = new Intl.RelativeTimeFormat(localeCode, { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (hours < 24) return rtf.format(-hours, "hour");
  if (days < 30) return rtf.format(-days, "day");
  return formatDate(timestamp, locale);
}

/**
 * Транслитерация строки в slug для имен папок/файлов.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0400-\u04FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Задержка (utility для mock-транспорта).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Генерация UUID (использует crypto.randomUUID когда доступно).
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Преобразование ArrayBuffer в hex (для отладки ключей).
 */
export function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Цвет аватара из строки (детерминированный).
 */
const AVATAR_COLORS = [
  "#007aff", "#ff3b30", "#34c759", "#ff9500",
  "#af52de", "#5ac8fa", "#ff2d55", "#5856d6",
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Инициалы пользователя для аватара.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
