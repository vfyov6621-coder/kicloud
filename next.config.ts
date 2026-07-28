import type { NextConfig } from "next";

// basePath для GitHub Pages — например, "/kicloud" если репозиторий называется kicloud.
// Для кастомного домена (https://ваш-домен.com) оставьте пустым.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // GitHub Pages требует trailing slash для корректной работы ссылок
  trailingSlash: true,
  // basePath для подкаталога (например, username.github.io/kicloud)
  basePath: BASE_PATH || undefined,
  assetPrefix: BASE_PATH || undefined,
  // Images: отключаем optimizer, GitHub Pages не поддерживает server-side оптимизацию
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

// Для production build (GitHub Pages) — включаем static export + webpack fallback для gramjs.
// В dev (Turbopack) output: "export" не поддерживается.
if (process.env.NODE_ENV === "production") {
  nextConfig.output = "export";
  // Webpack config для gramjs в браузере — gramjs использует Node.js модули,
  // которых нет в браузере. Заменяем их на пустые заглушки + polyfills для Buffer/process.
  nextConfig.webpack = (config, { isServer }) => {
    if (!isServer) {
      const webpack = require("webpack");
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        net: false,
        tls: false,
        stream: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        bufferutil: false,
        "utf-8-validate": false,
        // gramjs требует Buffer и process в браузере
        buffer: require.resolve("buffer/"),
        process: require.resolve("process/browser"),
      };
      // ProvidePlugin: делает Buffer и process доступными глобально
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: "process/browser",
        })
      );
    }
    return config;
  };
}

export default nextConfig;
