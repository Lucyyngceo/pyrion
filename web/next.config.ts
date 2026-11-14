import path from "node:path";
import type { NextConfig } from "next";

// The app reads ../data and imports ../engine, so the repository root is the project root
// for bundling and file tracing.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Never trace the downloaded PSI files (gigabytes) or other sessions' work folders.
  outputFileTracingExcludes: {
    "*": ["../data/raw/**", "../.cache/**", "../.git/**", "../pipeline/**"],
  },
};

export default nextConfig;
