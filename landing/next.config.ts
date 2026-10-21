import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static site in out/: no server, hosts anywhere (docs/03-landing-page.md §3). Cache Components cannot export, so it stays off.
  output: "export",
  images: { unoptimized: true },
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
