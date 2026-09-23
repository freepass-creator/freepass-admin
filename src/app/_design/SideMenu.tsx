'use client';
/**
 * ★PC 왼쪽 업무 메뉴 — AI Core «ERP 표준 UI 규격 v1» 골격 ② (대표 2026-09-23 「이 컨셉으로 프리패스 어드민에 적용」)
 *   메뉴는 폰 하단 다섯 걸음(`MobileTabBar`)과 같은 업무를 같은 차례로 놓는다 — 상품 · 접수 · 계약 · 청구 · 지급.
 *   정산관리(청구 · 지급)는 같은 판을 tab= 으로 가른다. 새 갈래를 만들지 않는다.
 *   폰에서는 이 메뉴가 안 보인다(CSS) — 다섯 걸음 하단바가 대신한다.
 */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from './Icon';

type Item = { key: string; label: string; href: string; icon: string };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: '영업', items: [
    { key: '상품', label: '상품찾기', href: '/products', icon: 'search' },
    { key: '접수', label: '계약접수', href: '/intake', icon: 'clipboard' },
  ] },
  { title: '계약', items: [
    { key: '계약', label: '전자계약', href: '/esign', icon: 'file-text' },
  ] },
  { title: '정산관리', items: [
    { key: '청구', label: '청구 (공급사)', href: '/settlement?tab=claim', icon: 'building' },
    { key: '지급', label: '지급 (영업자)', href: '/settlement?tab=pay', icon: 'wallet' },
  ] },
];

/** 지금 자리 — 경로 + (정산만) tab= 로 가른다. MobileTabBar 와 같은 판정. */
function useCurrent(): string {
  const path = usePathname() || '/';
  const sp = useSearchParams();
  if (path.startsWith('/settlement')) return sp.get('tab') === 'pay' ? '지급' : '청구';
  if (path.startsWith('/products')) return '상품';
  if (path.startsWith('/intake')) return '접수';
  if (path.startsWith('/esign')) return '계약';
  if (path.startsWith('/system')) return '시스템';
  return '';
}

export function SideMenu() {
  const now = useCurrent();
  return (
    <>
      {GROUPS.map((g) => (
        <div key={g.title} className="erp-nav-block">
          <div className="erp-nav-group">{g.title}</div>
          {g.items.map((it) => (
            <Link key={it.key} href={it.href} className="erp-nav-item" aria-current={now === it.key ? 'page' : undefined}>
              <Icon name={it.icon} size={18} />
              <span>{it.label}</span>
            </Link>
          ))}
        </div>
      ))}
      <div className="erp-nav-block">
        <div className="erp-nav-group">시스템</div>
        <Link href="/system/data-status" className="erp-nav-item" aria-current={now === '시스템' ? 'page' : undefined}>
          <Icon name="gauge" size={18} />
          <span>데이터 상태</span>
        </Link>
      </div>
    </>
  );
}

/** 상태바의 테마 고르기 — 링크 하나로 바꾼다(스크립트 없이도 된다). 되돌아올 자리는 지금 주소. */
export function ThemeSwitch({ current, labels }: { current: string; labels: Record<string, string> }) {
  const path = usePathname() || '/';
  const sp = useSearchParams();
  const back = `${path}${sp.toString() ? `?${sp}` : ''}`;
  return (
    <span className="erp-theme-switch" role="group" aria-label="화면 테마">
      <span className="erp-theme-label">테마</span>
      {Object.entries(labels).map(([id, label]) => (
        <a key={id} href={`/theme?set=${id}&back=${encodeURIComponent(back)}`} aria-pressed={current === id}>{label}</a>
      ))}
    </span>
  );
}
