import type { NextConfig } from "next";

// Project pages live under /<repo>; the Pages workflow sets this. Empty locally.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Web Serial / WebUSB need a secure context: serve over HTTPS (or localhost).

  // Static site in out/ for GitHub Pages (there is no server).
  output: "export",
  basePath,
  // Links to files in public/ (the driver installer) need the base path too.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // /flasher/ -> flasher/index.html, which static hosting serves directly.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
