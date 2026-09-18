import { contracts } from '../../server/erp5';
import { num, sp, txt, when, won } from '../_fn/fmt';
import { vocab } from '../_fn/fmt';

export const dynamic = 'force-dynamic';

/**
 * 전자계약 — ERP5 `contract` 읽기.
 * ★발행·서명은 아직 erp4 전자계약 화면이 한다. 여기서 발행하는 길은 따로 연다
 *   (구독 템플릿이 `isSample` — 공급사 운영값 미확정. DECISION REQUIRED).
 */
export default async function EsignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const status = sp(q.status);
  const onlyEsign = sp(q.esign) === '1';
  const text = sp(q.q).trim().toLowerCase();

  let all: Awaited<ReturnType<typeof contracts.list>>;
  try { all = await contracts.list(); }
  catch (e) { return <><h1>전자계약</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>; }

  const shown = all
    .filter((c) => !status || c.status === status)
    .filter((c) => !onlyEsign || c.signStatus)
    .filter((c) => !text || [c.code, c.plate, c.vehicle, c.customer, c.agent].join(' ').toLowerCase().includes(text));
  const statuses = vocab(all.map((c) => c.status));
  const signCount = (s: string) => all.filter((c) => c.signStatus === s).length;
  /* ★같은 계약코드가 문서 둘로 선 것 — 옛 판 이관 자국으로 보인다. 조용히 접지 않고 알린다 */
  const byCode = new Map<string, number>();
  for (const c of all) byCode.set(c.code, (byCode.get(c.code) ?? 0) + 1);
  const dup = [...byCode].filter(([, n]) => n > 1);

  return (
    <>
      <h1>전자계약</h1>
      <p className="fn-muted">ERP5 contract {all.length}건 (삭제·시험 계약 뺌) · 전자서명 걸린 것 {all.filter((c) => c.signStatus).length}건
        {' '}— 발행 {signCount('발행')} · 열람 {signCount('열람')} · 진행중 {signCount('진행중')} · 서명완료 {signCount('서명완료')}</p>
      {dup.length > 0 && <p className="fn-err">같은 계약코드가 문서 둘 이상으로 선 것 {dup.length}개 ({dup.reduce((n, [, k]) => n + k, 0)}건) — 합치지 않고 그대로 보입니다. ERP5 에서 정리할 대상입니다.</p>}
      <p className="fn-muted">발행·서명은 아직 erp4 전자계약 화면이 합니다. 여기서는 읽기만 합니다.</p>
      <form className="fn-filter">
        <label>찾기<input name="q" defaultValue={sp(q.q)} placeholder="계약코드 · 차번 · 고객 · 담당" /></label>
        <label>계약상태<select name="status" defaultValue={status}><option value="">전체</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><input type="checkbox" name="esign" value="1" defaultChecked={onlyEsign} /> 전자서명 건만</label>
        <button type="submit">찾기</button>
      </form>
      <p>{shown.length}건</p>
      <div className="fn-wrap">
        <table>
          <thead><tr>
            <th>만든 때</th><th>계약코드</th><th>계약상태</th><th>서명상태</th><th>양식</th><th>보험</th><th>차량번호</th><th>차종</th>
            <th>고객</th><th>영업담당</th><th>기간</th><th>월 대여료</th><th>계약일</th><th>발송</th><th>서명</th><th>문서</th>
          </tr></thead>
          <tbody>{shown.map((c) => (
            <tr key={c.id}>
              <td>{when(c.createdAt)}</td><td>{c.code}</td><td>{txt(c.status)}</td><td>{txt(c.signStatus)}</td>
              <td>{txt(c.kind)}</td><td>{txt(c.insurance)}</td><td>{txt(c.plate)}</td><td>{txt(c.vehicle)}</td>
              <td>{txt(c.customer)}</td><td>{txt(c.agent)}</td><td className="n">{num(c.term)}</td><td className="n">{won(c.rent)}</td>
              <td>{txt(c.contractDate)}</td><td>{when(c.signSentAt)}</td><td>{when(c.signedAt)}</td>
              <td>{c.signedPdfUrl ? <a href={c.signedPdfUrl} target="_blank" rel="noreferrer">서명본</a> : c.signUrl ? <a href={c.signUrl} target="_blank" rel="noreferrer">서명창</a> : ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
