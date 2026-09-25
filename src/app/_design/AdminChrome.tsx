import type { ReactNode } from 'react';
import { erp5Ready, writeEnabled } from '../../server/erp5';
import { TopMenu } from './Brand';
import { MobileTabBar } from './MobileTabBar';
import { currentAdmin } from '../../server/require-admin';
import { esignEnabled } from '../../server/esign-scope';

/** 기존 업무 4축 — 2026-09-21 결정에 따라 PC에서도 하단 버튼으로 배치.
 *   ★폰은 이 메뉴를 안 쓴다 — 다섯 걸음 하단바(`MobileTabBar`)가 대신한다(§14-8 개정, 아래 문서). */
const MENU = [
  ['/products', '상품찾기'],
  ['/intake', '계약접수'],
  ['/settlement', '정산관리'],
  ['/esign', '전자계약'],
] as const;

/**
 * 관리자 틀 — 상단 상태 + 본문 판 + 하단 업무 버튼. 상단에는 브랜드/실행 버튼을 두지 않는다.
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
      <header className="fn-top dz-statusbar" aria-label="관리자 상태">
        {/* 설정 확인은 실제 읽기 성공과 다르다. 상세 진단과 로그아웃은 상태 화면에서 제공한다. */}
        <a className="fn-state" href="/system/data-status" aria-label="데이터 상태 상세 및 계정">
          {data.ok ? '데이터 설정됨' : '데이터 설정 필요'} · {writeEnabled() ? '쓰기 허용' : '조회 전용'}
        </a>
        {나 && <span className="dz-me">{나.name}</span>}
      </header>
      <main className="fn-main">{children}</main>
      <nav className="dz-desktop-bottom" aria-label="업무 이동">
        {/* 전자계약은 ESIGN_ENABLED=on 일 때만 메뉴에 선다(운영 개시 범위 밖) */}
        <TopMenu items={esignEnabled() ? MENU : MENU.filter(([href]) => href !== '/esign')} />
      </nav>
      {/*
        ★폰 하단 — 다섯 걸음(상품 · 접수 · 계약 · 청구 · 지급). 위 띠에는 이동 버튼을 두지 않는다
        (대표 2026-09-18 「상단에는 버튼을 안 하는 게 나을 것 같아 그냥 하단에서 탁탁탁 눌러야지」).
        depth 1·2 화면에서는 이 바 대신 그 판의 하단바(§14-3)가 선다 — CSS 가 갈라 보인다(globals.css).
      */}
      <MobileTabBar esign={esignEnabled()} />
    </>
  );
}
