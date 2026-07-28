/**
 * TCloud — MTProto-клиент (интерфейс)
 * ТЗ 2.2: gramjs (telegram) или mtproto-wasm в Web Worker.
 *
 * В реальном продакшене реализация TelegramClientImpl использует gramjs:
 *   import { TelegramClient, Api } from "telegram";
 *   import { StringSession } from "telegram/sessions";
 *
 * В demo-режиме (TCLOUD_DEMO_MODE=true) используется MockTelegramClient,
 * который хранит "файлы" в IndexedDB blobs store.
 */

import type { UserSession } from "@/lib/types";

export interface SendCodeResult {
  phoneCodeHash: string;
  isCodeViaApp: boolean;
}

export interface SignInResult {
  session: UserSession | null;
  needsPassword: boolean;
}

export interface TelegramClient {
  /** ТЗ A-04: проверка валидности сессии через users.getFullUser */
  validateSession(session: UserSession): Promise<boolean>;

  /** ТЗ A-01: auth.sendCode */
  sendCode(phone: string): Promise<SendCodeResult>;

  /** ТЗ A-01: auth.signIn */
  signIn(params: { phone: string; code: string; phoneCodeHash: string }): Promise<SignInResult>;

  /** ТЗ A-02: auth.checkPassword (2FA) */
  checkPassword(password: string): Promise<UserSession>;

  /** ТЗ A-05: auth.logOut */
  logOut(session: UserSession): Promise<void>;

  /** ТЗ F-01: channels.CreateForumTopic */
  createForumTopic(name: string): Promise<number>;

  /** ТЗ F-02: channels.EditForumTopic */
  editForumTopic(topicId: number, name: string): Promise<void>;

  /** ТЗ F-03: channels.DeleteTopicHistory */
  deleteForumTopic(topicId: number): Promise<void>;

  /** ТЗ FL-01: MTProto upload (sendFile) до 2 ГБ */
  uploadFile(
    data: ArrayBuffer,
    fileName: string,
    topicId: number,
    onProgress?: (sent: number, total: number) => void
  ): Promise<string>;

  /** ТЗ FL-04: MTProto download */
  downloadFile(
    teleFileId: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<ArrayBuffer>;

  /** ТЗ FL-05: channels.deleteMessages с revoke=True */
  deleteMessages(messageId: number): Promise<void>;

  /** ТЗ FL-06: editMessageCaption */
  editMessageCaption(messageId: number, newCaption: string): Promise<void>;

  /** ТЗ FL-07: forwardMessages */
  forwardMessage(messageId: number, targetTopicId: number): Promise<number>;

  /** Признак demo-режима */
  isDemoMode(): boolean;
}

let client: TelegramClient | null = null;

/**
 * Получить клиент MTProto.
 * В demo-режиме возвращает MockTelegramClient,
 * иначе — реальную реализацию на gramjs (заглушка).
 */
export function getTelegramClient(): TelegramClient {
  if (client) return client;
  const demoMode = process.env.NEXT_PUBLIC_TCLOUD_DEMO_MODE === "true"
    || process.env.TCLOUD_DEMO_MODE === "true"
    || !process.env.TELEGRAM_API_ID
    || process.env.TELEGRAM_API_ID === "0";

  if (demoMode) {
    client = new MockTelegramClient();
  } else {
    // Реальная gramjs-реализация
    // client = new GramjsTelegramClient();
    // Пока нет реальных creds — fallback на mock
    client = new MockTelegramClient();
  }
  return client;
}

/**
 * Mock-реализация для demo-режима.
 * Имитирует все MTProto-вызовы с задержками.
 * Файлы хранит в IndexedDB blobs store.
 */
class MockTelegramClient implements TelegramClient {
  private session: UserSession | null = null;
  private codeHashCounter = 0;
  private topicCounter = 1; // General = 1
  private messageCounter = 100;
  private pendingCode: { phone: string; code: string; hash: string } | null = null;

  isDemoMode(): boolean {
    return true;
  }

  async validateSession(session: UserSession): Promise<boolean> {
    await sleep(300);
    this.session = session;
    return true;
  }

  async sendCode(phone: string): Promise<SendCodeResult> {
    await sleep(800);
    const hash = `mock_hash_${++this.codeHashCounter}`;
    // В demo-режиме код всегда 12345
    this.pendingCode = { phone, code: "12345", hash };
    return { phoneCodeHash: hash, isCodeViaApp: true };
  }

  async signIn(params: { phone: string; code: string; phoneCodeHash: string }): Promise<SignInResult> {
    await sleep(700);
    if (this.pendingCode?.hash !== params.phoneCodeHash) {
      throw new Error("Invalid phoneCodeHash");
    }
    if (params.code !== "12345") {
      throw new Error("Invalid code (demo code: 12345)");
    }
    // Создаём mock-сессию
    this.session = {
      userId: `mock_user_${Date.now()}`,
      sessionString: `mock_session_${Math.random().toString(36).slice(2)}`,
      dcId: 2,
      phone: params.phone,
      firstName: "Demo",
      lastName: "User",
      username: "demouser",
      createdAt: Date.now(),
    };
    return { session: this.session, needsPassword: false };
  }

  async checkPassword(password: string): Promise<UserSession> {
    await sleep(500);
    if (!password) throw new Error("Password required");
    if (!this.session) throw new Error("No active session");
    return this.session;
  }

  async logOut(_session: UserSession): Promise<void> {
    await sleep(300);
    this.session = null;
  }

  async createForumTopic(name: string): Promise<number> {
    await sleep(400);
    return ++this.topicCounter;
  }

  async editForumTopic(_topicId: number, _name: string): Promise<void> {
    await sleep(200);
  }

  async deleteForumTopic(_topicId: number): Promise<void> {
    await sleep(300);
  }

  async uploadFile(
    data: ArrayBuffer,
    fileName: string,
    _topicId: number,
    onProgress?: (sent: number, total: number) => void
  ): Promise<string> {
    const total = data.byteLength;
    const chunkSize = Math.max(1024 * 64, Math.floor(total / 20));
    for (let sent = 0; sent <= total; sent += chunkSize) {
      await sleep(50 + Math.random() * 50);
      onProgress?.(Math.min(sent, total), total);
    }
    const msgId = ++this.messageCounter;
    return String(msgId);
  }

  async downloadFile(
    _teleFileId: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<ArrayBuffer> {
    // В demo-режиме blob хранится в IndexedDB — здесь просто имитируем прогресс
    const total = 1024 * 1024; // 1MB симуляция
    const chunkSize = 1024 * 64;
    for (let received = 0; received <= total; received += chunkSize) {
      await sleep(20);
      onProgress?.(Math.min(received, total), total);
    }
    return new ArrayBuffer(0); // Реальные данные берём из IndexedDB в storage store
  }

  async deleteMessages(_messageId: number): Promise<void> {
    await sleep(200);
  }

  async editMessageCaption(_messageId: number, _newCaption: string): Promise<void> {
    await sleep(200);
  }

  async forwardMessage(_messageId: number, _targetTopicId: number): Promise<number> {
    await sleep(400);
    return ++this.messageCounter;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Реальная gramjs-реализация (заглушка для будущего).
 * Для активации: заполнить .env (TELEGRAM_API_ID, TELEGRAM_API_HASH),
 * раскомментировать код, установить gramjs.
 *
 * ТЗ 2.2.1: gramjs (telegram) 2.26+ поддерживает работу в браузере через Web Worker.
 */
/*
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

class GramjsTelegramClient implements TelegramClient {
  private client: TelegramClient | null = null;
  private apiId = Number(process.env.TELEGRAM_API_ID);
  private apiHash = process.env.TELEGRAM_API_HASH!;

  isDemoMode(): boolean { return false; }

  private async getClient(session?: UserSession): Promise<TelegramClient> {
    if (this.client) return this.client;
    const stringSession = new StringSession(session?.sessionString ?? "");
    this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
      autoReconnect: true,
      useWSS: true, // важно для браузера
    });
    await this.client.connect();
    return this.client;
  }

  async validateSession(session: UserSession): Promise<boolean> {
    try {
      const client = await this.getClient(session);
      await client.getMe();
      return true;
    } catch { return false; }
  }

  async sendCode(phone: string): Promise<SendCodeResult> {
    const client = await this.getClient();
    const result = await client.sendCode({ apiId: this.apiId, apiHash: this.apiHash }, phone);
    return { phoneCodeHash: result.phoneCodeHash, isCodeViaApp: result.isCodeViaApp };
  }

  // ... остальные методы через client.invoke(new Api.auth.SignIn({...}))
}
*/
