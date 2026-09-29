import type { ReactNode } from 'react';
import { demoMode, erp5Ready } from '../../server/freepass-data';
import { Brand } from './Brand';
import { MobileTabBar } from './MobileTabBar';
import { SideMenu } from './SideMenu';
import { Icon } from './Icon';
import { redirect } from 'next/navigation';
import { authEnforced } from '../../server/auth';
import { currentAdmin } from '../../server/require-admin';



/**
 * 관리자 틀 — AI Core «ERP 표준 UI 규격 v1» 골격 (대표 2026-09-23 「이 컨셉으로 프리패스 어드민에 적용」).
 *   PC: ① 상단 정보줄(워드마크 · 데이터 상태 · 사람) ② 왼쪽 업무 메뉴 ③ 본문 판 ④ 하단 상태줄(연결 · 테마).
 *   ★상단에는 실행 버튼을 두지 않는다 — 정보만(대표 2026-09-18). 업무 이동은 왼쪽 메뉴, 판 안의 실행은 판의 하단바.
 *   ★모바일은 전역 상단바를 두지 않는다 — 현재 Panel이 화면 최상단에서 시작하고, depth 0에는 하단 전역탭,
 *   depth 1+에는 해당 Panel의 ActionBar만 선다. PC shell과 같은 업무 부품을 쓰되 shell 배치만 다르다.
 *   ⓘ 2026-09-21 「PC 도 하단 업무 버튼」을 이 결정이 대신한다 — docs/DECISIONS.md D-UI-2026-09-23.
 *
 *   루트 layout 이 아니라 «관리자 쪽마다»(products · intake · settlement · esign · system 의 layout) 이 틀을 쓴다.
 *   까닭: 청구 링크(/c/[token])는 공급사가 여는 문이다 — 관리자 띠 · 메뉴 · 「ERP5 쓰기」 상태가
 *   화면에도, 쪽 원본(RSC)에도 실리면 안 된다(기능 세션 2026-09-18 「루트 layout 밖으로」).
 *   Admin 표지(.erp-theme-flag)는 관리자 화면 범위와 PC 격자만 표시한다. 청구 링크(/c/…)에는 표지가 없어 관리자 shell이 실리지 않는다.
 */
export async function AdminChrome({ children }: { children: ReactNode }) {
  /* 로그인한 사람 — 기능 쪽 currentAdmin(로그인이 꺼진 로컬 개발에서는 null · 이름 칸을 비운다) */
  const 나 = await currentAdmin();
  /* ★★여기가 쪽의 문이다. proxy 는 쿠키 «꼴»만 보므로(firebase-admin 을 모든 요청 앞에 실지 않으려고)
     꼴만 맞는 가짜 쿠키는 proxy 를 지나간다. 그걸 여기서 막는다 — 안 막으면 운영에서
     꼴만 맞춘 쿠키가 실데이터를 읽는다. 관리자 쪽은 전부 이 틀을 거친다. */
  if (authEnforced() && !나) redirect('/login');
  const data = erp5Ready();
  return (
    <>
      <a className="erp-skip-link" href="#admin-main">본문 바로가기</a>
      {/* 단일 UI 표지 — body 격자와 Admin 전용 범위를 세우는 구조 marker. */}
      <i className="erp-theme-flag" hidden />

      {/* ── PC ① 상단바 — 규격 erp-topbar 그대로(브랜드 · 워크스페이스 · 통합검색 · 상태 · 사람) ── */}
      <header className="erp-topbar erp-std" data-region="topbar">
        <div className="erp-brand"><Brand tail="admin" /></div>
        {/* 상품찾기(ProductsScreen)의 검색 칸 이름과 같아야 실제로 걸린다 — pq(대표 2026-09-24
            「검색창도 검색창 옆에 필터」 작업 때 계약접수와 같은 이름(pq)으로 맞추면서, 여기 통합
            검색이 q 로 남아 있어 조용히 죽어 있었다). */}
        <form className="erp-gsearch" action="/products" role="search">
          <Icon name="search" size={16} />
          <input name="q" placeholder="차번 · 모델 · 공급사 · 고객 검색" aria-label="통합 검색" />
          <kbd>Enter</kbd>
        </form>
        <div className="erp-topbar-right">
          {demoMode() && <span className="erp-demo-flag" title="FPA_DEMO=on — 화면 확인용 가상 데이터. 저장되지 않습니다.">가상 데이터</span>}
          <a className="erp-iconbtn" href="/system/data-status" aria-label={data.ok ? '데이터 설정됨' : '데이터 설정 필요'} {...(data.ok ? {} : { 'data-alert': true })}>
            <Icon name="gauge" size={18} />
          </a>
          <div className="erp-user"><span className="erp-avatar">{(나?.name ?? '관').slice(0, 1)}</span><div>{나?.name ?? '관리자'}<small>관리자 · 본사</small></div></div>
        </div>
      </header>

      {/* ── PC ② 좌측 메뉴 ── */}
      <nav className="erp-sidenav erp-std" data-region="sidenav" aria-label="업무 이동">
        <SideMenu />
      </nav>

      {/* ── 본문: viewport에 따라 같은 actual route의 responsive composition을 배치한다. (대표 2026-09-24 「좌측 사이드
          메뉴하고 상단 헤더하고 겹치잖아」) — ③ 작업 탭(규격 §1, 여러 화면을 MDI 탭으로 동시에 여는 자리)
          자리에 실제로는 ② 왼쪽 메뉴와 똑같은 다섯 항목을 그대로 다시 그리는 WorkTabs 가 있었다 — 진짜
          MDI(열어 둔 화면 탭)가 아니라 그냥 같은 이동 메뉴를 위아래로 두 번 보여주는 중복이었다. 이동은
          왼쪽 메뉴 하나로 정하고(AdminChrome 자신의 머리 주석 「② 왼쪽 업무 메뉴」, DEC-2026-09-23-01
          「상단은 정보만」과 일관되게) 이 줄을 없앴다. */}
      {/* 계약접수(/intake)가 내부 Admin 전체의 UI/UX 시각 정본이다.
          다른 업무는 데이터와 패널 수만 달라질 수 있고, 조작 문법을 따로 만들지 않는다. */}
      <main id="admin-main" className="fn-main" data-ui-authority="intake" tabIndex={-1}>
        {children}
      </main>

      {/*
        폰 depth 0 전역탭 — PC와 같은 업무축(상품 · 접수 · 실적 · 정산).
        전자계약은 마지막 독립 업무 문으로 붙인다.
        청구/지급은 정산 안의 축이며 전역탭으로 분리하지 않는다.
        depth 1·2 화면에서는 이 바 대신 현재 Panel의 ActionBar가 선다.
      */}
      <MobileTabBar />
    </>
  );
}
