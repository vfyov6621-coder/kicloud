/**
 * TCloud — Crypto API
 * ТЗ 4.4, 5.2: шифрование/расшифровка через Web Worker
 * Главный поток не блокируется — критично для 60fps анимаций.
 */
import { uuid } from "@/lib/utils";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/crypto.worker.ts", import.meta.url));
  }
  return worker;
}

interface PendingOp {
  resolve: (data: ArrayBuffer) => void;
  reject: (err: Error) => void;
  onProgress?: (percent: number) => void;
}

const pending = new Map<string, PendingOp>();

// Слушаем сообщения от worker
if (typeof window !== "undefined") {
  getWorker().addEventListener("message", (e: MessageEvent) => {
    const msg = e.data;
    if (!msg || !msg.id) return;
    const op = pending.get(msg.id);
    if (!op) return;

    if (msg.type === "progress") {
      op.onProgress?.(msg.percent);
    } else if (msg.type === "encrypt-result" || msg.type === "decrypt-result") {
      pending.delete(msg.id);
      if (msg.error) {
        op.reject(new Error(msg.error));
      } else {
        op.resolve(msg.data);
      }
    }
  });
}

/**
 * Зашифровать файл. Возвращает ArrayBuffer в формате .tcld
 * ТЗ E-01..E-05.
 */
export async function encryptFile(
  file: File | ArrayBuffer,
  password: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  const id = uuid();
  const data = file instanceof File ? await file.arrayBuffer() : file;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage(
      { type: "encrypt", id, data, password } as const,
      [data]
    );
  });
}

/**
 * Расшифровать файл из формата .tcld
 * ТЗ E-06.
 */
export async function decryptFile(
  data: ArrayBuffer,
  password: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  const id = uuid();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    // Копируем ArrayBuffer, чтобы transfer не затронул оригинал
    const copy = data.slice(0);
    getWorker().postMessage(
      { type: "decrypt", id, data: copy, password } as const,
      [copy]
    );
  });
}
