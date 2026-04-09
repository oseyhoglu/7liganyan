import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cheerio ve axios Node.js runtime'da çalışır, Edge'e bundle edilmez
  serverExternalPackages: ["cheerio", "axios"],
};

export default nextConfig;
