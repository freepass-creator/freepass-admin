'use client';
/**
 * ★PC 왼쪽 업무 메뉴 · 작업 탭 — AI Core «ERP 표준 UI 규격 v1» 골격 ② ③ 그대로(erp-sidenav · erp-tabs 부품)
 *   차례: 대표 2026-09-23 「순서는 상품, 접수, 실적, 정산, 계약이야. 사실 전자계약은 약간 별도로 취급을 해줘야 돼」
 *   실적은 접수와 다른 자기 판 셋을 쓴다(대표 2026-09-24 「분납실적은 … 맨 왼쪽에 … 완납실적은 …
 *   맨 오른쪽에 … 가운데에는 … 실적 상세」) — `wiv=실적` 로 들어가면 `Workspace.tsx` 가 계약접수 배열
 *   대신 분납실적|실적상세|완납실적 배열(`PerformanceWorkspace`)을 그린다.
 *   정산은 한 판에서 청구 · 지급을 가른다. 전자계약은 업무 흐름 밖의 따로 된 문으로 떼어 둔다.
 * */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from './Icon';

type Item = { key: string; label: string; href: string; icon: string };
const FLOW: Item[] = [
  { key: '상품', label: '상품찾기', href: '/products', icon: 'search' },
  { key: '접수', label: '계약접수', href: '/intake', icon: 'clipboard' },
  { key: '실적', label: '실적', href: '/intake?iv=완납실적&wiv=실적', icon: 'circle-check' },
  { key: '정산', label: '정산관리', href: '/settlement', icon: 'wallet' },
];
const ESIGN: Item = { key: '계약', label: '전자계약', href: '/esign', icon: 'file-text' };
const SYSTEM: Item = { key: '시스템', label: '데이터 상태', href: '/system/data-status', icon: 'gauge' };
export const 실적칸 = ['분납실적', '완납실적'];

/** 지금 자리 — 경로 + (접수만) 실적 칸이면 «실적». */
function useCurrent(): string {
  const path = usePathname() || '/';
  const sp = useSearchParams();
  if (path.startsWith('/settlement')) return '정산';
  if (path.startsWith('/products')) return '상품';
  if (path.startsWith('/intake')) return 실적칸.includes(sp.get('iv') ?? '') || sp.get('wiv') === '실적' ? '실적' : '접수';
  if (path.startsWith('/esign')) return '계약';
  if (path.startsWith('/system')) return '시스템';
  return '';
}

function MenuLink({ it, now }: { it: Item; now: string }) {
  return (
    <Link href={it.href} className="erp-nav-item" aria-current={now === it.key ? 'page' : undefined}>
      <Icon name={it.icon} size={18} />
      {it.label}
    </Link>
  );
}

export function SideMenu() {
  const now = useCurrent();
  return (
    <>
      <div className="erp-nav-group">업무</div>
      {FLOW.map((it) => <MenuLink key={it.key} it={it} now={now} />)}
      {/* 전자계약 · 시스템 — 둘 다 «업무 흐름 밖의 따로 된 문»이라 같은 구분선 처리를 받는다(대표 2026-09-24
          UI/UX 재검토 — 전에는 계약서 그룹만 --apart 라 시스템 그룹 앞엔 구분선이 없어서 둘의 성격이
          같은데 처리가 달랐다). */}
      <div className="erp-nav-group erp-nav-group--apart">계약서</div>
      <MenuLink it={ESIGN} now={now} />
      <div className="erp-nav-group erp-nav-group--apart">시스템</div>
      <MenuLink it={SYSTEM} now={now} />
    </>
  );
}

