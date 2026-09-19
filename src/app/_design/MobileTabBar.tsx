'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const 아이콘: Record<string, React.ReactNode> = {
  상품: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  접수: <><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 3h6v3H9z" /><path d="M8.5 11h7M8.5 15h4.5" /></>,
  계약: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8.5 17c1.2-1.8 2.2-1.8 2.7 0 .4 1.3 1.3 1.1 2.1-.2l.4-.6.9 1" /></>,
  실적: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
  정산: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 14.5h4M15.5 14.5h1.5" /></>,
};

const TABS = [
  ['상품', '/products'],
  ['접수', '/intake?v=work'],
  ['계약', '/esign'],
  ['실적', '/performance'],
  ['정산', '/settlement'],
] as const;

function useCurrent(): string {
  const path = usePathname() || '/';
  if (path.startsWith('/products')) return '상품';
  if (path.startsWith('/intake')) return '접수';
  if (path.startsWith('/esign')) return '계약';
  if (path.startsWith('/performance')) return '실적';
  if (path.startsWith('/settlement')) return '정산';
  return '';
}

export function MobileTabBar() {
  const now = useCurrent();
  return (
    <nav className="dz-tabbar" aria-label="주요 업무">
      {TABS.map(([label, href]) => (
        <Link key={label} href={href} className={now === label ? 'on' : undefined}
          aria-current={now === label ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>{아이콘[label]}</svg>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
