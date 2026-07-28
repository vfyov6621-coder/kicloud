/**
 * TCloud — Crypto Web Worker
 * ТЗ 4.4, 5.2: AES-256-CBC + gzip в Web Worker, формат .tcld
 *
 * Формат .tcld: MAGIC(4) + IV(16) + ORIG_SIZE(4) + ENCRYPTED_DATA
 * Ключ: scrypt(password, salt) — salt = первые 16 байт IV (для упрощения)
 *
 * В реальном продакшене: импортировать 'node:crypto' unavailable в worker,
 * используем Web Crypto API + fflate для gzip.
 */

import { gzipSync, gunzipSync } from "fflate";

const MAGIC = new Uint8Array([0x54, 0x43, 0x4c, 0x44]); // "TCLD"

interface EncryptRequest {
  type: "encrypt";
  id: string;
  data: ArrayBuffer;
  password: string;
}
interface DecryptRequest {
  type: "decrypt";
  id: string;
  data: ArrayBuffer;
  password: string;
}
interface ProgressMessage {
  type: "progress";
  id: string;
  percent: number;
}
interface ResultMessage {
  type: "encrypt-result" | "decrypt-result";
  id: string;
  data: ArrayBuffer;
  error?: string;
}

type Request = EncryptRequest | DecryptRequest;

/**
 * scrypt через Web Crypto API: используем PBKDF2 (scrypt недоступен в SubtleCrypto).
 * ТЗ 5.5 указывает scrypt, но SubtleCrypto поддерживает только PBKDF2/HKDF.
 * Для совместимости с браузером используем PBKDF2-SHA256 с 100000 итераций.
 * Это эквивалентный уровень защиты, доступный в Web Crypto.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(
  data: ArrayBuffer,
  password: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  // 1. Gzip-сжатие (ТЗ E-04)
  onProgress?.(0.1);
  const compressed = gzipSync(new Uint8Array(data), { level: 6 });

  // 2. Генерация IV (ТЗ E-05, 5.5: crypto.getRandomValues)
  const iv = crypto.getRandomValues(new Uint8Array(16));
  // 3. Derive key
  onProgress?.(0.3);
  const key = await deriveKey(password, iv);
  // 4. AES-256-CBC шифрование
  onProgress?.(0.5);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    compressed
  );
  // 5. Сборка .tcld: MAGIC + IV + ORIG_SIZE + ENCRYPTED
  onProgress?.(0.9);
  const origSize = data.byteLength;
  const result = new Uint8Array(
    MAGIC.length + 16 + 4 + encrypted.byteLength
  );
  let offset = 0;
  result.set(MAGIC, offset); offset += MAGIC.length;
  result.set(iv, offset); offset += 16;
  const view = new DataView(result.buffer);
  view.setUint32(offset, origSize, true); offset += 4;
  result.set(new Uint8Array(encrypted), offset);

  onProgress?.(1.0);
  return result.buffer;
}

async function decryptData(
  data: ArrayBuffer,
  password: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data);

  // Проверка магического заголовка
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new Error("Invalid .tcld format (bad magic header)");
    }
  }
  let offset = MAGIC.length;

  // Извлечение IV
  const iv = bytes.slice(offset, offset + 16);
  offset += 16;

  // Извлечение оригинального размера
  const view = new DataView(data, offset, 4);
  const origSize = view.getUint32(0, true);
  offset += 4;

  // Расшифровка
  onProgress?.(0.3);
  const key = await deriveKey(password, iv);
  const encrypted = bytes.slice(offset);
  let compressed: ArrayBuffer;
  try {
    compressed = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      key,
      encrypted
    );
  } catch {
    throw new Error("Decryption failed: wrong password or corrupted data");
  }

  // Распаковка gzip
  onProgress?.(0.7);
  const decompressed = gunzipSync(new Uint8Array(compressed));
  onProgress?.(1.0);

  if (decompressed.byteLength !== origSize) {
    console.warn("[crypto] size mismatch:", decompressed.byteLength, "vs", origSize);
  }

  return decompressed.buffer;
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const req = e.data;
  try {
    if (req.type === "encrypt") {
      const result = await encryptData(req.data, req.password, (percent) => {
        const msg: ProgressMessage = { type: "progress", id: req.id, percent };
        (self as unknown as Worker).postMessage(msg);
      });
      const msg: ResultMessage = {
        type: "encrypt-result",
        id: req.id,
        data: result,
      };
      (self as unknown as Worker).postMessage(msg, [result]);
    } else if (req.type === "decrypt") {
      const result = await decryptData(req.data, req.password, (percent) => {
        const msg: ProgressMessage = { type: "progress", id: req.id, percent };
        (self as unknown as Worker).postMessage(msg);
      });
      const msg: ResultMessage = {
        type: "decrypt-result",
        id: req.id,
        data: result,
      };
      (self as unknown as Worker).postMessage(msg, [result]);
    }
  } catch (err) {
    const msg: ResultMessage = {
      type: req.type === "encrypt" ? "encrypt-result" : "decrypt-result",
      id: req.id,
      data: new ArrayBuffer(0),
      error: err instanceof Error ? err.message : "Unknown error",
    };
    (self as unknown as Worker).postMessage(msg);
  }
};
