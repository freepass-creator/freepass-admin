'use client';
/**
 * ★★★**폰 하단 — 다섯 걸음의 동선** (대표 2026-09-18)
 *   「상품찾기는 상품 목록이 있을 거고 그걸 누르면 상품 상세가 나오는 거고 거기서 접수를 누르면
 *    접수하기 화면으로 바로 이동하는 거고, 그러면 다 하단바에 있어야 될 것 같은데」
 *   「상품 접수 실적 계약 … 청구 지급도 있어야 될 거고 — 버튼이 몇 개여야 되는지 네가 한번 생각해 봐」
 *   「그 버튼에 따른 페이지에서 뎁스가 몇 번까지 가는지 … 상단에는 버튼을 안 하는 게 나을 것 같아,
 *    그냥 하단에서 탁탁탁 눌러야지」
 *
 * ── 다섯 걸음(업무 흐름 그대로 — 새 갈래를 안 만들고 있는 화면을 배열만 다시 했다)
 * ```
 *   상품 ─┬─ 목록 → 상세(depth 1) ──「이 상품 접수하기」→(건너뜀) 접수 탭으로
 *   접수 ─┴─ 목록(=실적 걸음) → 상세 · 신규(depth 1)          ★실적은 접수 목록 그 자체다(대표 「정산 가면
 *   계약 ─── 목록 → 상세(depth 1)                    거기가 실적인데」 — 접수·실적을 한 탭으로 묶었다)
 *   청구 ─┬─ 묶음 → 실적 줄(depth 1) → 접수 상세(depth 2)      ★청구·지급은 같은 판(정산관리)을 tab= 으로 가른다
 *   지급 ─┘
 * ```
 * ★상단에는 이동 버튼을 두지 않는다 — 다섯 탭이 늘 바닥 한 줄에 있고, 눌러 들어간 depth 1·2 에서는
 *   ★이 바 대신 «그 판의 하단바»(§14-3, 보조 3 : 주 7)가 서고, 판 머리의 「‹」로 depth 0(이 탭의 집)에 돌아온다.
 *   둘 중 하나만 늘 있다(겹치지 않는다) — CSS 가 `.workspace` 의 `data-mode`·`data-phone`·백링크 유무로 가른다
 *   (`globals.css` 「폰 하단 — 다섯 걸음」). 여기 컴포넌트는 다섯 탭의 자리·강조만 그린다.
 */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const 아이콘: Record<string, React.ReactNode> = {
  상품: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  접수: <><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 3h6v3H9z" /><path d="M8.5 11h7M8.5 15h4.5" /></>,
  계약: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8.5 17c1.2-1.8 2.2-1.8 2.7 0 .4 1.3 1.3 1.1 2.1-.2l.4-.6.9 1" /></>,
  청구: <><circle cx="12" cy="12" r="8.5" /><path d="M9 10.5h3.5a1.8 1.8 0 0 1 0 3.5H9m3 0h1.5m-3-7v9" /></>,
  지급: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 14.5h3" /></>,
};
const TABS = [
  ['상품', '/products'],
  ['접수', '/intake?v=work'],
  ['계약', '/esign'],
  ['청구', '/settlement?tab=claim'],
  ['지급', '/settlement?tab=pay'],
] as const;

/** 지금 눌린 탭 — 경로 + (정산만) tab= 로 가른다 */
function useCurrent(): string {
  const path = usePathname() || '/';
  const sp = useSearchParams();
  if (path.startsWith('/settlement')) return sp.get('tab') === 'pay' ? '지급' : '청구';
  if (path.startsWith('/products')) return '상품';
  if (path.startsWith('/intake')) return '접수';
  if (path.startsWith('/esign')) return '계약';
  return '';
}

export function MobileTabBar() {
  const now = useCurrent();
  return (
    <nav className="dz-tabbar" aria-label="판 바꾸기">
      {TABS.map(([label, href]) => (
        <Link key={label} href={href} className={now === label ? 'on' : undefined} aria-current={now === label ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>{아이콘[label]}</svg>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
