/**
 * PC 전자계약 — 규격 `platform/contracts.html`(목록) + 상세 패널(`contract-detail.html` 의 전자계약 카드) 구성 그대로
 *   ★업무 흐름(상품 · 접수 · 실적 · 정산)과 따로 다루는 문이다(대표 2026-09-23) — 메뉴에서도 떼어 두었다.
 *   데이터는 기능 쪽 그대로(contracts.list). 서명창 · 서명본은 ERP5 가 준 주소를 새 창으로 연다.
 */
import Link from 'next/link';
import { contracts } from '../../server/erp5';
import { sp, txt, when } from '../_fn/fmt';
import { Badge, CardHead, hrefWith, PageHeader, Props, Screen, SearchBar, Seg, Steps, won0, type Tone } from './parts';
import { AutoSelect } from './AutoSelect';

type Q = Record<string, string | string[] | undefined>;
type 계약 = Awaited<ReturnType<typeof contracts.list>>[number];
const SIGN = ['발행', '열람', '진행중', '서명완료'] as const;
const SIGN_TONE: Record<string, Tone> = { 발행: 'info', 열람: 'warn', 진행중: 'info', 서명완료: 'ok' };
const STATUS_TONE: Record<string, Tone> = { 계약요청: 'info', 계약대기: 'warn', 계약발송: 'warn', 계약완료: 'ok', 계약취소: 'err', 계약철회: 'err' };
const signOf = (c: 계약) => c.signStatus || '미연결';

export async function EsignScreen({ q, base = '/esign' }: { q: Q; base?: string }) {
  let all: 계약[];
  try { all = await contracts.list(); }
  catch (e) { return <Screen name="esign"><PageHeader crumb={['홈', '전자계약']} title="전자계약" desc={<span className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</span>} /></Screen>; }

  const text = sp(q.q).trim().toLowerCase();
  const status = sp(q.status), sign = sp(q.sign);
  const statuses = [...new Set(all.map((c) => c.status).filter(Boolean))].sort();
  const searched = all
    .filter((c) => !status || c.status === status)
    .filter((c) => !text || [c.code, c.plate, c.vehicle, c.customer, c.agent].join(' ').toLowerCase().includes(text));
  const shown = searched.filter((c) => !sign || signOf(c) === sign)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const n = (s: string) => searched.filter((c) => signOf(c) === s).length;
  const sel = all.find((c) => c.id === sp(q.id));
  const waiting = all.filter((c) => ['발행', '열람', '진행중'].includes(c.signStatus)).length;

  const grid = (
    <section className="erp-card erp-card--fill">
      <SearchBar base={base} q={q} placeholder="고객 · 차번 · 계약코드 · 담당" keep={['sign']}
        dropdown={<AutoSelect name="status" value={status} label="계약상태" options={[['', '계약상태 전체'], ...statuses.map((v) => [v, v] as [string, string])]} />} />
      <div className="erp-toolbar" data-region="grid-toolbar">
        <span className="erp-toolbar-spacer" />
        <Seg label="전자서명" items={[
          { key: 'all', label: `전체 ${searched.length}`, href: hrefWith(base, q, { sign: null }), on: !sign },
          ...[...SIGN, '미연결'].map((s) => ({ key: s, label: `${s} ${n(s)}`, href: hrefWith(base, q, { sign: s }), on: sign === s })),
        ]} />
      </div>
      <div className="erp-grid-scroll" data-region="grid">
        <table className="erp-grid">
          <thead><tr>
            <th>계약코드</th><th>계약일</th><th>고객</th><th>차량 / 차량번호</th><th>영업 담당</th>
            <th className="erp-num">기간</th><th className="erp-num">월 대여료</th><th>전자서명</th><th>계약상태</th>
          </tr></thead>
          <tbody>
            {shown.map((c) => {
              const href = hrefWith(base, q, { id: c.id });
              return (
                <tr key={c.id} aria-selected={sel?.id === c.id} data-href={href}>
                  <td><Link className="erp-row-link" href={href}>{txt(c.code)}</Link></td>
                  <td>{txt(c.contractDate)}</td><td>{txt(c.customer)}</td>
                  <td>{txt(c.vehicle)}<span className="erp-cell-sub">{txt(c.plate)}</span></td>
                  <td>{txt(c.agent)}</td>
                  <td className="erp-num">{c.term ? `${c.term}개월` : '—'}</td>
                  <td className="erp-num erp-strong">{won0(c.rent)}</td>
                  <td>{c.signStatus ? <Badge tone={SIGN_TONE[c.signStatus] ?? 'neutral'}>{c.signStatus}</Badge> : <span className="erp-muted">미연결</span>}</td>
                  <td>{c.status ? <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="erp-grid-foot"><span>총 <b>{shown.length}</b>건</span><span>·</span><span>서명 대기 <b>{waiting}</b>건</span></div>
    </section>
  );

  const step = sel ? SIGN.indexOf(sel.signStatus as (typeof SIGN)[number]) : -1;
  return (
    <Screen name="esign">
      <PageHeader crumb={['홈', '계약서', '전자계약']} title="전자계약" badge={<Badge tone="neutral">업무 흐름과 별도</Badge>}
        desc="전자계약서의 발행 · 열람 · 서명 상태를 확인합니다. 계약접수 · 정산과는 따로 다루는 문입니다."
        actions={sel ? <>
          {sel.signUrl ? <a className="erp-btn" href={sel.signUrl} target="_blank" rel="noreferrer">서명창 열기</a> : null}
          {sel.signedPdfUrl
            ? <a className="erp-btn erp-btn--primary" href={sel.signedPdfUrl} target="_blank" rel="noreferrer">서명본 열기</a>
            : <span className="erp-btn erp-btn--primary" aria-disabled="true" title="서명이 끝나면 서명본을 열 수 있습니다">서명본 열기</span>}
        </> : <Link className="erp-btn erp-btn--ghost" href="/intake">계약접수</Link>} />
      {sel ? (
        <div className="erp-cols">
          {grid}
          <div className="erp-stack">
            <section className="erp-card">
              <CardHead title={`${txt(sel.customer)} · ${txt(sel.code)}`} right={sel.status ? <Badge tone={STATUS_TONE[sel.status] ?? 'neutral'}>{sel.status}</Badge> : null} />
              <div className="erp-card-body"><Steps current={sel.signStatus === '서명완료' ? SIGN.length : step} items={SIGN.map((s) => ({ label: s }))} /></div>
            </section>
            <section className="erp-card">
              <CardHead title="계약 정보" />
              <div className="erp-card-body">
                <Props pairs={[
                  ['차량', txt(sel.vehicle)], ['차량번호', txt(sel.plate)], ['영업 담당', txt(sel.agent)], ['기간 · 월 대여료', `${sel.term ?? '—'}개월 · ${won0(sel.rent)}원`],
                  ['양식', txt(sel.kind)], ['보험', txt(sel.insurance)], ['계약일', txt(sel.contractDate)], ['만든 때', when(sel.createdAt)],
                  ['발송', when(sel.signSentAt)], ['서명', when(sel.signedAt)],
                ]} />
              </div>
            </section>
          </div>
        </div>
      ) : grid}
    </Screen>
  );
}
