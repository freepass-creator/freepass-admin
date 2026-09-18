/**
 * ★★★**목록 한 줄 — 모든 목록이 이 한 줄을 쓴다** (대표 2026-09-18)
 *   「목록줄을 어떻게 할 건지 목록 통일을 해봐. 상품목록이랑 접수 실적 어찌 됐든 다 목록이니까 목록 규격 통일해야 할 듯」
 *   「배차상태 상품구분 / 혜택조건(무심사, 21세, 경력무관) 이런 거는 한눈에 보이면 좋은데 — 자리가 부족한가?」
 *
 * 기준 = 확정 목업(/design)의 상품 카드 — 새로 짓지 않고 그 모양을 «규격»으로 올렸다.
 * ```
 *   [사진 82×64]  제목 (메인 14 굵게) ·········· [뱃지] [뱃지]      ← 상품구분 · 배차상태
 *                 (표시) 곁 정보 (보조 12 · 회색, 한 줄)             ← 표시 = 확정 전 차종 등 «살필 것»
 *                 값 (메인 14 굵게) ············· [칩] [칩] [칩]     ← 혜택조건 (없으면 곁값)
 * ```
 *   · 세 줄 · 줄 높이 64 — 무엇을 더 싣든 «줄을 늘리지 않는다». 사진 없는 목록(접수·실적)은 사진 칸만 빠진다.
 *   · 강조는 색으로만(규칙 ④) — 뱃지 `tone="act"`(할 일이 있다) 는 옅은 남색 면 + 남색 글자.
 *   · 고른 줄 = 옅은 남색 면. 선은 없다(규칙 ①).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export function ListRow({ href, selected, thumb, title, badge, badges, tone = 'plain', flag, meta, value, aside, chips }: {
  href: string;
  selected?: boolean;
  /** 사진 칸 — 상품 목록만 준다. `null` 이면 「사진 없음」 칸이 서고, `undefined` 면 칸 자체가 없다. */
  thumb?: string | null;
  title: ReactNode;
  /** 뱃지 하나(접수·실적) — `tone` 이 이 뱃지에 걸린다 */
  badge?: ReactNode;
  /** 뱃지 여럿(상품: 상품구분 · 배차상태) — 늘 옅은 바탕 */
  badges?: ReactNode[];
  tone?: 'plain' | 'act';
  /** 둘째 줄 앞의 «살필 것» 한 마디 — 남색 굵게(예: 차종이 「세부모델까지」만 확정) */
  flag?: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  aside?: ReactNode;
  /** 셋째 줄 오른쪽 칩(혜택조건) — 셋까지. 있으면 곁값 대신 선다 */
  chips?: string[];
}) {
  const 칩 = (chips ?? []).filter(Boolean).slice(0, 3);
  return (
    <Link href={href} className={`dz-row${selected ? ' on' : ''}`}>
      {thumb !== undefined && (
        <span className="dz-row-thumb">
          {thumb
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumb} alt="" loading="lazy" />
            : <em>사진 없음</em>}
        </span>
      )}
      <span className="dz-row-body">
        <span className="dz-row-l1">
          <b>{title}</b>
          <span className="dz-row-badges">
            {(badges ?? []).filter(Boolean).map((x, i) => <i key={i} className="dz-badge plain">{x}</i>)}
            {badge ? <i className={`dz-badge ${tone}`}>{badge}</i> : null}
          </span>
        </span>
        <span className="dz-row-l2">{flag ? <em className="dz-flag">{flag}</em> : null}{meta}</span>
        <span className="dz-row-l3">
          <strong>{value}</strong>
          {칩.length
            ? <span className="dz-chips">{칩.map((c) => <i key={c}>{c}</i>)}</span>
            : aside ? <small>{aside}</small> : null}
        </span>
      </span>
    </Link>
  );
}
