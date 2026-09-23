/**
 * PC 정산관리 — 규격 `platform/settlements.html` 구성 그대로
 *   ④ 헤더 → ⑤ KPI(청구 · 지급 · 남는 것 · 청구월 미정) → 청구 흐름 | 지급 흐름 → [⑥ 조회조건 · ⑦ 청구/지급 탭 · 그리드 · 합계] 한 카드
 *   → (묶음을 고르면) 오른쪽 묶음 카드 + 청구서/지급명세 발행.
 *   셈은 기능 쪽 그대로(claimLedger · payLedger · ledgerTotals — 완납 · 인도 기준, 끊긴 분납은 받은 만큼).
 *   발행은 기능 쪽 IssueForm 그대로 — ⚠ 운영 원장에 쓴다(쓰기 꺼짐 · 가상 데이터에서는 저장되지 않는다).
 */
import Link from 'next/link';
import { settlements, today } from '../../server/erp5';
import type { SettlementRow } from '../../domain/settlement/types';
import { claimLedger, ledgerMonths, ledgerTotals, NO_MONTH, payLedger, type Clawback, type LedgerGroup } from '../../domain/settlement/ledgers';
import { sp, txt } from '../_fn/fmt';
import { IssueForm } from '../settlement/LifeForms';
import { Badge, CardHead, RowCard, RowCards, hrefWith, PageHeader, Props, Screen, SearchBar, Seg, won0, type Tone } from './parts';
import { AutoSelect } from './AutoSelect';

type Q = Record<string, string | string[] | undefined>;
const STAGE_TONE: Record<string, Tone> = { 접수: 'neutral', 청구: 'info', 통보: 'info', 정정: 'err', 확인: 'warn', 수금: 'ok', 지급: 'ok' };
/** 목록 카드의 작은 진행 단계 — 청구 · 지급 단계 흐름(기능 쪽 단계값 그대로) */
const CLAIM_FLOW = ['접수', '청구', '정정', '확인', '수금'];
const PAY_FLOW = ['접수', '통보', '정정', '확인', '지급'];

export async function SettlementScreen({ q, base = '/settlement' }: { q: Q; base?: string }) {
  let rows: SettlementRow[]; let cb: Clawback[];
  try { const [all, c] = await Promise.all([settlements.list(), settlements.clawbacks()]); rows = all.map((x) => x.row); cb = c; }
  catch (e) { return <Screen name="settlement"><PageHeader crumb={['홈', '정산관리']} title="정산관리" desc={<span className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</span>} /></Screen>; }

  const tab = sp(q.tab) === 'pay' ? 'pay' : 'claim';
  const now = today().slice(0, 7);
  const months = ledgerMonths(rows, cb);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  const month = sp(q.month) || 달들.find((m) => m <= now) || 달들[0] || NO_MONTH;
  const claimG = claimLedger(rows, month, cb), payG = payLedger(rows, month, cb);
  const ct = ledgerTotals(claimG), pt = ledgerTotals(payG);
  const groups: LedgerGroup[] = tab === 'claim' ? claimG : payG;
  const who = tab === 'claim' ? '공급사' : '영업채널';
  const 문서 = tab === 'claim' ? '청구서' : '지급명세';
  const gq = sp(q.gq).trim().toLowerCase();
  const gSel = groups.find((g) => g.party === sp(q.g));
  const lines = (gSel ? [gSel] : groups.filter((g) => !gq || g.party.toLowerCase().includes(gq)))
    .flatMap((g) => g.lines.map((l) => ({ ...l, party: g.party })));
  const stageOf = (r: SettlementRow) => (tab === 'claim' ? r.claimStage : r.payStage);
  const sumAmt = lines.reduce((a, l) => a + (typeof l.amount === 'number' ? l.amount : 0), 0);

  const grid = (
    <section className="erp-card erp-card--fill">
      <SearchBar base={base} q={q} name="gq" placeholder={`${who} 이름`} keep={['tab']}
        dropdown={<AutoSelect name="month" value={month} label="정산월" options={months.map((m) => [m, m])} />} />
      <div className="erp-toolbar" data-region="grid-toolbar">
        <span className="erp-toolbar-spacer" />
        <Seg label="정산 구분" items={[
          { key: 'claim', label: `청구 · 공급사 ${claimG.length}곳`, href: hrefWith(base, q, { tab: null, g: null }), on: tab === 'claim' },
          { key: 'pay', label: `지급 · 영업채널 ${payG.length}곳`, href: hrefWith(base, q, { tab: 'pay', g: null }), on: tab === 'pay' },
        ]} />
        {gSel ? <Link className="erp-chip" href={hrefWith(base, q, { g: null })}>{who}: {gSel.party} ×</Link> : null}
      </div>
      <RowCards label={`${tab === 'claim' ? '청구' : '지급'} 목록`}>
        {lines.map(({ row: r, amount, broken, ratio, party }) => {
          const flow = tab === 'claim' ? CLAIM_FLOW : PAY_FLOW;
          const st = stageOf(r);
          const at = st === flow[flow.length - 1] ? flow.length : flow.indexOf(st);
          const sent = tab === 'claim' ? r.progress.billed : r.payStage !== '접수';
          return (
            <RowCard key={`${party}-${r.id}`} href={`/intake?ic=${encodeURIComponent(r.id)}`} tone={STAGE_TONE[st] ?? 'neutral'}
              title={txt(r.customer)} badge={<Badge tone={STAGE_TONE[st] ?? 'neutral'}>{st}</Badge>}
              plate={txt(r.plate)} car={txt(r.model)}
              meta={`인도 ${txt(r.progress.deliveredAt)} · ${문서} ${sent ? '보냄' : '안 나감'}`}
              steps={{ labels: flow, at }}
              facts={[
                [who, <Link key="p" className="erp-row-link" href={hrefWith(base, q, { g: party })}>{party}</Link>],
                ['상품 · 기간', txt(r.product), `${r.term ?? '—'}개월`],
                ['결제', txt(r.payKind), broken ? `끊김 · 받은 몫 ${Math.round(ratio * 100)}%` : undefined],
              ]}
              amount={won0(amount)} amountLabel={tab === 'claim' ? '청구금액' : '지급액'} />
          );
        })}
      </RowCards>
      <div className="erp-grid-foot">
        <span>{month} · {who} <b>{groups.length}</b>곳 · <b>{lines.length}</b>줄 · {tab === 'claim' ? '청구금액' : '지급액'} 합계 <b>{won0(sumAmt)}</b>원</span><span>·</span>
        <span>청구 <b>{won0(ct.net)}</b>원 · 지급 <b>{won0(pt.net)}</b>원 · 남는 것 <b>{won0(ct.net - pt.net)}</b>원</span>
      </div>
    </section>
  );

  return (
    <Screen name="settlement">
      <PageHeader crumb={['홈', '업무', '정산관리']} title="정산관리"
        desc="공급사 청구와 영업채널 지급을 달마다 묶어 맞춥니다. 완납 · 인도 기준으로 줄이 서고, 끊긴 분납은 받은 만큼만 셉니다."
        actions={<>
          <Link className="erp-btn erp-btn--ghost" href="/intake?iv=완납실적">실적</Link>
          {gSel
            ? <button className="erp-btn erp-btn--primary" type="submit" form="erp-issue-form">{gSel.party} {문서} 발행</button>
            : <span className="erp-btn erp-btn--primary" aria-disabled="true" title={`${who}을 고르면 ${문서}를 발행할 수 있습니다`}>{문서} 발행</span>}
        </>} />
      {gSel ? (
        <div className="erp-cols">
          {grid}
          <div className="erp-stack">
            <section className="erp-card erp-embed">
              <CardHead title={gSel.party} right={<Badge tone={gSel.completed === gSel.lines.length ? 'ok' : 'warn'}>{tab === 'claim' ? '수금' : '지급'} {gSel.completed}/{gSel.lines.length}</Badge>} />
              <div className="erp-card-body">
                <Props pairs={[
                  ['합', `${won0(gSel.total)}원`], ['환수', gSel.clawbackTotal ? `−${won0(gSel.clawbackTotal)}원` : '—'],
                  [tab === 'claim' ? '청구할 돈' : '줄 돈', `${won0(gSel.net)}원`], [`${문서} 보냄`, `${gSel.done} / ${gSel.lines.length}`],
                  ['금액 모름', gSel.unknown ? `${gSel.unknown}줄` : '없음'], ['보류', gSel.hold ? `${gSel.hold}줄` : '없음'],
                ]} />
                <IssueForm id="erp-issue-form" month={month} axis={tab === 'claim' ? '공급사' : '영업채널'} party={gSel.party} />
              </div>
            </section>
          </div>
        </div>
      ) : grid}
    </Screen>
  );
}
