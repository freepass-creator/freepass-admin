import type { ReactNode } from 'react';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { TopMenu } from './Brand';
import { MobileTabBar } from './MobileTabBar';
import { currentAdmin } from '../../server/require-admin';

/** 관리자 업무 5축 — PC와 모바일에서 같은 순서와 같은 기능을 쓴다. */
const MENU = [
  ['/products', '상품찾기'],
  ['/intake', '계약접수'],
  ['/esign', '전자계약'],
  ['/intake?scope=performance&iv=all&v=work', '실적관리'],
  ['/settlement', '정산관리'],
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
        <span className="dz-admin-brand">FreePass <b>Admin</b></span>
        <TopMenu items={MENU} />
        {/* 설정 확인은 실제 읽기 성공과 다르다. 상세 진단과 로그아웃은 상태 화면에서 제공한다. */}
        <a className="fn-state" href="/system/data-status" aria-label="데이터 상태 상세 및 계정">
          {data.ok ? '데이터 설정됨' : '데이터 설정 필요'} · {writeEnabled() ? '쓰기 허용' : '조회 전용'}
        </a>
        {나 && <span className="dz-me">{나.name}</span>}
      </header>
      <main className="fn-main">{children}</main>
      {/*
        ★폰 하단 — 다섯 기능(상품 · 접수 · 계약 · 실적 · 정산). 모바일 위 띠에는 이동 버튼을 두지 않는다
        (대표 2026-09-18 「상단에는 버튼을 안 하는 게 나을 것 같아 그냥 하단에서 탁탁탁 눌러야지」).
        depth 1·2 화면에서는 이 바 대신 그 판의 하단바(§14-3)가 선다 — CSS 가 갈라 보인다(globals.css).
      */}
      <MobileTabBar />
    </>
  );
}
