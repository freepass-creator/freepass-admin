import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { demoMode } from '../../adapters/erp5/demo';
import { Brand } from './Brand';
import { MobileTabBar } from './MobileTabBar';
import { SideMenu, ThemeSwitch } from './SideMenu';
import { Icon } from './Icon';
import { THEME_COOKIE, THEME_LABEL, themeOf } from './theme';
import { currentAdmin } from '../../server/require-admin';

/** 규격 기본 글꼴 — Pretendard Variable (OFL). 규격 erp.css 의 --erp-font-family 첫 글꼴. */
const PRETENDARD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css';

/** 레트로 테마만 쓰는 글꼴 — 픽셀 제목(Galmuri11) · 고정폭 숫자(IBM Plex Mono). 둘 다 OFL. */
const RETRO_FONTS = [
  'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.3.0/400.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.3.0/600.css',
];

/**
 * 관리자 틀 — AI Core «ERP 표준 UI 규격 v1» 골격 (대표 2026-09-23 「이 컨셉으로 프리패스 어드민에 적용」).
 *   PC: ① 상단 정보줄(워드마크 · 데이터 상태 · 사람) ② 왼쪽 업무 메뉴 ③ 본문 판 ④ 하단 상태줄(연결 · 테마).
 *   ★상단에는 실행 버튼을 두지 않는다 — 정보만(대표 2026-09-18). 업무 이동은 왼쪽 메뉴, 판 안의 실행은 판의 하단바.
 *   ★폰은 그대로 — 왼쪽 메뉴·상태줄을 숨기고 다섯 걸음 하단바(`MobileTabBar`)가 선다.
 *   ⓘ 2026-09-21 「PC 도 하단 업무 버튼」을 이 결정이 대신한다 — docs/DECISIONS.md D-UI-2026-09-23.
 *
 *   루트 layout 이 아니라 «관리자 쪽마다»(products · intake · settlement · esign · system 의 layout) 이 틀을 쓴다.
 *   까닭: 청구 링크(/c/[token])는 공급사가 여는 문이다 — 관리자 띠 · 메뉴 · 「ERP5 쓰기」 상태가
 *   화면에도, 쪽 원본(RSC)에도 실리면 안 된다(기능 세션 2026-09-18 「루트 layout 밖으로」).
 *   테마 표지(.erp-theme-flag)도 그래서 이 틀에만 있다 — 청구 링크 화면은 테마를 타지 않는다.
 */
export async function AdminChrome({ children }: { children: ReactNode }) {
  /* 로그인한 사람 — 기능 쪽 currentAdmin(로그인이 꺼진 로컬 개발에서는 null · 이름 칸을 비운다) */
  const 나 = await currentAdmin();
  const data = erp5Ready();
  const theme = themeOf((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <link rel="stylesheet" href={PRETENDARD} precedence="default" />
      {theme === 'retro' && RETRO_FONTS.map((href) => <link key={href} rel="stylesheet" href={href} precedence="default" />)}
      {/* 테마 표지 — 틀은 body 바로 아래 형제들로 선다(폰 규칙이 `body > main` 을 본다). 감싸지 않고 표지 하나로
          테마와 PC 격자를 건다: `body:has(> .erp-theme-flag…)` (_erp/shell.css · _erp/erp-standard.css). */}
      <i className="erp-theme-flag" data-theme={theme} hidden />

      {/* ── 폰 머리(그대로) ── */}
      <header className="fn-top dz-statusbar" aria-label="관리자 상태">
        <a className="fn-state" href="/system/data-status" aria-label="데이터 상태 상세 및 계정">
          {data.ok ? '데이터 설정됨' : '데이터 설정 필요'} · {writeEnabled() ? '쓰기 허용' : '조회 전용'}
        </a>
        {나 && <span className="dz-me">{나.name}</span>}
      </header>

      {/* ── PC ① 상단바 — 규격 erp-topbar 그대로(브랜드 · 워크스페이스 · 통합검색 · 상태 · 사람) ── */}
      <header className="erp-topbar erp-std" data-region="topbar">
        <div className="erp-brand"><Brand /></div>
        {/* 정보만 — 회사 전환 기능이 없는데 링크로 두면 오른쪽 게이지 단추와 똑같은 자리(/system/data-status)로
            두 번 가는 중복 이동이 된다(대표 2026-09-24 「상단바랑 사이드바만 … 규격 제대로 검토해봐」).
            "지금 어느 회사 · 어느 모드인가"를 보여주는 정보 칩으로만 둔다. */}
        <span className="erp-company">
          <Icon name="building" size={16} />프리패스 본사 · {writeEnabled() ? '쓰기 허용' : '조회 전용'}
        </span>
        {/* 상품찾기(ProductsScreen)의 검색 칸 이름과 같아야 실제로 걸린다 — pq(대표 2026-09-24
            「검색창도 검색창 옆에 필터」 작업 때 계약접수와 같은 이름(pq)으로 맞추면서, 여기 통합
            검색이 q 로 남아 있어 조용히 죽어 있었다). */}
        <form className="erp-gsearch" action="/products" role="search">
          <Icon name="search" size={16} />
          <input name="pq" placeholder="차번 · 모델 · 공급사 · 고객 검색" aria-label="통합 검색" />
          <kbd>Enter</kbd>
        </form>
        {demoMode() && <span className="erp-demo-flag" title="FPA_DEMO=on — 화면 확인용 가상 데이터. 저장되지 않습니다.">가상 데이터</span>}
        <div className="erp-topbar-right">
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

      {/* ── 본문: PC 는 규격 화면(.erp-screen), 폰은 기존 판(그대로) ── (대표 2026-09-24 「좌측 사이드
          메뉴하고 상단 헤더하고 겹치잖아」) — ③ 작업 탭(규격 §1, 여러 화면을 MDI 탭으로 동시에 여는 자리)
          자리에 실제로는 ② 왼쪽 메뉴와 똑같은 다섯 항목을 그대로 다시 그리는 WorkTabs 가 있었다 — 진짜
          MDI(열어 둔 화면 탭)가 아니라 그냥 같은 이동 메뉴를 위아래로 두 번 보여주는 중복이었다. 이동은
          왼쪽 메뉴 하나로 정하고(AdminChrome 자신의 머리 주석 「② 왼쪽 업무 메뉴」, DEC-2026-09-23-01
          「상단은 정보만」과 일관되게) 이 줄을 없앴다. */}
      <main className="fn-main">
        {children}
      </main>

      {/* ── PC ⑧ 상태바 ── */}
      <footer className="erp-statusbar erp-std" data-region="statusbar">
        <span className={data.ok ? 'erp-statusbar-ok' : ''}>● ERP5 {data.ok ? '데이터 설정됨' : '데이터 설정 필요'}</span>
        <span>{writeEnabled() ? '쓰기 허용' : '조회 전용'}</span>
        {demoMode() && <span>가상 데이터 · 화면 확인용</span>}
        <span className="erp-statusbar-keys"><ThemeSwitch current={theme} labels={THEME_LABEL} /></span>
      </footer>

      {/*
        ★폰 하단 — 다섯 걸음(상품 · 접수 · 계약 · 청구 · 지급). 위 띠에는 이동 버튼을 두지 않는다
        (대표 2026-09-18 「상단에는 버튼을 안 하는 게 나을 것 같아 그냥 하단에서 탁탁탁 눌러야지」).
        depth 1·2 화면에서는 이 바 대신 그 판의 하단바(§14-3)가 선다 — CSS 가 갈라 보인다(globals.css).
      */}
      <MobileTabBar />
    </>
  );
}
