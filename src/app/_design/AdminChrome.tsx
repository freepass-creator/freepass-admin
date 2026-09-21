import type { ReactNode } from 'react';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { Brand, TopMenu } from './Brand';
import { MobileTabBar } from './MobileTabBar';
import { logoutAction } from '../login/actions';
import { currentAdmin } from '../../server/require-admin';

/** 메뉴 넷(웹 위 띠 글자 메뉴) — 대표 2026-09-18 「상품찾기 계약접수 정산관리 전자계약 이 4가지」.
 *   ★폰은 이 메뉴를 안 쓴다 — 다섯 걸음 하단바(`MobileTabBar`)가 대신한다(§14-8 개정, 아래 문서). */
const MENU = [
  ['/products', '상품찾기'],
  ['/intake', '계약접수'],
  ['/settlement', '정산관리'],
  ['/esign', '전자계약'],
] as const;

/**
 * ★관리자 틀 — CI 위 띠(메뉴 넷 · 쓰기 상태) + 본문 판 + 폰 하단 다섯 걸음.
 *   루트 layout 이 아니라 «관리자 쪽마다»(products · intake · settlement · esign · design 의 layout) 이 틀을 쓴다.
 *   까닭: 청구 링크(/c/[token])는 공급사가 여는 문이다 — 우리 직원이 아니다. 관리자 띠 · 메뉴 · 「ERP5 쓰기」 상태가
 *   화면에도, 쪽 원본(RSC)에도 실리면 안 된다(기능 세션 2026-09-18 「루트 layout 밖으로」).
 *   ⓘ 관리자 쪽들을 라우트 그룹으로 옮기면 상대 경로 import 가 다 깨져 기능 세션 파일을 흔든다 — 그래서 쪽마다 layout 한 줄.
 */
export async function AdminChrome({ children }: { children: ReactNode }) {
  /* 로그인한 사람 — 기능 쪽 currentAdmin(로그인이 꺼진 로컬 개발에서는 null · 이름 칸을 비운다) */
  const 나 = await currentAdmin();
  const data = erp5Ready();
  return (
    <>
      <nav className="fn-top">
        <Brand />
        <TopMenu items={MENU} />
        <a className="fn-state" href="/system/data-status">ERP5 freepasserp5 · 읽기 {data.ok ? '연결' : '오류'} · 쓰기 {writeEnabled() ? '켜짐' : '꺼짐'}</a>
        {/* 로그아웃 — 기능 쪽 logoutAction(쿠키 지우고 /login 으로). 폰에서도 작게 그대로 선다(이동 버튼이 아니라 계정 동작) */}
        {나 && <span className="dz-me">{나.name}</span>}
        <form action={logoutAction} className="dz-logout"><button type="submit">로그아웃</button></form>
      </nav>
      <main className="fn-main">{children}</main>
      {/*
        ★폰 하단 — 다섯 걸음(상품 · 접수 · 계약 · 청구 · 지급). 위 띠에는 이동 버튼을 두지 않는다
        (대표 2026-09-18 「상단에는 버튼을 안 하는 게 나을 것 같아 그냥 하단에서 탁탁탁 눌러야지」).
        depth 1·2 화면에서는 이 바 대신 그 판의 하단바(§14-3)가 선다 — CSS 가 갈라 보인다(globals.css).
      */}
      <MobileTabBar />
    </>
  );
}
