/**
 * ★★★**뱃지는 두 가지뿐 — 화이트라벨 규격을 가져왔다** (대표 2026-09-18)
 *   「여기 뱃지 규격이 왜 다르지?? 뱃지 규격이랑 이런 거는 화이트라벨 거 갖고 와도 될 것 같은데???
 *    규격 통일 좀 제대로 하자 … 갖고 올 거는 갖고 오고」
 *
 * 정본 = freepasserp4 `components/shop/shop-ui.tsx` — 거기는 «딱 두 가지»로 갈려 있다:
 *   ① 신원 딱지(Tag)  — 이 차가 «무엇»인가: 상품구분 · 배차상태 · 할 일. **상자**(면 하나 · 라운드 4 · 22px · 12px 글자).
 *   ② 조건 표시(PerkMark) — 손님이 «되나»: 무심사 · 분납가능 · 만21세 … **상자 없이 ✓ + 굵은 글자**.
 *      화이트라벨 설명 그대로: 「면이 없으면 신원 딱지와 한눈에 갈리고, 글자를 진하게 세울 수 있어 오히려 더 또렷하다 —
 *      회색 면에 회색 글자로 눕히면 셀링포인트가 딱지로 보인다」 · 「색은 아이콘에만, 글자는 먹색」
 * ⚠ 앞서 1줄 뱃지(흰 상자 22px)와 3줄 혜택 칩(옅은 남색 상자 20px)이 크기·색이 달라 «같은 것의 두 규격»처럼 보였다.
 * ⓘ 제미나이는 네 모양(채움·테두리·20px 칩·경고)을 권했지만 버렸다 — 테두리는 「선 없음」 규칙에 어긋나고,
 *   모양이 넷이면 대표가 지적한 «규격이 왜 다르냐»가 되풀이된다. 뜻은 «색»으로만 가른다(규칙 ④).
 */
import type { ReactNode } from 'react';

/** ① 신원 딱지 — tone: plain(회색 면) · act(할 일 있음 — 옅은 남색 면 + 남색 글자) */
export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'act' }) {
  return <i className={`dz-badge ${tone}`}>{children}</i>;
}

/** ② 조건 표시 — ✓ + 굵은 먹색 글자, 상자 없음. note(「정책 추정」)는 회색 글자로 끝에 */
export function PerkMarks({ marks, note, compact }: { marks: string[]; note?: string; compact?: boolean }) {
  if (!marks.length && !note) return null;
  return (
    <span className={`dz-perks${compact ? ' compact' : ''}`}>
      {marks.map((m) => <span key={m} className="dz-perk"><em aria-hidden>✓</em>{m}</span>)}
      {note && <span className="dz-perk-note">{note}</span>}
    </span>
  );
}
