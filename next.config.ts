import type { NextConfig } from 'next';

/** firebase-admin / Chromium 은 서버 전용 — 클라이언트 번들에 넣지 않는다. */
const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/esign/**': [
      './public/contract-template/**/*',
      './public/fonts/**/*',
      './node_modules/@sparticuz/chromium/**/*',
    ],
  },
};

export default nextConfig;
