import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web Serial / WebUSB need a secure context: serve over HTTPS (or localhost).

  // Static site in out/ for GitHub Pages (there is no server).
  output: "export",
  // Project pages live under /<repo>; the Pages workflow sets this. Empty locally.
  basePath: process.env.PAGES_BASE_PATH ?? "",
  // /flasher/ -> flasher/index.html, which static hosting serves directly.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
