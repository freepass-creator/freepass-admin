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
import { Badge, CardHead, hrefWith, PageHeader, Props, Screen, SearchBar, Seg, won0, type Tone } from './parts';
import { AutoSelect } from './AutoSelect';

type Q = Record<string, string | string[] | undefined>;
const STAGE_TONE: Record<string, Tone> = { 접수: 'neutral', 청구: 'info', 통보: 'info', 정정: 'err', 확인: 'warn', 수금: 'ok', 지급: 'ok' };

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
      <div className="erp-grid-scroll" data-region="grid">
        <table className="erp-grid">
          <thead><tr>
            <th>인도일</th><th>{who}</th><th>고객</th><th>차량 / 차량번호</th><th>상품 · 기간</th><th>결제</th>
            <th className="erp-num">{tab === 'claim' ? '청구금액' : '지급액'}</th><th>{문서}</th><th>단계</th>
          </tr></thead>
          <tbody>
            {lines.map(({ row: r, amount, broken, ratio, party }) => (
              <tr key={`${party}-${r.id}`} data-href={`/intake?ic=${encodeURIComponent(r.id)}`}>
                <td><Link className="erp-row-link" href={`/intake?ic=${encodeURIComponent(r.id)}`}>{txt(r.progress.deliveredAt)}</Link></td>
                <td><Link className="erp-row-link" href={hrefWith(base, q, { g: party })}>{party}</Link></td><td>{txt(r.customer)}</td>
                <td>{txt(r.model)}<span className="erp-cell-sub">{txt(r.plate)}</span></td>
                <td>{txt(r.product)} · {r.term ?? '—'}개월</td>
                <td>{txt(r.payKind)}{broken ? <> <span className="erp-tag">끊김 · 받은 몫 {Math.round(ratio * 100)}%</span></> : null}</td>
                <td className="erp-num erp-strong">{won0(amount)}</td>
                <td>{(tab === 'claim' ? r.progress.billed : r.payStage !== '접수') ? <span className="erp-tag erp-tag--primary">보냄</span> : <span className="erp-muted">안 나감</span>}</td>
                <td><Badge tone={STAGE_TONE[stageOf(r)] ?? 'neutral'}>{stageOf(r)}</Badge></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={6}>합계 ({lines.length}줄)</td><td className="erp-num">{won0(sumAmt)}</td><td /><td /></tr></tfoot>
        </table>
      </div>
      <div className="erp-grid-foot">
        <span>{month} · {who} <b>{groups.length}</b>곳 · <b>{lines.length}</b>줄</span><span>·</span>
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
