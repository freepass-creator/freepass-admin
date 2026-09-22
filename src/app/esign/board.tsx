import Link from 'next/link';
import { LiveSearch } from '../products/LiveSearch';
import '../products/board.css';
import { contracts } from '../../server/erp5';
import { erp5Ready } from '../../adapters/erp5/firestore';
import type { ContractSummary } from '../../adapters/erp5/contract-repository';
import { num, sp, when, won } from '../_fn/fmt';
import { FilterSheet, type FacetAxis } from '../_design/FilterSheet';
import { BoardList, type BoardRow } from '../products/BoardList';
import { CopyLink } from './CopyLink';

/**
 * ★★★ 전자계약 새 판 — 목업 「계약」 그대로 (대표 2026-09-22 「나머지 4개 화면으로 확장」)
 *   PC: 계약 목록 | 계약 상세 | 서명 상태 — 셋 다 1/3. 폰: 한 판씩(?v=list|detail|work).
 *   ERP5 contract 를 «읽기만» 한다(계약 쓰기는 이 화면에 없다) — 할 일은 서명창·서명본 열기와 링크 다시 보내기.
 */

type 계약 = ContractSummary;
type Tone = 'good' | 'warn' | 'bad' | undefined;

const 서명대기 = (c: 계약) => ['발행', '열람', '진행중'].includes(c.signStatus);
const 멈춤계약 = (c: 계약) => ['계약취소', '계약철회'].includes(c.status);

function 표(c: 계약): { t: string; tone: Tone } {
  if (멈춤계약(c)) return { t: c.status.replace('계약', ''), tone: 'bad' };
  if (c.signStatus === '서명완료') return { t: '서명완료', tone: 'good' };
  if (서명대기(c)) return { t: c.signStatus === '발행' ? '발송' : c.signStatus, tone: 'warn' };
  return { t: '미연결', tone: undefined };
}
/** 카드 아랫줄 — 지금 누구 차례인가 */
function 차례(c: 계약) {
  if (멈춤계약(c)) return `${c.status}`;
  if (c.signStatus === '서명완료') return c.status === '계약완료' ? '계약 완료' : '서명 완료 · 확인 대기';
  if (c.signStatus === '발행') return '고객 열람 대기';
  if (c.signStatus === '열람' || c.signStatus === '진행중') return '고객 서명 대기';
  return '전자계약 아님';
}
const 시각 = (t: number | null) => (t ? when(t) : '');

const 보기 = [
  { key: '', label: '전체', test: (_: 계약) => true },
  { key: '대기', label: '서명 대기', test: 서명대기 },
  { key: '완료', label: '서명완료', test: (c: 계약) => c.signStatus === '서명완료' },
  { key: '미연결', label: '미연결', test: (c: 계약) => !c.signStatus },
] as const;


export async function EsignBoard({ q }: { q: Record<string, string | string[] | undefined> }) {
  const data = erp5Ready();
  let all: 계약[];
  try { all = await contracts.list(); }
  catch (e) {
    return <div className="pb" data-phone="list"><p className="pb-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></div>;
  }

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const [k, v] of Object.entries(extra)) { if (v) u.set(k, v); else u.delete(k); }
    const s = u.toString();
    return s ? `/esign?${s}` : '/esign';
  };
  const 고른 = (k: string) => sp(q[k]).split(',').map((x) => x.trim()).filter(Boolean);
  const 켜끔 = (cur: string[], v: string) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',');

  const text = sp(q.q).trim().toLowerCase();
  const searched = all.filter((c) => !text || [c.code, c.plate, c.vehicle, c.customer, c.agent, c.signStatus, c.status]
    .join(' ').toLowerCase().includes(text));
  const 축 = { status: 고른('status'), agent: 고른('agent') };
  const 축값 = { status: (c: 계약) => c.status, agent: (c: 계약) => c.agent };
  const 축맞음 = (c: 계약, skip?: keyof typeof 축) =>
    (Object.keys(축) as (keyof typeof 축)[]).every((a) => a === skip || !축[a].length || 축[a].includes(축값[a](c)));
  const 거른 = searched.filter((c) => 축맞음(c));
  const 지금보기 = 보기.find((b) => b.key === sp(q.f)) ?? 보기[0];
  const sorted = 거른.filter(지금보기.test)
    .sort((a, b) => (b.signSentAt ?? b.createdAt ?? 0) - (a.signSentAt ?? a.createdAt ?? 0) || b.code.localeCompare(a.code));
  const 셈 = (a: keyof typeof 축) => {
    const m = new Map<string, number>();
    for (const c of searched.filter((x) => 축맞음(x, a))) { const v = 축값[a](c); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([key, count]) => ({ key, label: key, count }));
  };
  const axes: FacetAxis[] = [{ key: 'status', label: '계약상태', options: 셈('status') }, { key: 'agent', label: '담당자', options: 셈('agent') }];
  const 걸린조건 = axes.flatMap((ax) => 축[ax.key as keyof typeof 축].map((k) => ({
    key: `${ax.key}:${k}`, label: `${ax.label} ${k}`, href: keep({ [ax.key]: 켜끔(축[ax.key as keyof typeof 축], k) }),
  })));
  const 대기수 = all.filter(서명대기).length;
  const 겹친코드 = [...all.reduce((m, c) => m.set(c.code, (m.get(c.code) ?? 0) + 1), new Map<string, number>())].filter(([, n]) => n > 1).length;

  const selId = sp(q.id);
  const c = sorted.find((x) => x.id === selId) ?? (selId ? all.find((x) => x.id === selId) : undefined) ?? sorted[0];
  const view = (['list', 'detail', 'work'] as const).find((v) => v === sp(q.v)) ?? (selId ? 'detail' : 'list');
  const 지금 = c ? 표(c) : null;

  const 목록: BoardRow[] = sorted.map((x) => {
    const m = 표(x);
    return {
      id: x.id, href: keep({ id: x.id, v: 'detail' }), title: [x.customer, x.vehicle].filter(Boolean).join(' · ') || x.code,
      tag: m.t, tagTone: m.tone,
      meta: [x.code, x.signSentAt ? `${시각(x.signSentAt)} 발송` : x.contractDate ? `계약일 ${x.contractDate}` : ''].filter(Boolean).join(' · '),
      value: 차례(x), thumbLabel: '계약',
    };
  });

  const 흐름 = c ? [
    { k: '계약서 생성', done: !!c.createdAt, small: 시각(c.createdAt) || '—' },
    { k: '서명 링크 발송', done: !!c.signSentAt, small: 시각(c.signSentAt) || '대기' },
    { k: '고객 서명', done: c.signStatus === '서명완료', small: 시각(c.signedAt) || (서명대기(c) ? `${c.signStatus} 중` : '대기') },
    { k: '계약 완료', done: c.status === '계약완료', small: c.status || '대기' },
  ] : [];
  const 지금단계 = c && !멈춤계약(c) && c.signStatus ? 흐름.findIndex((s) => !s.done) : -1;
  const 사실 = c ? ([
    ['계약상태', c.status], ['서명상태', c.signStatus || '전자계약 아님'], ['양식', c.kind], ['보험', c.insurance],
    ['계약일', c.contractDate], ['기간', c.term != null ? `${num(c.term)}개월` : ''], ['담당자', c.agent], ['공급사코드', c.supplierCode],
  ] as [string, string][]).filter(([, v]) => v) : [];

  const 업무 = !c ? null : 멈춤계약(c)
    ? { h: `${c.status}된 계약`, p: '멈춘 계약입니다. 서명 링크를 다시 보내지 않습니다.' }
    : c.signStatus === '서명완료'
      ? { h: '서명 완료', p: c.status === '계약완료' ? '계약까지 끝났습니다. 서명본을 열어 확인할 수 있습니다.' : '고객 서명이 끝났습니다. 서명본을 확인하고 계약을 마무리합니다.' }
      : 서명대기(c)
        ? { h: c.signStatus === '발행' ? '고객 열람 대기' : '고객 서명 대기', p: '고객이 링크를 못 찾으면 링크를 복사해 다시 보냅니다. 서명이 끝나면 서명본이 섭니다.' }
        : { h: '전자계약 아님', p: '전자서명과 연결되지 않은 계약입니다(대면 계약 등).' };

  const 상태 = <span className={`sync${data.ok ? '' : ' warn'}`}>{data.ok ? '연결 정상' : '데이터 설정 필요'}</span>;
  const 폰머리 = {
    list: { title: <>전자계약<span>{sorted.length}건</span></>, sub: 대기수 ? `서명 대기 ${대기수}건` : '대기 없음' },
    detail: { title: <>계약 상세</>, sub: 지금?.t ?? '계약을 고르세요' },
    work: { title: <>서명 상태</>, sub: 업무?.h ?? '' },
  }[view];

  /* 주 버튼 하나 — 서명본이 있으면 그것, 없으면 서명창. 링크 복사는 곁 버튼 */
  const 주 = c?.signedPdfUrl
    ? <a className="primary" href={c.signedPdfUrl} target="_blank" rel="noreferrer">서명본 열기</a>
    : c?.signUrl && !멈춤계약(c)
      ? <a className="primary" href={c.signUrl} target="_blank" rel="noreferrer">서명창 열기</a>
      : null;

  return (
    <div className="pb" data-phone={view}>
      <header className="statusbar">
        <div><h1>{폰머리.title}</h1><small>{폰머리.sub}</small></div>
        {상태}
      </header>

      <div className="web-workspace">
        {/* ── 계약 목록 ── */}
        <section className="web-panel pb-list">
          <header className="web-panel-head">
            <h2>전자계약</h2><span>{sorted.length}건</span><small>{대기수 ? `서명 대기 ${대기수}건` : '대기 없음'}</small>
          </header>
          <div className="list-tools">
            <form className="search" action="/esign">
              {Object.entries(q).filter(([k, v]) => !['q', 'id', 'v'].includes(k) && sp(v))
                .map(([k, v]) => <input key={k} type="hidden" name={k} value={sp(v)} />)}
              <div className="search-field">
                <LiveSearch name="q" defaultValue={sp(q.q)} label="검색" placeholder="고객·차량번호·계약번호 검색" reset={['id']} />
              </div>
              <FilterSheet axes={axes} count={sorted.length} unit="건" />
            </form>
            <div className="chips" role="group" aria-label="보기">
              {보기.map((b) => {
                const on = b === 지금보기;
                return (
                  <Link key={b.label} className={`chip${on ? ' on' : ''}`} href={keep({ f: b.key, id: '', v: '' })} aria-current={on ? 'true' : undefined}>
                    {b.label}{b.key ? ` ${거른.filter(b.test).length}` : ''}{on && <span className="sr-only"> (선택됨)</span>}
                  </Link>
                );
              })}
            </div>
            {걸린조건.length > 0 && (
              <div className="applied" aria-label="걸어 둔 조건">
                {걸린조건.map((x) => (
                  <Link key={x.key} className="applied-chip" href={x.href} aria-label={`${x.label} 조건 풀기`}>
                    <span>{x.label}</span><span aria-hidden="true">✕</span>
                  </Link>
                ))}
                <Link className="applied-clear" href={keep({ status: '', agent: '', q: '' })}>모두 지우기</Link>
              </div>
            )}
            {겹친코드 > 0 && <p className="notice warn">같은 계약번호가 둘 이상인 계약 {겹친코드}개 — ERP5 정리 대상이라 화면에서 합치지 않습니다.</p>}
            </div>
            <div className="web-scroll">
            <BoardList rows={목록} selectedId={c?.id} unit="건" empty="조건에 맞는 계약이 없습니다." />
          </div>
        </section>

        {/* ── 계약 상세 ── */}
        <section className="web-panel pb-detail">
          <header className="web-panel-head"><h2>계약 상세</h2><small>{지금?.t ?? ''}</small></header>
          <div className="web-scroll">
            {c && 지금 ? (
              <>
                <div className="identity">
                  <span className={`tag${지금.tone ? ` ${지금.tone}` : ''}`}>{지금.t}</span>
                  <h3>{[c.customer, c.vehicle].filter(Boolean).join(' · ') || c.code}</h3>
                  <p>{[c.plate, c.agent, c.code].filter(Boolean).join(' · ')}</p>
                  {c.rent != null && <div className="money">월 {won(c.rent)}원{c.term ? <small style={{ marginLeft: 6, color: 'var(--muted)', fontSize: 'var(--support)', fontWeight: 500 }}>{c.term}개월</small> : null}</div>}
                </div>
                <div className="section">
                  <h4>계약 흐름</h4>
                  <ol className="timeline">
                    {흐름.map((s, i) => (
                      <li key={s.k} className={`step${s.done ? ' done' : ''}${i === 지금단계 ? ' now' : ''}`} aria-current={i === 지금단계 ? 'step' : undefined}>
                        <i aria-hidden="true">{s.done ? '✓' : ''}</i><b>{s.k}</b><small>{s.small}</small>
                        {s.done && <span className="sr-only"> (완료)</span>}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="section">
                  <h4>계약 정보</h4>
                  <div className="facts">{사실.map(([k, v]) => <div key={k} className="fact"><span>{k}</span><b>{v}</b></div>)}</div>
                </div>
              </>
            ) : <p className="empty">{sorted.length ? '왼쪽에서 계약을 고르세요.' : '조건에 맞는 계약이 없습니다.'}</p>}
          </div>
          {c && (
            <div className="web-actions only-phone">
              <Link className="tertiary" href={keep({ v: 'list' })}>목록</Link>
              <Link className="primary" href={keep({ id: c.id, v: 'work' })}>서명 상태</Link>
            </div>
          )}
        </section>

        {/* ── 서명 상태 ── */}
        <section className="web-panel pb-work">
          <header className="web-panel-head"><h2>서명 상태</h2><small>{c ? 차례(c) : ''}</small></header>
          <div className="web-scroll">
            {c && 업무 ? (
              <>
                <div className="identity">
                  <span className={`tag${지금?.tone ? ` ${지금.tone}` : ''}`}>서명 상태</span>
                  <h3>{업무.h}</h3>
                  <p>{업무.p}</p>
                </div>
                <div className="section">
                  <h4>처리 기준</h4>
                  <ol className="timeline">
                    <li className={`step${c.signSentAt ? ' done' : ''}`}><i aria-hidden="true">{c.signSentAt ? '✓' : ''}</i><b>링크 발송</b><small>{c.signSentAt ? '완료' : '대기'}</small></li>
                    <li className={`step${c.signStatus === '서명완료' ? ' done' : 서명대기(c) ? ' now' : ''}`}><i aria-hidden="true">{c.signStatus === '서명완료' ? '✓' : ''}</i><b>고객 서명</b><small>{c.signStatus === '서명완료' ? '완료' : 서명대기(c) ? '진행 중' : '대기'}</small></li>
                    <li className={`step${c.signedPdfUrl ? ' done' : ''}`}><i aria-hidden="true">{c.signedPdfUrl ? '✓' : ''}</i><b>서명본 보관</b><small>{c.signedPdfUrl ? '있음' : '없음'}</small></li>
                  </ol>
                </div>
                {!c.signUrl && !c.signedPdfUrl && <p className="notice">연결된 서명 링크나 서명본이 없습니다.</p>}
              </>
            ) : <p className="empty">계약을 고르면 서명 상태가 여기 섭니다.</p>}
          </div>
          {c && (주 || c.signUrl) && (
            <div className={`web-actions${c.signUrl && !멈춤계약(c) && !c.signedPdfUrl ? ' three' : ' single-web'}`}>
              <Link className="tertiary only-phone" href={keep({ id: c.id, v: 'detail' })}>상세</Link>
              {c.signUrl && !멈춤계약(c) && !c.signedPdfUrl && <CopyLink url={c.signUrl} />}
              {주}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
