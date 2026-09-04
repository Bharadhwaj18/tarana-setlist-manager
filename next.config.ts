import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ['pdfjs-dist'],
  // Pin the workspace root explicitly — a stray pnpm-lock.yaml higher up in
  // C:\Users\shrey confuses Turbopack's automatic root inference otherwise,
  // producing a "workspace root may not be correct" warning on every run.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
