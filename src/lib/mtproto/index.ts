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
    // Если клиент уже создан — возвращаем существующий.
    // sessionString передаётся ТОЛЬКО при validateSession (восстановление сессии после reload).
    // Все остальные методы (sendCode, signIn, uploadFile, и т.д.) вызывают getTg() без аргументов —
    // клиент уже авторизован, НЕ нужно переподключаться.
    if (this.tg && !sessionString) {
      // Проверяем, что клиент подключён. Если нет — переподключаем.
      if (this.tg.connected) {
        return this.tg;
      }
      console.log("[cloud] client exists but disconnected, reconnecting...");
      try {
        await Promise.race([
          this.tg.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("CONNECT_TIMEOUT")), 8000)
          ),
        ]);
        console.log("[cloud] reconnected ✓");
      } catch (e) {
        console.warn("[cloud] reconnect failed, trying fresh client:", e);
        this.tg = null;
      }
      if (this.tg) return this.tg;
    }
    // Если нужно восстановить сессию и клиент уже есть — переподключаем
    if (this.tg && sessionString) {
      try {
        await Promise.race([
          this.tg.disconnect(),
          new Promise((_, r) => setTimeout(() => r(new Error("disconnect timeout")), 2000)),
        ]);
      } catch {}
      this.tg = null;
    }
    // Динамический import — gramjs загружается только в браузере
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions");
    // Если sessionString не передан, используем сохранённую сессию (this.session)
    const sessStr = sessionString ?? this.session?.sessionString ?? "";
    const stringSession = new StringSession(sessStr);
    this.tg = new TelegramClient(stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
      autoReconnect: true,
      useWSS: true, // обязательно для браузера (HTTPS-only)
      retryDelay: 1000,
    });
    // connect() с timeout — gramjs иногда зависает после DC migration.
    // Если timeout — всё равно возвращаем client (invoke сам переподключит).
    console.log("[cloud] connecting...");
    try {
      await Promise.race([
        this.tg.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("CONNECT_TIMEOUT")), 8000)
        ),
      ]);
      console.log("[cloud] connected ✓");
    } catch (e) {
      console.warn("[cloud] connect timeout/error, continuing anyway:", e);
    }
    // Даём время на стабилизацию после DC migration
    await new Promise((r) => setTimeout(r, 1500));
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
    const { Api } = await import("telegram");

    console.log("[cloud] sendCode →", phone);

    // Прямой invoke Api.auth.SendCode.
    // НЕ используем хелпер tg.sendCode — он зависает после DC migration
    // (подключается к новому DC, но не повторяет запрос).
    // PHONE_MIGRATE_X обрабатываем вручную: ждём реконнект, вызываем ОДИН раз ещё.
    // Это не вызывает FLOOD_WAIT, т.к. миграция — это не повтор, а перенаправление.
    const doInvoke = () =>
      Promise.race([
        tg.invoke(
          new Api.auth.SendCode({
            phoneNumber: phone,
            apiId: this.apiId,
            apiHash: this.apiHash,
            settings: new Api.CodeSettings({}),
          })
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT_30S")), 30000)
        ),
      ]);

    let result: any;
    try {
      result = await doInvoke();
    } catch (e: any) {
      const errMsg = e?.errorMessage || e?.message || String(e);
      const seconds = e?.seconds || 0;
      console.warn("[cloud] sendCode first attempt:", errMsg);

      // PHONE_MIGRATE_X / USER_MIGRATE_X — нужен переход на другой DC.
      // gramjs автоматически мигрирует, но invoke нужно повторить ОДИН раз.
      if (errMsg.startsWith("PHONE_MIGRATE_") || errMsg.startsWith("USER_MIGRATE_")) {
        console.log("[cloud] DC migration, waiting 3s and retrying once...");
        await new Promise((r) => setTimeout(r, 3000));
        try {
          result = await doInvoke();
        } catch (e2: any) {
          return this.handleSendCodeError(e2);
        }
      } else {
        return this.handleSendCodeError(e);
      }
    }

    console.log("[cloud] sendCode ✓", result);
    return {
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp ?? false,
    };
  }

  private handleSendCodeError(e: any): never {
    const errMsg = e?.errorMessage || e?.message || String(e);
    const seconds = e?.seconds || 0;
    console.warn("[cloud] sendCode failed:", errMsg, e);

    if (errMsg.startsWith("FLOOD") || seconds > 0) {
      const waitSec = seconds || 30;
      const mins = Math.ceil(waitSec / 60);
      const hours = Math.floor(mins / 60);
      const restMins = mins % 60;
      const timeStr = hours > 0 ? `${hours} ч. ${restMins} мин.` : `${mins} мин.`;
      throw new Error(
        `Слишком много попыток входа. Подождите ${timeStr} и попробуйте снова.`
      );
    }
    if (errMsg === "PHONE_NUMBER_INVALID") {
      throw new Error("Неверный формат номера телефона");
    }
    if (errMsg === "PHONE_NUMBER_BANNED") {
      throw new Error("Этот номер заблокирован в Telegram");
    }
    if (errMsg === "PHONE_NUMBER_FLOOD") {
      throw new Error("Слишком много запросов на этот номер. Попробуйте позже.");
    }
    if (errMsg === "TIMEOUT_30S") {
      throw new Error(
        "Таймаут подключения к Telegram. Проверьте интернет и попробуйте снова."
      );
    }
    throw new Error(`Ошибка Telegram: ${errMsg}`);
  }

  async signIn(params: {
    phone: string;
    code: string;
    phoneCodeHash: string;
  }): Promise<SignInResult> {
    this.ensureBrowser();
    const tg = await this.getTg();
    const { Api } = await import("telegram");
    console.log("[cloud] signIn →", params.phone, "code:", params.code);
    try {
      const result = await Promise.race([
        tg.invoke(
          new Api.auth.SignIn({
            phoneNumber: params.phone,
            phoneCode: params.code,
            phoneCodeHash: params.phoneCodeHash,
          })
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT_30S")), 30000)
        ),
      ]);
      console.log("[cloud] signIn ✓", (result as any)?.className);
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
      const errMsg = e?.errorMessage || e?.message || String(e);
      const seconds = e?.seconds || 0;
      console.warn("[cloud] signIn failed:", errMsg, e);
      if (errMsg.startsWith("FLOOD") || seconds > 0) {
        const waitSec = seconds || 30;
        const mins = Math.ceil(waitSec / 60);
        throw new Error(`Слишком много попыток. Подождите ${mins} мин.`);
      }
      if (errMsg === "SESSION_PASSWORD_NEEDED") {
        return { session: null, needsPassword: true };
      }
      if (errMsg === "PHONE_CODE_INVALID") {
        throw new Error("Неверный код подтверждения");
      }
      if (errMsg === "PHONE_CODE_EXPIRED") {
        throw new Error("Код истёк, запросите новый");
      }
      if (errMsg === "TIMEOUT_30S") {
        throw new Error("Таймаут подключения. Проверьте интернет.");
      }
      throw new Error(`Ошибка: ${errMsg}`);
    }
  }

  async checkPassword(password: string): Promise<UserSession> {
    this.ensureBrowser();
    const tg = await this.getTg();
    const { Api } = await import("telegram");
    console.log("[cloud] checkPassword →");
    // Получаем SRP-параметры для cloud password
    const passwordSrpResult = await tg.invoke(new Api.account.GetPassword());
    // Вычисляем SRP через грамjs хелпер
  const { computeCheck } = await import("telegram/Password");
    const passwordSrpCheck = await computeCheck(passwordSrpResult, password);
    await tg.invoke(new Api.auth.CheckPassword({ password: passwordSrpCheck }));
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
    const tg = await this.getTg();
    const { Api } = await import("telegram");
    const channelId = await this.ensureStorageChannel();
    console.log(`[cloud] createFolder "${name}"`);
    const result = await tg.invoke(
      new Api.channels.CreateForumTopic({
        channel: channelId,
        title: name,
      })
    );
    console.log("[cloud] createFolder result:", (result as any)?.className);
    // Ищем ID топика в updates
    const updates = (result as any)?.updates ?? [];
    let topicId: number | null = null;
    for (const u of updates) {
      if (u.className === "UpdateForumTopic" && typeof u.id === "number") {
        topicId = u.id;
        break;
      }
    }
    // Fallback: иногда ID в MessageReplyInfo или в самом result
    if (topicId === null) {
      topicId = (result as any)?.id ?? Math.floor(Date.now() / 1000);
    }
    console.log("[cloud] createFolder ✓ topicId:", topicId);
    return topicId;
  }

  async editFolder(topicId: number, name: string): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg();
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
    const tg = await this.getTg();
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
    const tg = await this.getTg();
    const channelId = await this.ensureStorageChannel();

    console.log(`[cloud] uploadFile → "${fileName}" (${data.byteLength} bytes) to topic ${topicId}`);
    console.log("[cloud] channelId type:", channelId?.className || typeof channelId);

    // gramjs sendFile принимает CustomFile (НЕ нативный browser File).
    // Нативный File ломает _fileToMedia — gramjs пытается getInputMedia на нём,
    // что падает с "Cannot use [object File] as file".
    // CustomFile с buffer работает: fileToBuffer() возвращает file.buffer напрямую.
    const { CustomFile } = await import("telegram/client/uploads");
    // Buffer доступен глобально через ProvidePlugin (polyfill).
    // Buffer.from(ArrayBuffer) создаёт Node.js-совместимый Buffer.
    const buffer = Buffer.from(data);
    const customFile = new CustomFile(fileName, buffer.length, "", buffer);
    console.log("[cloud] CustomFile created, size:", customFile.size, "name:", customFile.name);

    try {
      console.log("[cloud] sendFile (with auto-upload)...");
      // Для forum topics нужно использовать topMsgId (НЕ replyTo).
      const message = await tg.sendFile(channelId, {
        file: customFile,
        caption: fileName,
        forceDocument: true,   // не сжимать, отправить как документ
        topMsgId: topicId,     // forum topic ID
        progressCallback: (sent: number, total: number) => {
          console.log(`[cloud] upload progress: ${sent}/${total}`);
          onProgress?.(sent, total);
        },
      });
      console.log("[cloud] uploadFile ✓ messageId:", message?.id);
      return String(message.id);
    } catch (e: any) {
      console.error("[cloud] uploadFile FAILED:", e?.errorMessage || e?.message, e);
      const errMsg = e?.errorMessage || e?.message || String(e);
      // Человеко-читаемые ошибки
      if (errMsg === "CHAT_ADMIN_REQUIRED" || errMsg === "CHAT_WRITE_FORBIDDEN") {
        throw new Error("Нет прав на запись в канал-хранилище. Обратитесь к поддержке.");
      }
      if (errMsg === "TOPIC_CLOSED") {
        throw new Error("Папка закрыта. Создайте новую.");
      }
      if (errMsg === "TOPIC_DELETED") {
        throw new Error("Папка удалена. Обновите список.");
      }
      if (errMsg.startsWith("FLOOD") || e?.seconds > 0) {
        const sec = e?.seconds || 30;
        throw new Error(`Слишком много загрузок. Подождите ${Math.ceil(sec / 60)} мин.`);
      }
      if (errMsg === "FILE_PARTS_INVALID" || errMsg === "FILE_PART_LENGTH_INVALID") {
        throw new Error("Файл слишком большой или повреждён.");
      }
      throw new Error(`Ошибка загрузки: ${errMsg}`);
    }
  }

  async downloadFile(
    fileId: string,
    onProgress?: (received: number, total: number) => void
  ): Promise<ArrayBuffer> {
    this.ensureBrowser();
    const tg = await this.getTg();
    const channelId = await this.ensureStorageChannel();
    const messageId = Number(fileId);

    console.log(`[cloud] downloadFile ← messageId ${messageId}`);

    const messages = await tg.getMessages(channelId, { ids: [messageId] });
    const message = messages[0];
    if (!message) {
      throw new Error("Сообщение не найдено");
    }
    if (!message.media) {
      throw new Error("В сообщении нет файла");
    }

    // downloadMedia(client, message, outputFile?, thumb?, progressCallback?)
    // outputFile — undefined (не пишем на диск, возвращаем Buffer)
    // progressCallback — позиционный 5й аргумент, принимает bigInt.BigInteger
    console.log("[cloud] downloadMedia...");
    const buffer = await tg.downloadMedia(
      message,
      undefined, // outputFile — не пишем на диск
      undefined, // thumb — скачиваем оригинал
      (received: any, total: any) => {
        // received/total — bigInt.BigInteger, конвертируем в number
        const r = typeof received?.toNumber === "function" ? received.toNumber() : Number(received);
        const t = typeof total?.toNumber === "function" ? total.toNumber() : Number(total);
        console.log(`[cloud] download progress: ${r}/${t}`);
        onProgress?.(r, t);
      }
    );

    console.log("[cloud] downloadFile ✓ type:", typeof buffer, buffer?.constructor?.name);

    if (buffer instanceof ArrayBuffer) return buffer;
    if (Buffer.isBuffer(buffer)) {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    if (buffer instanceof Uint8Array) {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    if (buffer instanceof Blob) {
      return await buffer.arrayBuffer();
    }
    // Fallback: если gramjs вернул что-то странное
    console.warn("[cloud] unexpected buffer type:", buffer);
    return new ArrayBuffer(0);
  }

  async deleteMessages(messageId: number): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg();
    const channelId = await this.ensureStorageChannel();
    await tg.deleteMessages(channelId, [messageId], { revoke: true });
  }

  async editMessageCaption(messageId: number, newCaption: string): Promise<void> {
    this.ensureBrowser();
    const tg = await this.getTg();
    const channelId = await this.ensureStorageChannel();
    await tg.editMessage(channelId, { message: messageId, text: newCaption });
  }

  async forwardMessage(messageId: number, targetTopicId: number): Promise<number> {
    this.ensureBrowser();
    const tg = await this.getTg();
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
    const tg = await this.getTg();
    const { Api } = await import("telegram");

    console.log("[cloud] ensureStorageChannel: searching for existing channel...");

    // Ищем существующий канал по названию
    const dialogs = await tg.getDialogs({ limit: 200 });
    const existing = dialogs.find(
      (d: any) => d.title === "kicloud Storage" && d.isChannel
    );
    if (existing) {
      // Получаем InputEntity (нужно для sendFile/invoke)
      let entityId = existing.entity;
      if (!entityId) {
        try {
          entityId = await tg.getInputEntity(existing.id);
        } catch {
          entityId = existing.id;
        }
      }
      console.log("[cloud] found existing storage channel:", existing.id?.toString());
      this.storageChannelId = entityId;
      return this.storageChannelId;
    }

    console.log("[cloud] creating new storage channel with forum=true...");
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
    if (!channel) {
      console.error("[cloud] CreateChannel result:", result);
      throw new Error("Не удалось создать канал-хранилище");
    }
    console.log("[cloud] storage channel created:", channel.id?.toString());
    // channel уже является Api.Channel объектом — его можно передавать как entity
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
