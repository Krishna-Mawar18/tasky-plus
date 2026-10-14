import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A parent directory (`C:\Users\darks`) also holds a package-lock.json, so
  // Next's automatic workspace-root detection walks past this project and warns
  // that it "detected multiple lockfiles". Pinning the root to this directory
  // keeps builds, tracing and Turbopack scoped to the app.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
