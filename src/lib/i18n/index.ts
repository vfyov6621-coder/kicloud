/**
 * TCloud — i18n core
 * ТЗ раздел 7: встроенная система (без next-intl), key-value словарь.
 * Компоненты получают язык из Zustand-стора и вызывают t(key).
 */
import { ru, type TranslationDict } from "./ru";
import { en } from "./en";
import type { Language } from "@/lib/types";

const dictionaries: Record<Language, TranslationDict> = { ru, en };

/**
 * Получить словарь для языка.
 */
export function getDict(lang: Language): TranslationDict {
  return dictionaries[lang] ?? ru;
}

/**
 * Безопасное чтение вложенного ключа: t("auth.title")
 */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Интерполяция плейсхолдеров: t("folders.fileCount", { count: 5 })
 * Поддерживает {name}, {sec}, {days}, {count}, {size} и т.д.
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`
  );
}

/**
 * t(key, lang, params?) — основной переводчик.
 * Если ключ не найден, возвращает сам ключ.
 */
export function t(
  key: string,
  lang: Language = "ru",
  params?: Record<string, string | number>
): string {
  const dict = getDict(lang);
  const value = getPath(dict, key);
  if (typeof value === "string") {
    return interpolate(value, params);
  }
  // Fallback: RU -> EN -> key
  const ruValue = getPath(ru, key);
  if (typeof ruValue === "string") {
    return interpolate(ruValue, params);
  }
  return key;
}
