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
      <body>{children}</body>
    </html>
  );
}
