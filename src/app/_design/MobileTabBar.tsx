'use client';
/**
 * 폰 하단 전역 업무탭.
 * 최신 Admin 운영축과 PC SideMenu를 그대로 따른다:
 *   상품 → 접수 → 실적 → 정산
 * 전자계약은 운영축 밖의 별도 문이며 ESIGN_ENABLED=on일 때만 마지막에 붙는다.
 * 청구/지급은 별도 전역탭이 아니라 정산 화면 안의 두 축(공급사/영업채널)으로 전환한다.
 * depth 1+에서는 전역탭 대신 현재 Panel의 ActionBar가 선다.
 */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const 아이콘: Record<string, React.ReactNode> = {
  상품: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  접수: <><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 3h6v3H9z" /><path d="M8.5 11h7M8.5 15h4.5" /></>,
  실적: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.2 2.2 4.8-5" /></>,
  정산: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 14.5h3" /></>,
  계약: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8.5 17c1.2-1.8 2.2-1.8 2.7 0 .4 1.3 1.3 1.1 2.1-.2l.4-.6.9 1" /></>,
};
const TABS = [
  ['상품', '/products'],
  ['접수', '/intake?v=work'],
  ['실적', '/intake?wiv=실적&iv=분납실적&v=work'],
  ['정산', '/settlement'],
  ['계약', '/esign'],
] as const;

/** 지금 눌린 전역 업무축. 정산 내부의 claim/pay는 같은 정산 탭이다. */
function useCurrent(): string {
  const path = usePathname() || '/';
  const sp = useSearchParams();
  if (path.startsWith('/settlement')) return '정산';
  if (path.startsWith('/products')) return '상품';
  if (path.startsWith('/intake')) {
    return sp.get('wiv') === '실적' || ['분납실적', '완납실적'].includes(sp.get('iv') ?? '') ? '실적' : '접수';
  }
  if (path.startsWith('/esign')) return '계약';
  return '';
}

export function MobileTabBar({ esign = true }: { esign?: boolean }) {
  const now = useCurrent();
  const tabs = esign ? TABS : TABS.filter(([label]) => label !== '계약');
  return (
    <nav className="dz-tabbar" aria-label="판 바꾸기">
      {tabs.map(([label, href]) => (
        <Link key={label} href={href} className={now === label ? 'on' : undefined} aria-current={now === label ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>{아이콘[label]}</svg>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
