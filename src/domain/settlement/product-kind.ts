/**
 * **상품의 상품구분 → 원장의 상품구분·렌트구분.**  두 곳이 다른 말을 쓴다 — 짝은 여기 한 곳에서 정한다.
 *
 *   상품(ERP5 products · erp4 캐논 7)   신차렌트 · 중고렌트 · 신차구독 · 중고구독 · 오플구독 · 픽업구독 · 오공구독
 *   원장(settlement_rows)               상품구분: 장기렌트 · 선출고 · 견적출고 · 신차발주 · 구독 · 오플구독 · 지원금
 *                                       렌트구분: 재렌트 · 신차렌트 · 구독
 *
 * ★원장 상품구분은 «수수료 갈래를 정하는 축» 이다(erp4 settlement-atoms 「사람이 고르는 필수」) —
 *   선출고면 차량가 × 3.5%, 견적출고·신차발주는 건별(사람이 넣는다). 잘못 짝지으면 신차에 재렌트 요율이 붙는다.
 *
 * 짝은 원장 실측(2026-09-18 · 취소 뺀 줄)에서 읽었다 — 지어내지 않았다:
 *   재렌트 → 장기렌트 165 · 구독 → 오플구독 117 · 구독 → 구독 32 · 신차렌트 → 선출고 80 / 견적출고 10 / 신차발주 1
 * ★신차렌트만 «하나로 안 떨어진다» — 기본은 선출고(대부분)이되 `certain: false` 로 사람이 고르게 한다.
 */
export interface LedgerKind {
  product: string;        // 원장 상품구분
  rentKind: string;       // 원장 렌트구분
  /** 하나로 떨어지나 — false 면 화면이 choices 중에서 «고르게» 해야 한다 */
  certain: boolean;
  choices: string[];
}

export function ledgerKindOf(productKind: string | null | undefined): LedgerKind | null {
  const k = String(productKind ?? '').replace(/\s/g, '');
  switch (k) {
    case '중고렌트': return { product: '장기렌트', rentKind: '재렌트', certain: true, choices: ['장기렌트'] };
    case '오플구독': return { product: '오플구독', rentKind: '구독', certain: true, choices: ['오플구독'] };
    case '중고구독': case '오공구독': case '픽업구독': case '신차구독':
      return { product: '구독', rentKind: '구독', certain: true, choices: ['구독'] };
    case '신차렌트': return { product: '선출고', rentKind: '신차렌트', certain: false, choices: ['선출고', '견적출고', '신차발주'] };
    default: return null;   // 모르는 말 — 짓지 않는다. 사람이 원장 말에서 고른다
  }
}

/** 원장 상품구분 전부 — 직접 접수의 고를 말 (실측 차례) */
export const LEDGER_PRODUCTS = ['장기렌트', '오플구독', '선출고', '구독', '견적출고', '신차발주', '지원금'] as const;


export type LedgerKindSelection =
  | { ok: true; product: string; rentKind: string }
  | { ok: false; error: string };

/**
 * 상품에서 시작한 접수의 원장 상품구분을 서버에서 다시 검증한다.
 * - certain=true: 화면값을 믿지 않고 정해진 product/rentKind 로 덮는다.
 * - certain=false: product 는 허용된 choices 중 하나여야 하고 rentKind 는 도메인 값으로 고정한다.
 * - 모르는 상품구분은 기존 수동 처리 경로를 막지 않기 위해 여기서 판정하지 않는다.
 */
export function resolveLedgerKindSelection(
  productKind: string | null | undefined,
  selectedProduct: string,
  selectedRentKind: string,
): LedgerKindSelection | null {
  const mapped = ledgerKindOf(productKind);
  if (!mapped) return null;
  if (mapped.certain) {
    return { ok: true, product: mapped.product, rentKind: mapped.rentKind };
  }
  if (!mapped.choices.includes(selectedProduct)) {
    return { ok: false, error: `상품구분이 맞지 않습니다 — ${mapped.choices.join(' / ')} 중에서 다시 골라 주세요` };
  }
  return { ok: true, product: selectedProduct, rentKind: mapped.rentKind };
}
