import type { ReactNode } from 'react';
import { AdminChrome } from '../_design/AdminChrome';

/** 관리자 쪽 — CI 위 띠 · 메뉴 넷(루트 layout 에서 옮겨 왔다 · 청구 링크 /c 에는 안 실린다) */
export default function Layout({ children }: { children: ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
