/**
 * kicloud — клиент для облачного хранилища на базе Telegram
 *
 * Архитектура:
 *  - Все операции с файлами через gramjs (https://gram.js.org/) в браузере
 *  - Session сохраняется в IndexedDB
 *  - Файлы хранятся в приватном Telegram-канале пользователя с forum topics как папки
 *
 * В demo-режиме используется MockClient для тестирования UI без реального аккаунта.
 *
 * gramjs — клиентская библиотека, работает только в браузере (через WebSocket/WSS).
 * Все `await import("telegram")` выполняются только в браузере (typeof window check),
 * чтобы избежать SSR-сборки node-зависимостей (net, fs, и т.д.).
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

export interface CloudClient {
  validateSession(session: UserSession): Promise<boolean>;
  sendCode(phone: string): Promise<SendCodeResult>;
  signIn(params: { phone: string; code: string; phoneCodeHash: string }): Promise<SignInResult>;
  checkPassword(password: string): Promise<UserSession>;
  logOut(session: UserSession): Promise<void>;
  createFolder(name: string): Promise<number>;
  editFolder(topicId: number, name: string): Promise<void>;
  deleteFolder(topicId: number): Promise<void>;
  uploadFile(
    data: ArrayBuffer,
    fileName: string,
    topicId: number,
    onProgress?: (sent: number, total: number) => void
  ): Promise<string>;
  downloadFile(
    fileId: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<ArrayBuffer>;
  deleteMessages(messageId: number): Promise<void>;
  editMessageCaption(messageId: number, newCaption: string): Promise<void>;
  forwardMessage(messageId: number, targetTopicId: number): Promise<number>;
  isDemoMode(): boolean;
}

let client: CloudClient | null = null;

const DEMO_MODE =
  process.env.NEXT_PUBLIC_KICLOUD_DEMO_MODE === "true" ||
  process.env.KICLOUD_DEMO_MODE === "true";

// NEXT_PUBLIC_ префикс обязателен — иначе переменная не попадёт в клиентский bundle.
// API_ID/API_HASH не являются секретами (идентифицируют приложение, не пользователя).
const API_ID = Number(
  process.env.NEXT_PUBLIC_TELEGRAM_API_ID || process.env.TELEGRAM_API_ID || "0"
);
const API_HASH =
  process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || process.env.TELEGRAM_API_HASH || "";

export function getCloudClient(): CloudClient {
  if (client) return client;
  if (DEMO_MODE || !API_ID || API_ID === 0 || !API_HASH) {
    client = new MockCloudClient();
  } else {
    client = new GramjsCloudClient(API_ID, API_HASH);
  }
  return client;
}

/* ============================================================
   Реальный клиент на gramjs — работает только в браузере.
   ============================================================ */
class GramjsCloudClient implements CloudClient {
  private apiId: number;
  private apiHash: string;
  private tg: any = null;
  private session: UserSession | null = null;
  private storageChannelId: any = null;

  constructor(apiId: number, apiHash: string) {
    this.apiId = apiId;
    this.apiHash = apiHash;
  }

  isDemoMode(): boolean {
    return false;
  }

  /** Проверка, что мы в браузере. На SSR gramjs не загружаем. */
  private ensureBrowser(): void {
    if (typeof window === "undefined") {
      throw new Error("Cloud client доступен только в браузере");
    }
  }

  private async getTg(sessionString?: string): Promise<any> {
    this.ensureBrowser();
    if (this.tg) return this.tg;
    // Динамический import — gramjs загружается только в браузере
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions");
    const stringSession = new StringSession(sessionString ?? "");
    this.tg = new TelegramClient(stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
      autoReconnect: true,
      useWSS: true, // обязательно для браузера (HTTPS-only)
      retryDelay: 1000,
    });
    await this.tg.connect();
    return this.tg;
  }

  async validateSession(session: UserSession): Promise<boolean> {
    this.ensureBrowser();
    try {
      const tg = await this.getTg(session.sessionString);
      const me = await tg.getMe();
      if (me) {
        this.session = {
          ...session,
          firstName: me.firstName ?? session.firstName,
          lastName: me.lastName ?? session.lastName,
          username: me.username ?? session.username,
        };
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[cloud] validateSession failed", e);
      return false;
    }
  }

  async sendCode(phone: string): Promise<SendCodeResult> {
    this.ensureBrowser();
    const tg = await this.getTg();
    const result = await tg.sendCode(
      { apiId: this.apiId, apiHash: this.apiHash },
      phone
    );
    return {
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp,
    };
  }

  async signIn(params: {
    phone: string;
    code: string;
    phoneCodeHash: string;
  }): Promise<SignInResult> {
    this.ensureBrowser();
    const tg = await this.getTg();
    try {
      await tg.signIn({
        phoneNumber: params.phone,
        phoneCode: params.code,
        phoneCodeHash: params.phoneCodeHash,
      });
      const me = await tg.getMe();
      const sessionString = (tg.session as any).save();
      this.session = {
        userId: String(me.id),
        sessionString,
        dcId: tg.session.dcId ?? 2,
        phone: params.phone,
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        username: me.username ?? "",
        createdAt: Date.now(),
      };
      return { session: this.session, needsPassword: false };
    } catch (e: any) {
      if (e.errorMessage === "SESSION_PASSWORD_NEEDED") {
        return { session: null, needsPassword: true };
      }
      throw e;
    }
  }

  async checkPassword(password: string): Promise<UserSession> {
    this.ensureBrowser();
    const tg = await this.getTg();
    await tg.signInWithPassword(
      { apiId: this.apiId, apiHash: this.apiHash },
      { password: () => Promise.resolve(password) }
    );
    const me = await tg.getMe();
    const sessionString = (tg.session as any).save();
    this.session = {
      userId: String(me.id),
      sessionString,
      dcId: tg.session.dcId ?? 2,
      phone: this.session?.phone ?? "",
      firstName: me.firstName ?? "",
      lastName: me.lastName ?? "",
      username: me.username ?? "",
      createdAt: Date.now(),
    };
    return this.session;
  }

  async logOut(_session: UserSession): Promise<void> {
    this.ensureBrowser();
    if (this.tg) {
      try {
        const { Api } = await import("telegram");
        await this.tg.invoke(new Api.auth.LogOut());
      } catch (e) {
        console.warn("[cloud] logOut failed", e);
      }
    }
    this.session = null;
    this.tg = null;
    this.storageChannelId = null;
  }

  async createFolder(name: string): Promise<number> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const { Api } = await import("telegram");
    const channelId = await this.ensureStorageChannel();
    const result = await tg.invoke(
      new Api.channels.CreateForumTopic({
        channel: channelId,
        title: name,
      })
    );
    const topicId =
      (result as any)?.updates?.find((u: any) => u.className === "UpdateForumTopic")
        ?.id ?? Math.floor(Math.random() * 100000);
    return topicId;
  }

  async editFolder(topicId: number, name: string): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const { Api } = await import("telegram");
    const channelId = await this.ensureStorageChannel();
    await tg.invoke(
      new Api.channels.EditForumTopic({
        channel: channelId,
        topicId,
        title: name,
      })
    );
  }

  async deleteFolder(topicId: number): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const { Api } = await import("telegram");
    const channelId = await this.ensureStorageChannel();
    await tg.invoke(
      new Api.channels.DeleteTopicHistory({
        channel: channelId,
        topMsgId: topicId,
      })
    );
  }

  async uploadFile(
    data: ArrayBuffer,
    fileName: string,
    topicId: number,
    onProgress?: (sent: number, total: number) => void
  ): Promise<string> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const channelId = await this.ensureStorageChannel();

    // CustomFile — gramjs API для загрузки из ArrayBuffer в браузере
    const { CustomFile } = await import("telegram/client/uploads");
    const buffer = Buffer.from(data);
    const customFile = new CustomFile(fileName, buffer.length, buffer);

    const sentFile = await tg.uploadFile({
      file: customFile,
      workers: 1,
      onProgress: (progress: number) => {
        const total = data.byteLength;
        const sent = Math.floor(total * progress);
        onProgress?.(sent, total);
      },
    });

    const message = await tg.sendFile(channelId, {
      file: sentFile,
      caption: fileName,
      replyTo: topicId,
    });

    return String(message.id);
  }

  async downloadFile(
    fileId: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<ArrayBuffer> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const channelId = await this.ensureStorageChannel();
    const messageId = Number(fileId);

    const messages = await tg.getMessages(channelId, { ids: [messageId] });
    const message = messages[0];
    if (!message || !message.media) {
      throw new Error("File not found in storage");
    }

    const buffer = await tg.downloadMedia(message, {
      progressCallback: (received: number, total: number) => {
        onProgress?.(received, total);
      },
    });

    if (buffer instanceof ArrayBuffer) return buffer;
    if (Buffer.isBuffer(buffer)) {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    return new ArrayBuffer(0);
  }

  async deleteMessages(messageId: number): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const channelId = await this.ensureStorageChannel();
    await tg.deleteMessages(channelId, [messageId], { revoke: true });
  }

  async editMessageCaption(messageId: number, newCaption: string): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const channelId = await this.ensureStorageChannel();
    await tg.editMessage(channelId, { message: messageId, text: newCaption });
  }

  async forwardMessage(messageId: number, targetTopicId: number): Promise<number> {
    this.ensureBrowser();
    const tg = await this.getTg(this.session?.sessionString);
    const channelId = await this.ensureStorageChannel();
    const result = await tg.forwardMessages(channelId, [messageId], channelId, {
      withMyScore: false,
      topMsgId: targetTopicId,
    });
    const newId =
      (result as any)?.updates?.find((u: any) => u.className === "MessageID")?.id ??
      Math.floor(Math.random() * 1000000);
    return newId;
  }

  /** Получить или создать приватный канал-хранилище */
  private async ensureStorageChannel(): Promise<any> {
    if (this.storageChannelId) return this.storageChannelId;
    const tg = await this.getTg(this.session?.sessionString);
    const { Api } = await import("telegram");

    // Ищем существующий канал по названию
    const dialogs = await tg.getDialogs({ limit: 200 });
    const existing = dialogs.find(
      (d: any) => d.title === "kicloud Storage" && d.isChannel
    );
    if (existing) {
      this.storageChannelId = existing.entity;
      return this.storageChannelId;
    }

    // Создаём новый приватный канал с форумом
    const result = await tg.invoke(
      new Api.channels.CreateChannel({
        title: "kicloud Storage",
        about: "kicloud file storage",
        megagroup: false,
        forum: true,
      })
    );
    const channel = (result as any)?.chats?.[0];
    if (!channel) throw new Error("Failed to create storage channel");
    this.storageChannelId = channel;
    return this.storageChannelId;
  }
}

/* ============================================================
   Mock-клиент для demo-режима (без реального подключения).
   ============================================================ */
class MockCloudClient implements CloudClient {
  private session: UserSession | null = null;
  private codeHashCounter = 0;
  private topicCounter = 1;
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
    this.pendingCode = { phone, code: "12345", hash };
    return { phoneCodeHash: hash, isCodeViaApp: true };
  }

  async signIn(params: {
    phone: string;
    code: string;
    phoneCodeHash: string;
  }): Promise<SignInResult> {
    await sleep(700);
    if (this.pendingCode?.hash !== params.phoneCodeHash) {
      throw new Error("Invalid phoneCodeHash");
    }
    if (params.code !== "12345") {
      throw new Error("Invalid code (demo code: 12345)");
    }
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

  async createFolder(_name: string): Promise<number> {
    await sleep(400);
    return ++this.topicCounter;
  }

  async editFolder(_topicId: number, _name: string): Promise<void> {
    await sleep(200);
  }

  async deleteFolder(_topicId: number): Promise<void> {
    await sleep(300);
  }

  async uploadFile(
    data: ArrayBuffer,
    _fileName: string,
    _topicId: number,
    onProgress?: (sent: number, total: number) => void
  ): Promise<string> {
    const total = data.byteLength;
    const chunkSize = Math.max(1024 * 64, Math.floor(total / 20));
    for (let sent = 0; sent <= total; sent += chunkSize) {
      await sleep(50 + Math.random() * 50);
      onProgress?.(Math.min(sent, total), total);
    }
    return String(++this.messageCounter);
  }

  async downloadFile(
    _fileId: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<ArrayBuffer> {
    const total = 1024 * 1024;
    const chunkSize = 1024 * 64;
    for (let received = 0; received <= total; received += chunkSize) {
      await sleep(20);
      onProgress?.(Math.min(received, total), total);
    }
    return new ArrayBuffer(0);
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
