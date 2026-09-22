'use client';
/**
 * ★★★**다섯 걸음 — 폰 하단 · PC 상단, 같은 동선** (대표 2026-09-18 · 2026-09-22 목업 갱신)
 *   「상품찾기는 상품 목록이 있을 거고 그걸 누르면 상품 상세가 나오는 거고 거기서 접수를 누르면
 *    접수하기 화면으로 바로 이동하는 거고, 그러면 다 하단바에 있어야 될 것 같은데」
 *   「상품 접수 실적 계약 … 청구 지급도 있어야 될 거고 — 버튼이 몇 개여야 되는지 네가 한번 생각해 봐」
 *
 * ★2026-09-22 대표 — 목업(`docs/ui/mockups/admin-mobile-five-functions.html`)이 다섯 걸음 이름을
 *   상품·접수·계약·실적·정산으로 확정했다. 그대로 옮긴다(아이콘도 목업 그림 그대로).
 *   실적·정산은 새 쪽이 아니다 — 기존 정산관리(`/settlement`)의 `tab=claim|pay` 두 입구를
 *   이름만 목업에 맞춰 다시 붙인 것뿐이다(경로·기능은 손대지 않았다).
 * ★탭 지도는 «여기 한 곳»에서만 쓴다 — 폰 하단(`MobileTabBar`)과 PC 상단(`Brand.TopMenu`)이 같은
 *   `TABS`·아이콘·「지금 탭」 판정을 나눠 쓴다(대표 「같은 걸 왜 또 짜」).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS: Record<string, React.ReactNode> = {
  상품: <><path d="M4 7h16v12H4z" /><path d="M7 7V4h10v3M8 12h8" /></>,
  접수: <><rect x="6" y="3" width="12" height="18" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  계약: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h5M8 13h8M8 17h6" /></>,
  실적: <><path d="M4 19V9M10 19V5M16 19v-7M3 19h18" /></>,
  정산: <><path d="M4 6h16v12H4z" /><path d="M4 10h16M8 15h3" /></>,
};
export const TABS = [
  ['상품', '/products'],
  ['접수', '/intake?v=work'],
  ['계약', '/esign'],
  ['실적', '/performance'],
  ['정산', '/settlement'],
] as const;

/** 지금 눌린 탭 — 경로로 가른다(실적 = /performance · 정산 = /settlement, 대표 2026-09-22 「목업대로 나눔」). 폰 하단 · PC 상단이 같이 쓴다 */
export function useCurrentTab(): string {
  const path = usePathname() || '/';
  if (path.startsWith('/performance')) return '실적';
  if (path.startsWith('/settlement')) return '정산';
  if (path.startsWith('/products')) return '상품';
  if (path.startsWith('/intake')) return '접수';
  if (path.startsWith('/esign')) return '계약';
  return '';
}

export function TabIcon({ label, size = 22 }: { label: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[label]}</svg>
  );
}

export function MobileTabBar() {
  const now = useCurrentTab();
  return (
    <nav className="dz-tabbar" aria-label="판 바꾸기">
      {TABS.map(([label, href]) => (
        <Link key={label} href={href} className={now === label ? 'on' : undefined} aria-current={now === label ? 'page' : undefined}>
          <TabIcon label={label} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
