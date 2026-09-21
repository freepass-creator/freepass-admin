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
import { Icon } from './Icon';
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
 * 기존 이름 TopMenu는 호환을 위해 유지한다. 현재 위치는 PC 하단 업무 버튼(2026-09-21).
 *   Sales 기준: 흰 바탕, 아이콘·라벨만 강조. 활성 메뉴에 진한 버튼 면을 칠하지 않는다.
 * ★폰에서는 이 메뉴가 안 보인다 — `_design/MobileTabBar`의 다섯 걸음
 *   (상품 · 접수 · 계약 · 청구 · 지급)이 대신한다.
 *   Desktop 4축과 Mobile 5걸음은 같은 업무를 다른 깊이로 배열한 것이며,
 *   청구·지급은 Desktop의 「정산관리」 한 축을 모바일에서 두 입구로 나눈 것이다.
 */
export function TopMenu({ items }: { items: readonly (readonly [string, string])[] }) {
  const path = usePathname() || '/';
  return (
    <div className="dz-menu">
      {items.map(([href, label]) => {
        const 여기 = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={여기 ? 'on' : undefined} aria-current={여기 ? 'page' : undefined}>
            <Icon name={href === '/products' ? 'search' : href === '/intake' ? 'clipboard' : href === '/settlement' ? 'wallet' : 'file-text'} size={24} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
