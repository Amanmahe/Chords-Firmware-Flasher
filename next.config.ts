import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web Serial / WebUSB need a secure context: serve over HTTPS (or localhost).
};

export default nextConfig;
