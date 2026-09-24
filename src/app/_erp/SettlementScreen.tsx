/**
 * PC 정산관리 — 판 셋: 청구목록(왼쪽) | 정산상세(가운데) | 지급목록(오른쪽) (§5-4, 대표 2026-09-24
 *   「정산관리는 왼쪽 패널에다가 청구, 가운데 상세, 오른쪽에 지급이야. 다 목록이니까 목록 쓰면 되고,
 *   목록 규격」). 청구·지급을 한 판 안 탭으로 가르던 것(정산묶음)을 걷어내고, 실적 화면(분납실적|
 *   실적상세|완납실적)과 같은 결로 둘을 늘 같이 보이는 목록 판 둘로 나눈다 — 목록 판은 전부 compact +
 *   SearchBar(§5-1)로 같은 틀이다. 가운데는 상세내용 kind(목록이 아니라 compact 가 없다) — 고른 묶음의
 *   정산상세(총 · 환수 · 순액 · 발행) + 그 줄들을 보여준다. 줄을 누르면 그 접수 자체의 상세(계약접수
 *   워크스페이스)로 건너간다 — 정산상세는 «그 묶음»의 요약이지 개별 접수상세의 자리가 아니다.
 *   셈은 기능 쪽 그대로(claimLedger · payLedger — 완납 · 인도 기준, 끊긴 분납은 받은 만큼).
 *   발행은 기능 쪽 IssueForm 그대로 — ⚠ 운영 원장에 쓴다(쓰기 꺼짐 · 가상 데이터에서는 저장되지 않는다).
 */
import type { ReactNode } from 'react';
import { settlements, today } from '../../server/erp5';
import type { SettlementRow } from '../../domain/settlement/types';
import {
  claimLedger, ledgerGroupAttention, ledgerMonths, NO_MONTH, payLedger, type Clawback, type LedgerGroup,
} from '../../domain/settlement/ledgers';
import { sp, txt } from '../_fn/fmt';
import { IssueForm } from '../settlement/LifeForms';
import { Badge, hrefWith, Panel, PanelBody, PanelFoot, PanelHead, RowCard, RowCards, Screen, SearchBar, won0, type Tone } from './parts';
import { AutoSelect } from './AutoSelect';

type Q = Record<string, string | string[] | undefined>;
const STAGE_TONE: Record<string, Tone> = { 접수: 'neutral', 청구: 'info', 통보: 'info', 정정: 'err', 확인: 'warn', 수금: 'ok', 지급: 'ok' };
const CLAIM_FLOW = ['접수', '청구', '정정', '확인', '수금'];
const PAY_FLOW = ['접수', '통보', '정정', '확인', '지급'];
const ATTN_TONE: Record<string, Tone> = { issue: 'err', todo: 'info', done: 'ok' };
const ATTN_LABEL: Record<string, string> = { issue: '이슈', todo: '미처리', done: '완료' };
/** 목록 카드 썸네일 — §5-4 규격대로 상태 아이콘 + 짧은 두 글자(대표 2026-09-24 「목록 줄 카드 규격도
 *  … 상태 아이콘 또는 분류 아이콘이 있고 두줄」, 접수목록의 StatusIcon·INTAKE_SHORT 와 같은 결). */
const ATTN_SHORT: Record<string, string> = { issue: '이슈', todo: '대기', done: '완료' };
const ATTN_ICON_PATH: Record<string, ReactNode> = {
  issue: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></>,
  todo: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  done: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
};
function AttnIcon({ attn }: { attn: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{ATTN_ICON_PATH[attn]}</svg>;
}

export async function SettlementScreen({ q, base = '/settlement' }: { q: Q; base?: string }) {
  let rows: SettlementRow[]; let cb: Clawback[];
  try { const [all, c] = await Promise.all([settlements.list(), settlements.clawbacks()]); rows = all.map((x) => x.row); cb = c; }
  catch (e) {
    return (
      <Screen name="settlement-workspace">
        <Panel compact><PanelHead kind="목록" title="정산관리" count="오류" />
          <PanelBody><p className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></PanelBody></Panel>
      </Screen>
    );
  }

  const nowMonth = today().slice(0, 7);
  const months = ledgerMonths(rows, cb);
  const 달들 = months.filter((m) => m !== NO_MONTH);
  const month = sp(q.month) || 달들.find((m) => m <= nowMonth) || 달들[0] || NO_MONTH;
  const claimG = claimLedger(rows, month, cb), payG = payLedger(rows, month, cb);

  const cq = sp(q.cq).trim().toLowerCase();
  const pq = sp(q.pq).trim().toLowerCase();
  const shownClaim = claimG.filter((g) => !cq || g.party.toLowerCase().includes(cq));
  const shownPay = payG.filter((g) => !pq || g.party.toLowerCase().includes(pq));

  /* 고른 묶음 — 청구 · 지급 어느 목록에서 눌렀는지로 축(문서 · 사람 이름)을 가른다 */
  const gp = sp(q.g);
  const claimSel = claimG.find((g) => g.party === gp);
  const paySel = !claimSel ? payG.find((g) => g.party === gp) : undefined;
  const gSel = claimSel ?? paySel;
  const tab: 'claim' | 'pay' = claimSel ? 'claim' : 'pay';
  const who = tab === 'claim' ? '공급사' : '영업채널';
  const 문서 = tab === 'claim' ? '청구서' : '지급명세';
  const axis = tab === 'claim' ? '공급사' as const : '영업채널' as const;

  const 장부 = gSel && month !== NO_MONTH ? await settlements.invoices(month).catch(() => []) : [];
  const 장 = gSel ? 장부.find((x) => x.axis === axis && x.party === gSel.party) ?? null : null;

  const list = (title: string, items: LedgerGroup[], name: string) => (
    <RowCards label={`${title} 목록`}>
      {items.map((g) => {
        const attn = ledgerGroupAttention(g);
        return (
          <RowCard key={g.party} href={hrefWith(base, q, { g: g.party })} current={g.party === gSel?.party}
            tone={ATTN_TONE[attn]} thumb={<><AttnIcon attn={attn} /><span>{ATTN_SHORT[attn]}</span></>} thumbStatus
            title={g.party} badge={<Badge tone={ATTN_TONE[attn]}>{ATTN_LABEL[attn]}</Badge>}
            facts={[[name, `${g.done}/${g.lines.length}`], ['완료', `${g.completed}/${g.lines.length}`]]}
            amount={won0(g.net)} amountLabel="정산액" />
        );
      })}
    </RowCards>
  );

  return (
    <Screen name="settlement-workspace">
    <div className="erp-workspace">
      <Panel compact>
        <PanelHead kind="목록" title="청구목록" count={`${claimG.length}곳`} />
        <SearchBar base={base} q={q} name="cq" placeholder="공급사 이름" keep={['month']}
          dropdown={<AutoSelect name="month" value={month} label="정산월" options={months.map((m) => [m, m])} />} />
        <PanelBody>{list('청구', shownClaim, '청구서')}</PanelBody>
      </Panel>

      <Panel>
        {gSel ? (
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
                {gSel.lines.map(({ row: r, amount, broken, ratio }) => {
                  const flow = tab === 'claim' ? CLAIM_FLOW : PAY_FLOW;
                  const st = tab === 'claim' ? r.claimStage : r.payStage;
                  const at = st === flow[flow.length - 1] ? flow.length : flow.indexOf(st);
                  return (
                    <RowCard key={r.id} href={`/intake?ic=${encodeURIComponent(r.id)}`} tone={STAGE_TONE[st] ?? 'neutral'}
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
            <PanelHead kind="상세내용" title="정산상세" count="묶음 선택" />
            <PanelBody><p className="erp-muted">왼쪽 청구목록이나 오른쪽 지급목록에서 고르세요.</p></PanelBody>
          </>
        )}
      </Panel>

      <Panel compact>
        <PanelHead kind="목록" title="지급목록" count={`${payG.length}곳`} />
        <SearchBar base={base} q={q} name="pq" placeholder="영업채널 이름" keep={['month']} />
        <PanelBody>{list('지급', shownPay, '지급명세')}</PanelBody>
      </Panel>
    </div>
    </Screen>
  );
}
