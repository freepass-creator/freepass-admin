/**
 * PC 계약접수 · 실적 — 전체 훑어보기 전용 단독 목록(페이지네이션 있음). ④ 헤더 → 한 목록 판
 * (⑥ 조회조건 · ⑦ 상태 탭 · 그리드 · 바닥). 접수 상세(?ic=) · 신규 접수 폼(?w=new)은 여기 없다 —
 * 그건 WorkspaceScreen(3패널, 가운데 판이 등힘)이 맡는다(대표 2026-09-24 스스로 정정).
 *   실적은 따로 판이 없다 — 실적 칸(분납실적 · 완납실적)을 고르면 같은 판이 «실적» 이 되고 금액 열이 선다(대표 2026-09-23).
 */
import Link from 'next/link';
import { settlements, today } from '../../server/erp5';
import type { SettlementRow } from '../../domain/settlement/types';
import { BUCKETS, bucketOf, type Bucket } from '../../domain/settlement/stage';
import { claimAmountOf, marginOf, payAmountOf } from '../../domain/settlement/money';
import { sortIntakeRows } from '../../domain/settlement/intake-list';
import { sp, txt } from '../_fn/fmt';
import { Badge, Panel, PanelBody, PanelFoot, PanelHead, RowCard, RowCards, hrefWith, PageHeader, Screen, SearchBar, Seg, won0, type Tone } from './parts';

type Q = Record<string, string | string[] | undefined>;
const 실적칸: Bucket[] = ['분납실적', '완납실적'];
const TONE: Record<Bucket, Tone> = { 당월접수: 'info', 미완료: 'warn', 분납실적: 'neutral', 완납실적: 'ok', 취소: 'err' };
/** 목록 카드의 작은 진행 단계 — 상세의 진행 단계와 같은 다섯 걸음 */
const FLOW = ['접수', '계약서', '인도', '청구', '수금·지급'];
const PAGE = 15;
const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);

export async function IntakeScreen({ q, base = '/intake' }: { q: Q; base?: string }) {
  let rows: SettlementRow[];
  try { rows = (await settlements.list()).map((x) => x.row); }
  catch (e) { return <Screen name="intake"><PageHeader crumb={['홈', '계약접수']} title="계약접수" desc={<span className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</span>} /></Screen>; }
  const now = new Date(`${today()}T12:00:00+09:00`);
  const bucket = new Map(rows.map((r) => [r, bucketOf(r, now)]));

  /* ── 목록 ── */
  const iv = (BUCKETS as string[]).includes(sp(q.iv)) || sp(q.iv) === 'all' ? sp(q.iv) : '당월접수';
  const perfView = 실적칸.includes(iv as Bucket);
  const text = sp(q.iq).trim().toLowerCase();
  const sup = sp(q.isup), ch = sp(q.ich);
  const searched = rows
    .filter((r) => !text || [r.customer, r.plate, r.model, r.supplier, r.channel, r.agent].join(' ').toLowerCase().includes(text))
    .filter((r) => !sup || r.supplier === sup).filter((r) => !ch || r.channel === ch);
  const inView = (r: SettlementRow) => iv === 'all' || bucket.get(r) === iv;
  const shown = sortIntakeRows(searched.filter(inView), iv as Bucket | 'all');
  const page = Math.max(1, Number(sp(q.page)) || 1);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const slice = shown.slice((page - 1) * PAGE, page * PAGE);
  const n = (b: Bucket) => searched.filter((r) => bucket.get(r) === b).length;
  const suppliers = [...new Set(rows.map((r) => r.supplier).filter(Boolean) as string[])].sort();
  const channels = [...new Set(rows.map((r) => r.channel).filter(Boolean) as string[])].sort();
  const perfRows = rows.filter((r) => 실적칸.includes(bucket.get(r)!));
  const title = perfView ? '실적' : '계약접수';

  return (
    <Screen name={perfView ? 'performance' : 'intake'}>
      <PageHeader crumb={['홈', '업무', title]} title={title}
        desc={perfView ? '인도된 계약 — 분납실적 · 완납실적. 청구 · 지급 · 남는 것을 한 줄로 봅니다.' : '접수부터 계약서 · 인도 · 취소까지 모든 접수의 진행을 봅니다. 새 접수는 상품찾기에서 차를 고르고 시작합니다.'}
        actions={<>
          <Link className="erp-btn erp-btn--ghost" href="/settlement">정산관리</Link>
          <Link className="erp-btn erp-btn--primary" href="/products">신규 접수</Link>
        </>} />
      <Panel>
        <PanelHead kind="목록" title={title} count={`전체 ${shown.length}건`} />
        <PanelBody>
          <SearchBar base={base} q={q} name="iq" placeholder="고객 · 차번 · 모델 · 공급사 · 담당" keep={['iv']} facets={[
            { key: 'isup', title: '공급사', options: suppliers.map((v) => ({ value: v, count: rows.filter((r) => r.supplier === v && inView(r)).length })) },
            { key: 'ich', title: '영업채널', options: channels.map((v) => ({ value: v, count: rows.filter((r) => r.channel === v && inView(r)).length })) },
          ]} />
          <div className="erp-toolbar" data-region="grid-toolbar">
            <span className="erp-toolbar-spacer" />
            <Seg label="접수 칸" items={[
                { key: 'all', label: `전체 ${searched.length}`, href: hrefWith(base, q, { iv: 'all', page: null }), on: iv === 'all' },
                ...BUCKETS.map((b) => ({ key: b, label: `${b} ${n(b)}`, href: hrefWith(base, q, { iv: b === '당월접수' ? null : b, page: null }), on: iv === b })),
              ]} />
          </div>
          <RowCards label={`${title} 목록`}>
            {slice.map((r) => {
              const b = bucket.get(r)!;
              const pg = r.progress;
              const at = pg.cancelled ? -1 : !pg.paper ? 1 : !pg.delivered ? 2 : !pg.billed ? 3 : !(pg.collected && pg.paid) ? 4 : 5;
              const todo = pg.cancelled ? '취소됨' : ['', '계약서 대기', '인도 대기', '청구 대기', pg.collected ? '지급 대기' : '수금 대기', '정산 끝'][at];
              return (
                /* ic 는 WorkspaceScreen(가운데 판)의 몫 — iv/iq 등을 지운 깨끗한 주소라야 거기로 간다(intake/page.tsx 갈림) */
                <RowCard key={r.id} href={`${base}?ic=${encodeURIComponent(r.id)}`} tone={TONE[b]}
                  title={txt(r.customer)} badge={<Badge tone={TONE[b]}>{b}</Badge>}
                  plate={txt(r.plate)} car={txt(r.model)}
                  meta={`접수 ${txt(r.receivedAt)}${perfView ? ` · 인도 ${txt(pg.deliveredAt)}` : ''} · ${todo}`}
                  steps={{ labels: FLOW, at }}
                  facts={perfView ? [
                    ['공급사', txt(r.supplier), `청구 ${r.claimStage}`],
                    ['영업채널', txt(r.channel), `지급 ${r.payStage}`],
                    ['청구액', `${won0(claimAmountOf(r, now))}원`],
                    ['지급액', `${won0(payAmountOf(r, now))}원`],
                  ] : [
                    ['공급사', txt(r.supplier)],
                    ['상품 · 기간', txt(r.product), `${r.term ?? '—'}개월`],
                    ['영업채널', txt(r.channel), r.agent ? `담당 ${r.agent}` : undefined],
                    ['보증금', r.deposit ? `${won0(r.deposit)}원` : '무보증', txt(r.payKind)],
                  ]}
                  amount={won0(perfView ? marginOf(r, now) : r.rent)} amountLabel={perfView ? '남는 것' : '월 대여료'} />
              );
            })}
          </RowCards>
        </PanelBody>
        <PanelFoot>
          <span>총 <b>{shown.length}</b>건</span>
          {!perfView ? <><span>·</span><span>월 대여료 합계 <b>{won0(sum(shown.map((r) => r.rent)))}</b>원</span></> : null}
          {perfView ? <><span>·</span><span>청구 <b>{won0(sum(shown.map((r) => claimAmountOf(r, now))))}</b>원 · 지급 <b>{won0(sum(shown.map((r) => payAmountOf(r, now))))}</b>원 · 남는 것 <b>{won0(sum(shown.map((r) => marginOf(r, now))))}</b>원</span></> : null}
          <nav className="erp-pager" aria-label="페이지">
            {Array.from({ length: pages }, (_, i) => i + 1).map((k) => (
              <Link key={k} href={hrefWith(base, q, { page: String(k) })} aria-current={k === page ? 'page' : undefined}>{k}</Link>
            ))}
          </nav>
        </PanelFoot>
      </Panel>
    </Screen>
  );
}
