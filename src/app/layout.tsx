import type { ReactNode } from 'react';
import './globals.css';
import './_design/admin-final.css';
import './_fn/fn.css';
import './_design/erp-theme.css';
import './_erp/erp-standard.css';
import './_erp/shell.css';

export const metadata = {
  title: 'freepass-admin',
  description: 'FreePass internal admin ERP',
};

/**
 * 루트 — 쪽 틀(html · body)과 옷만. ★관리자 띠 · 메뉴는 여기 없다 — 관리자 쪽마다 `_design/AdminChrome` 을 쓴다.
 *   청구 링크(/c/[token])는 공급사가 여는 문이라 관리자 틀이 절대 실리면 안 된다(기능 세션 2026-09-18).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 본문 글꼴 — 우리가 서비스하는 Pretendard Variable(OFL). scripts/install-fonts.mjs 가 깐다.
            ★제3자 CDN 에 기대지 않는다. dynamic-subset 이라 브라우저는 쓰는 조각만 받는다.
            ★루트에 두는 까닭 — 로그인·청구 링크처럼 관리자 껍데기가 없는 쪽도 같은 글꼴로 선다. */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
