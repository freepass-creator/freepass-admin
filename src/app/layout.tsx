import type { ReactNode } from 'react';
import './globals.css';
import './_design/admin-final.css';
import './_fn/fn.css';

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
      {/* ★Pretendard — 프리패스 세일즈(app.css)·목업이 쓰는 실제 글꼴. globals.css 는 이 이름을 이미
          font-family 1순위로 적어 뒀지만 «불러오는 줄»이 없어 사실은 시스템 대체 글꼴(굵고 뭉툭)로 그려지고 있었다
          (대표 2026-09-22 「폰트 지금 뭐지??」). CDN 은 세일즈 목업이 쓰는 것과 같은 출처(orioncactus/pretendard). */}
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
