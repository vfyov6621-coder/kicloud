/**
 * kicloud — Electron main process
 *
 * Загружает Next.js static export из ./out/ через кастомный протокол app://
 * (file:// не работает с абсолютными путями /_next/static/...).
 */

const { app, BrowserWindow, protocol, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

// Регистрируем кастомный протокол до app.ready
// secure: true — чтобы gramjs WSS и Web Crypto API работали
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const OUT_DIR = path.join(__dirname, "..", "out");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 800,
    minHeight: 600,
    title: "kicloud",
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    // Убираем меню для чистого UI
    autoHideMenuBar: true,
  });

  // Показываем окно когда контент готов (избегает white flash)
  win.once("ready-to-show", () => {
    win.show();
  });

  // Открываем внешние ссылки в браузере (не в Electron)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.loadURL("app://./index.html");

  // Убираем меню полностью
  Menu.setApplicationMenu(null);
}

// Обработчик протокола app:// — отдаёт файлы из ./out/
function handleAppProtocol(request) {
  const url = new URL(request.url);
  // url.hostname = ".", url.pathname = "/index.html" или "/_next/static/..."
  let filePath = url.pathname;

  // Нормализуем путь
  if (filePath === "/" || filePath === "") {
    filePath = "/index.html";
  }

  // Для путей без расширения и без trailing slash — добавляем /index.html
  // (Next.js trailingSlash: true создаёт папки с index.html)
  if (!path.extname(filePath) && !filePath.endsWith("/")) {
    filePath = filePath + "/index.html";
  }
  if (filePath.endsWith("/")) {
    filePath = filePath + "index.html";
  }

  const fullPath = path.join(OUT_DIR, filePath);

  // Проверяем, что файл существует. Если нет — отдаём index.html (SPA fallback)
  if (!fs.existsSync(fullPath)) {
    return path.join(OUT_DIR, "index.html");
  }

  return fullPath;
}

app.whenReady().then(() => {
  // Регистрируем file protocol для app://
  protocol.registerFileProtocol("app", (request, callback) => {
    callback(handleAppProtocol(request));
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
