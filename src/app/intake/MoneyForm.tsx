'use client';
/**
 * ★접수 상세 — 「프로모션 · 가감」 작은 폼 둘 (대표 2026-09-18 「앞으로는 수수료대로 계산하고 프로모션이나 가감할 수 있는 기능」)
 *   셈은 기능 쪽(moneyAction · ledgers.claimAmountOf/payAmountOf)이 한다 — 여기는 칸만.
 *   ★수수료 칸은 없다 — 수수료는 기계가 ERP5 수수료표로 센다(기능 세션).
 *   ★폼을 «둘»로 가른다 — moneyAction 은 보낸 칸 묶음만 고친다. 프로모션만 고칠 때 가감을 건드리지 않게.
 *   ⚠ 저장 단추는 운영 원장(ERP5)에 바로 쓴다. 에러 문구(청구서 나감 · 지급 끝남 거절 등)는 받은 그대로 보인다.
 */
import { startTransition, useActionState } from 'react';
import { moneyAction, type FormState } from './actions';

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
      <form onSubmit={send(promoAct)}>
        <input type="hidden" name="code" value={code} />
        <b>프로모션</b>
        <label>금액<input name="promoAmount" defaultValue={칸값(promoAmount)} inputMode="numeric" placeholder="공급사가 더 주는 돈" /></label>
        <label>영업자 몫 %<input name="promoSharePct" defaultValue={칸값(promoSharePct)} inputMode="numeric" placeholder="100" /></label>
        <label className="wide">사유<input name="promoReason" defaultValue={promoReason ?? ''} /></label>
        {promo.errors.length > 0 && <ul className="dz-errs">{promo.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="submit" disabled={disabled || promoPending}>{promoPending ? '저장 중…' : '프로모션 저장'}</button>
      </form>
      <form onSubmit={send(adjAct)}>
        <input type="hidden" name="code" value={code} />
        <b>가감</b>
        <label>청구 ±<input name="claimAdjust" defaultValue={칸값(claimAdjust)} inputMode="numeric" placeholder="빼는 돈은 −" /></label>
        <label>지급 ±<input name="payAdjust" defaultValue={칸값(payAdjust)} inputMode="numeric" placeholder="빼는 돈은 −" /></label>
        <label className="wide">사유 *<input name="adjustReason" defaultValue={adjustReason ?? ''} /></label>
        {adj.errors.length > 0 && <ul className="dz-errs">{adj.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="submit" disabled={disabled || adjPending}>{adjPending ? '저장 중…' : '가감 저장'}</button>
      </form>
    </div>
  );
}
