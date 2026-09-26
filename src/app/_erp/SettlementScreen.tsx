/**
 * PC 정산관리 — 판 셋: 청구목록(왼쪽) | 정산상세(가운데) | 지급목록(오른쪽) (§5-4, 대표 2026-09-24
 *   「정산관리는 왼쪽 패널에다가 청구, 가운데 상세, 오른쪽에 지급이야. 다 목록이니까 목록 쓰면 되고,
 *   목록 규격」). 청구·지급을 한 판 안 탭으로 가르던 것(정산묶음)을 걷어내고, 실적 화면(분납실적|
 *   실적상세|완납실적)과 같은 결로 둘을 늘 같이 보이는 목록 판 둘로 나눈다 — 목록 판은 전부 compact +
 *   SearchBar(§5-1)로 같은 틀이다. 가운데는 상세내용 kind(목록이 아니라 compact 가 없다) — 고른 묶음의
 *   정산상세(총 · 환수 · 순액 · 발행) + 그 줄들을 보여준다. 줄을 누르면 route를 벗어나지 않고
 *   같은 가운데 Panel이 공용 SettlementDetail로 전환된다. 월·거래처·청구/지급 축은 URL focus/g/tab으로 유지한다.
 *   셈은 기능 쪽 그대로(claimLedger · payLedger — 완납 · 인도 기준, 끊긴 분납은 받은 만큼).
 *   발행은 기능 쪽 IssueForm 그대로 — ⚠ 운영 원장에 쓴다(쓰기 꺼짐 · 가상 데이터에서는 저장되지 않는다).
 */
import type { ReactNode } from 'react';
import { settlements, today } from '../../server/erp5';
import type { SettlementRow } from '../../domain/settlement/types';
import {
  claimLedger, ledgerGroupAttention, ledgerMonths, locateSettlementFocus, nextActionableLedgerParty, NO_MONTH, payLedger,
  type Clawback, type LedgerGroup, type LedgerGroupFilter,
} from '../../domain/settlement/ledgers';
import { sp, txt } from '../_fn/fmt';
import { IssueForm } from '../settlement/LifeForms';
import {
  hrefWith, Panel, PanelBody, PanelFoot, PanelHead, PanelState, QuickFilter, RowCard, RowCards, Screen, SearchBar, won0, type Facet, type Tone,
} from './parts';
import { AutoSelect } from './AutoSelect';
import { SettlementDetail } from './SettlementDetail';
import { nextActionablePerformanceCode } from '../../domain/settlement/performance-filter';
import { settlementGroupSignal, settlementGroupSupport, settlementLineSignal, type SettlementSignal, type SettlementSignalTone } from '../settlement/group-signal';

type Q = Record<string, string | string[] | undefined>;
const CLAIM_FLOW = ['접수', '청구', '정정', '확인', '수금'];
const PAY_FLOW = ['접수', '통보', '정정', '확인', '지급'];
const SIGNAL_TONE: Record<SettlementSignalTone, Tone> = {
  neutral: 'neutral', info: 'info', warning: 'warn', error: 'err', success: 'ok',
};
/** 상태 visual은 shared signal의 label/tone을 그대로 쓰고, glyph만 ERP shell에 맞춘다. */
const SIGNAL_ICON_PATH: Record<SettlementSignalTone, ReactNode> = {
  error: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></>,
  warning: <><circle cx="12" cy="12" r="10" /><path d="M9.5 9v6M14.5 9v6" /></>,
  success: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  neutral: <><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></>,
};
function SignalIcon({ signal }: { signal: SettlementSignal }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{SIGNAL_ICON_PATH[signal.tone]}</svg>;
}

export async function SettlementScreen({ q, base = '/settlement' }: { q: Q; base?: string }) {
  let rows: SettlementRow[]; let cb: Clawback[];
  try { const [all, c] = await Promise.all([settlements.list(), settlements.clawbacks()]); rows = all.map((x) => x.row); cb = c; }
  catch {
    return (
      <Screen name="settlement-workspace">
        <div className="erp-workspace">
          <Panel compact>
            <PanelHead kind="상태" title="정산관리" count="읽기 실패" />
            <PanelBody>
              <PanelState kind="error" title="정산 데이터를 불러오지 못했습니다.">
                잠시 후 다시 시도해 주세요. 계속 실패하면 데이터 연결 상태를 확인해 주세요.
              </PanelState>
            </PanelBody>
          </Panel>
        </div>
      </Screen>
    );
  }

  const nowMonth = today().slice(0, 7);
  const requestedTab: 'claim' | 'pay' = sp(q.tab) === 'pay' ? 'pay' : 'claim';
  const focusId = sp(q.focus).trim();
  const focus = focusId ? locateSettlementFocus(rows, cb, focusId, requestedTab) : null;
  const months = ledgerMonths(rows, cb);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  const month = focus?.month || sp(q.month) || 달들.find((m) => m <= nowMonth) || 달들[0] || NO_MONTH;
  const claimG = claimLedger(rows, month, cb), payG = payLedger(rows, month, cb);

  /*
   * 목록 판 규격 — 검색창(+필터 버튼) → 퀵 필터 → 목록, 예외 없이(대표 2026-09-24 「검색창 옆에 또
   * 필터 없잖아 제발 좀 규격통일 좀 해라 전수조사해」). 퀵 필터(정산 상태)는 새로 짓지 않고 이미
   * 있던 유틸(ledgerGroupAttention — 예전 폰 SettlementBoards 의 gs 상태 그대로)을 청구 · 지급 각자의
   * 파라미터(cgs/pgs)로 재사용한다. 검색창 옆 필터 버튼은 그 묶음(공급사/영업채널)이 다루는 상품구분
   * — 이름은 이미 검색창이 걸러 주니, 겹치지 않는 축으로 상품구분을 쓴다(ProductsScreen 의 facets 와
   * 같은 결, 여기서는 «그 묶음의 줄 중 하나라도 그 상품구분이면» 걸린다).
   */
  const cq = sp(q.cq).trim().toLowerCase();
  const pq = sp(q.pq).trim().toLowerCase();
  const cgs: LedgerGroupFilter = (['issue', 'todo', 'done'] as const).includes(sp(q.cgs) as never) ? sp(q.cgs) as LedgerGroupFilter : 'all';
  const pgs: LedgerGroupFilter = (['issue', 'todo', 'done'] as const).includes(sp(q.pgs) as never) ? sp(q.pgs) as LedgerGroupFilter : 'all';
  const ckind = sp(q.ckind);
  const pkind = sp(q.pkind);
  const groupKinds = (g: LedgerGroup) => [...new Set(g.lines.map((l) => l.row.product).filter((v): v is string => !!v))];
  const claimPass = (g: LedgerGroup, skip?: 'cgs' | 'ckind') =>
    (!cq || g.party.toLowerCase().includes(cq))
    && (skip === 'cgs' || cgs === 'all' || ledgerGroupAttention(g) === cgs)
    && (skip === 'ckind' || !ckind || groupKinds(g).includes(ckind));
  const payPass = (g: LedgerGroup, skip?: 'pgs' | 'pkind') =>
    (!pq || g.party.toLowerCase().includes(pq))
    && (skip === 'pgs' || pgs === 'all' || ledgerGroupAttention(g) === pgs)
    && (skip === 'pkind' || !pkind || groupKinds(g).includes(pkind));
  const shownClaim = claimG.filter((g) => claimPass(g));
  const shownPay = payG.filter((g) => payPass(g));
  const claimCount = (mode: LedgerGroupFilter) => claimG.filter((g) => claimPass(g, 'cgs') && (mode === 'all' || ledgerGroupAttention(g) === mode)).length;
  const payCount = (mode: LedgerGroupFilter) => payG.filter((g) => payPass(g, 'pgs') && (mode === 'all' || ledgerGroupAttention(g) === mode)).length;
  const claimKindFacet: Facet = {
    key: 'ckind', title: '상품구분',
    options: [...new Set(claimG.flatMap(groupKinds))].sort()
      .map((v) => ({ value: v, count: claimG.filter((g) => claimPass(g, 'ckind') && groupKinds(g).includes(v)).length })),
  };
  const payKindFacet: Facet = {
    key: 'pkind', title: '상품구분',
    options: [...new Set(payG.flatMap(groupKinds))].sort()
      .map((v) => ({ value: v, count: payG.filter((g) => payPass(g, 'pkind') && groupKinds(g).includes(v)).length })),
  };

  /* 고른 묶음 — focus로 들어오면 같은 달·상대·축을 복원하고, 아니면 g 선택을 따른다. */
  const gp = focus?.party ?? sp(q.g);
  const claimSel = (focus?.tab === 'claim' || !focus) ? claimG.find((g) => g.party === gp) : undefined;
  const paySel = (focus?.tab === 'pay' || (!focus && !claimSel)) ? payG.find((g) => g.party === gp) : undefined;
  const gSel = claimSel ?? paySel;
  const tab: 'claim' | 'pay' = focus?.tab ?? (claimSel ? 'claim' : paySel ? 'pay' : requestedTab);
  const who = tab === 'claim' ? '공급사' : '영업채널';
  const 문서 = tab === 'claim' ? '청구서' : '지급명세';
  const axis = tab === 'claim' ? '공급사' as const : '영업채널' as const;
  const focusedLine = focus?.code && gSel ? gSel.lines.find((x) => x.row.id === focus.code) : undefined;
  const nextPerformanceCode = focusedLine && gSel ? nextActionablePerformanceCode(gSel.lines, axis, focusedLine.row.id) : null;
  const nextGroupParty = gSel ? nextActionableLedgerParty(tab === 'claim' ? claimG : payG, gSel.party) : null;
  const claimAxisComplete = tab === 'claim' && claimG.every((g) => ledgerGroupAttention(g) === 'done');
  const nextPayParty = claimAxisComplete ? nextActionableLedgerParty(payG, '') : null;

  const 장부 = gSel && month !== NO_MONTH ? await settlements.invoices(month).catch(() => []) : [];
  const 장 = gSel ? 장부.find((x) => x.axis === axis && x.party === gSel.party) ?? null : null;

  const list = (title: string, items: LedgerGroup[], name: string, side: 'claim' | 'pay') => items.length ? (
    <RowCards label={`${title} 목록`}>
      {items.map((g) => {
        const signal = settlementGroupSignal(g, side, month === NO_MONTH);
        return (
          <RowCard key={g.party} href={hrefWith(base, q, { g: g.party, focus: null, lc: null, tab: side })} current={g.party === gSel?.party}
            tone={SIGNAL_TONE[signal.tone]} thumb={<><SignalIcon signal={signal} /><span>{signal.label}</span></>} thumbStatus
            title={g.party}
            sub={`${name} ${g.done}/${g.lines.length}`}
            meta={settlementGroupSupport(g, side)}
            facts={[[name, `${g.done}/${g.lines.length}`], ['완료', `${g.completed}/${g.lines.length}`]]}
            amount={`정산 ${won0(g.net)}원`} unit="" />
        );
      })}
    </RowCards>
  ) : <PanelState title={`${title}할 거래처가 없습니다.`}>선택한 정산월·검색·필터 조건을 확인해 주세요.</PanelState>;

  return (
    <Screen name="settlement-workspace">
    <div className="erp-workspace">
      <Panel compact>
        <PanelHead kind="목록" title="청구목록" count={`${claimG.length}곳`} />
        <SearchBar base={base} q={q} name="cq" placeholder="공급사 이름" facets={[claimKindFacet]} keep={['month', 'cgs']} />
        {/* 상태 QuickFilter 업무 항목은 미확정. 정산월 + 전체/미처리 예시만 유지한다. */}
        <QuickFilter label="정산 상태" dropdown={<AutoSelect name="month" value={month} label="정산월" options={months.map((m) => [m, m])} />} items={[
          { key: 'all', label: `전체 ${claimCount('all')}`, href: hrefWith(base, q, { cgs: null }), on: cgs === 'all' },
          { key: 'todo', label: `미처리 ${claimCount('todo')}`, href: hrefWith(base, q, { cgs: 'todo' }), on: cgs === 'todo' },
        ]} />
        <PanelBody>{list('청구', shownClaim, '청구서', 'claim')}</PanelBody>
      </Panel>

      <Panel>
        {focusedLine && gSel ? (
          <SettlementDetail cur={focusedLine.row} base={base} q={q} now={new Date(`${today()}T12:00:00+09:00`)}
            life={{
              axis,
              mode: sp(q.lc),
              link: (mode: string) => hrefWith(base, q, { g: gSel.party, focus: focusedLine.row.id, lc: mode || null, tab }),
              backHref: hrefWith(base, q, { g: gSel.party, focus: null, lc: null, tab }),
              nextHref: nextPerformanceCode ? hrefWith(base, q, { g: gSel.party, focus: nextPerformanceCode, lc: null, tab }) : undefined,
              nextGroupHref: !nextPerformanceCode && nextGroupParty ? hrefWith(base, q, { g: nextGroupParty, focus: null, lc: null, tab }) : undefined,
              nextAxisHref: !nextPerformanceCode && !nextGroupParty && nextPayParty
                ? hrefWith(base, q, { g: nextPayParty, focus: null, lc: null, tab: 'pay' }) : undefined,
              nextAxisLabel: '지급 업무로',
              invoiceBiz: 장?.partyBizNo,
            }} />
        ) : gSel ? (
          <>
            <PanelHead kind="상세내용" title={gSel.party} count={`${who} · ${month}`} />
            <PanelBody>
              <IssueForm id="erp-issue-form" month={month} axis={axis} party={gSel.party} />
              <div className="erp-tile">
                <h3 className="erp-tile-title">정산 요약</h3>
                <div className="erp-tile-group">
                  <div className="erp-tile-row"><b>합</b><strong>{won0(gSel.total)}원</strong></div>
                  <div className="erp-tile-row"><b>환수</b><strong>{gSel.clawbackTotal ? `−${won0(gSel.clawbackTotal)}원` : '—'}</strong></div>
                  <div className="erp-tile-row"><b>정산액</b><strong>{won0(gSel.net)}원</strong></div>
                  <div className="erp-tile-row"><b>{문서} 보냄</b><strong>{gSel.done} / {gSel.lines.length}</strong></div>
                  <div className="erp-tile-row"><b>완료</b><strong>{gSel.completed} / {gSel.lines.length}</strong></div>
                </div>
              </div>
              <RowCards label="실적 줄">
                {gSel.lines.map(({ row: r, broken, ratio }) => {
                  const flow = tab === 'claim' ? CLAIM_FLOW : PAY_FLOW;
                  const st = tab === 'claim' ? r.claimStage : r.payStage;
                  const at = st === flow[flow.length - 1] ? flow.length : flow.indexOf(st);
                  const signal = settlementLineSignal(st, { hold: tab === 'claim' && r.progress.billHold, broken });
                  return (
                    <RowCard key={r.id} href={hrefWith(base, q, { g: gSel.party, focus: r.id, lc: null, tab })} tone={SIGNAL_TONE[signal.tone]}
                      thumb={<><SignalIcon signal={signal} /><span>{signal.label}</span></>} thumbStatus
                      title={txt(r.customer)}
                      subId={txt(r.plate)} sub={`${txt(r.model)} · ${txt(r.product)} · ${r.term ?? '—'}개월`} steps={{ labels: flow, at }}
                      meta={tab === 'claim'
                        ? `지급 수수료 ${r.money.pay === null ? '—' : `${won0(r.money.pay)}원`}`
                        : `청구 수수료 ${r.money.claim === null ? '—' : `${won0(r.money.claim)}원`}`}
                      facts={[
                        ['상품 · 기간', txt(r.product), `${r.term ?? '—'}개월`],
                        ['결제', txt(r.payKind), broken ? `끊김 · 받은 몫 ${Math.round(ratio * 100)}%` : undefined],
                      ]}
                      amount={tab === 'claim'
                        ? `청구 수수료 ${r.money.claim === null ? '—' : `${won0(r.money.claim)}원`}`
                        : `지급 수수료 ${r.money.pay === null ? '—' : `${won0(r.money.pay)}원`}`}
                      unit="" />
                  );
                })}
              </RowCards>
            </PanelBody>
            <PanelFoot>
              <span>{month} · <b>{gSel.net.toLocaleString('ko-KR')}</b>원</span>
              <button className="erp-btn erp-btn--primary" type="submit" form="erp-issue-form">
                {장 ? `다시 발행 · ${장.invoiceNo}` : `${문서} 발행`}
              </button>
            </PanelFoot>
          </>
        ) : (
          <>
            <PanelHead kind="상세내용" title="정산상세" count="묶음 선택" />
            <PanelBody><PanelState title="정산 거래처를 선택해 주세요.">왼쪽 청구목록 또는 오른쪽 지급목록에서 거래처를 고르면 가운데에 정산 요약이 표시됩니다.</PanelState></PanelBody>
          </>
        )}
      </Panel>

      <Panel compact>
        <PanelHead kind="목록" title="지급목록" count={`${payG.length}곳`} />
        <SearchBar base={base} q={q} name="pq" placeholder="영업채널 이름" facets={[payKindFacet]} keep={['month', 'pgs']} />
        {/* 상태 QuickFilter 업무 항목은 미확정. 정산월 + 전체/미처리 예시만 유지한다. */}
        <QuickFilter label="정산 상태" dropdown={<AutoSelect name="month" value={month} label="정산월" options={months.map((m) => [m, m])} />} items={[
          { key: 'all', label: `전체 ${payCount('all')}`, href: hrefWith(base, q, { pgs: null }), on: pgs === 'all' },
          { key: 'todo', label: `미처리 ${payCount('todo')}`, href: hrefWith(base, q, { pgs: 'todo' }), on: pgs === 'todo' },
        ]} />
        <PanelBody>{list('지급', shownPay, '지급명세', 'pay')}</PanelBody>
      </Panel>
    </div>
    </Screen>
  );
}
