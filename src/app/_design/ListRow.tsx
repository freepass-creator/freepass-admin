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
 *   · 뱃지는 두 가지뿐(_design/Badges, 화이트라벨 규격) — 1줄 신원 딱지(상자) · 3줄 조건 표시(✓ + 굵은 글자, 상자 없음).
 *   · 강조는 색으로만(규칙 ④) — 딱지 `tone="act"`(할 일이 있다) 는 옅은 남색 면 + 남색 글자.
 *   · 고른 줄 = 옅은 남색 면. 선은 없다(규칙 ①).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PerkMarks, Tag, 상품신원, 신원 } from './Badges';
import { Icon } from './Icon';

/**
 * ★상태 칸 — 사진이 없는 목록(접수 · 정산 묶음 · 실적 줄)은 사진 자리에 «상태 그림» 하나(대표 2026-09-18
 *   「상품목록 아닌 곳에도 상품목록 사진처럼 썸네일 아이콘 하나 해서 그 목록의 상태값을 표현 · 직관적으로 어떤 상태인지」).
 *   그림 + 한 낱말 · 색은 면에만(남색 = 진행 · 초록 = 끝 · 붉음 = 멈춤/위험 · 회색 = 대기/취소 · 호박 = 보류).
 */
export type RowStatus = { icon: string; label: string; tone: 'navy' | 'green' | 'red' | 'grey' | 'amber' };

export function StatusTile({ s }: { s: RowStatus }) {
  return (
    <span className={`dz-row-status ${s.tone}`} aria-label={s.label}>
      <Icon name={s.icon} size={20} stroke={2} /><em>{s.label}</em>
    </span>
  );
}

/** 접수·실적 한 칸 — 끝 · 취소는 제 그림, 할 일이 남았으면(act) 기다림 */
const 할일 = (text: string, tone: 'plain' | 'act' | 'warn') => {
  const s = 신원(text);
  return tone !== 'plain' && s.icon === 'tag' ? { icon: 'clock' } : s;
};

export function ListRow({ href, selected, thumb, status, title, badge, badges, tone = 'plain', flag, meta, value, aside, chips, product }: {
  href: string;
  selected?: boolean;
  /** 사진 칸 — 상품 목록만 준다. `null` 이면 「사진 없음」 칸이 서고, `undefined` 면 칸 자체가 없다. */
  thumb?: string | null;
  /** 상태 칸 — 사진 없는 목록에서 사진 자리에 선다 */
  status?: RowStatus;
  title: ReactNode;
  /** 뱃지 하나(접수·실적) — `tone` 이 이 뱃지에 걸린다 */
  badge?: ReactNode;
  /** 뱃지 여럿(상품: 상품구분 · 배차상태) — 늘 옅은 바탕 */
  badges?: ReactNode[];
  tone?: 'plain' | 'act' | 'warn';
  /** 둘째 줄 앞의 «살필 것» 한 마디 — 남색 굵게(예: 차종이 「세부모델까지」만 확정) */
  flag?: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  aside?: ReactNode;
  /** 셋째 줄 오른쪽 칩(혜택조건) — 받은 차례 그대로. 있으면 곁값 대신 선다 */
  chips?: string[];
  /**
   * ★상품 줄 — 대표 2026-09-18 「맨 첫 줄에 세부 모델만(제조사 필요 없고) + 상태 배지 · 상품구분 배지 →
   *   그다음이 바로 기간 · 대여료 · 보증금 → 세 번째 줄이 21세 되냐 뭐 되냐 이런 조건」 · 「재원 이런 건 필요 없어 — 눌러서 보면 되고」
   *   ⇒ 1줄 이름 + 칩 · 2줄 값(굵게, 왼쪽) · 3줄 조건 표시(왼쪽). 곁 정보(차번·연식·주행·연료) 줄이 없다.
   */
  product?: boolean;
}) {
  /** ★차례가 뜻이다(심사가 맨 앞) — 자르지 않고 다 싣는다. 자리가 모자라면 CSS 가 «뒤에서부터 통째로» 숨긴다. */
  const 칩 = (chips ?? []).filter(Boolean);
  return (
    <Link href={href} className={`dz-row${selected ? ' on' : ''}`}>
      {thumb === undefined && status && <StatusTile s={status} />}
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
            {/* 신원 칩 — 아이콘 + 글자(갈래마다 그림 · 좋은 소식은 초록). 할 일(act)은 기다림 그림 */}
            {/* 상품 칩 — 화이트라벨 그대로: 차례 = [상품구분, 출고상태] */}
            {(badges ?? []).map((x, i) => (x ? <Tag key={i} {...(typeof x === 'string' ? 상품신원(x, i === 0 && (badges ?? []).length > 1 ? 'kind' : 'status') : {})}>{x}</Tag> : null))}
            {badge ? <Tag tone={tone} {...(typeof badge === 'string' ? 할일(badge, tone) : {})}>{badge}</Tag> : null}
          </span>
        </span>
        {product ? (
          <>
            <span className="dz-row-l2 value"><strong>{value}</strong></span>
            <span className="dz-row-l3 perks">{칩.length ? <PerkMarks marks={칩} compact /> : <small>조건 없음</small>}</span>
          </>
        ) : (
          <>
            <span className="dz-row-l2">{flag ? <em className="dz-flag">{flag}</em> : null}{meta}</span>
            <span className="dz-row-l3">
              <strong>{value}</strong>
              {칩.length
                ? <PerkMarks marks={칩} compact />
                : aside ? <small>{aside}</small> : null}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}
