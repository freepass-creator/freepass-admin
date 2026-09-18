'use client';
/**
 * ★★★**계약기간 고르기 — «차 확인 → 기간 선택 → 접수»** (대표 2026-09-18)
 *   「계약기간은 **모바일에서는 좌우로 흐르게** 해주고. 이거는 **접수를 편하게** 하는 거니까
 *    어떤 차인지 확인하고 **기간을 선택해서 접수**한다」
 *
 * ★기간 한 벌 = 카드 단추 하나 — 기간 · 월 대여료 · 보증금/주행이 «한 장»에 같이 선다.
 *   고르는 순간 무엇을 고르는지 값이 눈앞에 있다(표에서 줄을 따라가 읽을 필요가 없다).
 *   ⚠ 서로 다른 기간의 값을 섞지 않는다 — 카드 한 장이 원자의 Offer 한 벌이다.
 * ★고른 뒤 누르는 단추는 **하나**다 — 줄마다 「이 요금으로 접수」가 붙어 있으면 잘못 누르기 쉽다.
 *   고르기(카드)와 접수(주 단추)를 떼어, 확인한 것만 접수되게 한다. 가는 곳(주소)은 앞과 같다.
 *
 * 폰  — 카드가 좌우로 흐른다(끝 카드가 반쯤 보여 «더 있다»를 말한다). 접수 단추와 함께 화면 아래에 붙는다.
 * PC  — 카드가 줄을 넘겨 다 보인다(가로로 굴리지 않는다).
 *
 * ⓘ 이 부품은 «모양»만 맡는다. 값은 받은 대로 쓰고, 접수 주소도 화면이 쓰던 그대로다.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';

type 요금 = {
  id: string; termMonths: number; monthlyRent: number;
  deposit?: number; prepayment?: number; annualMileageKm?: number;
};

const 원 = (n?: number) => (n === undefined || n === null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`);

export function OfferPicker({ productId, offers, initial }: { productId: string; offers: 요금[]; initial?: string }) {
  /** 읽는 차례 — 개월 짧은 것부터, 같은 개월이면 주행 적은 것부터, 그래도 같으면 싼 것부터. */
  const 줄 = useMemo(() => [...offers].sort((a, b) =>
    (a.termMonths - b.termMonths)
    || ((a.annualMileageKm ?? 0) - (b.annualMileageKm ?? 0))
    || (a.monthlyRent - b.monthlyRent)), [offers]);
  const [고름, set고름] = useState(() => (줄.some((o) => o.id === initial) ? initial! : 줄[0]?.id ?? ''));
  const 고른 = 줄.find((o) => o.id === 고름);

  if (!줄.length) return <p className="dz-empty">받은 요금이 없습니다 — 「없다」가 아니라 원자에 요금이 안 들어온 것입니다.</p>;

  return (
    <div className="dz-offer">
      <div className="dz-terms" role="radiogroup" aria-label="계약기간">
        {줄.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={o.id === 고름}
            className={`dz-term${o.id === 고름 ? ' on' : ''}`} onClick={() => set고름(o.id)}>
            <b>{o.termMonths}개월</b>
            <span>월 {원(o.monthlyRent)}</span>
            <small>
              보증금 {원(o.deposit)}
              {o.annualMileageKm ? ` · 연 ${o.annualMileageKm.toLocaleString('ko-KR')}km` : ''}
              {o.prepayment ? ` · 선납 ${원(o.prepayment)}` : ''}
            </small>
          </button>
        ))}
      </div>
      {고른 && (
        <Link className="dz-go"
          href={`/intake/new?product=${encodeURIComponent(productId)}&offer=${encodeURIComponent(고른.id)}`}>
          {고른.termMonths}개월 · 월 {원(고른.monthlyRent)}으로 접수
        </Link>
      )}
    </div>
  );
}
