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
import { usePathname } from 'next/navigation';
import { Exo_2 } from 'next/font/google';

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
 * 위 띠의 메뉴 — «지금 있는 곳»을 색으로 말한다(규칙 ④ 강조는 색으로만). 글자만(규칙 ③).
 *   켜진 메뉴 = 한 단 밝은 남색 면 + 스카이 글자 — CI 두 색을 다 쓴다. 선·밑줄은 긋지 않는다.
 * ★폰에서는 이 메뉴가 안 보인다 — `_design/MobileTabBar`의 다섯 걸음
 *   (상품 · 접수 · 계약 · 실적 · 정산)이 대신한다.
 *   Desktop 4축과 Mobile 5걸음은 같은 업무를 다른 깊이로 배열한다. Mobile 상단에는 메뉴/뒤로/계정 버튼을 두지 않는다.
 */
export function TopMenu({ items }: { items: readonly (readonly [string, string])[] }) {
  const path = usePathname() || '/';
  return (
    <div className="dz-menu">
      {items.map(([href, label]) => {
        const 여기 = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={여기 ? 'on' : undefined} aria-current={여기 ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
