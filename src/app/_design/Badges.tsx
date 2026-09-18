/**
 * ★★★**뱃지는 두 가지뿐 — 화이트라벨 규격 · 아이콘 + 글자** (대표 2026-09-18)
 *   「뱃지 규격이랑 이런 거는 화이트라벨 거 갖고 와도 될 거 같은데 … 갖고 올 거는 갖고 오고」
 *   「우리가 만들어 놓은 erp4 디자인 중에서 … 아이콘 + 텍스트 타입이나 이런 거 잘 생각해봐」
 *   erp4 집 규칙(대표 2026-08-28 · 08-30) 「박스 뱃지 쓰지 말고 아이콘 텍스트 형태로 · **모든 곳에서**」
 *
 * 정본 = freepasserp4 `components/shop/shop-ui.tsx` 의 두 얼굴:
 *   ① 신원 칩(StateChip → Tag) — 이 차가 «무엇»인가: 출고상태 · 상품구분 · 할 일.
 *      옅은 면 + 아이콘 + 작은 글자 · **테두리 없음**(테두리가 붙는 순간 박스 뱃지다).
 *      좋은 소식(출고가능 · 즉시출고 · 끝)은 초록 — 원본 `good`.
 *   ② 조건 표시(PerkMark) — 손님이 «되나»: 심사 · 혜택. **면 없이 아이콘 + 굵은 먹색 글자.** 색은 아이콘에만.
 *      ★심사는 방패 — 무심사는 초록, 신용조회 · 소득확인은 흐린 회색(원본 `ask`: 손님이 «해야 할 일»이라
 *        혜택 색을 주면 서류가 혜택으로 보인다). 나머지 혜택은 남색 ✓.
 *      ⚠ 앞서 「✓신용조회」가 「✓분납가능」과 같은 얼굴이었다 — 심사 요구가 혜택처럼 읽혔다.
 * ⚠ 앞서 ①은 아이콘 없는 회색 상자였다(화이트라벨의 절반만 가져왔다).
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * 신원 칩의 그림 — 원본 erp4 `SIGNAL_ICON` 그대로: 그림은 «값»이 아니라 «갈래»를 가리킨다.
 *   출고상태만 상태에 따라 갈린다(살 수 있나 ○✓ / 기다려야 하나 ◷ / 안 되나 ⊘) — 글자를 못 읽어도 먼저 걸러진다.
 */
export function 신원(text: string): { icon: string; good?: boolean } {
  if (/출고가능|즉시출고/.test(text)) return { icon: 'circle-check', good: true };
  if (/불가|종료|말소|취소/.test(text)) return { icon: 'circle-slash' };
  if (/계약중|상품화중|출고협의|대기|다음/.test(text)) return { icon: 'clock' };
  if (text === '끝') return { icon: 'circle-check', good: true };
  return { icon: 'tag' };
}

/** ① 신원 칩 — tone: plain(옅은 면) · act(할 일 있음 — 옅은 남색 면 + 남색 글자) · 좋은 소식은 초록 */
export function Tag({ children, tone = 'plain', icon, good }: {
  children: ReactNode; tone?: 'plain' | 'act' | 'warn'; icon?: string; good?: boolean;
}) {
  return (
    <i className={`dz-badge ${tone}${good ? ' good' : ''}`}>
      {icon ? <Icon name={icon} size={12} stroke={2.2} /> : null}{children}
    </i>
  );
}

/** 심사 값인가 — 도메인 perks 는 심사를 맨 앞에 싣는다(무심사 · 신용조회 · 소득확인 …) */
const 심사 = (m: string) => /심사|신용|소득/.test(m);

/** ② 조건 표시 — 아이콘 + 굵은 먹색 글자, 면 없음. note(「정책 추정」)는 회색 글자로 끝에 */
export function PerkMarks({ marks, note, compact }: { marks: string[]; note?: string; compact?: boolean }) {
  if (!marks.length && !note) return null;
  return (
    <span className={`dz-perks${compact ? ' compact' : ''}`}>
      {marks.map((m) => {
        const kind = 심사(m) ? (/무심사/.test(m) ? 'good' : 'ask') : 'perk';
        return (
          <span key={m} className={`dz-perk ${kind}`}>
            <Icon name={kind === 'perk' ? 'check' : 'shield-check'} size={compact ? 12 : 14} stroke={2.4} />{m}
          </span>
        );
      })}
      {note && <span className="dz-perk-note">{note}</span>}
    </span>
  );
}
