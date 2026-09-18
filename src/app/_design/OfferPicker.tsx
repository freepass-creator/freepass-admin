'use client';
/**
 * ★★★**상세 요약의 아래 절반 — 혜택 → 기간 → 값 한 줄 → 접수** (대표 2026-09-18)
 *   「여기 순서를 좀 정해보자」 → A 안 · 「상품상세에 대여료 저렇게 공간 많이 두고 할 필요 없어, 한 줄로 마무리」
 *   제미나이 상의(2026-09-18): 「선택한 Offer 의 핵심 값(월·보증금·주행)은 늘 붙어 움직인다 — 한 줄로 줄이되
 *   보증금/선납·주행은 절대 빼지 마라(월 값만 보이면 오접수 사고)」 — 받았다.
 *
 * ```
 *   ✓무심사  ✓분납가능  ✓만21세                     ← 혜택(상자 없이 ✓ + 굵은 글자 — 화이트라벨 PerkMark)
 *   [36개월] 48개월  60개월                          ← 기간은 단추로 고른다
 *   월 510,000원 | 보증금 1,000,000원 | 주행 —        ← 값은 «한 줄», 기간을 누르면 이 줄만 바뀐다
 *   [        이 상품 접수하기        ]
 * ```
 * ⚠ 앞서 요약 네 칸(공급사·차종 매칭·보증금·약정주행) + 큰 남색 Offer 박스였다 — 보증금·주행이 두 번 섰고
 *   혜택은 맨 아래 깔렸다. 칸을 걷고(공급사는 이름 밑, 차종 매칭은 상세정보), 박스를 한 줄로 줄였다.
 * ⓘ 같은 개월이 둘 이상이면(오플 「12_2만」「12_3만」) 단추에 주행 한도를 붙인다 — 안 붙이면 「12개월」이 둘 선다.
 * ★혜택 = 도메인의 `perks` — 받은 차례 그대로(심사가 맨 앞). 정책이 추정·없음이면 끝에 회색 한 마디.
 * ★「이 상품 접수하기」는 쪽을 옮기지 않는다(대표 절대 법칙 — 위 메뉴 말고는 어디로도 안 넘어간다).
 *   누르면 `onApply` 로 알린다 — 판을 쥔 쪽이 오른쪽 판을 신규 접수로 바꾼다. 없으면(상품찾기) 단추를 안 세운다.
 */
import { useMemo, useState } from 'react';
import { PerkMarks } from './Badges';

type 요금 = {
  id: string; termMonths: number; monthlyRent: number;
  deposit?: number; prepayment?: number; annualMileageKm?: number;
};

const 원 = (n?: number) => (n === undefined || n === null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`);
const 주행 = (n?: number) => (n ? `연 ${n.toLocaleString('ko-KR')}km` : '—');

/**
 * 공유 — 지금 보는 차의 주소를 건넨다. 폰은 기기 공유창(navigator.share), 웹은 주소 복사.
 * ★주소에 고른 차·기간이 다 들어 있다(`?id=&offer=`) — 받은 사람이 같은 자리를 연다.
 */
function Share() {
  const [done, setDone] = useState(false);
  const go = async () => {
    const url = window.location.href;
    try {
      if (navigator.share && window.matchMedia('(max-width: 900px)').matches) { await navigator.share({ url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true); setTimeout(() => setDone(false), 1500);
    } catch { /* 닫았거나 막혔다 — 아무 일 없다 */ }
  };
  return <button type="button" className="dz-bar-sub" onClick={go}>{done ? '복사됨' : '공유'}</button>;
}

export function OfferPicker({ offers, initial, perks, perksNote, onApply, applyBase }: {
  offers: 요금[]; initial?: string;
  /** 혜택조건 — 도메인이 정한 차례 그대로(심사가 맨 앞) */
  perks?: string[];
  /** 정책이 추정·없음이면 혜택 끝에 붙는 한 마디(「정책 추정」 · 「정책 없음」) */
  perksNote?: string;
  /** 접수하기 — 쪽을 안 옮기고 판을 바꾼다(계약접수). 고른 요금 열쇠를 넘긴다 */
  onApply?: (offerId: string) => void;
  /**
   * 판을 쥔 쪽이 서버 화면이면 «주소 바탕»을 준다 — 여기서 고른 요금(&offer=)만 덧붙여 같은 쪽 오른쪽 판을 바꾼다.
   * ⚠ 함수를 넘기면 안 된다 — 서버 화면이 클라이언트 부품에 함수를 넘기면 쪽이 통째로 죽는다(실측: 서버 오류).
   */
  applyBase?: string;
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
      <PerkMarks marks={perks ?? []} note={perksNote} />
      {줄.length === 0 ? <p className="dz-empty">받은 요금이 없습니다 — 원자에 요금이 안 들어온 것입니다.</p> : (
        /* ★틀고정 — 기간 · 값 한 줄 · 접수하기는 판 아래에 붙는다(사진·혜택을 훑는 동안에도 손 닿는 자리) */
        <div className="dz-apply dz-bar">
          <div className="offer-picker">
            {줄.map((x) => (
              <button key={x.id} type="button" onClick={() => set고름(x.id)} className={x.id === 고름 ? 'active' : ''}>
                {x.termMonths}개월{겹침(x.termMonths) && x.annualMileageKm ? ` · ${x.annualMileageKm / 10000}만km` : ''}
              </button>
            ))}
          </div>
          {o && (
            <p className="dz-offer-line">
              <b>월 {원(o.monthlyRent)}</b>
              <span>보증금 {원(o.deposit)}</span>
              {o.prepayment ? <span>선납 {원(o.prepayment)}</span> : null}
              <span>주행 {주행(o.annualMileageKm)}</span>
            </p>
          )}
          {/* ★공유는 접수 단추 «왼쪽에 작게»(대표 2026-09-18) — 앞서 판 머리 오른쪽 위에 따로 서 있었다 */}
          <div className="dz-bar-go">
            <Share />
            {o && applyBase && <a className="primary" href={`${applyBase}${applyBase.includes('?') ? '&' : '?'}offer=${encodeURIComponent(o.id)}`}>이 상품 접수하기</a>}
            {o && !applyBase && onApply && (
              <button type="button" className="primary" onClick={() => onApply(o.id)}>이 상품 접수하기</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
