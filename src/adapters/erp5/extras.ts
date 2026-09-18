/**
 * **상품찾기가 더 보일 것** — 색상 · 옵션 · 차급 · 차량가 · 출고협의 사유 · 원본 링크 · 입고일 · 정책 확정도.
 *
 * ★대표 2026-09-18 「상품찾기 다 갖고 왔니? 사진이랑 이런것들?」 — 화이트라벨(erp4 PUBLIC_PRODUCT_FIELDS)과
 *   대 보니 색상 687 · 옵션 570 · 차급 614 대가 ERP5 에 있는데 안 옮기고 있었다(실측 2026-09-18 · 목록 694).
 * ★원자 글자를 그대로 옮긴다. 고치지 않는다 — 단, 뜻이 다른 값이 섞인 칸은 «걸러» 옮긴다(아래 차급).
 */
import { strOrUndef as S, positiveNumOrUndef as N } from './atom';
type Rec = Record<string, unknown>;

/**
 * ★차급 칸에 딴 말이 섞여 있다(실측) — 「레이」 27 · 「신차렌트」 13 · 「중고렌트」 …
 *   차급 말일 때만 옮긴다. 아니면 비운다 — 「신차렌트」 를 차급으로 보이면 거짓이다.
 */
const CLASS_RE = /^(경형|소형|준중형|중형|준대형|대형)(\s*(세단|SUV|MPV|해치백|쿠페|트럭|밴|왜건|RV|컨버터블|픽업))?$/;
export const vehicleClassOf = (v: unknown) => { const s = S(v); return s && CLASS_RE.test(s) ? s : undefined; };

/**
 * 정책이 얼마나 확정됐나 (ERP5 `policy_reference_state`) — 실측: 추정 227 · 운영자 연결 116 · 정규화 92 · 없음 19 · 빈칸 240.
 * ★혜택(perks)·심사가 이 정책에서 나온다. 추정 정책이면 혜택도 추정이다 — 화면이 그걸 숨기면 안 된다.
 */
export type PolicyState = 'CONFIRMED' | 'INFERRED' | 'MISSING';
export function policyStateOf(d: Rec, hasPolicy: boolean): PolicyState | undefined {
  const s = S(d.policy_reference_state);
  if (s === 'inferred') return 'INFERRED';
  if (s === 'missing' || (!hasPolicy && !S(d.policy_code))) return 'MISSING';
  if (s === 'linked_by_operator' || s === 'normalized') return 'CONFIRMED';
  return undefined;   // 빈칸 — 모른다. 「확정」 으로 올리지 않는다
}

const http = (v: unknown) => { const s = S(v); return s && /^https?:\/\//i.test(s) ? s : undefined; };

export function extrasOf(d: Rec, hasPolicy: boolean) {
  const reason = S(d.status_reason);
  const out = {
    extColor: S(d.ext_color),
    intColor: S(d.int_color),
    options: S(d.options),
    /** 옵션 글자가 공급사 원문으로 «확인 안 된» 것 (ERP5 option_evidence_status=HOLD · 실측 222) */
    optionsUnverified: S(d.option_evidence_status) === 'HOLD' ? true : undefined,
    vehicleClass: vehicleClassOf(d.vehicle_class),
    /** 차량가(신차가) — 원. 없으면 칸 없음 */
    consumerPrice: N(d.consumer_price),
    /** 배차상태의 까닭 — 공급사협의 · 공급사불가 · 계약선점 … (출고협의·계약중인 차에만 뜻이 있다) */
    statusReason: reason,
    /** 공급사 원본 상세 — 확인하러 가는 곳 */
    sourceUrl: http(d.source_url),
    /** 롯데 T카 링크 — 픽업구독 차 (erp4 sheetPlateLink 규칙: 픽업은 T카) */
    ticaLink: http(d.tica_link),
    /** ERP 에 처음 들어온 날 — 새로 들어온 차를 가를 때 */
    firstSeenAt: S(d.erp_first_seen_date),
    policyState: policyStateOf(d, hasPolicy),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Partial<typeof out>;
}
