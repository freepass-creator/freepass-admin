import type { ReactNode } from 'react';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { Brand, TopMenu } from './Brand';
import { logoutAction } from '../login/actions';

/** 메뉴 넷 — 대표 2026-09-18 「상품찾기 계약접수 정산관리 전자계약 이 4가지」 */
const MENU = [
  ['/products', '상품찾기'],
  ['/intake', '계약접수'],
  ['/settlement', '정산관리'],
  ['/esign', '전자계약'],
] as const;

/**
 * ★관리자 틀 — CI 위 띠(메뉴 넷 · 쓰기 상태) + 본문 판.
 *   루트 layout 이 아니라 «관리자 쪽마다»(products · intake · settlement · esign · design 의 layout) 이 틀을 쓴다.
 *   까닭: 청구 링크(/c/[token])는 공급사가 여는 문이다 — 우리 직원이 아니다. 관리자 띠 · 메뉴 · 「ERP5 쓰기」 상태가
 *   화면에도, 쪽 원본(RSC)에도 실리면 안 된다(기능 세션 2026-09-18 「루트 layout 밖으로」).
 *   ⓘ 관리자 쪽들을 라우트 그룹으로 옮기면 상대 경로 import 가 다 깨져 기능 세션 파일을 흔든다 — 그래서 쪽마다 layout 한 줄.
 */
export function AdminChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="fn-top">
        <Brand />
        <TopMenu items={MENU} />
        <span className="fn-state">ERP5 freepasserp5 · 쓰기 {writeEnabled() ? '켜짐' : '꺼짐'}</span>
        {/* 로그아웃 — 기능 쪽 logoutAction(쿠키 지우고 /login 으로) */}
        <form action={logoutAction} className="dz-logout"><button type="submit">로그아웃</button></form>
      </nav>
      <main className="fn-main">{children}</main>
    </>
  );
}
