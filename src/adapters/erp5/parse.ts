/**
 * ERP5 의 «사람이 적은 말» 을 숫자로 읽는다.
 *
 * ERP5(Firebase `freepasserp5`) 의 정책 81벌은 칸이 전부 «글자» 다 —
 * 「연 30,000km」 · 「만 26세 이상」 · 「2만원」 · 「불가」.
 * 사람이 시트에 적은 그대로 들어와 있고, 그래서 사람은 읽지만 기계는 못 거른다.
 *
 * ★여기서 지키는 것 셋 —
 *   ① **못 읽으면 `undefined` 다. 0 이 아니다.**
 *      「미확인」과 「0원」과 「불가」는 서로 다른 사실이다. 0 으로 뭉개면
 *      「무보증 차를 찾아 줘」 에 보증금 미확인 차가 섞여 나온다.
 *   ② **원문을 버리지 않는다.** 숫자로 읽은 값 옆에 글자를 그대로 남긴다.
 *      나중에 「왜 이렇게 읽었나」를 사람이 되짚을 수 있어야 한다.
 *   ③ **추측하지 않는다.** 단위가 없으면 붙이지 않는다.
 */

/** 「2만원」 「10만원」 「1,720,000」 「200원」 → 원 단위 수. 못 읽으면 undefined */
export function parseMoney(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const s = String(raw ?? '').trim();
  if (!s) return undefined;

  /* 「1억원」 「1억 5천만원」 */
  const eok = /^(\d+(?:\.\d+)?)\s*억/.exec(s);
  if (eok) {
    const rest = s.slice(eok[0].length);
    const man = /(\d[\d,]*)\s*(?:천만|만)/.exec(rest);
    let n = Number(eok[1]) * 100_000_000;
    if (man) n += Number(man[1].replace(/,/g, '')) * (rest.includes('천만') ? 10_000_000 : 10_000);
    return n;
  }
  /* 「1천5백만원」 */
  const cheonMan = /^(\d+)\s*천\s*(?:(\d+)\s*백)?\s*만/.exec(s);
  if (cheonMan) {
    return (Number(cheonMan[1]) * 1000 + Number(cheonMan[2] ?? 0) * 100) * 10_000;
  }
  /* 「2만원」 「10만」 */
  const man = /^(\d[\d,]*(?:\.\d+)?)\s*만/.exec(s);
  if (man) return Number(man[1].replace(/,/g, '')) * 10_000;
  /* 「200원」 「1,720,000」 */
  const plain = /^(\d[\d,]*)\s*원?$/.exec(s);
  if (plain) return Number(plain[1].replace(/,/g, ''));

  return undefined;
}

/** 「연 30,000km」 「연 2만km」 「20000」 → km. 못 읽으면 undefined */
export function parseMileageKm(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  const man = /(\d[\d,]*(?:\.\d+)?)\s*만\s*(?:km|킬로)?/i.exec(s);
  if (man) return Number(man[1].replace(/,/g, '')) * 10_000;
  const km = /(\d[\d,]*)\s*(?:km|킬로)/i.exec(s);
  if (km) return Number(km[1].replace(/,/g, ''));
  const bare = /^(?:연\s*)?(\d[\d,]*)$/.exec(s);
  if (bare) return Number(bare[1].replace(/,/g, ''));
  return undefined;
}

/**
 * 「만 26세 이상」 「만21세」 「제한없음」 → 나이.
 * ★「불가」 · 「제한없음」 은 나이가 «아니다» — 뜻이 다르므로 갈라 돌려준다.
 */
export function parseAge(raw: unknown): { age?: number; unlimited?: boolean; denied?: boolean } {
  const s = String(raw ?? '').trim();
  if (!s) return {};
  if (/^(불가|없음|미제공|해당없음)$/i.test(s)) return { denied: true };
  if (/제한\s*없|무제한/.test(s)) return { unlimited: true };
  const m = /(\d{2})\s*세/.exec(s);
  return m ? { age: Number(m[1]) } : {};
}

/** 「20%」 「0.2」 「30%」 → 0~1 비율. ★1 을 넘으면 퍼센트로 읽는다 */
export function parseRate(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? (raw > 1 ? raw / 100 : raw) : undefined;
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(s);
  if (pct) return Number(pct[1]) / 100;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return n > 1 ? n / 100 : n;
}

/** 「가능」/「불가」/「협의」 → 참·거짓·모름. ★「협의」는 거짓이 아니다 */
export function parseYesNo(raw: unknown): boolean | undefined {
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  if (/^(가능|포함|있음|제공|true|y|예)$/i.test(s)) return true;
  if (/^(불가|불포함|없음|미제공|false|n|아니오)$/i.test(s)) return false;
  return undefined;           /* 협의 · 조건부 — 모른다 */
}

/**
 * ★`price` 맵의 열쇠를 푼다. ERP5 실측 두 꼴 —
 *   `"12"`        기간만
 *   `"12_2만"`    기간 _ 연 주행거리
 *
 * 주행거리가 없으면 `annualMileageKm` 는 **undefined** 다 —
 * 「약정 없음(무제한)」 이 아니라 「이 열쇠가 말해 주지 않는다」 는 뜻이다.
 * 무제한인지는 정책(`annual_mileage`)이 말한다.
 */
export function parsePriceKey(key: string): { termMonths?: number; annualMileageKm?: number } {
  const s = String(key ?? '').trim();
  if (!s) return {};
  const [head, ...rest] = s.split('_');
  const termMonths = /^\d+$/.test(head) ? Number(head) : undefined;
  const tail = rest.join('_');
  const annualMileageKm = tail ? parseMileageKm(tail) : undefined;
  return { termMonths, annualMileageKm };
}
