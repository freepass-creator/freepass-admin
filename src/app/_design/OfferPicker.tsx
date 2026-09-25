'use client';
/**
 * ★★★**상세 요약의 아래 절반 — 혜택 → 기간 → 값 한 줄 → 접수** (대표 2026-09-18)
 *   「여기 순서를 좀 정해보자」 → A 안 · 「상품상세에 대여료 저렇게 공간 많이 두고 할 필요 없어, 한 줄로 마무리」
 *   제미나이 상의(2026-09-18): 「선택한 Offer 의 핵심 값(월·보증금·주행)은 늘 붙어 움직인다 — 한 줄로 줄이되
 *   보증금/선납·주행은 절대 빼지 마라(월 값만 보이면 오접수 사고)」 — 받았다.
 *
 * ```
 *   ✓무심사  ✓분납가능  ✓만21세                     ← 혜택(상자 없이 ✓ + 굵은 글자 — 화이트라벨 PerkMark)
 *   36개월 | 510,000원/월 | 보증금 1,000,000원 · 연 2만km
 *   48개월 | 490,000원/월 | 보증금 1,000,000원 · 연 2만km
 *   ★각 Offer가 한 줄 선택 카드다. 선택상태는 카드 면으로만 표현한다.
 *   [        이 상품 접수하기        ]
 * ```
 * ⚠ 앞서 요약 네 칸(공급사·차종 매칭·보증금·약정주행) + 큰 남색 Offer 박스였다 — 보증금·주행이 두 번 섰고
 *   혜택은 맨 아래 깔렸다. 칸을 걷고(공급사는 이름 밑, 차종 매칭은 상세정보), 박스를 한 줄로 줄였다.
 * ⓘ 같은 개월이 둘 이상이면(오플 「12_2만」「12_3만」) 단추에 주행 한도를 붙인다 — 안 붙이면 「12개월」이 둘 선다.
 * ★혜택 = 도메인의 `perks` — 받은 차례 그대로(심사가 맨 앞). 정책이 추정·없음이면 끝에 회색 한 마디.
 * ★「이 상품 접수하기」는 쪽을 옮기지 않는다(대표 절대 법칙 — 위 메뉴 말고는 어디로도 안 넘어간다).
 *   ★접수하기 · 공유는 여기 없다 — 상세 판 «하단바»(DetailTabs, §14-3)가 든다. 여기서 고른 요금을 useChosenOffer 로 알린다.
 */
import { useEffect, useMemo, useState } from 'react';
import { useChosenOffer } from './chosen-offer';
import { PerkMarks } from './Badges';
import { EmptyState } from './Primitives';

type 요금 = {
  id: string; termMonths: number; monthlyRent: number;
  deposit?: number; prepayment?: number; annualMileageKm?: number;
};

const 원 = (n?: number) => (n === undefined || n === null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`);
const 주행 = (n?: number) => (n ? `연 ${n.toLocaleString('ko-KR')}km` : '—');

export function OfferPicker({ offers, initial, perks, perksNote }: {
  offers: 요금[]; initial?: string;
  /** 혜택조건 — 도메인이 정한 차례 그대로(심사가 맨 앞) */
  perks?: string[];
  /** 정책이 추정·없음이면 혜택 끝에 붙는 한 마디(「정책 추정」 · 「정책 없음」) */
  perksNote?: string;
}) {
  /** 읽는 차례 — 개월 짧은 것부터, 같은 개월이면 주행 적은 것부터, 그래도 같으면 싼 것부터. */
  const 줄 = useMemo(() => [...offers].sort((a, b) =>
    (a.termMonths - b.termMonths)
    || ((a.annualMileageKm ?? 0) - (b.annualMileageKm ?? 0))
    || (a.monthlyRent - b.monthlyRent)), [offers]);
  const [고름, set고름] = useState(() => (줄.some((o) => o.id === initial) ? initial! : 줄[0]?.id ?? ''));
  const o = 줄.find((x) => x.id === 고름);
  /* 고른 요금을 판 하단바에 알린다 */
  const 알림 = useChosenOffer();
  useEffect(() => { 알림(o?.id ?? ''); }, [o?.id, 알림]);
  const 겹침 = (t: number) => 줄.filter((x) => x.termMonths === t).length > 1;

  return (
    <>
      <PerkMarks marks={perks ?? []} note={perksNote} />
      {줄.length === 0 ? <EmptyState>받은 요금이 없습니다 — 원자에 요금이 안 들어온 것입니다.</EmptyState> : (
        <div className="dz-offer-select-list" role="list" aria-label="기간별 대여료 선택"
          data-ai-feature="data.list-presentation data.variant-selector" data-ai-list-mode="variant-card">
          {줄.map((x) => {
            const 조건 = [
              x.deposit ? `보증금 ${원(x.deposit)}` : '보증금 없음',
              x.prepayment ? `선납 ${원(x.prepayment)}` : null,
              x.annualMileageKm ? `연 ${x.annualMileageKm.toLocaleString('ko-KR')}km` : null,
            ].filter(Boolean).join(' · ');
            return (
              <button key={x.id} type="button" role="listitem"
                onClick={() => set고름(x.id)}
                aria-pressed={x.id === 고름}
                className={`dz-offer-select-row${x.id === 고름 ? ' active' : ''}`}>
                <strong>{x.termMonths}개월{겹침(x.termMonths) && x.annualMileageKm ? ` · ${x.annualMileageKm / 10000}만km` : ''}</strong>
                <b>{원(x.monthlyRent)}/월</b>
                <span>{조건}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
