import { ProductWorkspace } from '../products/workspace';
import { IntakeScreen } from '../_erp/IntakeScreen';

export const dynamic = 'force-dynamic';

/**
 * 계약접수 — **메인**. 대표 2026-09-18 「이게 우리 메인인데 이거는 접수 화면이고」 · 「계약접수 → 메인」
 * 판 셋: 상품 목록 | 상품 상세 | 접수 목록. 차를 찾고 → 확인하고 → 기간 골라 접수 → 오른쪽에서 이어 간다.
 * ⓘ 접수 줄 전부(보기·거름)는 /intake/list 에 있다 — 오른쪽 판의 「전부 보기」가 그리로 간다.
 */
export default async function IntakeMain({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  /* PC = ERP 표준 화면(DEC-2026-09-23-01), 폰 = 기존 판 — CSS(_erp/shell.css)가 폭으로 가른다 */
  return <><IntakeScreen q={q} /><ProductWorkspace q={q} mode="intake" base="/intake" /></>;
}
