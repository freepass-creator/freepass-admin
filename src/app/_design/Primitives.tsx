import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * ★공통 시각 primitive — 배치·기능을 새로 만들지 않는다.
 * 실제 화면에 이미 반복되던 markup을 한 곳으로 올린 것뿐이다.
 * 정본: docs/ui/ADMIN-UI-UX-SSOT.md
 */

export function PanelHeader({ title, count, backHref, backLabel = '목록으로' }: {
  title: ReactNode;
  count?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="panel-head">
      {backHref ? <Link className="dz-phone-back" href={backHref} aria-label={backLabel}>‹</Link> : null}
      <div><h1>{title}</h1></div>
      {count !== undefined && count !== null ? <span className="count">{count}</span> : null}
    </div>
  );
}

export function SearchField({ name, defaultValue, placeholder }: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <>
      <span className="dz-search-ico" aria-hidden><Icon name="search" size={18} stroke={2.2} /></span>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder ?? name} />
    </>
  );
}

export function ActionBar({ children, balance = 'primary' }: {
  children: ReactNode;
  /** primary: 2개 3:7 / 3개 3:3:4. equal: 동급 2개 5:5 */
  balance?: 'primary' | 'equal';
}) {
  return <div className="dz-bar"><div className="dz-bar-go" data-action-balance={balance}>{children}</div></div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="dz-empty">{children}</p>;
}

export function SummaryGrid({ children }: { children: ReactNode }) {
  return <dl className="summary-grid">{children}</dl>;
}

export function SummaryItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}


export function Notice({ tone, children }: { tone: 'warn' | 'ok'; children: ReactNode }) {
  return <p className={tone === 'warn' ? 'dz-warn' : 'dz-ok'}>{children}</p>;
}
