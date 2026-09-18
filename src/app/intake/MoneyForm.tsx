'use client';
/**
 * ★접수 상세 — 「프로모션 · 가감」 작은 폼 둘 (대표 2026-09-18 「앞으로는 수수료대로 계산하고 프로모션이나 가감할 수 있는 기능」)
 *   셈은 기능 쪽(moneyAction · ledgers.claimAmountOf/payAmountOf)이 한다 — 여기는 칸만.
 *   ★수수료는 기계가 ERP5 수수료표로 센다 — 사람은 «고칠 때만»(FeeForm · 사유 필수).
 *   ★폼을 «둘»로 가른다 — moneyAction 은 보낸 칸 묶음만 고친다. 프로모션만 고칠 때 가감을 건드리지 않게.
 *   ⚠ 저장 단추는 운영 원장(ERP5)에 바로 쓴다. 에러 문구(청구서 나감 · 지급 끝남 거절 등)는 받은 그대로 보인다.
 */
import { startTransition, useActionState } from 'react';
import { clawbackAction, feeAction, moneyAction, type FormState } from './actions';

const 칸값 = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function MoneyForm({ code, promoAmount, promoSharePct, promoReason, claimAdjust, payAdjust, adjustReason, disabled }: {
  code: string;
  promoAmount: number | null; promoSharePct: number | null; promoReason: string | null;
  claimAdjust: number | null; payAdjust: number | null; adjustReason: string | null;
  disabled?: boolean;
}) {
  const [promo, promoAct, promoPending] = useActionState<FormState, FormData>(moneyAction, { errors: [] });
  const [adj, adjAct, adjPending] = useActionState<FormState, FormData>(moneyAction, { errors: [] });
  const send = (act: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => act(fd));
  };
  return (
    <div className="dz-money">
      <form onSubmit={send(promoAct)} aria-busy={promoPending}>
        <input type="hidden" name="code" value={code} />
        <b>프로모션</b>
        <label>금액<input name="promoAmount" defaultValue={칸값(promoAmount)} inputMode="numeric" placeholder="공급사가 더 주는 돈" /></label>
        <label>영업자 몫 %<input name="promoSharePct" defaultValue={칸값(promoSharePct)} inputMode="numeric" placeholder="100" /></label>
        <label className="wide">사유<input name="promoReason" defaultValue={promoReason ?? ''} /></label>
        {promo.errors.length > 0 && <ul className="dz-errs">{promo.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="submit" disabled={disabled || promoPending} aria-busy={promoPending}>{promoPending ? '저장 중…' : '프로모션 저장'}</button>
      </form>
      <form onSubmit={send(adjAct)} aria-busy={adjPending}>
        <input type="hidden" name="code" value={code} />
        <b>가감</b>
        <label>청구 ±<input name="claimAdjust" defaultValue={칸값(claimAdjust)} inputMode="numeric" placeholder="빼는 돈은 −" /></label>
        <label>지급 ±<input name="payAdjust" defaultValue={칸값(payAdjust)} inputMode="numeric" placeholder="빼는 돈은 −" /></label>
        <label className="wide">사유 *<input name="adjustReason" defaultValue={adjustReason ?? ''} /></label>
        {adj.errors.length > 0 && <ul className="dz-errs">{adj.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="submit" disabled={disabled || adjPending} aria-busy={adjPending}>{adjPending ? '저장 중…' : '가감 저장'}</button>
      </form>
    </div>
  );
}

/**
 * ★수수료 고치기 — 접수 뒤(특히 「금액 모름」 줄). 기능 쪽 feeAction: 비운 쪽은 안 바뀜 · 사유 필수 · 청구서/지급명세 나간 쪽은 거절.
 *   대표 2026-09-18 「차 골라서 접수하거나 직접 접수하는 방식으로 이제 접수를 구워 가는 거야」
 */
export function FeeForm({ code, claim, pay, disabled }: { code: string; claim: number | null; pay: number | null; disabled?: boolean }) {
  const [s, act, pending] = useActionState<FormState, FormData>(feeAction, { errors: [] });
  return (
    <div className="dz-money">
      <form aria-busy={pending} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }}>
        <input type="hidden" name="code" value={code} />
        <b>수수료 <small className="dz-sec-note inline">비운 쪽은 안 바뀝니다</small></b>
        <label>청구 수수료<input name="feeClaim" inputMode="numeric" placeholder={claim === null ? '금액 모름' : `지금 ${claim.toLocaleString('ko-KR')}`} /></label>
        <label>지급 수수료<input name="feePay" inputMode="numeric" placeholder={pay === null ? '금액 모름' : `지금 ${pay.toLocaleString('ko-KR')}`} /></label>
        <label className="wide">사유 *<input name="feeReason" /></label>
        {s.errors.length > 0 && <ul className="dz-errs">{s.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? '저장 중…' : '수수료 저장'}</button>
      </form>
    </div>
  );
}

/**
 * ★환수 세우기 — 인도된 줄(완납실적 · 분납실적)만. 금액은 사람이 넣는다(조건이 공급사마다 다르다) · 사유 필수.
 *   그 달 청구 · 지급 묶음에서 빠진다(정산관리 실적 줄 끝 «−금액» 줄). 같은 차 · 같은 달이 있으면 거절 글.
 */
export function ClawbackForm({ code, today }: { code: string; today: string }) {
  const [s, act, pending] = useActionState<FormState, FormData>(clawbackAction, { errors: [] });
  return (
    <details className="dz-form-more">
      <summary>환수 세우기 <small>드물다 — 필요할 때만</small></summary>
      <div className="dz-money">
        <form aria-busy={pending} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }}>
          <input type="hidden" name="code" value={code} />
          <label>환수일<input name="at" type="date" defaultValue={today} /></label>
          <span />
          <label>공급사에 돌려줄 것<input name="supplierAmt" inputMode="numeric" /></label>
          <label>영업채널에서 돌려받을 것<input name="agentAmt" inputMode="numeric" /></label>
          <label className="wide">사유 *<input name="reason" /></label>
          {s.errors.length > 0 && <ul className="dz-errs">{s.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <button type="submit" disabled={pending} aria-busy={pending}>{pending ? '저장 중…' : '환수 세우기'}</button>
        </form>
      </div>
    </details>
  );
}
