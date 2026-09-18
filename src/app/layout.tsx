import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import './_fn/fn.css';
import { writeEnabled } from '../adapters/erp5/settlement-repository';
import { Brand, TopMenu } from './_design/Brand';

export const metadata = {
  title: 'freepass-admin',
  description: 'FreePass internal admin ERP',
};

/** 메뉴 넷 — 대표 2026-09-18 「상품찾기 계약접수 정산관리 전자계약 이 4가지」 */
const MENU = [
  ['/products', '상품찾기'],
  ['/intake', '계약접수'],
  ['/settlement', '정산관리'],
  ['/esign', '전자계약'],
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <nav className="fn-top">
          <Brand />
          <TopMenu items={MENU} />
          <span className="fn-state">ERP5 freepasserp5 · 쓰기 {writeEnabled() ? '켜짐' : '꺼짐'}</span>
        </nav>
        <main className="fn-main">{children}</main>
      </body>
    </html>
  );
}
