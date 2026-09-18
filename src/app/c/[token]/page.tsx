import { ClaimDoor } from './ClaimDoor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '프리패스 청구 확인', robots: { index: false, follow: false } };

/**
 * ★청구 링크 — 공급사(상대)가 여는 문 (대표 2026-09-18 「공급사한테 청구서 PDF 말고 이제 그냥 청구 링크를 보내자 · 사업자등록번호 넣으면 보이게끔」)
 *   관리자 틀(위 띠 · 메뉴)은 없다 — 이 사람은 우리 직원이 아니다(루트 layout 은 쪽 틀만, 관리자 틀은 관리자 쪽 layout 에만).
 *   토큰 + 사업자등록번호가 전부 · 세션 없음 — 부를 때마다 서버가 다시 본다(기능 c/actions.ts).
 */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClaimDoor token={token} />;
}
