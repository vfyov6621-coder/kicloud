import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "online.kixprojects.kicloud",
  appName: "kicloud",
  webDir: "out",
  server: {
    // Используем hosted URL для gramjs WSS (Android WebView может блокировать
    // WSS соединения к Telegram DC из file:// — hosted URL решает это).
    // Если хотите полностью офлайн — уберите androidScheme и используйте
    // hybrid: true с локальными файлами, но gramjs может не работать.
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    // Разрешаем WSS соединения к Telegram DC
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      spinnerColor: "#3b82f6",
    },
  },
 cordova: {},
};

export default config;
