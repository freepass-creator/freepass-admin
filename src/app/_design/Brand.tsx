'use client';
/**
 * ★★★**freepass-admin 의 얼굴 — 공식 CI 워드마크 그대로** (대표 2026-09-18)
 *   「freepass admin 은 우리 CI 규격에 맞춰서 BI 규격으로 해주세요」 · 「공식적인 CI 에는 그 체크박스 네모가 없어」
 *
 * 정본 = CI / BI Center(`C:\dev\ci_center\index.html` BRANDS · roleColor) — 새로 짓지 않는다. 거기 적힌 값을 옮긴다.
 *   · **마크 없음 — 워드마크뿐.** Exo 2 · 앞말 600(main) + 뒷말 300(base) · 사이 2px.
 *   · 색  밝은 바탕: main `#1B2A4A` · base `#7F93B3`
 *         남색 바탕(ctx 'brand' — 위 띠): main `#FFFFFF` · base `rgba(255,255,255,.55)`
 * ⚠ 앞서 erp4 앱 아이콘(둥근 네모 + 체크)을 CI 마크처럼 붙였다 — 공식 CI 에는 없다. 걷었다.
 */
import Link from 'next/link';
import { Exo_2 } from 'next/font/google';
import { TABS, TabIcon, useCurrentTab } from './MobileTabBar';

const 레터링 = Exo_2({ weight: ['300', '600'], subsets: ['latin'], display: 'swap' });

/** 워드마크 — 「freepass」(600) 「admin」(300). 누르면 첫 화면으로. */
export function Brand({ tail = 'admin' }: { tail?: string }) {
  return (
    <Link href="/" className={`dz-brand ${레터링.className}`} aria-label={`freepass ${tail}`}>
      <span className="dz-word"><b>freepass</b><i>{tail}</i></span>
    </Link>
  );
}

/**
 * ★2026-09-22 대표 — PC 상단 5개 페이지 전환 메뉴. 폰 하단(`MobileTabBar`)과 «같은 다섯 걸음»
 *   (상품 · 접수 · 계약 · 실적 · 정산)을 쓴다 — 탭 지도·아이콘·「지금 탭」 판정을 `MobileTabBar`에서 그대로 가져온다(재사용).
 *   위치는 관리자 띠(`.fn-top`) 바로 아래(`_design/AdminChrome`) — PC 전용, 폰에서는 안 보인다(`.dz-desktop-bottom` CSS).
 */
export function TopMenu() {
  const now = useCurrentTab();
  return (
    <div className="dz-menu">
      {TABS.map(([label, href]) => (
        <Link key={label} href={href} className={now === label ? 'on' : undefined} aria-current={now === label ? 'page' : undefined}>
          <TabIcon label={label} />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
