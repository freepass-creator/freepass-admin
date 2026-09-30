import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { settlements, today, writeEnabled } from '../../server/freepass-data';
import { blockOf, type SettlementRow } from '../../domain/settlement/types';
import { intakeListModel, 멈춘자리, 보기, 제목 } from './intake-list-model';
import { FilterSheet } from '../_design/FilterSheet';
import { LiveSearch } from '../products/LiveSearch';
import { PAGE, firstWindow, flat } from '../products/list-rows';
import { moreIntakeRows } from '../products/list-actions';
import { claimAmountOf, payAmountOf } from '../../domain/settlement/ledgers';
import { marginOf } from '../../domain/settlement/money';
import { billingMonth, invalidPaidRounds, nextInstallmentDate, paidRoundsOf, roundsOf, stageOf } from '../../domain/settlement/stage';
import { PaidRounds } from './PaidRounds';
import { POLICY_FIELDS } from '../../domain/catalog/policy-fields.generated';
import { LEGACY_POLICY_LABELS } from '../_design/ProductInfo';
import { sp, txt, when, won } from '../_fn/fmt';
import { BoardList, type BoardRow } from '../products/BoardList';
import { IntakeWork } from './IntakeWork';
import { intakeNextAction } from './next-action';
import { ClawbackForm, FeeForm, MoneyForm, TerminationClawbackReviewForm } from './MoneyForm';
import { terminationClawbackReview } from '../../domain/settlement/clawback';
import { contractPaymentStateOf } from '../../domain/contracts/payment';
import { resolveOfferPolicies } from '../../domain/product/resolve-policies';

/**
 * 계약접수(메인) 오른쪽 판 — 접수 목록 · 접수 상세 (대표 2026-09-18 「이게 우리 메인」 · 2026-09-22 「상품찾기 상품상세 접수목록」)
 *   왼쪽 두 판(상품 목록 | 상품 상세)은 상품판과 같고, 오른쪽이 접수다:
 *     기본 = 접수 목록 · 줄을 누르면(?ic=) 접수 상세 + 다음 업무 · 가운데 [접수하기](?w=new) = 신규 계약접수(상품판이 그린다).
 *   값 · 규칙은 기능 쪽 그대로: 다음 걸음 = blockOf · intakeNextAction, 금액 = claimAmountOf · payAmountOf, 저장 = progressAction · moneyAction.
 */

type Keep = (extra: Record<string, string>) => string;

/** 접수 목록 — 오른쪽 판 기본. 검색 = iq · 보기 = iv (상품 쪽 q · 칩과 섞이지 않는다) */
export function IntakeList({ q, keep, all }: { q: Record<string, string | string[] | undefined>; keep: Keep; all: SettlementRow[] }) {
  const { rows, iv, 칸수, axes, 걸린조건 } = intakeListModel(all, q, keep, today());
  return (
    <>
      <div className="list-tools">
        <form className="search" action="/intake">
          {Object.entries(q).filter(([k, v]) => !['iq', 'ic', 'w', 'v', 'created', 'exists'].includes(k) && sp(v))
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={sp(v)} />)}
          <input type="hidden" name="v" value="work" />
          <div className="search-field">
            <LiveSearch name="iq" defaultValue={sp(q.iq)} label="접수 검색" placeholder="고객·차량·접수번호 검색" />
          </div>
          <FilterSheet axes={axes} count={rows.length} unit="건" />
          {/* 차 없이 직접 접수 — 견적출고 · 신차발주는 차량번호 전에도 접수한다(#87) */}
          <Link className="new-intake" href={keep({ w: 'direct', ic: '', v: 'work' })} aria-label="차 없이 직접 접수" title="차 없이 직접 접수">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </Link>
        </form>
        <div className="chips" role="group" aria-label="접수 칸">
          {보기.map((b) => {
            const on = b.key === iv;
            return (
              <Link key={b.key} className={`chip${on ? ' on' : ''}${b.key === '미완료' && 칸수['미완료'] ? ' alert' : ''}`}
                href={keep({ iv: b.key, ic: '', w: '', v: 'work' })} aria-current={on ? 'true' : undefined}>
                {b.label} {칸수[b.key]}{on && <span className="sr-only"> (선택됨)</span>}
              </Link>
            );
          })}
        </div>
        {걸린조건.length > 0 && (
          <div className="applied" aria-label="걸어 둔 조건">
            {걸린조건.map((c) => (
              <Link key={c.key} className="applied-chip" href={c.href} aria-label={`${c.label} 조건 풀기`}><span>{c.label}</span><span aria-hidden="true">✕</span></Link>
            ))}
            <Link className="applied-clear" href={keep(Object.fromEntries(axes.map((x) => [x.key, ''])))}>모두 지우기</Link>
          </div>
        )}
      </div>
      <div className="web-scroll">
        <BoardList rows={firstWindow(rows, sp(q.ic))} selectedId={sp(q.ic) || undefined} total={rows.length} page={PAGE} more={moreIntakeRows.bind(null, flat(q))} unit="건" empty="조건에 맞는 접수가 없습니다." />
      </div>
    </>
  );
}

/** 접수 상세 + 다음 업무 — 오른쪽 판 한 장에 위(상세) · 아래(할 일) · 하단바 [목록] [주 버튼] */
export async function IntakeDetail({ code, keep, created, exists }: { code: string; keep: Keep; created?: boolean; exists?: boolean }) {
  const hit = await settlements.get(code);
  const back = keep({ ic: '', v: 'work' });
  if (!hit) {
    return (
      <>
        <div className="web-scroll"><p className="empty">이 접수를 못 찾았습니다 — {code}</p></div>
        <div className="web-actions single-web"><Link className="tertiary" href={back}>접수 목록</Link></div>
      </>
    );
  }
  const r = hit.row;
  const 멈춤 = 멈춘자리(r);
  const now = new Date();
  const 청구 = claimAmountOf(r, now);
  const 지급 = payAmountOf(r, now);
  const 마진 = marginOf(r, now);
  const 청구월 = billingMonth(r, now);
  const 실적상태 = stageOf(r, now);
  const 회차 = roundsOf(r.payKind);
  const canWrite = writeEnabled();
  const snapshot = r.catalogSnapshot;
  const payment = contractPaymentStateOf(hit.raw);
  const events = await settlements.events(r.plate, r.receivedAt, r.catalogRef?.productId, hit.raw.intakeRequestId, hit.raw.intakeIdentityMode);
  const 환수검토 = r.contractTerminatedAt ? terminationClawbackReview(r, await settlements.clawbacks()) : 'NONE';
  const 끝남 = !r.progress.cancelled && !blockOf(r);
  const 단계 = [
    { k: '접수', done: true, small: txt(r.receivedAt) },
    { k: '계약서', done: r.progress.paper, small: r.progress.paper ? '받음' : '대기' },
    { k: '차량번호', done: !!r.plate, small: r.plate ?? '대기' },
    { k: '인도', done: r.progress.delivered, small: r.progress.delivered ? txt(r.progress.deliveredAt) : '대기' },
    { k: '정산', done: 끝남, small: `청구 ${r.claimStage} · 지급 ${r.payStage}` },
  ];
  const 지금단계 = r.progress.cancelled ? -1 : 단계.findIndex((s) => !s.done);
  const 조건 = ([
    ['상품구분', r.product], ['기간', r.term ? `${r.term}개월` : null], ['월 대여료', r.rent != null ? `${won(r.rent)}원` : null],
    ['보증금', r.deposit != null ? `${won(r.deposit)}원` : null], ['분납', r.payKind],
    ['계약 방식', r.contractType], ['공급사', r.supplier], ['영업채널', r.channel], ['담당자', r.agent],
  ] as [string, string | null | undefined][]).filter(([, v]) => v);
  const b = blockOf(r);

  const head = (
    <>
      {created && <p className="notice ok" role="status">접수를 저장했습니다.</p>}
      {exists && <p className="notice warn" role="status">같은 차량번호 + 접수일이 원장에 이미 있어 새로 만들지 않았습니다. 있던 줄입니다.</p>}
      <div className="identity">
        <span className={`tag${멈춤.tone ? ` ${멈춤.tone}` : ''}`}>{멈춤.t}</span>
        <h3>{제목(r) || r.id}</h3>
        <p>{[r.plate ?? '차량번호 없음', r.supplier, r.receivedAt ? `접수 ${r.receivedAt}` : ''].filter(Boolean).join(' · ')}</p>
        {r.rent != null && <div className="money">월 {won(r.rent)}원{r.term ? <small className="money-sub">{r.term}개월</small> : null}</div>}
      </div>
      <div className="section">
        <h4>진행 사실</h4>
        <ol className="timeline">
          {단계.map((s, i) => (
            <li key={s.k} className={`step${s.done ? ' done' : ''}${i === 지금단계 ? ' now' : ''}`} aria-current={i === 지금단계 ? 'step' : undefined}>
              <i aria-hidden="true">{s.done ? '✓' : ''}</i><b>{s.k}</b><small>{s.small}</small>
              {s.done && <span className="sr-only"> (완료)</span>}
            </li>
          ))}
        </ol>
      </div>
      <div className="section">
        <h4>금액</h4>
        <div className="summary">
          <div><small>청구금액</small><b>{청구 === null ? '모름' : `${won(청구)}원`}</b></div>
          <div><small>지급액</small><b>{지급 === null ? '모름' : `${won(지급)}원`}</b></div>
          <div><small>남는 금액</small><b>{마진 === null ? '미확인' : `${won(마진)}원`}</b></div>
        </div>
      </div>
      {조건.length > 0 && (
        <div className="section">
          <h4>계약 조건</h4>
          <div className="facts">{조건.map(([k, v]) => <div key={k} className="fact"><span>{k}</span><b>{v}</b></div>)}</div>
        </div>
      )}
      <div className="section">
        <h4>실적 · 납입</h4>
        <div className="facts">
          <div className="fact"><span>실적 상태</span><b>{실적상태}</b></div>
          <div className="fact"><span>청구월</span><b>{청구월 ?? '미정'}</b></div>
          <div className="fact"><span>납입회차</span><b>{회차 >= 2 ? invalidPaidRounds(r) ? '기록 확인 필요' : `${paidRoundsOf(r, now)}/${회차}${r.paidRounds == null ? ' · 자동판정' : ' · 확인값'}` : '해당 없음'}</b></div>
          <div className="fact"><span>다음 납입일</span><b>{nextInstallmentDate(r) ?? (회차 >= 2 ? '완납 또는 미정' : '해당 없음')}</b></div>
          <div className="fact"><span>청구 · 지급 단계</span><b>{r.claimStage} · {r.payStage}</b></div>
        </div>
        {회차 >= 2 && r.progress.delivered && <div className="form pb-money"><PaidRounds code={r.id} rounds={회차} paid={r.paidRounds} disabled={r.progress.cancelled || !canWrite} /></div>}
      </div>
      {r.note && <div className="section"><h4>메모</h4><p className="intake-note">{r.note}</p></div>}
      <div className="section">
        <h4>계약 사실</h4>
        <div className="facts">
          <div className="fact"><span>계약금 수납</span><b>{payment.state === 'RECEIVED' ? `${won(payment.fact.amount)}원 · ${when(payment.fact.receivedAt)}` : payment.state === 'INCONSISTENT' ? '기록 확인 필요' : '수납 기록 없음'}</b></div>
          <div className="fact"><span>계약취소</span><b>{r.contractCancelledAt ? `${when(r.contractCancelledAt)} · ${txt(r.contractCancellationReason)}` : '기록 없음'}</b></div>
          <div className="fact"><span>계약해지</span><b>{r.contractTerminatedAt ? `${txt(r.contractTerminationDate)} · ${txt(r.contractTerminationReason)}` : '기록 없음'}</b></div>
          <div className="fact"><span>계약금 처리</span><b>{r.contractPaymentDisposition?.state === 'PENDING' ? '처리 대기' : r.contractPaymentDisposition?.state === 'RESOLVED' ? '처리 완료' : r.contractPaymentDisposition?.state === 'INCONSISTENT' ? '확인 필요' : '해당 없음'}</b></div>
        </div>
        {r.contractPaymentDisposition?.state === 'RESOLVED' && <p className="muted">반환 {won(r.contractPaymentDisposition.fact.refundedAmount)}원 · 공급사 귀속 {won(r.contractPaymentDisposition.fact.supplierRevenueAmount)}원 · 상계 {won(r.contractPaymentDisposition.fact.offsetAmount)}원</p>}
        {r.contractPaymentDisposition?.state === 'INCONSISTENT' && <p className="notice warn">{r.contractPaymentDisposition.reason}</p>}
        {payment.state === 'INCONSISTENT' && <p className="notice warn">{payment.reason}</p>}
        {r.esignContractId && <Link className="small-btn" href={`/esign?id=${encodeURIComponent(r.esignContractId)}&v=detail`}>연결 계약 보기</Link>}
      </div>
      <details className="more">
        <summary>접수 당시 상품 · 정책</summary>
        <div className="more-body">
          {!snapshot ? <p className="notice warn">저장 당시 상품 사본이 없습니다. 현재 상품 조건으로 대체하지 않습니다.</p> : <>
            <p className="muted">저장 당시 기준 · {snapshot.capturedAt} · 상품 v{snapshot.product.version}</p>
            <div className="facts">
              <div className="fact"><span>선택 기간</span><b>{snapshot.offer.termMonths}개월</b></div>
              <div className="fact"><span>월 대여료</span><b>{won(snapshot.offer.monthlyRent)}원</b></div>
              <div className="fact"><span>보증금</span><b>{snapshot.offer.deposit === null ? '미확인' : `${won(snapshot.offer.deposit)}원`}</b></div>
              <div className="fact"><span>선납금</span><b>{snapshot.offer.prepayment === null ? '미확인' : `${won(snapshot.offer.prepayment)}원`}</b></div>
              <div className="fact"><span>연 약정주행</span><b>{snapshot.offer.annualMileageKm === null ? '미확인' : `${won(snapshot.offer.annualMileageKm)}km`}</b></div>
              {(snapshot.offer.resolvedPolicyValues ?? resolveOfferPolicies({ productPolicies: snapshot.product.policyValues ?? [] }, snapshot.offer)).map((p) => <div key={p.policyId} className="fact">
                <span>{POLICY_FIELDS.find((f) => f.key === p.policyId)?.label ?? LEGACY_POLICY_LABELS[p.policyId] ?? p.policyId}</span>
                <b>{p.type === 'MONEY' ? `${won(p.value)}원` : p.type === 'BOOLEAN' ? (p.value ? '있음' : '없음') : p.type === 'PERCENTAGE' ? `${p.value}%` : Array.isArray(p.value) ? p.value.join(' · ') : String(p.value)}</b>
              </div>)}
            </div>
          </>}
        </div>
      </details>
      {hit.warnings.length > 0 && <div className="section"><h4>살필 것</h4>{hit.warnings.map((w) => <p key={w} className="notice warn">{w}</p>)}</div>}
      <details className="more">
        <summary>고친 이력 {events.length}</summary>
        <div className="more-body">
          {events.length === 0 ? <p className="empty" style={{ padding: 12 }}>남은 이력이 없습니다.</p> : (
            <div className="facts">{events.map((e, i) => <div key={i} className="fact"><span>{e.field} · {when(e.at)}</span><b>{txt(e.from)} → {txt(e.to)}</b></div>)}</div>
          )}
        </div>
      </details>
      <h4 className="work-title">다음 업무</h4>
    </>
  );

  return (
    <IntakeWork key={r.id} code={r.id} next={intakeNextAction(b, r.progress.cancelled, r.progress.delivered)}
      plate={r.plate ?? ''} paper={r.progress.paper} delivered={r.progress.delivered} deliveredAt={r.progress.deliveredAt ?? ''}
      cancelled={r.progress.cancelled} today={today()} readOnly={!canWrite}
      intakeCancellationAllowed={payment.state === 'NONE' && !r.contractCancelledAt && !r.contractTerminatedAt && !r.progress.delivered}
      settleHref={`/settlement?tab=${b === '지급' || b === '지급금액 모름' ? 'pay' : 'claim'}&focus=${encodeURIComponent(r.id)}${청구월 ? `&month=${청구월}` : ''}`}
      backHref={back} head={head}
      money={<>
        {/* 돈 고치기 — 수수료 · 프로모션 · 가감(기능 쪽 feeAction · moneyAction) · 환수(인도된 줄만) */}
        <FeeForm code={r.id} claim={r.money.claim} pay={r.money.pay} disabled={r.progress.cancelled || !canWrite} />
        <MoneyForm code={r.id}
          promoAmount={r.money.claimIncentive} promoSharePct={r.money.promoShare === null ? null : Math.round(r.money.promoShare * 100)}
          promoReason={r.money.promoReason} claimAdjust={r.money.claimAdjust} payAdjust={r.money.payAdjust}
          adjustReason={r.money.adjustReason} disabled={r.progress.cancelled || !canWrite} />
        {!r.progress.cancelled && r.progress.delivered && !r.contractTerminatedAt && <ClawbackForm code={r.id} today={today()} disabled={!canWrite} />}
        {r.contractTerminatedAt ? <>
          <p className="notice">계약해지 환수 검토 · {환수검토 === 'PENDING' ? '검토 대기' : 환수검토 === 'REQUIRED' ? '환수 필요' : 환수검토 === 'NOT_REQUIRED' ? '환수 없음' : 환수검토 === 'RECORDED' ? '등록 완료' : '기록 확인 필요'}</p>
          {환수검토 === 'PENDING' && <TerminationClawbackReviewForm code={r.id} operationId={randomUUID()} disabled={!canWrite} />}
          {환수검토 === 'REQUIRED' && <ClawbackForm code={r.id} today={today()} disabled={!canWrite} />}
        </> : null}
      </>} />
  );
}
