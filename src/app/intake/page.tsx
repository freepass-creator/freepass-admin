import { ProductWorkspace } from '../products/workspace';
import { IntakeScreen } from '../_erp/IntakeScreen';
import { WorkspaceScreen } from '../_erp/Workspace';

export const dynamic = 'force-dynamic';

/**
 * 계약접수 — **메인**. 대표 2026-09-18 「이게 우리 메인인데 이거는 접수 화면이고」 · 「계약접수 → 메인」
 * 판 셋: 상품 목록 | 상품 상세 | 접수 목록. 차를 찾고 → 확인하고 → 기간 골라 접수 → 오른쪽에서 이어 간다.
 *   (대표 2026-09-24 「새로 만들지 말고 공통 규격을 활용해서 프리패스 어드민 구성해보자」 — ai-core
 *   side-by-side 레퍼런스의 판 셋을 WorkspaceScreen 으로 그대로 옮겨 이 주석이 말하는 기본 화면을 채웠다.)
 * 접수 상세(?ic=) · 실적 보기(?iv=) · 검색/거름(?iq= 등) · 신규 접수 폼(?w=new)은 전부 그대로 IntakeScreen
 * 이 맡는다 — WorkspaceScreen 은 그 중 아무 파라미터도 없을 때(또는 WorkspaceScreen 자신의 pq·id·offer만
 * 있을 때)만 서는 기본 landing 이다. ⓘ 접수 줄 전부(보기·거름)는 /intake/list 에 있다.
 */
const INTAKE_SCREEN_PARAMS = ['ic', 'w', 'iv', 'iq', 'isup', 'ich', 'page'] as const;

export default async function IntakeMain({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const onIntakeScreen = INTAKE_SCREEN_PARAMS.some((k) => q[k] !== undefined);
  /* PC = ERP 표준 화면(DEC-2026-09-23-01), 폰 = 기존 판 — CSS(_erp/shell.css)가 폭으로 가른다 */
  return <>{onIntakeScreen ? <IntakeScreen q={q} /> : <WorkspaceScreen q={q} />}<ProductWorkspace q={q} mode="intake" base="/intake" /></>;
}
