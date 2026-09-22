import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { LiveSearch } from '../products/LiveSearch';
import '../products/board.css';
import { settlements, today } from '../../server/erp5';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { claimLedger, ledgerMonths, locateSettlementFocus, NO_MONTH, payLedger, type LedgerLine } from '../../domain/settlement/ledgers';
import { performanceDone, performanceIssue, performanceSearchText } from '../../domain/settlement/performance-filter';
import { cashRemainingOf, type Axis } from '../../domain/settlement/lifecycle';
import type { SettlementRow } from '../../domain/settlement/types';
import { sp, txt, won } from '../_fn/fmt';
import { FilterSheet, type FacetAxis } from '../_design/FilterSheet';
import { BoardList, type BoardRow } from '../products/BoardList';
import { LifeForm, SideStep } from '../settlement/LifeForms';
import { settlementPrimaryAction } from '../settlement/primary-action';

/**
 * ★★★ 실적관리 새 판 — 목업 「실적」 그대로 (대표 2026-09-22 「목업대로 나눔」)
 *   실적 = 인도된 «건» 하나하나 — 공급사 청구 · 영업채널 지급 · 마진, 그리고 그 건의 대조 걸음(확인 · 정정 · 계산서 · 수금/지급).
 *   PC: 실적 목록 | 실적 상세 | 대조 업무. 폰: 한 판씩. 달은 ‹ › 로 넘긴다(정산과 같은 달 — 기능 ledgerMonths).
 *   셈 · 막는 규칙 · 순서는 기능 쪽 그대로: 줄 = claimLedger · payLedger, 다음 걸음 = settlementPrimaryAction, 저장 = lifecycleAction.
 *   ⚠ 운영 원장(ERP5)에 바로 쓴다 — 모양 확인 때 누르지 않는다.
 */

type Deal = { row: SettlementRow; claim?: LedgerLine; pay?: LedgerLine };
type Tone = 'good' | 'warn' | 'bad' | undefined;
type Mode = 'all' | 'todo' | 'issue' | 'done';

const 끝축 = (d: Deal, ax: Axis) => { const l = ax === '공급사' ? d.claim : d.pay; return !l || performanceDone(l, ax); };
const 끝남 = (d: Deal) => 끝축(d, '공급사') && 끝축(d, '영업채널');
const 이슈 = (d: Deal) => !끝남(d) && ((!!d.claim && performanceIssue(d.claim, '공급사')) || (!!d.pay && performanceIssue(d.pay, '영업채널')));
const 모드맞음 = (d: Deal, m: Mode) => m === 'all' || (m === 'done' ? 끝남(d) : m === 'issue' ? 이슈(d) : !끝남(d) && !이슈(d));
/** 마진 = 청구 − 지급. 선 줄 중 하나라도 금액을 모르면 «모름»(0 으로 세지 않는다) */
const 마진 = (d: Deal): number | null => {
  if ((d.claim && d.claim.amount == null) || (d.pay && d.pay.amount == null)) return null;
  return (d.claim?.amount ?? 0) - (d.pay?.amount ?? 0);
};
function 표(d: Deal): { t: string; tone: Tone } {
  if (이슈(d)) return { t: '이슈', tone: 'bad' };
  if (끝남(d)) return { t: '완료', tone: 'good' };
  if (!끝축(d, '공급사')) return { t: `청구 · ${d.row.claimStage}`, tone: 'warn' };
  return { t: `지급 · ${d.row.payStage}`, tone: 'warn' };
}
const 길 = { 공급사: ['접수', '청구', '확인', '계산서', '수금'], 영업채널: ['접수', '통보', '확인', '지급'] } as const;

const 보기: { key: Mode; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'todo', label: '할 일' }, { key: 'issue', label: '이슈' }, { key: 'done', label: '완료' },
];


export async function PerformanceBoard({ q }: { q: Record<string, string | string[] | undefined> }) {
  const data = erp5Ready();
  let all: SettlementRow[]; let cb: Awaited<ReturnType<typeof settlements.clawbacks>>;
  try { const [a, c] = await Promise.all([settlements.list(), settlements.clawbacks()]); all = a.map((x) => x.row); cb = c; }
  catch (e) {
    return <div className="pb" data-phone="list"><p className="pb-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></div>;
  }

  /* 접수판 「정산으로」 → 이 건이 서는 달을 찾아 연다. 못 서면(원장에 못 섬) 접수로 돌려보낸다(fail-closed) */
  const ic0 = sp(q.ic);
  const 축요청: Axis = sp(q.ax) === 'pay' ? '영업채널' : '공급사';
  const focus = ic0 && !sp(q.month) ? (locateSettlementFocus(all, cb, ic0, 축요청 === '공급사' ? 'claim' : 'pay')
    ?? locateSettlementFocus(all, cb, ic0, 축요청 === '공급사' ? 'pay' : 'claim')) : null;
  const focusMiss = !!ic0 && !sp(q.month) && !focus;

  const months = ledgerMonths(all, cb);
  const now = today().slice(0, 7);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  const month = focus?.month || sp(q.month) || 달들.find((m) => m <= now) || 달들[0] || NO_MONTH;

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    if (!u.get('month')) u.set('month', month);
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    return `/performance?${u}`;
  };

  /* 그 달의 건 — 청구 줄 · 지급 줄을 접수 코드로 한 건에 묶는다 */
  const 건들 = new Map<string, Deal>();
  for (const g of claimLedger(all, month, cb)) for (const l of g.lines) 건들.set(l.row.id, { ...(건들.get(l.row.id) ?? { row: l.row }), claim: l });
  for (const g of payLedger(all, month, cb)) for (const l of g.lines) 건들.set(l.row.id, { ...(건들.get(l.row.id) ?? { row: l.row }), pay: l });
  const 전부 = [...건들.values()];

  const 고른 = (k: string) => sp(q[k]).split(',').map((x) => x.trim()).filter(Boolean);
  const 켜끔 = (cur: string[], v: string) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',');
  const text = sp(q.q).trim().toLowerCase();
  const searched = 전부.filter((d) => !text || performanceSearchText({ row: d.row } as LedgerLine).includes(text));
  const 축 = { supplier: 고른('supplier'), channel: 고른('channel'), agent: 고른('agent') };
  const 축값 = { supplier: (d: Deal) => d.row.supplier ?? '', channel: (d: Deal) => d.row.channel ?? '', agent: (d: Deal) => d.row.agent ?? '' };
  const 축맞음 = (d: Deal, skip?: keyof typeof 축) =>
    (Object.keys(축) as (keyof typeof 축)[]).every((a) => a === skip || !축[a].length || 축[a].includes(축값[a](d)));
  const 거른 = searched.filter((d) => 축맞음(d));
  const mode = focus ? 'all' : (보기.find((b) => b.key === sp(q.f))?.key ?? 'all');
  const 순위 = (d: Deal) => (이슈(d) ? 0 : 끝남(d) ? 2 : 1);
  const sorted = 거른.filter((d) => 모드맞음(d, mode))
    .sort((a, b) => 순위(a) - 순위(b) || (b.row.progress.deliveredAt ?? '').localeCompare(a.row.progress.deliveredAt ?? '') || a.row.id.localeCompare(b.row.id));
  const 셈 = (a: keyof typeof 축) => {
    const m = new Map<string, number>();
    for (const d of searched.filter((x) => 축맞음(x, a))) { const v = 축값[a](d); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([key, count]) => ({ key, label: key, count }));
  };
  const axes: FacetAxis[] = [
    { key: 'supplier', label: '공급사', options: 셈('supplier') }, { key: 'channel', label: '영업채널', options: 셈('channel') },
    { key: 'agent', label: '담당자', options: 셈('agent') },
  ];
  const 걸린조건 = axes.flatMap((ax) => 축[ax.key as keyof typeof 축].map((k) => ({
    key: `${ax.key}:${k}`, label: `${ax.label} ${k}`, href: keep({ [ax.key]: 켜끔(축[ax.key as keyof typeof 축], k) }),
  })));
  const 확인필요 = 전부.filter((d) => !끝남(d)).length;
  const 마진합 = 거른.reduce((n, d) => n + (마진(d) ?? 0), 0);
  const 모름수 = 거른.filter((d) => 마진(d) === null).length;

  const i = 달들.indexOf(month);
  const 앞달 = i >= 0 ? 달들[i + 1] : 달들[0];
  const 뒤달 = i > 0 ? 달들[i - 1] : undefined;
  const 달로 = (m: string) => keep({ month: m, ic: '', v: 'list', lc: '' });

  /* ── 고른 건 ── */
  const ic = focus?.code ?? ic0;
  const d = sorted.find((x) => x.row.id === ic) ?? (ic ? 건들.get(ic) : undefined) ?? sorted[0];
  const view = focus ? 'work' : ((['list', 'detail', 'work'] as const).find((v) => v === sp(q.v)) ?? (ic0 ? 'detail' : 'list'));
  const 지금 = d ? 표(d) : null;
  const r = d?.row;
  const 축고름: Axis = !d ? 축요청 : sp(q.ax) ? 축요청 : (!끝축(d, '공급사') && d.claim ? '공급사' : d.pay ? '영업채널' : '공급사');
  const 줄 = d ? (축고름 === '공급사' ? d.claim : d.pay) : undefined;

  const 목록: BoardRow[] = sorted.map((x) => {
    const m = 표(x); const 마 = 마진(x);
    return {
      id: x.row.id, href: keep({ ic: x.row.id, v: 'detail', lc: '', ax: '' }), title: [txt(x.row.customer), x.row.model].filter(Boolean).join(' · '),
      tag: m.t, tagTone: m.tone,
      meta: [x.row.plate, x.row.supplier, x.row.channel].filter(Boolean).join(' · '),
      value: 마 === null ? '마진 확인 필요' : `마진 ${won(마)}원`, thumbLabel: '실적',
    };
  });

  /* 대조 업무 — 그 축의 주 걸음 하나(하단바) · 곁 걸음은 「다른 작업」 */
  const 장부 = d && month !== NO_MONTH ? await settlements.invoices(month).catch(() => []) : [];
  const 장 = r && 줄 ? 장부.find((x) => x.axis === 축고름 && x.party === (축고름 === '공급사' ? r.supplier : r.channel)) ?? null : null;
  const stage = r ? (축고름 === '공급사' ? r.claimStage : r.payStage) : '접수';
  const 현재걸음 = 축고름 === '공급사' && stage === '확인' ? (r?.progress.invoiceIssued ? '수금' : '계산서') : stage;
  const 순번 = (길[축고름] as readonly string[]).indexOf(현재걸음);
  const 끝말 = 축고름 === '공급사' ? '수금' : '지급';
  const 정정중 = sp(q.lc) === 'correct' && stage !== '접수';
  const primary = r ? settlementPrimaryAction(r, 축고름) : 'none';
  const fid = r ? `life-${r.id}` : 'life';
  const 누적 = r ? (축고름 === '공급사' ? r.progress.collectedAmt ?? 0 : r.progress.paidAmt ?? 0) : 0;
  const 남은 = r ? cashRemainingOf(축고름, r) : null;
  const 다음건 = d ? sorted.find((x) => x.row.id !== d.row.id && !끝남(x)) : undefined;
  let 주: React.ReactNode = null; let 곁: React.ReactNode = null; let 폼: React.ReactNode = null;
  let 업무 = { h: '', p: '' };
  if (r && 줄) {
    if (정정중) {
      업무 = { h: '정정 요청 쓰기', p: `상대(${축고름})가 말한 금액과 사유를 남깁니다. 저장하면 이 줄은 «정정»으로 멈춥니다.` };
      폼 = <LifeForm id={fid} code={r.id} kind="correct" axis={축고름} need="correct" />;
      주 = <button type="submit" form={fid} className="primary">정정 저장</button>;
      곁 = <Link className="secondary" href={keep({ lc: '' })}>취소</Link>;
    } else if (primary === 'confirm') {
      업무 = { h: `${축고름} 확인`, p: `${축고름 === '공급사' ? '청구서' : '지급명세'}가 나갔습니다. 상대가 금액을 맞다고 하면 확인을 찍습니다.` };
      폼 = <LifeForm id={fid} code={r.id} kind="confirm" axis={축고름} need="none" />;
      주 = <button type="submit" form={fid} className="primary">{축고름} 확인</button>;
      곁 = <Link className="secondary" href={keep({ lc: 'correct' })}>정정 요청</Link>;
    } else if (primary === 'uncorrect') {
      업무 = { h: '정정 풀기', p: '정정 요청이 걸려 멈춘 줄입니다. 상대와 맞췄으면 정정을 풉니다.' };
      폼 = <LifeForm id={fid} code={r.id} kind="uncorrect" axis={축고름} need="none" />;
      주 = <button type="submit" form={fid} className="primary">정정 풂</button>;
    } else if (primary === 'invoice') {
      업무 = { h: '계산서 끊기', p: '공급사가 확인했습니다. 수금 전에 세금계산서를 끊습니다(날짜 · 사업자번호).' };
      폼 = <SideStep id={fid} code={r.id} kind="invoice" label="계산서" on={false} day={today()} biz={장?.partyBizNo} externalSubmit />;
      주 = <button type="submit" form={fid} className="primary">계산서 끊기</button>;
      곁 = <Link className="secondary" href={keep({ lc: 'correct' })}>정정 요청</Link>;
    } else if (primary === 'cash') {
      업무 = { h: `${끝말} 찍기`, p: 누적 > 0 && 남은 !== null ? `부분${끝말} ${won(누적)}원 처리 · 남은 금액 ${won(남은)}원` : `${끝말}된 금액과 날짜를 찍습니다. 부분이면 금액만 줄여 넣습니다.` };
      폼 = <LifeForm id={fid} code={r.id} kind={축고름 === '공급사' ? 'collected' : 'paid'} axis={축고름} need="money" amount={남은 ?? 0} day={today()} operationId={randomUUID()} />;
      주 = <button type="submit" form={fid} className="primary">{누적 > 0 ? `${끝말} 추가` : `${끝말} 찍기`}</button>;
      곁 = <Link className="secondary" href={keep({ lc: 'correct' })}>정정 요청</Link>;
    } else if (primary === 'none') {
      업무 = { h: `${축고름 === '공급사' ? '청구서' : '지급명세'} 발행 전`, p: '이 달 거래처 묶음의 문서가 아직 안 나갔습니다. 발행은 「정산」에서 합니다.' };
      주 = <Link className="primary" href={`/settlement?ax=${축고름 === '공급사' ? 'claim' : 'pay'}&month=${encodeURIComponent(month)}&g=${encodeURIComponent((축고름 === '공급사' ? r.supplier : r.channel) ?? '')}&v=work`}>정산으로</Link>;
    } else {
      업무 = { h: `${끝말} 완료`, p: `이 축은 ${끝말}까지 끝났습니다.` };
      주 = 다음건 ? <Link className="primary" href={keep({ ic: 다음건.row.id, v: 'work', lc: '', ax: '' })}>다음 할 일</Link> : null;
    }
  } else if (r) {
    업무 = { h: `${축고름} 줄 없음`, p: `이 건은 이 달 ${축고름 === '공급사' ? '청구' : '지급'} 원장에 서지 않습니다(정산대상 · 금액 · 달 확인).` };
  }
  const 읽기만 = !writeEnabled();
  /* 조회 전용이면 «저장하는» 주 버튼만 막는다(폼이 있는 걸음) — 옮겨 가기(정산으로 · 다음 할 일)는 그대로 */
  if (읽기만 && 폼) 주 = <button type="button" className="primary" disabled>조회 전용</button>;

  const 상태 = <span className={`sync${data.ok ? '' : ' warn'}`}>{data.ok ? '연결 정상' : '데이터 설정 필요'}</span>;
  const 폰머리 = {
    list: { title: <>실적관리<span>{sorted.length}건</span></>, sub: 확인필요 ? `확인 필요 ${확인필요}건` : '모두 끝남' },
    detail: { title: <>실적 상세</>, sub: 지금?.t ?? '건을 고르세요' },
    work: { title: <>대조 업무</>, sub: 업무.h },
  }[view];

  return (
    <div className="pb" data-phone={view}>
      <header className="statusbar">
        <div><h1>{폰머리.title}</h1><small>{폰머리.sub}</small></div>
        {상태}
      </header>
      <div className="web-workspace">
        {/* ── 실적 목록 ── */}
        <section className="web-panel pb-list">
          <header className="web-panel-head">
            <h2>실적관리</h2><span>{sorted.length}건</span><small>{확인필요 ? `확인 필요 ${확인필요}건` : '모두 끝남'}</small>
          </header>
          <div className="list-tools">
            {focusMiss && (
              <p className="notice warn">이 접수는 지금 실적 원장에 설 수 없습니다. <Link href={`/intake?ic=${encodeURIComponent(ic0)}&v=work`}>접수 상세에서 막힘 확인</Link></p>
            )}
            <form className="search" action="/performance">
              {Object.entries(q).filter(([k, v]) => !['q', 'ic', 'v', 'lc'].includes(k) && sp(v))
                .map(([k, v]) => <input key={k} type="hidden" name={k} value={sp(v)} />)}
              {!sp(q.month) && <input type="hidden" name="month" value={month} />}
              <div className="search-field">
                <LiveSearch name="q" defaultValue={sp(q.q)} label="검색" placeholder="고객·차량번호·공급사 검색" reset={['ic']} />
              </div>
              <FilterSheet axes={axes} count={sorted.length} unit="건" />
            </form>
            <div className="monthbar" aria-label="정산월">
              {앞달 && month !== NO_MONTH ? <Link href={달로(앞달)} aria-label="앞 달">‹</Link> : <span className="gap" />}
              <b>{month}</b>
              {뒤달 && month !== NO_MONTH ? <Link href={달로(뒤달)} aria-label="뒤 달">›</Link> : <span className="gap" />}
              <span className="sum">마진 <b>{won(마진합)}원</b>{모름수 ? <span className="warn"> · 모름 {모름수}</span> : null}</span>
            </div>
            <div className="chips" role="group" aria-label="보기">
              {보기.map((b) => {
                const on = b.key === mode;
                return (
                  <Link key={b.key} className={`chip${on ? ' on' : ''}`} href={keep({ f: b.key === 'all' ? '' : b.key, ic: '', v: '' })} aria-current={on ? 'true' : undefined}>
                    {b.label}{b.key !== 'all' ? ` ${거른.filter((x) => 모드맞음(x, b.key)).length}` : ''}{on && <span className="sr-only"> (선택됨)</span>}
                  </Link>
                );
              })}
              {months.includes(NO_MONTH) && (
                <Link className={`chip${month === NO_MONTH ? ' on' : ''}`} href={달로(NO_MONTH)}>{NO_MONTH}</Link>
              )}
            </div>
            {걸린조건.length > 0 && (
              <div className="applied" aria-label="걸어 둔 조건">
                {걸린조건.map((x) => (
                  <Link key={x.key} className="applied-chip" href={x.href} aria-label={`${x.label} 조건 풀기`}><span>{x.label}</span><span aria-hidden="true">✕</span></Link>
                ))}
                <Link className="applied-clear" href={keep({ supplier: '', channel: '', agent: '', q: '' })}>모두 지우기</Link>
              </div>
            )}
            {month === NO_MONTH && <p className="notice warn">인도됐는데 셈한 달이 이미 닫힌 달이라 못 들어간 건입니다 — 「다른 작업」에서 청구월을 정합니다.</p>}
            </div>
            <div className="web-scroll">
            <BoardList rows={목록} selectedId={d?.row.id} unit="건" empty="이 달에 선 실적이 없습니다." />
          </div>
        </section>

        {/* ── 실적 상세 ── */}
        <section className="web-panel pb-detail">
          <header className="web-panel-head"><h2>실적 상세</h2><small>{지금?.t ?? ''}</small></header>
          <div className="web-scroll">
            {d && r && 지금 ? (() => {
              const 마 = 마진(d);
              return (
                <>
                  <div className="identity">
                    <span className={`tag${지금.tone ? ` ${지금.tone}` : ''}`}>{지금.t}</span>
                    <h3>{[txt(r.customer), r.model].filter(Boolean).join(' · ')}</h3>
                    <p>{[r.plate, r.supplier, r.channel, r.progress.deliveredAt ? `인도 ${r.progress.deliveredAt}` : ''].filter(Boolean).join(' · ')}</p>
                    <div className="money">{마 === null ? '마진 확인 필요' : `마진 ${won(마)}원`}</div>
                  </div>
                  <div className="summary">
                    <div><small>공급사 청구</small><b>{!d.claim ? '—' : d.claim.amount == null ? '모름' : `${won(d.claim.amount)}원`}</b></div>
                    <div><small>채널 지급</small><b>{!d.pay ? '—' : d.pay.amount == null ? '모름' : `${won(d.pay.amount)}원`}</b></div>
                  </div>
                  {(d.claim?.broken || d.pay?.broken) && <p className="notice warn">분납이 끊겨 받은 몫({Math.round((d.claim ?? d.pay)!.ratio * 100)}%)만 섰습니다.</p>}
                  {r.progress.billHold && <p className="notice warn">청구 보류 중 — 이번 달 청구에서 빠집니다.</p>}
                  <div className="section">
                    <h4>대조 단계</h4>
                    <ol className="timeline">
                      {d.claim && <li className={`step${r.progress.collected ? ' done' : ' now'}`}><i aria-hidden="true">{r.progress.collected ? '✓' : ''}</i><b>공급사 · {r.claimStage === '확인' && !r.progress.invoiceIssued ? '계산서 대기' : r.claimStage}</b><small>{r.progress.collected ? '수금 완료' : '진행 중'}</small></li>}
                      {d.pay && <li className={`step${r.progress.paid ? ' done' : ' now'}`}><i aria-hidden="true">{r.progress.paid ? '✓' : ''}</i><b>영업채널 · {r.payStage}</b><small>{r.progress.paid ? '지급 완료' : '진행 중'}</small></li>}
                    </ol>
                  </div>
                  <div className="section">
                    <h4>계약 조건</h4>
                    <div className="facts">
                      {([['상품구분', r.product], ['기간', r.term ? `${r.term}개월` : ''], ['월 대여료', r.rent != null ? `${won(r.rent)}원` : ''],
                        ['분납', r.payKind], ['청구월', r.progress.billMonth], ['셈 근거', r.settleNote], ['담당자', r.agent]] as [string, string | null | undefined][])
                        .filter(([, v]) => v).map(([k, v]) => <div key={k} className="fact"><span>{k}</span><b>{v}</b></div>)}
                    </div>
                  </div>
                  <p style={{ marginTop: 12 }}><Link className="applied-clear" href={`/intake?ic=${encodeURIComponent(r.id)}&v=detail`}>접수 상세 보기 →</Link></p>
                </>
              );
            })() : <p className="empty">{sorted.length ? '왼쪽에서 건을 고르세요.' : '이 달에 선 실적이 없습니다.'}</p>}
          </div>
          {d && (
            <div className="web-actions only-phone">
              <Link className="tertiary" href={keep({ v: 'list' })}>목록</Link>
              <Link className="primary" href={keep({ ic: d.row.id, v: 'work' })}>대조 업무</Link>
            </div>
          )}
        </section>

        {/* ── 대조 업무 ── */}
        <section className="web-panel pb-work">
          <header className="web-panel-head"><h2>대조 업무</h2><small>{축고름 === '공급사' ? '공급사 청구' : '영업채널 지급'}</small></header>
          <div className="web-scroll">
            {r ? (
              <>
                <div className="chips" role="group" aria-label="대조 축">
                  {(['공급사', '영업채널'] as const).map((a) => {
                    const on = a === 축고름; const 있음 = a === '공급사' ? !!d?.claim : !!d?.pay;
                    return (
                      <Link key={a} className={`chip${on ? ' on' : ''}`} href={keep({ ax: a === '공급사' ? 'claim' : 'pay', lc: '', v: 'work' })} aria-current={on ? 'true' : undefined}>
                        {a === '공급사' ? '공급사 청구' : '영업채널 지급'}{!있음 ? ' · 없음' : 끝축(d!, a) ? ' · 끝' : ''}{on && <span className="sr-only"> (선택됨)</span>}
                      </Link>
                    );
                  })}
                </div>
                <div className="identity">
                  <span className="tag warn">대조 업무</span>
                  <h3>{업무.h}</h3>
                  <p>{업무.p}</p>
                </div>
                {읽기만 && <p className="notice warn">ERP5 쓰기가 꺼져 있어 저장되지 않습니다(조회 전용).</p>}
                {줄 && (
                  <div className="section">
                    <h4>처리 기준</h4>
                    <ol className="timeline">
                      {(길[축고름] as readonly string[]).map((x, k) => (
                        <li key={x} className={`step${순번 >= 0 && k < 순번 ? ' done' : ''}${x === 현재걸음 && stage !== '수금' && stage !== '지급' ? ' now' : ''}${(stage === '수금' || stage === '지급') ? ' done' : ''}`}>
                          <i aria-hidden="true">{(순번 >= 0 && k < 순번) || stage === '수금' || stage === '지급' ? '✓' : ''}</i><b>{x}</b>
                          <small>{x === 현재걸음 && stage !== 끝말 ? '지금' : ''}</small>
                        </li>
                      ))}
                      {stage === '정정' && <li className="step now"><i aria-hidden="true">!</i><b>정정</b><small>멈춤</small></li>}
                    </ol>
                  </div>
                )}
                {폼 && <div className="section form">{폼}</div>}
                {줄 && r && (
                  <details className="more">
                    <summary>다른 작업</summary>
                    <div className="more-body">
                      {(() => {
                        const 곁일 = [
                          축고름 === '공급사' && !r.progress.billed && <SideStep key="hold" code={r.id} kind="hold" label={r.progress.billHold ? '청구 보류 중' : '청구 보류'} on={r.progress.billHold} />,
                          !r.progress.billed && r.progress.delivered && <SideStep key="month" code={r.id} kind="billMonth" label="청구월" month={r.progress.billMonth ?? today().slice(0, 7)} />,
                          축고름 === '공급사' && r.progress.billed && primary !== 'invoice' && <SideStep key="inv" code={r.id} kind="invoice" label={r.progress.invoiceIssued ? '계산서 끊음' : '계산서'} on={r.progress.invoiceIssued} day={today()} biz={장?.partyBizNo} />,
                        ].filter(Boolean);
                        return 곁일.length ? 곁일 : <p className="notice">지금 할 곁일이 없습니다.</p>;
                      })()}
                    </div>
                  </details>
                )}
              </>
            ) : <p className="empty">건을 고르면 대조 업무가 여기 섭니다.</p>}
          </div>
          {r && (주 || 곁) && (
            <div className={`web-actions${곁 ? ' three' : ' single-web'}`}>
              <Link className="tertiary only-phone" href={keep({ ic: r.id, v: 'detail', lc: '' })}>상세</Link>
              {곁}
              {주}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
