import { blockOf, intakeTaskOf, type Block, type SettlementRow } from '../../domain/settlement/types';
import { BUCKETS, bucketOf, type Bucket } from '../../domain/settlement/stage';
import { intakeAgeDays, sortIntakeRows } from '../../domain/settlement/intake-list';
import { standingFixed, tallyMatch } from '../_design/facet-standing';
import { 고른값 } from '../_design/pick';
import { 많은순 } from '../products/workspace-config';
import type { FacetAxis } from '../_design/FilterSheet';
import { sp, txt } from '../_fn/fmt';
import type { BoardRow } from '../products/BoardList';

/**
 * 접수 목록 — 옛 판(products/workspace.tsx 접수 모드)의 규칙을 «그대로» 옮겼다. 첫 화면(IntakeSide)과 더 불러오기(list-actions)가 같이 쓴다.
 *   ★칸 = 계약이 앉는 자리 다섯(기능 stage.ts · 대표 2026-09-18 「접수 → 분납실적/완납실적 → 완납·인도 기준 청구·지급」)
 *     당월접수 · 미완료 · 분납실적 · 완납실적 · 취소. 처음 여는 칸 = 당월접수(이달의 일).
 *     미완료(지난달 이전 접수인데 아직 인도 전)는 오래 있을수록 위험 — 오래된 것부터, 「지연 N일」.
 *   ★세부조건 여섯 — 접수월 · 공급사 · 영업채널 · 영업담당 · 상품구분 · 다음 할 일(주소 칸은 i 로 시작해 상품 쪽 거름과 안 섞인다).
 */
type Tone = 'good' | 'warn' | 'bad' | undefined;

/** 접수 상세의 한 마디 — 지금 멈춘 자리(다음 걸음). 초록 = 끝, 호박 = 할 일, 빨강 = 원장 정보가 비어 못 감 */
export function 멈춘자리(r: SettlementRow): { t: string; tone: Tone } {
  if (r.progress.cancelled) return { t: '취소', tone: undefined };
  const b = blockOf(r);
  if (!b) return { t: '완료', tone: 'good' };
  const 표: Partial<Record<Block, { t: string; tone: Tone }>> = {
    계약서: { t: '서류 대기', tone: 'warn' },
    '차량번호 없음': { t: '차번 대기', tone: 'warn' },
    인도: { t: '인도 대기', tone: 'warn' },
    '공급사 없음': { t: '공급사 없음', tone: 'bad' },
    '영업채널 없음': { t: '채널 없음', tone: 'bad' },
    '청구금액 모름': { t: '금액 모름', tone: 'bad' },
    '지급금액 모름': { t: '금액 모름', tone: 'bad' },
  };
  return 표[b] ?? { t: `정산 · ${b}`, tone: undefined };
}
export const 제목 = (r: SettlementRow) => [txt(r.customer), r.model].filter(Boolean).join(' · ');

/** 칸 표 — 칸이 곧 상태(옛 접수상태 그대로). 당월접수는 인도 여부로 한 번 더 가른다 */
function 칸표(r: SettlementRow, b: Bucket): { t: string; tone: Tone } {
  if (b === '취소') return { t: '취소', tone: undefined };
  if (b === '미완료') return { t: '미완료', tone: 'bad' };
  if (b === '완납실적') return { t: '완납실적', tone: 'good' };
  if (b === '분납실적') return { t: '분납실적', tone: 'warn' };
  return r.progress.delivered ? { t: '인도', tone: 'good' } : { t: '접수', tone: 'warn' };
}
const 할일말: Record<ReturnType<typeof intakeTaskOf>, string> = {
  계약: '다음 · 계약서', 차량: '다음 · 차량번호', 인도: '다음 · 인도', 정산: '다음 · 정산', 완료: '끝', 취소: '취소됨',
};

export const 보기: { key: Bucket | 'all'; label: string }[] = [
  ...BUCKETS.map((b) => ({ key: b, label: b })), { key: 'all', label: '전체' },
];

export function intakeListModel(all: SettlementRow[], q: Record<string, string | string[] | undefined>,
  keep: (extra: Record<string, string>) => string, today: string) {
  const iv = ((BUCKETS as string[]).includes(sp(q.iv)) || sp(q.iv) === 'all' ? sp(q.iv) : '당월접수') as Bucket | 'all';
  const 칸의 = new Map(all.map((r) => [r, bucketOf(r)] as const));
  const 칸수 = Object.fromEntries([...BUCKETS.map((b) => [b, all.filter((r) => 칸의.get(r) === b).length]), ['all', all.length]]) as Record<Bucket | 'all', number>;
  const 진행 = (r: SettlementRow) => iv === 'all' || 칸의.get(r) === iv;

  const 접수축: [string, string, (r: SettlementRow) => string][] = [
    ['im', '접수월', (r) => String(r.receivedAt ?? '').slice(0, 7)],
    ['isup', '공급사', (r) => r.supplier ?? ''],
    ['ich', '영업채널', (r) => r.channel ?? ''],
    ['iag', '영업담당', (r) => r.agent ?? ''],
    ['ipr', '상품구분', (r) => r.product ?? ''],
    ['itask', '다음 할 일', (r) => intakeTaskOf(r)],
  ];
  const isel = Object.fromEntries(접수축.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const i통과 = (r: SettlementRow, skip?: string) => 접수축.every(([a, , of]) => a === skip || !isel[a].length || isel[a].includes(of(r)));
  const iq = (sp(q.iq) || sp(q.wiq)).trim().toLowerCase();
  const isearched = all.filter(진행)
    .filter((r) => !iq || [r.plate, r.customer, r.model, r.supplier, r.channel, r.agent, r.id].join(' ').toLowerCase().includes(iq));
  const shown = sortIntakeRows(isearched.filter((r) => i통과(r)), iv);
  const axes: FacetAxis[] = 접수축.map(([a, label, of]) => {
    const keys = a === 'im' ? [...new Set(all.map(of).filter(Boolean))].sort().reverse() : 많은순(all.map(of));
    const base = tallyMatch(all, keys, (r, k) => of(r) === k);
    const live = tallyMatch(isearched.filter((r) => i통과(r, a)), keys, (r, k) => of(r) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });
  const 걸린조건 = axes.flatMap((ax) => isel[ax.key].map((k) => ({
    key: `${ax.key}:${k}`, label: `${ax.label} ${k}`,
    href: keep({ [ax.key]: isel[ax.key].filter((x) => x !== k).join(','), ic: '', v: 'work' }),
  })));

  const rows: BoardRow[] = shown.map((r) => {
    const b = 칸의.get(r)!;
    const m = 칸표(r, b);
    const days = b === '미완료' ? intakeAgeDays(r, today) : null;
    return {
      id: r.id, href: keep({ ic: r.id, w: '', v: 'detail' }), title: 제목(r) || r.id, tag: m.t, tagTone: m.tone, kind: r.product ?? undefined,
      meta: [r.receivedAt ? `접수 ${r.receivedAt.slice(5).replace('-', '/')}` : '', r.plate, r.channel, r.agent].filter(Boolean).join(' · '),
      value: [b === '미완료' ? (days === null ? '지연' : `지연 ${days}일`) : '', 할일말[intakeTaskOf(r)]].filter(Boolean).join(' · '),
      thumbLabel: '접수',
    };
  });
  return { rows, iv, 칸수, axes, 걸린조건 };
}
