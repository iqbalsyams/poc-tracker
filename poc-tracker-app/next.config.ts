import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Semua halaman bergantung pada sesi login dan data terbaru, jadi tidak ada yang di-cache/prerender
  cacheComponents: false,
  // Image Docker ringan untuk DevOps (lihat Dockerfile)
  output: "standalone",
  // Tetap sebagai modul terpisah di output standalone karena scripts/migrate.mjs (seed) juga memakainya
  serverExternalPackages: ["pg", "bcryptjs", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
