'use client';
/**
 * ★★★**상세의 아래 절반 — 확정 목업(/design) 그대로** (대표 2026-09-18)
 *   「디자인은 아까 **기간은 버튼 눌러서 고르자**고 했고, 아까 디자인 어디 갔는지 **그대로 복구**해봐」
 *
 * 목업 차례 그대로다 —
 *   요약 네 칸(공급사 · 차종 매칭 · 보증금 · 약정주행) → 기간 단추 → 남색 「선택 Offer」 박스 → 「이 상품 접수하기」
 *   보증금 · 약정주행 · 월 금액은 «고른 기간»을 따라 바뀐다(목업과 같다).
 *
 * ⚠ 한 번 목업을 버리고 «카드 + 합친 접수 단추»로 새로 지었었다 — 확정 디자인을 바꾼 것이라 되돌렸다.
 * ⓘ 목업과 다른 것 하나 — 같은 개월이 둘 이상이면(오플 「12_2만」「12_3만」) 단추에 주행 한도를 붙인다.
 *   안 붙이면 「12개월」 단추가 둘 서서 무엇을 누르는지 모른다.
 * ★조건 칩 = 도메인의 혜택조건(`perks`) — 받은 차례 그대로. 비었으면 자리째 안 그린다.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';

type 요금 = {
  id: string; termMonths: number; monthlyRent: number;
  deposit?: number; prepayment?: number; annualMileageKm?: number;
};

const 원 = (n?: number) => (n === undefined || n === null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`);
const 주행 = (n?: number) => (n ? `연 ${n.toLocaleString('ko-KR')}km` : '—');

export function OfferPicker({ productId, offers, initial, supplier, match, matchNote, perks, perksNote }: {
  productId: string; offers: 요금[]; initial?: string; supplier: string; match: string;
  /** 트림까지 확정이 아니면 «왜 거기서 멈췄나» — 기능 쪽 matchNote. 있으면 칸 밑에 작게 */
  matchNote?: string;
  /** 혜택조건 — 도메인이 정한 차례 그대로(심사가 맨 앞). 목업의 조건 칩 자리에 선다 */
  perks?: string[];
  /** 정책이 추정·없음이면 혜택 칩 끝에 붙는 한 마디(「정책 추정」 · 「정책 없음」) — 혜택을 믿을지 말지 알려 준다 */
  perksNote?: string;
}) {
  /** 읽는 차례 — 개월 짧은 것부터, 같은 개월이면 주행 적은 것부터, 그래도 같으면 싼 것부터. */
  const 줄 = useMemo(() => [...offers].sort((a, b) =>
    (a.termMonths - b.termMonths)
    || ((a.annualMileageKm ?? 0) - (b.annualMileageKm ?? 0))
    || (a.monthlyRent - b.monthlyRent)), [offers]);
  const [고름, set고름] = useState(() => (줄.some((o) => o.id === initial) ? initial! : 줄[0]?.id ?? ''));
  const o = 줄.find((x) => x.id === 고름);
  const 겹침 = (t: number) => 줄.filter((x) => x.termMonths === t).length > 1;

  return (
    <>
      <dl className="summary-grid">
        <div><dt>공급사</dt><dd>{supplier}</dd></div>
        <div><dt>차종 매칭</dt><dd>{match}{matchNote ? <small className="dz-note">{matchNote}</small> : null}</dd></div>
        <div><dt>보증금</dt><dd>{원(o?.deposit)}</dd></div>
        <div><dt>약정주행</dt><dd>{주행(o?.annualMileageKm)}</dd></div>
      </dl>
      {줄.length === 0 ? <p className="dz-empty">받은 요금이 없습니다 — 원자에 요금이 안 들어온 것입니다.</p> : (
        <>
          <div className="offer-picker">
            {줄.map((x) => (
              <button key={x.id} type="button" onClick={() => set고름(x.id)} className={x.id === 고름 ? 'active' : ''}>
                {x.termMonths}개월{겹침(x.termMonths) && x.annualMileageKm ? ` · ${x.annualMileageKm / 10000}만km` : ''}
              </button>
            ))}
          </div>
          {o && (
            <div className="offer-block">
              <div><span>선택 Offer</span><b>{o.termMonths}개월</b></div>
              <strong>월 {원(o.monthlyRent)}</strong>
              <p>보증금 {원(o.deposit)} · {주행(o.annualMileageKm)}{o.prepayment ? ` · 선납 ${원(o.prepayment)}` : ''}</p>
            </div>
          )}
          {((perks && perks.length > 0) || perksNote) && (
            <div className="chips">
              {(perks ?? []).map((x) => <span key={x}>{x}</span>)}
              {perksNote && <span className="dz-chip-note">{perksNote}</span>}
            </div>
          )}
          {o && (
            <Link className="primary"
              href={`/intake/new?product=${encodeURIComponent(productId)}&offer=${encodeURIComponent(o.id)}`}>
              이 상품 접수하기
            </Link>
          )}
        </>
      )}
    </>
  );
}
