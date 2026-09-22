import type { NextConfig } from 'next';

/** firebase-admin 은 서버에서만 돈다 — 묶지 말고 그대로 부른다. */
const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],
  devIndicators: false,
};

export default nextConfig;
