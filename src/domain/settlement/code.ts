import { createHash } from 'node:crypto';

/**
 * **정산 줄의 ERP5 코드 — `stl_` + 결정 토큰.**
 *
 * ★erp4 `lib/domain/ids.ts` `stableId('settlement', …)` 와 «같은 셈법» 이다 (2026-09-18 대조 일치).
 *   같은 차번+접수일이면 어디서 만들든 같은 코드가 나온다 ⇒ 시트·ERP 병행 입력에서 두 줄이 안 선다.
 * ⚠ 셈법을 바꾸면 같은 계약에 다른 코드가 나와 두 줄이 선다. 고치려면 erp4 와 같이 고친다.
 */
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** 찾는 열쇠 — 차번(띄어쓰기 없앰) + 접수일(YYYY-MM-DD). */
export const settlementKey = (plate: unknown, receivedAt: unknown) =>
  `${String(plate ?? '').replace(/\s/g, '')}|${String(receivedAt ?? '').trim().slice(0, 10)}`;

export function settlementCode(plate: unknown, receivedAt: unknown): string {
  const identity = settlementKey(plate, receivedAt);
  const d = createHash('sha256').update(`settlement:${identity.trim()}`, 'utf8').digest();
  let t = '';
  for (let i = 0; i < 10; i += 1) t += ALPHABET[d[i] % ALPHABET.length];
  return `stl_${t}`;
}

/** `settlement_events` 문서 id — erp4 `eventKey` 와 같은 꼴(차번|접수일, 금지문자 치환). */
export const eventDocId = (plate: unknown, receivedAt: unknown) =>
  `${String(plate ?? '').trim()}|${String(receivedAt ?? '').trim()}`.replace(/[.$#[\]/\s|]/g, '_');
