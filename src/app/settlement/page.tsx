import Link from 'next/link';
import { ListRow, StatusTile, type RowStatus } from '../_design/ListRow';
import { settlements, today } from '../../server/erp5';
import { claimLedger, filterLedgerGroups, ledgerGroupAttention, ledgerMonths, ledgerTotals, locateSettlementFocus, nextActionableLedgerParty, NO_MONTH, payLedger, type LedgerGroupFilter } from '../../domain/settlement/ledgers';
import { sp, txt, won } from '../_fn/fmt';
import { IntakeDetailPanel } from '../intake/panels';
import { driftOf, planInvoice, type Axis } from '../../domain/settlement/lifecycle';
import { filterPerformanceLines, nextActionablePerformanceCode, performanceMatchesMode, type PerformanceFilterMode } from '../../domain/settlement/performance-filter';
import { ClaimLink, IssueForm } from './LifeForms';
import { ActionBar, EmptyState, Notice, PanelHeader, SearchField, SummaryGrid, SummaryItem } from '../_design/Primitives';
import { SettlementScreen } from '../_erp/SettlementScreen';

export const dynamic = 'force-dynamic';

/**
 * ★★★**정산관리 — 판 셋: 묶음 | 실적 줄 | 접수 상세** (대표 2026-09-18 · WORK-INBOX §14-0 「화면 = 같은 판의 배열」)
 *   「정산은 정산 특화」 — 새로 그리지 않고 계약접수와 «같은 판»을 배열했다:
 *   · 왼쪽  = 목록 판 규격(머리 + 건수 · 검색창 · 퀵 단추 · 목록 한 줄) — 공급사(청구) / 영업채널(지급) 묶음
 *   · 가운데 = 목록 판 규격 — 고른 묶음의 실적 줄(+ 환수 줄)
 *   · 오른쪽 = 접수 상세 판(계약접수와 «같은 부품» IntakeDetailPanel) — 줄을 누르면 여기 선다
 *   ★절대 법칙 — 줄을 눌러도 쪽을 안 옮긴다(앞서 실적 줄이 /intake/[code] 로 넘어갔다). 주소 `?g=묶음&ic=접수코드`.
 *
 * 셈은 기능 쪽 그대로(ledgers · stage — 완납·인도 기준 청구·지급, 대표 2026-09-18):
 *   · 금액 = line.amount(끊긴 분납은 받은 만큼) · 묶음 합 = g.net(합 − 환수) · 달 = ledgerMonths(환수 달 포함)
 *   · 「청구월 미정」(NO_MONTH) — 인도됐는데 셈한 달이 이미 닫혀 못 들어간 줄. ★사람이 달을 정할 자리 — 붉게.
 *   · 끊김 — 줄마다 「끊김 · 받은 몫 50%」.
 * ★정산 생애주기(기능 lifecycle · 대표 「기능은 SSOT·코딩으로, 배열은 디자인이 그 기준으로」) — 주 걸음은 «하단바»(§14-3):
 *   가운데 묶음 판 = [청구서/지급명세 발행] · 오른쪽 접수 상세 = 그 줄의 다음 걸음(확인 · 정정 · 수금/지급). 곁 걸음(보류 · 청구월 · 계산서)은 본문.
 *   ⚠ 운영 원장에 바로 쓴다 — 모양 확인 때 누르지 않는다.
 */
export default async function SettlementPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await props.searchParams;
  /* PC = ERP 표준 화면(DEC-2026-09-23-01), 폰 = 기존 판 — CSS(_erp/shell.css)가 폭으로 가른다 */
  return <><SettlementScreen q={q} /><SettlementBoards searchParams={props.searchParams} /></>;
}

async function SettlementBoards({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const requestedTab = sp(q.tab) === 'pay' ? 'pay' : 'claim';

  let all: Awaited<ReturnType<typeof settlements.list>>;
  let cb: Awaited<ReturnType<typeof settlements.clawbacks>>;
  try { [all, cb] = await Promise.all([settlements.list(), settlements.clawbacks()]); }
  catch (e) { return <><h1>정산관리</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>; }
  const rows = all.map((x) => x.row);
  const focusCode = sp(q.focus).trim();
  const focus = focusCode ? locateSettlementFocus(rows, cb, focusCode, requestedTab) : null;
  const focusMiss = !!focusCode && !focus;
  const tab = focus?.tab ?? requestedTab;

  const months = ledgerMonths(rows, cb);
  /* ★처음 여는 달 = 이번 달까지 중 가장 최근(앞날 청구월이 적힌 줄이 있어 «맨 위»를 고르면 엉뚱한 달이 열린다) */
  const now = today().slice(0, 7);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  const month = focus?.month || sp(q.month) || 달들.find((m) => m <= now) || 달들[0] || NO_MONTH;
  const groups = tab === 'claim' ? claimLedger(rows, month, cb) : payLedger(rows, month, cb);
  const t = ledgerTotals(groups);
  const who = tab === 'claim' ? '공급사' : '영업채널';
  const 미정 = months.includes(NO_MONTH) ? (tab === 'claim' ? claimLedger(rows, NO_MONTH, cb) : payLedger(rows, NO_MONTH, cb)) : [];
  const 미정수 = 미정.reduce((n, g) => n + g.lines.length, 0);

  const gq = sp(q.gq).trim();
  const gs = focus ? 'all' : ((['all', 'issue', 'todo', 'done'] as const).includes(sp(q.gs) as LedgerGroupFilter)
    ? sp(q.gs) as LedgerGroupFilter : 'all');
  const shownGroups = filterLedgerGroups(groups, gs, gq);
  const groupCount = (mode: LedgerGroupFilter) =>
    mode === 'all' ? groups.length : groups.filter((g) => ledgerGroupAttention(g) === mode).length;
  const gSel = shownGroups.find((g) => g.party === (focus?.party ?? sp(q.g))) ?? shownGroups[0];
  const nextGroupParty = gSel ? nextActionableLedgerParty(groups, gSel.party) : null;
  const ic = focus?.code ?? sp(q.ic);

  /* 실적 줄 찾기 — 판정은 domain/performance-filter 한 곳에서만 한다. */
  const lq = sp(q.lq).trim();
  const ls = focus ? 'all' : ((['all', 'todo', 'issue', 'done'] as const).includes(sp(q.ls) as PerformanceFilterMode)
    ? sp(q.ls) as PerformanceFilterMode : 'todo');
  const perfAxis: Axis = tab === 'claim' ? '공급사' : '영업채널';
  const performanceLines = filterPerformanceLines(gSel?.lines ?? [], perfAxis, ls, lq);
  const performanceCount = (mode: PerformanceFilterMode) =>
    (gSel?.lines ?? []).filter((x) => performanceMatchesMode(x, perfAxis, mode)).length;
  const nextPerformanceCode = ic ? nextActionablePerformanceCode(gSel?.lines ?? [], perfAxis, ic, lq) : null;
  const shownClawbacks = (gSel?.clawbacks ?? []).filter((x) =>
    (ls === 'all' || ls === 'issue')
    && (!lq || [x.plate, x.reason, x.month].filter(Boolean).join(' ').toLowerCase().includes(lq.toLowerCase())));
  /* ── 발행 — 고른 묶음(한 달 · 한 상대)의 청구서/지급명세. 미리보기 = 기능 쪽 planInvoice 그대로(발행과 같은 셈) ── */
  const axis: Axis = perfAxis;
  const 장부 = month !== NO_MONTH ? await settlements.invoices(month).catch(() => []) : [];
  const 장 = gSel ? 장부.find((x) => x.axis === axis && x.party === gSel.party) ?? null : null;
  const 계획 = gSel ? planInvoice(month, axis, gSel.party, gSel.lines, cb, 장, 장부.map((x) => x.invoiceNo), Date.now(), '미리보기') : null;
  const 어긋남 = 계획?.ok ? driftOf(장, { supply: 계획.invoice.supply, vat: 계획.invoice.vat, lines: 계획.invoice.lines }) : null;
  const 문서 = tab === 'claim' ? '청구서' : '지급명세';
  const view = focus ? 'work' : ((['list', 'detail', 'work'] as const).find((v) => v === sp(q.v)) ?? (ic ? 'work' : sp(q.g) ? 'detail' : 'list'));

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    u.delete('focus');
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    return `/settlement?${u}`;
  };
  /* 달 넘기기 — ‹ 앞 달 · 뒤 달 › (달 단추를 줄줄이 세우지 않는다) */
  const i = 달들.indexOf(month);
  const 앞달 = i >= 0 ? 달들[i + 1] : 달들[0];
  const 뒤달 = i > 0 ? 달들[i - 1] : undefined;
  const 달로 = (m: string) => keep({ month: m, g: '', ic: '', v: 'list' });
  /** 실적 줄의 상태 칸 — 그 축의 걸음(접수 → 청구/통보 → 확인 → 수금/지급) · 곁길(보류 · 정정 · 끊김) */
  const 줄상태 = (stage: string, hold: boolean, broken: boolean): RowStatus =>
    hold ? { icon: 'pause', label: '보류', tone: 'amber' }
      : stage === '정정' ? { icon: 'alert', label: '정정', tone: 'red' }
        : broken ? { icon: 'alert', label: '끊김', tone: 'red' }
          : stage === '수금' || stage === '지급' ? { icon: 'circle-check', label: stage, tone: 'green' }
            : stage === '확인' ? { icon: 'shield-check', label: '확인', tone: 'navy' }
              : stage === '청구' || stage === '통보' ? { icon: 'send', label: stage, tone: 'navy' }
                : { icon: 'clipboard', label: '접수', tone: 'grey' };
  const 금액 = (n: number | null | undefined) => (n === null || n === undefined ? '금액 모름' : `${won(n)}원`);
  const 묶음상태 = (g: (typeof groups)[number]): RowStatus => {
    if (month === NO_MONTH) return { icon: 'alert', label: '미정', tone: 'red' };
    const attention = ledgerGroupAttention(g);
    if (attention === 'issue') return { icon: 'alert', label: '이슈', tone: 'red' };
    if (attention === 'done') return { icon: 'circle-check', label: '완료', tone: 'green' };
    return g.done > 0
      ? { icon: 'clock', label: `${g.done}/${g.lines.length}`, tone: 'navy' }
      : { icon: 'clock', label: '대기', tone: 'navy' };
  };
  const 묶음톤 = (g: (typeof groups)[number]) => {
    const attention = ledgerGroupAttention(g);
    return attention === 'issue' ? 'warn' as const : attention === 'todo' ? 'act' as const : 'plain' as const;
  };

  return (
    <>
      <section className="workspace" data-phone={view} data-mode="settle">
        {/* ── 묶음 — 공급사(청구) / 영업채널(지급) ─────────────────── */}
        <section className="panel product-panel" data-panel-role="list">
          <div className="dz-listtop">
            {focusMiss && (
              <Notice tone="warn">
                이 접수는 지금 {tab === 'claim' ? '청구' : '지급'} 원장에 설 수 없습니다.{' '}
                <Link href={`/intake?ic=${encodeURIComponent(focusCode)}&v=work`}>접수 상세에서 막힘 확인</Link>
              </Notice>
            )}
            <PanelHeader title={tab === 'claim' ? '청구목록' : '지급목록'} count={`${groups.length}곳 · ${t.rows}줄`} />
            <form className="dz-find" action="/settlement">
              <input type="hidden" name="tab" value={tab} /><input type="hidden" name="month" value={month} /><input type="hidden" name="gs" value={gs} />
              <div className="searchbox dz-searchbox">
                <SearchField name="gq" defaultValue={sp(q.gq)} placeholder={`${who} 이름`} />
              </div>
            </form>
            <div className="quick-filters">
              <Link className={tab === 'claim' ? 'active' : ''} href={keep({ tab: 'claim', g: '', ic: '' })}>청구 · 공급사</Link>
              <Link className={tab === 'pay' ? 'active' : ''} href={keep({ tab: 'pay', g: '', ic: '' })}>지급 · 영업채널</Link>
              <Link className={gs === 'all' ? 'active' : ''} href={keep({ gs: 'all', g: '', ic: '', v: 'list' })}>전체 <small>{groupCount('all')}</small></Link>
              <Link className={gs === 'issue' ? 'active warn' : 'warn'} href={keep({ gs: 'issue', g: '', ic: '', v: 'list' })}>이슈 <small>{groupCount('issue')}</small></Link>
              <Link className={gs === 'todo' ? 'active' : ''} href={keep({ gs: 'todo', g: '', ic: '', v: 'list' })}>미처리 <small>{groupCount('todo')}</small></Link>
              <Link className={gs === 'done' ? 'active' : ''} href={keep({ gs: 'done', g: '', ic: '', v: 'list' })}>완료 <small>{groupCount('done')}</small></Link>
              {미정수 > 0 && (
                <Link className={`${month === NO_MONTH ? 'active ' : ''}warn`} href={달로(NO_MONTH)}>{NO_MONTH} <small>{미정수}</small></Link>
              )}
            </div>
            {/* 달 — ‹ 앞 달 | 2026-09 | 뒤 달 › · 합 */}
            <div className="dz-month">
              {앞달 && month !== NO_MONTH ? <Link href={달로(앞달)} aria-label="앞 달">‹</Link> : <span />}
              <b>{month}</b>
              {뒤달 && month !== NO_MONTH ? <Link href={달로(뒤달)} aria-label="뒤 달">›</Link> : <span />}
              <span className="dz-month-sum">
                {tab === 'claim' ? '청구' : '지급'} <b>{won(t.net)}원</b>
                {t.clawback ? <small> · 환수 −{won(t.clawback)}</small> : null}
                {t.unknown ? <small className="dz-warn-txt"> · 금액 모름 {t.unknown}</small> : null}
              </span>
            </div>
            {month === NO_MONTH && <Notice tone="warn">인도됐는데 셈한 달이 이미 닫힌(청구서 나간) 달이라 못 들어간 줄입니다 — 사람이 달을 정해야 합니다.</Notice>}
          </div>
          <div className="list">
            {shownGroups.map((g) => {
              const 위험 = [
                g.unknown ? `금액 모름 ${g.unknown}` : '',
                g.hold ? `보류 ${g.hold}` : '',
                g.broken ? `끊김 ${g.broken}` : '',
                g.clawbacks.length ? `환수 ${g.clawbacks.length}` : '',
              ].filter(Boolean);
              const 위험표시 = 위험.length > 2 ? `${위험.slice(0, 2).join(' · ')} · 외 ${위험.length - 2}` : 위험.join(' · ');
              return (
                <ListRow key={g.party} href={keep({ g: g.party, ic: '', v: 'detail' })} selected={g.party === gSel?.party}
                  status={묶음상태(g)}
                  title={g.party} mainValue={`정산 ${won(g.net)}원`}
                  badge={`${tab === 'claim' ? '청구서' : '지급 통보'} ${g.done}/${g.lines.length}`}
                  tone={묶음톤(g)}
                  meta={`${tab === 'claim' ? '청구서' : '지급 통보'} ${g.done}/${g.lines.length}`}
                  value={위험표시 || `완료 ${g.completed}/${g.lines.length}`} />
              );
            })}
            {shownGroups.length === 0 && <EmptyState>이 달에 선 {who}가 없습니다.</EmptyState>}
          </div>
        </section>

        {/* ── 실적 줄 — 고른 묶음 ─────────────────────────────── */}
        <section className="panel detail-panel st-lines" data-panel-role="list">
          <div className="dz-listtop">
            <PanelHeader title={gSel ? gSel.party : '실적 줄'} count={gSel ? `${performanceLines.length} / ${gSel.lines.length}줄` : undefined}
              backHref={keep({ v: 'list' })} backLabel="묶음으로" />
            {gSel && (
              <>
                <form className="dz-find" action="/settlement">
                  <input type="hidden" name="tab" value={tab} />
                  <input type="hidden" name="month" value={month} />
                  <input type="hidden" name="g" value={gSel.party} />
                  <input type="hidden" name="ls" value={ls} />
                  <input type="hidden" name="v" value="detail" />
                  <div className="searchbox dz-searchbox">
                    <SearchField name="lq" defaultValue={sp(q.lq)} placeholder="고객 · 차량번호 · 차량 · 담당자" />
                  </div>
                </form>
                <div className="quick-filters">
                  <Link className={ls === 'todo' ? 'active' : ''} href={keep({ ls: 'todo', ic: '', v: 'detail' })}>할 일 <small>{performanceCount('todo')}</small></Link>
                  <Link className={ls === 'issue' ? 'active' : ''} href={keep({ ls: 'issue', ic: '', v: 'detail' })}>이슈 <small>{performanceCount('issue')}</small></Link>
                  <Link className={ls === 'done' ? 'active' : ''} href={keep({ ls: 'done', ic: '', v: 'detail' })}>완료 <small>{performanceCount('done')}</small></Link>
                  <Link className={ls === 'all' ? 'active' : ''} href={keep({ ls: 'all', ic: '', v: 'detail' })}>전체 <small>{performanceCount('all')}</small></Link>
                </div>
              </>
            )}
            {gSel && (
              <SummaryGrid>
                <SummaryItem label="합">{won(gSel.total)}원</SummaryItem>
                <SummaryItem label="환수">{gSel.clawbackTotal ? `−${won(gSel.clawbackTotal)}원` : '—'}</SummaryItem>
                <SummaryItem label={tab === 'claim' ? '청구할 돈' : '줄 돈'}><b>{won(gSel.net)}원</b></SummaryItem>
                <SummaryItem label={tab === 'claim' ? '청구서 보냄' : '지급 통보'}>{gSel.done} / {gSel.lines.length}</SummaryItem>
                <SummaryItem label={tab === 'claim' ? '수금 완료' : '지급 완료'}><b>{gSel.completed} / {gSel.lines.length}</b></SummaryItem>
              </SummaryGrid>
            )}
            {/* 발행 — 번호 · 미리보기(공급가 · 부가세 · 합계) · 막힌 까닭 · 발행 뒤 원장이 바뀜 */}
            {gSel && 계획 && (
              <div className="dz-issue">
                <p><b>{문서}</b> {장 ? <>{장.invoiceNo} · 발행 {new Date(장.issuedAt).toISOString().slice(0, 10)}</> : <span className="dz-muted">아직 안 나감</span>}</p>
                {계획.ok
                  ? <p className="dz-issue-sum">공급가 {won(계획.invoice.supply)} · 부가세 {won(계획.invoice.vat)} · <b>합계 {won(계획.invoice.total)}원</b>{계획.invoice.clawback ? ` (환수 −${won(계획.invoice.clawback)})` : ''}</p>
                  : <Notice tone="warn">{계획.error}</Notice>}
                {어긋남 && <Notice tone="warn">{어긋남} — 다시 발행하면 같은 번호로 새 합계가 섭니다.</Notice>}
                <IssueForm id="issue-form" month={month} axis={axis} party={gSel.party} />
                {장 && <ClaimLink month={month} axis={axis} party={gSel.party}
                  live={!!장.linkCreatedAt && !장.linkRevokedAt} openCount={장.openCount} openedAt={장.openedAt}
                  failCount={장.failCount} locked={!!장.lockedUntil && 장.lockedUntil > Date.now()} lockedUntil={장.lockedUntil} response={장.response ?? null} />}
              </div>
            )}
          </div>
          <div className="list">
            {performanceLines.map(({ row: r, amount, broken, ratio }) => {
              const 끝 = tab === 'claim' ? r.progress.collected : r.progress.paid;
              return (
                <ListRow key={r.id} href={keep({ g: gSel?.party ?? '', ic: r.id, v: 'work' })} selected={r.id === ic}
                  status={줄상태(tab === 'claim' ? r.claimStage : r.payStage, r.progress.billHold && tab === 'claim', broken)}
                  title={txt(r.customer)}
                  mainValue={tab === 'claim'
                    ? `청구 수수료 ${r.money.claim === null ? '—' : `${won(r.money.claim)}원`}`
                    : `지급 수수료 ${r.money.pay === null ? '—' : `${won(r.money.pay)}원`}`}
                  badge={r.progress.billHold ? '보류' : (tab === 'claim' ? r.claimStage : r.payStage)}
                  tone={r.progress.billHold || !끝 ? 'act' : 'plain'}
                  meta={[r.plate, r.model, r.product, r.term ? `${r.term}개월` : ''].filter(Boolean).join(' · ') || '—'}
                  value={tab === 'claim'
                    ? `지급 수수료 ${r.money.pay === null ? '—' : `${won(r.money.pay)}원`}`
                    : `청구 수수료 ${r.money.claim === null ? '—' : `${won(r.money.claim)}원`}`} />
              );
            })}
            {/* 환수 — 접수 줄의 체크가 아니라 «반대 부호의 한 줄»(기능 세션) */}
            {shownClawbacks.map((c, k) => (
              <div key={`환수-${k}`} className="dz-row dz-row-minus">
                <StatusTile s={{ icon: 'repeat', label: '환수', tone: 'red' }} />
                <span className="dz-row-body">
                  <span className="dz-row-l1" data-line-role="main"><b>환수 · {c.plate}</b></span>
                  <span className="dz-row-l2" data-line-role="key">{c.reason || '—'} · {c.at?.slice(0, 10)}</span>
                  <span className="dz-row-l3" data-line-role="support"><strong>−{won(tab === 'claim' ? c.supplierAmt : c.agentAmt)}원</strong><small>{c.month}</small></span>
                </span>
              </div>
            ))}
            {!gSel && <EmptyState>왼쪽에서 {who}를 고르면 그 실적 줄이 여기 섭니다.</EmptyState>}
            {gSel && performanceLines.length === 0 && shownClawbacks.length === 0 && <EmptyState>이 검색/상태에 맞는 실적이 없습니다.</EmptyState>}
          </div>
          {/* ★하단바(§14-3) — 묶음 판의 주 걸음 = 발행. 막혔으면(청구월 미정 · 금액 모름 · 정정 중) 눌리지 않는다 */}
          {gSel && (
            <ActionBar>
              <button type="submit" form="issue-form" className="primary" disabled={!계획?.ok}>
                {장 ? `다시 발행 · ${장.invoiceNo}` : `${문서} 발행`}
              </button>
            </ActionBar>
          )}
        </section>

        {/* ── 접수 상세 — 계약접수와 같은 판 ─────────────────── */}
        <section className="panel work-panel" data-panel-role="work">
          {ic
            ? <IntakeDetailPanel code={ic} back={keep({ ic: '', lc: '', v: 'detail' })}
                life={{ axis, mode: sp(q.lc), link: (lc: string) => keep({ lc, v: 'work' }), nextHref: nextPerformanceCode ? keep({ ic: nextPerformanceCode, lc: '', ls: 'all', v: 'work' }) : undefined, nextGroupHref: !nextPerformanceCode && nextGroupParty ? keep({ g: nextGroupParty, ic: '', lc: '', ls: 'todo', v: 'detail' }) : undefined, invoiceBiz: 장?.partyBizNo }} />
            : (
              <>
                <PanelHeader title="접수 상세" backHref={keep({ v: 'detail' })} backLabel="실적으로" />
                <EmptyState>가운데 실적 줄을 누르면 그 접수의 진행 · 금액 · 원자 전부가 여기 섭니다.</EmptyState>
                <EmptyState>청구서·지급명세는 가운데 묶음에서 발행하고, 실적 줄을 고르면 확인·정정·계산서·수금·지급을 오른쪽에서 이어서 처리합니다.</EmptyState>
              </>
            )}
        </section>
      </section>

    </>
  );
}
