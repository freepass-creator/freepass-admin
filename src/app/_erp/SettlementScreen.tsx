/**
 * PC 정산관리 — 판 셋: 정산묶음 | 실적 줄 | 접수상세 (§5-4, 대표 2026-09-24 「모든 페이지는 다
 *   패널화 돼 있다」 — 단독 페이지(§4 두 칸 카드 골격 · Props · CardHead)로 두지 않는다). 계약접수
 *   (Workspace.tsx)와 같은 erp-panel 셋으로 짠다 — 접수상세 판은 그 화면과 똑같은 부품(SettlementDetail)
 *   을 쓴다(같은 접수는 어느 화면에서 열어도 같은 판).
 *   셈은 기능 쪽 그대로(claimLedger · payLedger · ledgerTotals — 완납 · 인도 기준, 끊긴 분납은 받은 만큼).
 *   발행은 기능 쪽 IssueForm 그대로 — ⚠ 운영 원장에 쓴다(쓰기 꺼짐 · 가상 데이터에서는 저장되지 않는다).
 */
import { settlements, today } from '../../server/erp5';
import type { SettlementRow } from '../../domain/settlement/types';
import {
  claimLedger, ledgerGroupAttention, ledgerMonths, NO_MONTH, payLedger, type Clawback, type LedgerGroup,
} from '../../domain/settlement/ledgers';
import { sp, txt } from '../_fn/fmt';
import { IssueForm } from '../settlement/LifeForms';
import { Badge, hrefWith, Panel, PanelBody, PanelFoot, PanelHead, QuickFilter, RowCard, RowCards, Screen, SearchBar, won0, type Tone } from './parts';
import { AutoSelect } from './AutoSelect';
import { SettlementDetail } from './SettlementDetail';

type Q = Record<string, string | string[] | undefined>;
const STAGE_TONE: Record<string, Tone> = { 접수: 'neutral', 청구: 'info', 통보: 'info', 정정: 'err', 확인: 'warn', 수금: 'ok', 지급: 'ok' };
const CLAIM_FLOW = ['접수', '청구', '정정', '확인', '수금'];
const PAY_FLOW = ['접수', '통보', '정정', '확인', '지급'];
const ATTN_TONE: Record<string, Tone> = { issue: 'err', todo: 'info', done: 'ok' };
const ATTN_LABEL: Record<string, string> = { issue: '이슈', todo: '미처리', done: '완료' };

export async function SettlementScreen({ q, base = '/settlement' }: { q: Q; base?: string }) {
  let rows: SettlementRow[]; let cb: Clawback[];
  try { const [all, c] = await Promise.all([settlements.list(), settlements.clawbacks()]); rows = all.map((x) => x.row); cb = c; }
  catch (e) {
    return (
      <Screen name="settlement-workspace">
        <Panel><PanelHead kind="목록" title="정산관리" count="오류" />
          <PanelBody><p className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></PanelBody></Panel>
      </Screen>
    );
  }

  const tab = sp(q.tab) === 'pay' ? 'pay' : 'claim';
  const nowMonth = today().slice(0, 7);
  const nowDate = new Date(`${today()}T12:00:00+09:00`);
  const months = ledgerMonths(rows, cb);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  const month = sp(q.month) || 달들.find((m) => m <= nowMonth) || 달들[0] || NO_MONTH;
  const claimG = claimLedger(rows, month, cb), payG = payLedger(rows, month, cb);
  const groups: LedgerGroup[] = tab === 'claim' ? claimG : payG;
  const who = tab === 'claim' ? '공급사' : '영업채널';
  const 문서 = tab === 'claim' ? '청구서' : '지급명세';
  const gq = sp(q.gq).trim().toLowerCase();
  const shownGroups = groups.filter((g) => !gq || g.party.toLowerCase().includes(gq));
  const gSel = groups.find((g) => g.party === sp(q.g));

  const 장부 = month !== NO_MONTH ? await settlements.invoices(month).catch(() => []) : [];
  const axis = tab === 'claim' ? '공급사' as const : '영업채널' as const;
  const 장 = gSel ? 장부.find((x) => x.axis === axis && x.party === gSel.party) ?? null : null;

  const ic = sp(q.ic);
  const cur = ic ? rows.find((r) => r.id === ic) : undefined;

  return (
    <Screen name="settlement-workspace">
    <div className="erp-workspace">
      <Panel compact>
        <PanelHead kind="목록" title={tab === 'claim' ? '청구목록' : '지급목록'} count={`${groups.length}곳`} />
        <SearchBar base={base} q={q} name="gq" placeholder={`${who} 이름`} keep={['tab', 'month']}
          dropdown={<AutoSelect name="month" value={month} label="정산월" options={months.map((m) => [m, m])} />} />
        <QuickFilter label="정산 구분" items={[
          { key: 'claim', label: `청구 · 공급사 ${claimG.length}곳`, href: hrefWith(base, q, { tab: null, g: null, ic: null }), on: tab === 'claim' },
          { key: 'pay', label: `지급 · 영업채널 ${payG.length}곳`, href: hrefWith(base, q, { tab: 'pay', g: null, ic: null }), on: tab === 'pay' },
        ]} />
        <PanelBody>
          <RowCards label={`${who} 목록`}>
            {shownGroups.map((g) => {
              const attn = ledgerGroupAttention(g);
              return (
                <RowCard key={g.party} href={hrefWith(base, q, { g: g.party, ic: null })} current={g.party === gSel?.party}
                  tone={ATTN_TONE[attn]} title={g.party} badge={<Badge tone={ATTN_TONE[attn]}>{ATTN_LABEL[attn]}</Badge>}
                  facts={[[문서, `${g.done}/${g.lines.length}`], [tab === 'claim' ? '수금' : '지급', `${g.completed}/${g.lines.length}`]]}
                  amount={won0(g.net)} amountLabel="정산액" />
              );
            })}
          </RowCards>
        </PanelBody>
      </Panel>

      <Panel>
        {gSel ? (
          <>
            <PanelHead kind="목록" title={gSel.party} count={`${gSel.lines.length}줄`} />
            <PanelBody>
              <IssueForm id="erp-issue-form" month={month} axis={axis} party={gSel.party} />
              <RowCards label="실적 줄">
                {gSel.lines.map(({ row: r, amount, broken, ratio }) => {
                  const flow = tab === 'claim' ? CLAIM_FLOW : PAY_FLOW;
                  const st = tab === 'claim' ? r.claimStage : r.payStage;
                  const at = st === flow[flow.length - 1] ? flow.length : flow.indexOf(st);
                  return (
                    <RowCard key={r.id} href={hrefWith(base, q, { ic: r.id })} current={r.id === ic} tone={STAGE_TONE[st] ?? 'neutral'}
                      title={txt(r.customer)} badge={<Badge tone={STAGE_TONE[st] ?? 'neutral'}>{st}</Badge>}
                      plate={txt(r.plate)} car={txt(r.model)} steps={{ labels: flow, at }}
                      facts={[
                        ['상품 · 기간', txt(r.product), `${r.term ?? '—'}개월`],
                        ['결제', txt(r.payKind), broken ? `끊김 · 받은 몫 ${Math.round(ratio * 100)}%` : undefined],
                      ]}
                      amount={won0(amount)} amountLabel={tab === 'claim' ? '청구금액' : '지급액'} />
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
            <PanelHead kind="목록" title="실적 줄" count="묶음 선택" />
            <PanelBody><p className="erp-muted">왼쪽에서 {who}를 고르면 그 실적 줄이 여기 섭니다.</p></PanelBody>
          </>
        )}
      </Panel>

      <Panel compact>
        {cur ? (
          <SettlementDetail cur={cur} base={base} q={q} now={nowDate} />
        ) : (
          <>
            <PanelHead kind="상세내용" title="접수상세" count="고른 접수" />
            <PanelBody><p className="erp-muted">가운데 실적 줄을 고르세요.</p></PanelBody>
          </>
        )}
      </Panel>
    </div>
    </Screen>
  );
}
