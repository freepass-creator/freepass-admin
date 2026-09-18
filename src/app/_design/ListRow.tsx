/**
 * ★★★**목록 한 줄 — 모든 목록이 이 한 줄을 쓴다** (대표 2026-09-18)
 *   「목록줄을 어떻게 할 건지 목록 통일을 해봐. 상품목록이랑 접수 실적 어찌 됐든 다 목록이니까 목록 규격 통일해야 할 듯」
 *
 * 기준 = 확정 목업(/design)의 상품 카드 — 새로 짓지 않고 그 모양을 «규격»으로 올렸다.
 * ```
 *   [사진 82×64]  제목 (메인 14 굵게) ················ 뱃지 (보조 12)
 *                 곁 정보 (보조 12 · 회색, 한 줄)
 *                 값 (메인 14 굵게) ···················· 곁값 (보조 12)
 * ```
 *   · 세 줄 · 줄 높이 64 — 사진이 있든 없든 «같은 높이». 사진 없는 목록(접수·실적)은 사진 칸만 빠진다.
 *   · 강조는 색으로만(규칙 ④) — 뱃지 `tone="act"`(할 일이 있다) 는 옅은 남색 면 + 남색 글자.
 *   · 고른 줄 = 옅은 남색 면. 선은 없다(규칙 ①).
 * ⚠ 앞서 상품 카드와 접수 카드가 줄 수·높이·글자 자리가 서로 달랐다 — 같은 화면에 두 문법이 섰다.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export function ListRow({ href, selected, thumb, title, badge, tone = 'plain', meta, value, aside }: {
  href: string;
  selected?: boolean;
  /** 사진 칸 — 상품 목록만 준다. `null` 이면 「사진 없음」 칸이 서고, `undefined` 면 칸 자체가 없다. */
  thumb?: string | null;
  title: ReactNode;
  badge?: ReactNode;
  tone?: 'plain' | 'act';
  meta?: ReactNode;
  value?: ReactNode;
  aside?: ReactNode;
}) {
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
        <span className="dz-row-l1"><b>{title}</b>{badge ? <i className={`dz-badge ${tone}`}>{badge}</i> : null}</span>
        <span className="dz-row-l2">{meta}</span>
        <span className="dz-row-l3"><strong>{value}</strong>{aside ? <small>{aside}</small> : null}</span>
      </span>
    </Link>
  );
}
