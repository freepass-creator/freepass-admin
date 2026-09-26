import { ProductWorkspace } from '../products/workspace';
import { WorkspaceScreen } from '../_erp/Workspace';

export const dynamic = 'force-dynamic';

/**
 * 계약접수 — **메인**. 대표 2026-09-18 「이게 우리 메인인데 이거는 접수 화면이고」 · 「계약접수 → 메인」
 * 판 셋: 상품 목록 | 상품 상세 · 접수 상세 · 입력(신규접수 폼) 이 등히는 가운데 판 | 접수 목록(전체
 * 훑어보기 포함). 대표 2026-09-24 「상품 찾기 말고는 다 세개 패널로 하면 돼」 — 예전에 따로 있던 전체
 * 목록 단독 화면(IntakeScreen)도 이 3패널을 벗어나지 않고 세 번째 판(wiv/wiq/wisup/wich/wpage) 하나로
 * 합쳤다. 실적(`wiv=실적`)만 예외 — 분납실적|실적상세|완납실적으로 배열이 다른 자기 판 셋을 쓴다
 * (`Workspace.tsx` 의 `PerformanceWorkspace`, 대표 2026-09-24 「실적 페이지는 이렇게 구성이야」).
 * ⓘ 접수 줄 전부(보기·거름)는 /intake/list 에 있다.
 */
export default async function IntakeMain({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  /* 같은 actual route가 viewport에 따라 적응형 composition으로 렌더링된다. */
  return <><WorkspaceScreen q={q} /><ProductWorkspace q={q} mode="intake" base="/intake" /></>;
}
