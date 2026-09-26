/**
 * 접수상세 — §5-4 상세내용 판. 계약접수(Workspace.tsx)·정산관리(SettlementScreen.tsx) 가 같은 접수를
 *   가리킬 때 똑같은 판을 연다(대표 2026-09-24 「모든 페이지는 다 패널화 돼 있다」 — 화면마다 새로
 *   그리지 않는다). 원래 Workspace.tsx 안에 있던 것을 그대로 뽑았다 — 모양 · 계산 전부 그대로.
 */
import Link from 'next/link';
import { settlements, today, writeEnabled } from '../../server/freepass-data';
import { bucketOf } from '../../domain/settlement/stage';
import { claimAmountOf, marginOf, payAmountOf } from '../../domain/settlement/money';
import { adminBlockLabel, adminWorkflowPhaseOf, blockOf, type SettlementRow } from '../../domain/settlement/types';
import { intakeNextAction } from '../intake/next-action';
import { progressFormId } from '../intake/progress-form-id';
import { txt, when } from '../_fn/fmt';
import { IntakeProgress } from './IntakeProgress';
import { hrefWith, PanelBody, PanelFoot, PanelHead, Steps, won0 } from './parts';

type Q = Record<string, string | string[] | undefined>;

export async function SettlementDetail({ cur, base, q, now }: { cur: SettlementRow; base: string; q: Q; now: Date }) {
  const b = bucketOf(cur, now);
  const p = cur.progress;
  const step = p.cancelled ? -1 : !p.paper ? 1 : !p.delivered ? 2 : !p.billed ? 3 : !p.collected ? 4 : 5;
  const claim = claimAmountOf(cur, now), pay = payAmountOf(cur, now), margin = marginOf(cur, now);
  const hit = await settlements.get(cur.id);
  const raw = (hit?.raw ?? {}) as Record<string, unknown>;
  const events = hit ? await settlements.events(cur.plate, cur.receivedAt, cur.catalogRef?.productId, raw.intakeRequestId, raw.intakeIdentityMode) : [];
  const block = blockOf(cur);
  const phase = adminWorkflowPhaseOf(cur);
  const next = intakeNextAction(block, p.cancelled, p.delivered);
  const primary = next.kind === 'paper' ? <button className="erp-btn erp-btn--primary" type="submit" form={progressFormId(cur.id, 'paper')} name="on" value="1">계약서 받음</button>
    : next.kind === 'plate' ? <button className="erp-btn erp-btn--primary" type="submit" form={progressFormId(cur.id, 'plate')}>차량번호 저장</button>
    : next.kind === 'delivered' ? <button className="erp-btn erp-btn--primary" type="submit" form={progressFormId(cur.id, 'delivered')} name="on" value="1">인도 완료</button>
    : next.kind === 'settlement' ? <Link className="erp-btn erp-btn--primary" href={`/settlement?tab=${next.tab}&focus=${encodeURIComponent(cur.id)}`}>정산관리</Link>
    : next.kind === 'new' ? <Link className="erp-btn erp-btn--primary" href="/intake?w=new">신규 접수</Link>
    : <span className="erp-btn erp-btn--primary" aria-disabled="true">{adminBlockLabel(next.label)}</span>;

  return (
    <>
      <PanelHead kind="상세내용" title={txt(cur.customer)} count={`${b} · ${phase}`} />
      <PanelBody>
        <div className="erp-detail-body">
          <div className="erp-tile">
            <h3 className="erp-tile-title">진행 <span className="erp-docstate">{phase}</span></h3>
            <Steps current={step} items={[
              { label: '접수', count: cur.receivedAt?.slice(5) ?? '—' },
              { label: '계약서', count: p.paper ? '받음' : '—' },
              { label: '인도', count: p.deliveredAt?.slice(5) ?? '—' },
              { label: '청구', count: p.billMonth ?? '—' },
              { label: '수금 · 지급', count: p.collected && p.paid ? '끝' : p.collected ? '수금' : '—' },
            ]} />
          </div>
          <div className="erp-tile-group">
            <div className="erp-info-card erp-tile">
              <h3 className="erp-tile-title">고객 · 차량</h3>
              <dl>
                <div><dt>고객</dt><dd>{txt(cur.customer)}</dd></div>
                <div><dt>차량번호</dt><dd>{txt(cur.plate)}</dd></div>
                <div><dt>차량</dt><dd>{txt(cur.model)}</dd></div>
                <div><dt>공급사</dt><dd>{txt(cur.supplier)}</dd></div>
                <div><dt>영업채널</dt><dd>{txt(cur.channel)}</dd></div>
                <div><dt>영업 담당</dt><dd>{txt(cur.agent)}</dd></div>
              </dl>
            </div>
            <div className="erp-info-card erp-tile">
              <h3 className="erp-tile-title">계약 조건</h3>
              <dl>
                <div><dt>상품구분</dt><dd>{txt(cur.product)}</dd></div>
                <div><dt>계약기간</dt><dd>{cur.term ? `${cur.term}개월` : '—'}</dd></div>
                <div><dt>보증금</dt><dd data-type="money">{won0(cur.deposit)}원</dd></div>
                <div><dt>월 대여료</dt><dd data-type="money">{won0(cur.rent)}원</dd></div>
                <div><dt>결제</dt><dd>{txt(cur.payKind)}</dd></div>
                <div><dt>계약 방식</dt><dd>{txt(cur.contractType)}</dd></div>
              </dl>
            </div>
          </div>
          <div className="erp-tile">
            <h3 className="erp-tile-title">금액 <span className="erp-docstate">청구(공급사) − 지급(영업채널) = 남는 것</span></h3>
            <div className="erp-tile-group">
              <div className="erp-tile-row"><b>청구 · {txt(cur.supplier)} · {cur.claimStage}</b><strong>{won0(claim)}원</strong></div>
              <div className="erp-tile-row"><b>지급 · {txt(cur.channel)} · {cur.payStage}</b><strong>{won0(pay)}원</strong></div>
              <div className="erp-tile-row"><b>남는 것</b><strong>{won0(margin)}원</strong></div>
            </div>
          </div>
          <div className="erp-tile">
            <h3 className="erp-tile-title">처리 — 차량번호 · 계약서 · 인도 · 취소</h3>
            <IntakeProgress code={cur.id} plate={cur.plate ?? ''} paper={p.paper} delivered={p.delivered} deliveredAt={p.deliveredAt ?? ''}
              cancelled={p.cancelled} today={today()} writable={writeEnabled()} />
          </div>
          <div className="erp-tile">
            <h3 className="erp-tile-title">처리 이력 {events.length}건</h3>
            {events.length ? (
              <ul className="erp-timeline">
                {events.slice(0, 8).map((e, i) => (
                  <li key={i} data-state={i === 0 ? 'current' : undefined}><strong>{e.field}</strong> {txt(e.from)} → {txt(e.to)}<time>{when(e.at)}</time></li>
                ))}
              </ul>
            ) : <span className="erp-muted">남은 이력이 없습니다.</span>}
          </div>
        </div>
      </PanelBody>
      <PanelFoot>
        <Link className="erp-btn erp-btn--ghost" href={hrefWith(base, q, { ic: null })}>목록으로</Link>
        {primary}
      </PanelFoot>
    </>
  );
}
