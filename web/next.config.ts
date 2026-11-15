import path from "node:path";
import type { NextConfig } from "next";

// The app reads ../data and imports ../engine, so the repository root is the project root
// for bundling and file tracing.
const repoRoot = path.join(__dirname, "..");

// Security headers on every response. Next.js injects small inline scripts for hydration, so script-src needs
// 'unsafe-inline' (no nonce plumbing); the dev server also needs 'unsafe-eval'. Nothing is loaded from other origins.
const dev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Never trace the downloaded PSI files (gigabytes) or other sessions' work folders.
  outputFileTracingExcludes: {
    "*": ["../data/raw/**", "../.cache/**", "../.git/**", "../pipeline/**"],
  },
};

export default nextConfig;
