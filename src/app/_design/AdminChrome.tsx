import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { Brand } from './Brand';
import { MobileTabBar } from './MobileTabBar';
import { SideMenu, ThemeSwitch } from './SideMenu';
import { THEME_COOKIE, THEME_LABEL, themeOf } from './theme';
import { currentAdmin } from '../../server/require-admin';

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
      {theme === 'retro' && RETRO_FONTS.map((href) => <link key={href} rel="stylesheet" href={href} precedence="default" />)}
      {/* 테마 표지 — 틀은 body 바로 아래 형제들로 선다(폰 규칙이 `body > main` 을 본다). 그래서 감싸지 않고
          표지 하나로 테마를 건다: `body:has(> .erp-theme-flag[data-theme=…])` (erp-theme.css). */}
      <i className="erp-theme-flag" data-theme={theme} hidden />
      <header className="fn-top dz-statusbar erp-top" aria-label="관리자 상태">
        <Brand />
        {/* 설정 확인은 실제 읽기 성공과 다르다. 상세 진단과 로그아웃은 상태 화면에서 제공한다. */}
        <a className="fn-state" href="/system/data-status" aria-label="데이터 상태 상세 및 계정">
          {data.ok ? '데이터 설정됨' : '데이터 설정 필요'} · {writeEnabled() ? '쓰기 허용' : '조회 전용'}
        </a>
        {나 && <span className="dz-me">{나.name}</span>}
      </header>
      <nav className="erp-side" aria-label="업무 이동">
        <SideMenu />
      </nav>
      <main className="fn-main">{children}</main>
      <footer className="erp-status" aria-label="상태줄">
        <span className="erp-status-ok" data-ok={data.ok ? 'true' : 'false'}>● ERP5 {data.ok ? '설정됨' : '설정 필요'}</span>
        <span>{writeEnabled() ? '쓰기 허용' : '조회 전용'}</span>
        <ThemeSwitch current={theme} labels={THEME_LABEL} />
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
