import type { ReactNode } from 'react';

export function PanelHeader({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return <div className="panel-head"><h1>{title}</h1>{action ?? (meta === undefined ? null : <span>{meta}</span>)}</div>;
}
