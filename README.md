# kicloud

Бесплатное облачное хранилище файлов с AES-256 шифрованием. Файлы до 2 ГБ, без серверов, без подписок.

**Архитектура:**
- Frontend: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- Backend: Telegram через [gramjs](https://gram.js.org/) (клиентский, в браузере)
- Хранение метаданных: IndexedDB (опционально Firestore для синхронизации)
- Шифрование: AES-256-CBC + gzip в Web Worker (локально, ключ не покидает устройство)
- Хостинг: GitHub Pages (бесплатно, static export)

## Возможности

- Файлы до 2 ГБ через приватный Telegram-канал (forum topics как папки)
- Шифрование AES-256-CBC + gzip + PBKDF2-SHA256 (100k итераций)
- Формат `.kienc` (KIEN magic + IV + размер + зашифрованные данные)
- 2FA поддержка
- Light/Dark тема + RGB-кастомизация
- RU/EN i18n
- PWA (installable, offline-доступ к метаданным)
- Drag-and-drop загрузка
- Grid/List views
- Корзина с авто-очисткой 30 дней
- 100% клиентское — нет серверной части

## Локальный запуск

```bash
# 1. Установить зависимости
bun install

# 2. Заполнить .env (см. ниже)

# 3. Запустить dev-сервер
bun run dev
# Открыть http://localhost:3000
```

### .env конфигурация

```env
# Получить на https://my.telegram.org → API development tools
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash

# Demo-режим: true — mock-транспорт (код 12345, любой пароль)
#             false — реальное подключение к Telegram
KICLOUD_DEMO_MODE=false

# basePath для GitHub Pages:
#   - для репозитория kicloud: NEXT_PUBLIC_BASE_PATH=/kicloud
#   - для кастомного домена: NEXT_PUBLIC_BASE_PATH= (пусто)
NEXT_PUBLIC_BASE_PATH=

# Опционально: Firestore для синхронизации метаданных между устройствами
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Деплой на GitHub Pages + кастомный домен

### Шаг 1: Создать репозиторий

```bash
# На GitHub создайте новый репозиторий с именем "kicloud" (public)
git init
git add .
git commit -m "Initial commit: kicloud"
git remote add origin https://github.com/USERNAME/kicloud.git
git push -u origin main
```

### Шаг 2: Настроить GitHub Actions для автодеплоя

Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - name: Build
        env:
          TELEGRAM_API_ID: ${{ secrets.TELEGRAM_API_ID }}
          TELEGRAM_API_HASH: ${{ secrets.TELEGRAM_API_HASH }}
          KICLOUD_DEMO_MODE: "false"
          NEXT_PUBLIC_BASE_PATH: /kicloud
          NODE_ENV: production
        run: bun run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Шаг 3: Добавить секреты на GitHub

1. Зайдите в репозиторий → Settings → Secrets and variables → Actions
2. Добавьте секреты:
   - `TELEGRAM_API_ID` = `30840671` (или ваш)
   - `TELEGRAM_API_HASH` = `45d7a93d5a14b90a1e596b311844fcb9` (или ваш)

### Шаг 4: Включить GitHub Pages

1. Settings → Pages
2. Source: **GitHub Actions**
3. После пуша в main сайт будет доступен по адресу: `https://USERNAME.github.io/kicloud/`

### Шаг 5: Привязать кастомный домен

1. В настройках DNS вашего домена добавьте записи:
   ```
   # Для apex-домена (example.com):
   A     @     185.199.108.153
   A     @     185.199.109.153
   A     @     185.199.110.153
   A     @     185.199.111.153
   
   # Для поддомена (www.example.com или app.example.com):
   CNAME www   USERNAME.github.io.
   ```

2. В репозитории GitHub: Settings → Pages → Custom domain → введите ваш домен
3. Нажмите **Save**, подождите 5-15 минут для активации HTTPS
4. Поставьте галочку **Enforce HTTPS**

5. Обновите `.env` и секрет `NEXT_PUBLIC_BASE_PATH`:
   - Если домен apex (`https://example.com`): `NEXT_PUBLIC_BASE_PATH=` (пусто)
   - Если поддомен (`https://app.example.com`): `NEXT_PUBLIC_BASE_PATH=` (пусто)
   - Если `https://USERNAME.github.io/kicloud`: `NEXT_PUBLIC_BASE_PATH=/kicloud`

6. Запушьте изменения — GitHub Actions пересоберёт сайт с правильным basePath

### Альтернатива: Vercel / Netlify / Cloudflare Pages

```bash
# Vercel
npm i -g vercel
vercel --prod

# Netlify
npm i -g netlify-cli
netlify deploy --prod --dir=out

# Cloudflare Pages
# Dashboard → Create project → Connect Git repo
# Build command: bun run build
# Output directory: out
```

Все три платформы бесплатны и поддерживают кастомные домены с авто-SSL.

## Опционально: Firestore для синхронизации метаданных

По умолчанию метаданные файлов хранятся в IndexedDB каждого устройства. Если хотите синхронизировать между устройствами:

1. Создайте проект на https://console.firebase.google.com
2. Включите Firestore Database (test mode для начала)
3. Project settings → Your apps → Web app → скопируйте конфиг
4. Заполните `NEXT_PUBLIC_FIREBASE_*` в `.env`
5. Настройте Security Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Каждый пользователь видит только свои метаданные
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. Для анонимной аутентификации включите Anonymous auth в Firebase Console

## Шифрование

**Локальное, без внешнего API — это безопаснее.**

Алгоритм:
1. Gzip-сжатие файла в Web Worker
2. Генерация случайного IV (16 байт, crypto.getRandomValues)
3. Derive key: PBKDF2-SHA256 (100k итераций) из пароля пользователя
4. AES-256-CBC шифрование
5. Формат `.kienc`: `MAGIC(4) + IV(16) + ORIG_SIZE(4) + ENCRYPTED_DATA`

**Ключ никогда не покидает устройство.** Пароль шифрования хранится только в оперативной памяти (Zustand), не персистится в IndexedDB.

Почему не внешний API для шифрования:
- Если ключ уходит на сервер — это компрометирует всю модель безопасности
- Web Crypto API (SubtleCrypto) даёт нативное аппаратное ускорение AES
- Web Worker не блокирует UI (60fps анимации)
- Проверено в браузерах: Chrome, Firefox, Safari, Edge

## Структура проекта

```
src/
├── app/                    # layout.tsx, page.tsx, globals.css
├── components/cloud/       # AuthScreen, Dashboard, Sidebar, FileBrowser, FileCard, SettingsPanel, TrashView, Modals
├── stores/                 # Zustand: auth, settings, storage
├── lib/
│   ├── i18n/              # ru.ts, en.ts, index.ts
│   ├── mtproto/          # CloudClient interface + GramjsCloudClient + MockCloudClient
│   ├── crypto.ts         # Web Worker API
│   ├── db.ts             # IndexedDB через idb
│   ├── types.ts          # типы данных
│   └── utils.ts          # formatFileSize, getFileIcon, formatDate, и т.д.
├── workers/
│   └── crypto.worker.ts  # AES-256-CBC + gzip
public/manifest.json, sw.js, icon.svg
electron/main.cjs              # Electron main process
build/icon.*                   # Иконки для desktop
electron-builder.yml           # конфиг electron-builder
capacitor.config.ts            # конфиг Capacitor для Android
.github/workflows/
├── deploy.yml                 # деплой web-версии на GitHub Pages
└── build-apps.yml             # сборка desktop + android приложений
```

## Desktop + Android приложения

kicloud собирается в нативные приложения через **GitHub Actions**. При пуше в `main` или создании тега `v*` запускается [workflow](.github/workflows/build-apps.yml), который собирает:

- **Windows**: `.exe` (NSIS installer + portable)
- **Linux**: `.AppImage`, `.deb`, `.tar.gz`
- **Android**: `.apk`

### Скачать готовые сборки

1. Откройте https://github.com/vfyov6621-coder/kicloud/actions
2. Выберите workflow "Build Desktop + Android Apps"
3. Нажмите на последний успешный run
4. Скачайте artifacts:
   - `kicloud-windows` → `.exe` файлы
   - `kicloud-linux` → `.AppImage` / `.deb`
   - `kicloud-android` → `.apk`

### Создать Release с приложениями

```bash
# Тег запускает release job, который создаёт GitHub Release
git tag v2.0.0
git push origin v2.0.0
```

Release появится на https://github.com/vfyov6621-coder/kicloud/releases со всеми файлами.

### Технологии

- **Windows/Linux**: [Electron](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/)
  - `electron/main.cjs` — main process
  - `electron-builder.yml` — конфиг сборки
  - Static export из Next.js загружается через кастомный протокол `app://`
- **Android**: [Capacitor](https://capacitorjs.com/) 8.x
  - `capacitor.config.ts` — конфиг
  - Android проект создаётся на CI через `npx cap add android`
  - WebView загружает static export с `androidScheme: https`

### Локальная сборка (для разработки)

```bash
# Установить зависимости
bun install

# Desktop — запустить в dev режиме (нужен собранный ./out/)
bun run build:web
bun run electron:dev

# Desktop — собрать инсталлеры
bun run electron:build:win    # Windows (.exe)
bun run electron:build:linux  # Linux (.AppImage, .deb)

# Android — собрать APK (нужен Android SDK + Java 17)
bun run android:build:debug   # debug APK
bun run android:build:release # release APK (нужен signing key)
```

### Структура

```
electron/
├── main.cjs              # Electron main process
build/
├── icon.svg              # исходная иконка
├── icon.png              # 512x512 PNG (Linux)
├── icon-256.png          # 256x256 PNG
├── icon-128.png          # 128x128 PNG
├── icon.ico              # Windows ICO (multi-size)
electron-builder.yml      # конфиг electron-builder
capacitor.config.ts       # конфиг Capacitor для Android
.github/workflows/
├── deploy.yml            # деплой web-версии на GitHub Pages
└── build-apps.yml        # сборка desktop + android приложений
```

## Лицензия

MIT — используйте свободно.
