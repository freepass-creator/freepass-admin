import { ProductWorkspace } from '../products/workspace';
import { IntakeScreen } from '../_erp/IntakeScreen';
import { WorkspaceScreen } from '../_erp/Workspace';

export const dynamic = 'force-dynamic';

/**
 * 계약접수 — **메인**. 대표 2026-09-18 「이게 우리 메인인데 이거는 접수 화면이고」 · 「계약접수 → 메인」
 * 판 셋: 상품 목록 | 상품 상세 · 접수 상세 · 입력(신규접수 폼) 이 등히는 가운데 판 | 접수 목록.
 * 차를 찾고 → 확인하고 → 기간 골라 접수하거나, 접수 목록에서 줄을 눌러 상세를 본다 — 어느 쪽이든
 * 이 3패널 화면을 벗어나지 않고 가운데 판만 바뀐다(대표 2026-09-24 「그 패널이 어딘가엔 두 개, 어딘가에는
 * 세개 이렇게 들어갈 수 있는 거야」 — 접수 상세(?ic=) · 신규 접수 폼(?w=new)도 WorkspaceScreen 이 맡는다).
 * 실적 보기(?iv=) · 전체 목록 검색/거름(?iq= 등, 페이지네이션 있는 넓은 목록)만 따로 IntakeScreen 의
 * 단독 목록 화면으로 간다 — 그건 «고르러 온다»가 아니라 «전부 훑어본다»가 목적이라 다른 화면이다.
 * ⓘ 접수 줄 전부(보기·거름)는 /intake/list 에 있다.
 */
const INTAKE_SCREEN_PARAMS = ['iv', 'iq', 'isup', 'ich', 'page'] as const;

export default async function IntakeMain({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const onIntakeScreen = INTAKE_SCREEN_PARAMS.some((k) => q[k] !== undefined);
  /* PC = ERP 표준 화면(DEC-2026-09-23-01), 폰 = 기존 판 — CSS(_erp/shell.css)가 폭으로 가른다 */
  return <>{onIntakeScreen ? <IntakeScreen q={q} /> : <WorkspaceScreen q={q} />}<ProductWorkspace q={q} mode="intake" base="/intake" /></>;
}
