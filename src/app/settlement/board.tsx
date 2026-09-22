import Link from 'next/link';
import { LiveSearch } from '../products/LiveSearch';
import '../products/board.css';
import { settlements, today } from '../../server/erp5';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { erp5Ready } from '../../adapters/erp5/firestore';
import { claimLedger, filterLedgerGroups, ledgerGroupAttention, ledgerMonths, ledgerTotals, nextActionableLedgerParty, NO_MONTH, payLedger, type LedgerGroup, type LedgerGroupFilter } from '../../domain/settlement/ledgers';
import { driftOf, planInvoice, type Axis } from '../../domain/settlement/lifecycle';
import { sp, txt, won } from '../_fn/fmt';
import { BoardList, type BoardRow } from '../products/BoardList';
import { ClaimLink, IssueForm } from './LifeForms';

/**
 * ★★★ 정산관리 새 판 — 목업 「정산」 그대로 (대표 2026-09-22 「목업대로 나눔」)
 *   정산 = 거래처 × 달 «묶음» — 청구(공급사) · 지급(영업채널). 건 하나하나의 확인·정정·수금/지급은 「실적」에서 한다.
 *   PC: 정산 목록(묶음) | 정산 상세(줄 · 합) | 정산 업무(청구서/지급명세 발행 · 청구 링크). 폰: 한 판씩.
 *   셈은 기능 쪽 그대로: 묶음 = claimLedger · payLedger, 합 = g.net(합 − 환수), 발행 미리보기 = planInvoice(발행과 같은 셈).
 *   ⚠ 운영 원장(ERP5)에 바로 쓴다 — 모양 확인 때 누르지 않는다.
 */

type Tone = 'good' | 'warn' | 'bad' | undefined;

const 상태보기: { key: LedgerGroupFilter; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'issue', label: '이슈' }, { key: 'todo', label: '미처리' }, { key: 'done', label: '완료' },
];

export async function SettlementBoard({ q }: { q: Record<string, string | string[] | undefined> }) {
  const data = erp5Ready();
  let all: Awaited<ReturnType<typeof settlements.list>>; let cb: Awaited<ReturnType<typeof settlements.clawbacks>>;
  try { [all, cb] = await Promise.all([settlements.list(), settlements.clawbacks()]); }
  catch (e) {
    return <div className="pb" data-phone="list"><p className="pb-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></div>;
  }
  const rows = all.map((x) => x.row);
  /* 청구/지급 — ax(새 주소) · tab(옛 주소) 둘 다 받는다 */
  const ax: 'claim' | 'pay' = (sp(q.ax) || sp(q.tab)) === 'pay' ? 'pay' : 'claim';
  const axis: Axis = ax === 'claim' ? '공급사' : '영업채널';
  const who = axis;
  const 문서 = ax === 'claim' ? '청구서' : '지급명세';
  const 끝말 = ax === 'claim' ? '수금' : '지급';

  const months = ledgerMonths(rows, cb);
  const now = today().slice(0, 7);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  /* ★처음 여는 달 = 이번 달까지 중 가장 최근(앞날 청구월이 적힌 줄이 있어 «맨 위»를 고르면 엉뚱한 달이 열린다) */
  const month = sp(q.month) || 달들.find((m) => m <= now) || 달들[0] || NO_MONTH;
  const groups = ax === 'claim' ? claimLedger(rows, month, cb) : payLedger(rows, month, cb);
  const t = ledgerTotals(groups);
  const gs = (상태보기.find((b) => b.key === sp(q.gs))?.key ?? 'all') as LedgerGroupFilter;
  const gq = sp(q.q).trim();
  const shown = filterLedgerGroups(groups, gs, gq);
  const 미정수 = months.includes(NO_MONTH)
    ? (ax === 'claim' ? claimLedger(rows, NO_MONTH, cb) : payLedger(rows, NO_MONTH, cb)).reduce((n, g) => n + g.lines.length, 0) : 0;
  const 셈 = (m: LedgerGroupFilter) => (m === 'all' ? groups.length : groups.filter((g) => ledgerGroupAttention(g) === m).length);

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    u.delete('tab'); u.delete('focus');
    u.set('ax', ax);
    if (!u.get('month')) u.set('month', month);
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    return `/settlement?${u}`;
  };
  const i = 달들.indexOf(month);
  const 앞달 = i >= 0 ? 달들[i + 1] : 달들[0];
  const 뒤달 = i > 0 ? 달들[i - 1] : undefined;
  const 달로 = (m: string) => keep({ month: m, g: '', v: 'list' });

  const 표 = (g: LedgerGroup): { t: string; tone: Tone } => {
    if (month === NO_MONTH) return { t: '달 미정', tone: 'bad' };
    const a = ledgerGroupAttention(g);
    if (a === 'issue') return { t: '이슈', tone: 'bad' };
    if (a === 'done') return { t: '완료', tone: 'good' };
    return { t: g.done ? `${끝말} ${g.completed}/${g.lines.length}` : `${문서} 대기`, tone: 'warn' };
  };

  const g = shown.find((x) => x.party === sp(q.g)) ?? shown[0];
  const view = (['list', 'detail', 'work'] as const).find((v) => v === sp(q.v)) ?? (sp(q.g) ? 'detail' : 'list');
  const 지금 = g ? 표(g) : null;
  /* 끝난 묶음 — 주 버튼은 «다음 거래처»(아직 안 끝난 곳 중 먼저 볼 곳 · 기능 nextActionableLedgerParty) */
  const 끝난묶음 = !!g && month !== NO_MONTH && ledgerGroupAttention(g) === 'done';
  const 다음거래처 = g ? nextActionableLedgerParty(groups, g.party) : null;

  const 목록: BoardRow[] = shown.map((x) => {
    const m = 표(x);
    return {
      id: x.party, href: keep({ g: x.party, v: 'detail' }), title: `${x.party} · ${month === NO_MONTH ? NO_MONTH : `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`}`,
      tag: m.t, tagTone: m.tone,
      meta: [`실적 ${x.lines.length}건`, `${문서} ${x.done}/${x.lines.length}`, x.unknown ? `금액 모름 ${x.unknown}` : '', x.hold ? `보류 ${x.hold}` : '',
        x.broken ? `끊김 ${x.broken}` : '', x.clawbacks.length ? `환수 ${x.clawbacks.length}` : ''].filter(Boolean).join(' · '),
      value: `${ax === 'claim' ? '청구' : '지급'} ${won(x.net)}원`, thumbLabel: '정산',
    };
  });

  /* ── 발행 — 고른 묶음(한 달 · 한 상대). 미리보기 = 기능 쪽 planInvoice 그대로(발행과 같은 셈) ── */
  const 장부 = g && month !== NO_MONTH ? await settlements.invoices(month).catch(() => []) : [];
  const 장 = g ? 장부.find((x) => x.axis === axis && x.party === g.party) ?? null : null;
  const 계획 = g ? planInvoice(month, axis, g.party, g.lines, cb, 장, 장부.map((x) => x.invoiceNo), Date.now(), '미리보기') : null;
  const 어긋남 = 계획?.ok ? driftOf(장, { supply: 계획.invoice.supply, vat: 계획.invoice.vat, lines: 계획.invoice.lines }) : null;
  const 날 = (ms?: number) => (ms ? new Date(ms + 9 * 3600_000).toISOString().slice(0, 10) : '');

  const 상태 = <span className={`sync${data.ok ? '' : ' warn'}`}>{data.ok ? '연결 정상' : '데이터 설정 필요'}</span>;
  const 남은 = groups.filter((x) => ledgerGroupAttention(x) !== 'done').length;
  const 폰머리 = {
    list: { title: <>정산관리<span>{shown.length}곳</span></>, sub: 남은 ? `미수·미지급 ${남은}곳` : '모두 끝남' },
    detail: { title: <>정산 상세</>, sub: 지금?.t ?? '묶음을 고르세요' },
    work: { title: <>정산 업무</>, sub: 장 ? `${문서} ${장.invoiceNo}` : `${문서} 발행 전` },
  }[view];

  return (
    <div className="pb" data-phone={view}>
      <header className="statusbar">
        <div><h1>{폰머리.title}</h1><small>{폰머리.sub}</small></div>
        {상태}
      </header>
      <div className="web-workspace">
        {/* ── 정산 목록 — 거래처 묶음 ── */}
        <section className="web-panel pb-list">
          <header className="web-panel-head">
            <h2>정산관리</h2><span>{shown.length}곳</span><small>{t.rows}줄 · {남은 ? `남은 ${남은}곳` : '모두 끝남'}</small>
          </header>
          <div className="list-tools">
            <form className="search" action="/settlement">
              <input type="hidden" name="ax" value={ax} /><input type="hidden" name="month" value={month} />
              {gs !== 'all' && <input type="hidden" name="gs" value={gs} />}
              <div className="search-field">
                <LiveSearch name="q" defaultValue={gq} label="검색" placeholder={`${who} 이름 검색`} reset={['g']} />
              </div>
            </form>
            <div className="monthbar" aria-label="정산월">
              {앞달 && month !== NO_MONTH ? <Link href={달로(앞달)} aria-label="앞 달">‹</Link> : <span className="gap" />}
              <b>{month}</b>
              {뒤달 && month !== NO_MONTH ? <Link href={달로(뒤달)} aria-label="뒤 달">›</Link> : <span className="gap" />}
              <span className="sum">{ax === 'claim' ? '청구' : '지급'} <b>{won(t.net)}원</b>
                {t.clawback ? <> · 환수 −{won(t.clawback)}</> : null}{t.unknown ? <span className="warn"> · 모름 {t.unknown}</span> : null}</span>
            </div>
            <div className="chips" role="group" aria-label="청구 · 지급 · 상태">
              {(['claim', 'pay'] as const).map((a) => {
                const on = a === ax;
                return (
                  <Link key={a} className={`chip${on ? ' on' : ''}`} href={keep({ ax: a, g: '', v: 'list' })} aria-current={on ? 'true' : undefined}>
                    {a === 'claim' ? '청구' : '지급'}{on && <span className="sr-only"> (선택됨)</span>}
                  </Link>
                );
              })}
              <span className="chip-sep" aria-hidden="true" />
              {상태보기.map((b) => {
                const on = b.key === gs;
                return (
                  <Link key={b.key} className={`chip${on ? ' on' : ''}`} href={keep({ gs: b.key === 'all' ? '' : b.key, g: '', v: 'list' })} aria-current={on ? 'true' : undefined}>
                    {b.label} {셈(b.key)}{on && <span className="sr-only"> (선택됨)</span>}
                  </Link>
                );
              })}
              {미정수 > 0 && <Link className={`chip${month === NO_MONTH ? ' on' : ''}`} href={달로(NO_MONTH)}>{NO_MONTH} {미정수}</Link>}
            </div>
            {month === NO_MONTH && <p className="notice warn">인도됐는데 셈한 달이 이미 닫힌(청구서 나간) 달이라 못 들어간 줄입니다 — 「실적」에서 사람이 달을 정합니다.</p>}
            </div>
            <div className="web-scroll">
            <BoardList rows={목록} selectedId={g?.party} unit="곳" empty={`이 달에 선 ${who}가 없습니다.`} />
          </div>
        </section>

        {/* ── 정산 상세 — 고른 묶음의 줄 ── */}
        <section className="web-panel pb-detail">
          <header className="web-panel-head"><h2>정산 상세</h2><small>{지금?.t ?? ''}</small></header>
          <div className="web-scroll">
            {g && 지금 ? (
              <>
                <div className="identity">
                  <span className={`tag${지금.tone ? ` ${지금.tone}` : ''}`}>{지금.t}</span>
                  <h3>{g.party} · {month}</h3>
                  <p>실적 {g.lines.length}건 · {ax === 'claim' ? '청구서 보냄' : '지급 통보'} {g.done}/{g.lines.length} · 확정금액은 발행 뒤 바꾸지 않음</p>
                  <div className="money">{ax === 'claim' ? '청구할 돈' : '줄 돈'} {won(g.net)}원</div>
                </div>
                <div className="summary">
                  <div><small>합</small><b>{won(g.total)}원</b></div>
                  <div><small>환수</small><b>{g.clawbackTotal ? `−${won(g.clawbackTotal)}원` : '—'}</b></div>
                  <div><small>{ax === 'claim' ? '수금 완료' : '지급 완료'}</small><b>{g.completed} / {g.lines.length}</b></div>
                </div>
                {g.unknown > 0 && <p className="notice warn">금액을 모르는 줄 {g.unknown}개 — 합에 넣지 않았습니다. 「실적」에서 금액을 채웁니다.</p>}
                <div className="section">
                  <h4>실적 줄</h4>
                  <div className="lines">
                    {g.lines.map(({ row: r, amount, broken, ratio }) => {
                      const 끝 = ax === 'claim' ? r.progress.collected : r.progress.paid;
                      const stage = ax === 'claim' ? r.claimStage : r.payStage;
                      return (
                        <Link key={r.id} className="line" href={`/performance?ic=${encodeURIComponent(r.id)}&month=${encodeURIComponent(month)}&ax=${ax}&v=work`}>
                          <b>{[txt(r.customer), r.plate].filter(Boolean).join(' · ')}</b>
                          <span className="amt">{amount == null ? '금액 모름' : `${won(amount)}원`}</span>
                          <small>{[r.model, ax === 'claim' ? r.channel : r.supplier, broken ? `끊김 · 받은 몫 ${Math.round(ratio * 100)}%` : ''].filter(Boolean).join(' · ')}</small>
                          <small style={{ textAlign: 'right', color: 끝 ? 'var(--good)' : r.progress.billHold ? 'var(--warn)' : undefined }}>{r.progress.billHold && ax === 'claim' ? '보류' : stage}</small>
                        </Link>
                      );
                    })}
                    {g.clawbacks.map((c, k) => (
                      <div key={`환수-${k}`} className="line minus">
                        <b>환수 · {c.plate}</b>
                        <span className="amt">−{won(ax === 'claim' ? c.supplierAmt : c.agentAmt)}원</span>
                        <small>{c.reason || '—'} · {c.at?.slice(0, 10)}</small><small style={{ textAlign: 'right' }}>{c.month}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <p className="empty">{groups.length ? '왼쪽에서 거래처를 고르세요.' : `이 달에 선 ${who}가 없습니다.`}</p>}
          </div>
          {g && (
            <div className="web-actions only-phone">
              <Link className="tertiary" href={keep({ v: 'list' })}>목록</Link>
              <Link className="primary" href={keep({ g: g.party, v: 'work' })}>정산 업무</Link>
            </div>
          )}
        </section>

        {/* ── 정산 업무 — 발행 · 청구 링크 ── */}
        <section className="web-panel pb-work">
          <header className="web-panel-head"><h2>정산 업무</h2><small>{장 ? `${문서} ${장.invoiceNo}` : `${문서} 발행 전`}</small></header>
          <div className="web-scroll">
            {g && 계획 ? (
              <>
                <div className="identity">
                  <span className={`tag${장 ? '' : ' warn'}`}>정산 업무</span>
                  <h3>{장 ? `${문서} ${장.invoiceNo}` : `${문서} 발행`}</h3>
                  <p>{장 ? `발행 ${날(장.issuedAt)} · 청구 → 확인 → 계산서 → 수금 순서로 증빙을 남깁니다.` : `${g.party}에 ${month} ${문서}를 냅니다. 발행하면 줄마다 ${ax === 'claim' ? '청구' : '통보'}가 찍힙니다.`}</p>
                </div>
                {!writeEnabled() && <p className="notice warn">ERP5 쓰기가 꺼져 있어 발행되지 않습니다(조회 전용).</p>}
                {계획.ok ? (
                  <div className="summary">
                    <div><small>공급가</small><b>{won(계획.invoice.supply)}원</b></div>
                    <div><small>부가세</small><b>{won(계획.invoice.vat)}원</b></div>
                    <div><small>합계</small><b>{won(계획.invoice.total)}원</b></div>
                  </div>
                ) : <p className="notice warn">{계획.error}</p>}
                {계획.ok && 계획.invoice.clawback ? <p className="notice">환수 −{won(계획.invoice.clawback)}원이 합계에 들어갔습니다.</p> : null}
                {어긋남 && <p className="notice warn">{어긋남} — 다시 발행하면 같은 번호로 새 합계가 섭니다.</p>}
                <IssueForm id="issue-form" month={month} axis={axis} party={g.party} />
                <div className="section">
                  <h4>처리 이력</h4>
                  <ol className="timeline">
                    <li className={`step${장 ? ' done' : ' now'}`}><i aria-hidden="true">{장 ? '✓' : ''}</i><b>{문서} 발행</b><small>{장 ? 날(장.issuedAt) : '대기'}</small></li>
                    <li className={`step${g.done === g.lines.length && g.lines.length ? ' done' : 장 ? ' now' : ''}`}><i aria-hidden="true">{g.done === g.lines.length && g.lines.length ? '✓' : ''}</i><b>{ax === 'claim' ? '청구' : '통보'}</b><small>{g.done}/{g.lines.length}</small></li>
                    <li className={`step${g.completed === g.lines.length && g.lines.length ? ' done' : ''}`}><i aria-hidden="true">{g.completed === g.lines.length && g.lines.length ? '✓' : ''}</i><b>{끝말}</b><small>{g.completed}/{g.lines.length}</small></li>
                  </ol>
                </div>
                {장 && (
                  <div className="section">
                    <h4>{ax === 'claim' ? '청구 링크' : '지급명세 링크'}</h4>
                    <ClaimLink month={month} axis={axis} party={g.party}
                      live={!!장.linkCreatedAt && !장.linkRevokedAt} openCount={장.openCount} openedAt={장.openedAt}
                      failCount={장.failCount} locked={!!장.lockedUntil && 장.lockedUntil > Date.now()} lockedUntil={장.lockedUntil} response={장.response ?? null} />
                  </div>
                )}
              </>
            ) : <p className="empty">거래처를 고르면 발행과 청구 링크가 여기 섭니다.</p>}
          </div>
          {g && (
            <div className="web-actions single-web">
              <Link className="tertiary only-phone" href={keep({ g: g.party, v: 'detail' })}>상세</Link>
              {끝난묶음 && 다음거래처
                ? <Link className="primary" href={keep({ g: 다음거래처, v: 'work' })}>다음 거래처</Link>
                : (
                  <button type="submit" form="issue-form" className="primary" disabled={!계획?.ok || !writeEnabled()}>
                    {장 ? `다시 발행 · ${장.invoiceNo}` : `${문서} 발행`}
                  </button>
                )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
