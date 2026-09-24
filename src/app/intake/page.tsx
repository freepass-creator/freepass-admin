import { ProductWorkspace } from '../products/workspace';
import { WorkspaceScreen } from '../_erp/Workspace';

export const dynamic = 'force-dynamic';

/**
 * 계약접수 — **메인**. 대표 2026-09-18 「이게 우리 메인인데 이거는 접수 화면이고」 · 「계약접수 → 메인」
 * 판 셋: 상품 목록 | 상품 상세 · 접수 상세 · 입력(신규접수 폼) 이 등히는 가운데 판 | 접수 목록(실적 · 전체
 * 훑어보기 포함). 대표 2026-09-24 「상품 찾기 말고는 다 세개 패널로 하면 돼」 — 예전에 따로 있던 실적/전체
 * 목록 단독 화면(IntakeScreen)도 이 3패널을 벗어나지 않고 세 번째 판(wiv/wiq/wisup/wich/wpage) 하나로
 * 합쳤다. PC 는 언제나 이 3패널 하나뿐이다 — 어느 쿼리로 들어와도 갈라지지 않는다.
 * ⓘ 접수 줄 전부(보기·거름)는 /intake/list 에 있다.
 */
export default async function IntakeMain({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  /* PC = ERP 표준 3패널(DEC-2026-09-23-01), 폰 = 기존 판 — CSS(_erp/shell.css)가 폭으로 가른다 */
  return <><WorkspaceScreen q={q} /><ProductWorkspace q={q} mode="intake" base="/intake" /></>;
}
