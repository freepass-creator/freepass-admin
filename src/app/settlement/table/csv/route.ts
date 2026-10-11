import { requireAdmin } from '../../../../server/require-admin';
import { readSettlementTable } from '../../../../server/freepass-data';
import { settlementSummaryCsv } from '../../../../domain/settlement/summary';

export const dynamic = 'force-dynamic';

/** 기준 시각·전월 가감을 포함한 관리자 집계 다운로드. 화면과 같은 직렬화를 사용한다. */
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const denied = await requireAdmin();
  if (denied) return new Response(denied, { status: 401, headers });
  try {
    const summary = await readSettlementTable(new URL(request.url).searchParams.get('month') ?? '');
    const month = /^\d{4}-\d{2}$/.test(summary.month) ? summary.month : 'unassigned';
    return new Response(settlementSummaryCsv(summary), { headers: {
      ...headers, 'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="settlement-${month}.csv"`,
    } });
  } catch {
    return new Response('접수 원장을 읽지 못했습니다. 다시 조회해 주세요.', { status: 503, headers });
  }
}
