import Link from 'next/link';
import { contracts } from '../../server/erp5';
import { num, sp, txt, when, won } from '../_fn/fmt';
import { ListRow, type RowStatus } from '../_design/ListRow';
import { Icon } from '../_design/Icon';

export const dynamic = 'force-dynamic';

type 계약 = Awaited<ReturnType<typeof contracts.list>>[number];

const SIGN_FILTERS = ['', '발행', '열람', '진행중', '서명완료', '미연결'] as const;

function 서명상태(c: 계약): RowStatus {
  if (c.signStatus === '서명완료') return { icon: 'circle-check', label: '서명완료', tone: 'green' };
  if (c.signStatus === '진행중') return { icon: 'clock', label: '진행중', tone: 'navy' };
  if (c.signStatus === '열람') return { icon: 'info', label: '열람', tone: 'amber' };
  if (c.signStatus === '발행') return { icon: 'send', label: '발행', tone: 'navy' };
  return { icon: 'file-text', label: '미연결', tone: 'grey' };
}

export default async function EsignPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const text = sp(q.q).trim().toLowerCase();
  const sign = SIGN_FILTERS.includes(sp(q.sign) as (typeof SIGN_FILTERS)[number]) ? sp(q.sign) : '';
  const id = sp(q.id);

  let all: Awaited<ReturnType<typeof contracts.list>>;
  try {
    all = await contracts.list();
  } catch (e) {
    return <><h1>전자계약</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>;
  }

  const searched = all.filter((c) => !text
    || [c.code, c.plate, c.vehicle, c.customer, c.agent, c.signStatus, c.status]
      .join(' ').toLowerCase().includes(text));
  const shown = searched.filter((c) => {
    if (!sign) return true;
    if (sign === '미연결') return !c.signStatus;
    return c.signStatus === sign;
  });

  const selected = shown.find((c) => c.id === id) ?? shown[0] ?? null;
  const view = (sp(q.v) === 'detail' || id) && selected ? 'detail' : 'list';

  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])));
    for (const [k, v] of Object.entries(extra)) {
      if (v) u.set(k, v);
      else u.delete(k);
    }
    const s = u.toString();
    return s ? `/esign?${s}` : '/esign';
  };

  const count = (s: string) => s === '미연결'
    ? all.filter((c) => !c.signStatus).length
    : s ? all.filter((c) => c.signStatus === s).length : all.length;

  const byCode = new Map<string, number>();
  for (const c of all) byCode.set(c.code, (byCode.get(c.code) ?? 0) + 1);
  const duplicateCodes = [...byCode].filter(([, n]) => n > 1);

  return (
    <section className="workspace" data-mode="esign" data-phone={view}>
      <section className="panel product-panel">
        <div className="dz-listtop">
          <div className="panel-head">
            <div><h1>계약 목록</h1></div>
            <span className="count">{shown.length.toLocaleString()}건</span>
          </div>

          <form className="dz-find" action="/esign">
            {sign && <input type="hidden" name="sign" value={sign} />}
            <div className="searchbox dz-searchbox">
              <span className="dz-search-ico" aria-hidden><Icon name="search" size={18} stroke={2.2} /></span>
              <input name="q" defaultValue={sp(q.q)} placeholder="고객 · 차량번호 · 계약코드 · 담당자" />
            </div>
          </form>

          <div className="quick-filters">
            {SIGN_FILTERS.map((s) => (
              <Link key={s || '전체'} className={sign === s ? 'active' : ''}
                href={keep({ sign: s, id: '', v: 'list' })}>
                {s || '전체'} <small>{count(s)}</small>
              </Link>
            ))}
          </div>

          {duplicateCodes.length > 0 && (
            <p className="dz-warn">
              같은 계약코드가 둘 이상인 항목 {duplicateCodes.length}개 — ERP5 정리 대상이며 화면에서는 합치지 않습니다.
            </p>
          )}
        </div>

        <div className="list">
          {shown.map((c) => (
            <ListRow key={c.id}
              href={keep({ id: c.id, v: 'detail' })}
              selected={c.id === selected?.id}
              status={서명상태(c)}
              title={txt(c.customer)}
              badge={txt(c.signStatus) === '—' ? '미연결' : txt(c.signStatus)}
              tone={c.signStatus === '서명완료' ? 'plain' : 'act'}
              flag={c.status && c.status !== '완료' ? txt(c.status) : undefined}
              meta={[c.plate, c.vehicle, c.agent, c.code].filter(Boolean).join(' · ') || '—'}
              value={c.rent === null || c.rent === undefined ? '대여료 미확인' : `${won(c.rent)}원`}
              aside={c.term === null || c.term === undefined ? '기간 미확인' : `${num(c.term)}개월`}
            />
          ))}
          {shown.length === 0 && <p className="dz-empty">이 조건에 맞는 계약이 없습니다.</p>}
        </div>
      </section>

      <section className="panel detail-panel">
        {selected ? (
          <>
            <div className="panel-head">
              <Link className="dz-phone-back" href={keep({ id: '', v: 'list' })} aria-label="계약 목록으로">‹</Link>
              <div><h1>계약 상세</h1></div>
              <span className="count">{txt(selected.code)}</span>
            </div>

            <div className="vehicle-title">
              <div>
                <h2>{txt(selected.customer)}</h2>
                <p>{[selected.plate, selected.vehicle, selected.agent].filter(Boolean).join(' · ') || '계약 정보'}</p>
              </div>
            </div>

            <dl className="summary-grid">
              <div><dt>계약상태</dt><dd>{txt(selected.status)}</dd></div>
              <div><dt>서명상태</dt><dd>{txt(selected.signStatus)}</dd></div>
              <div><dt>기간</dt><dd>{selected.term === null || selected.term === undefined ? '—' : `${num(selected.term)}개월`}</dd></div>
              <div><dt>월 대여료</dt><dd>{selected.rent === null || selected.rent === undefined ? '—' : `${won(selected.rent)}원`}</dd></div>
            </dl>

            <h3 className="dz-sub">계약 정보</h3>
            <dl className="summary-grid">
              <div><dt>양식</dt><dd>{txt(selected.kind)}</dd></div>
              <div><dt>보험</dt><dd>{txt(selected.insurance)}</dd></div>
              <div><dt>계약일</dt><dd>{txt(selected.contractDate)}</dd></div>
              <div><dt>만든 때</dt><dd>{when(selected.createdAt)}</dd></div>
              <div><dt>발송</dt><dd>{when(selected.signSentAt)}</dd></div>
              <div><dt>서명</dt><dd>{when(selected.signedAt)}</dd></div>
            </dl>

            <div className="dz-bar">
              <div className="dz-bar-go">
                {selected.signUrl && (
                  <a className="dz-bar-sub" href={selected.signUrl} target="_blank" rel="noreferrer">서명창 열기</a>
                )}
                {selected.signedPdfUrl && (
                  <a className="primary" href={selected.signedPdfUrl} target="_blank" rel="noreferrer">서명본 열기</a>
                )}
              </div>
            </div>

            {!selected.signUrl && !selected.signedPdfUrl && (
              <p className="dz-empty">연결된 전자서명 링크나 완료 문서가 없습니다.</p>
            )}
          </>
        ) : (
          <>
            <div className="panel-head"><div><h1>계약 상세</h1></div></div>
            <p className="dz-empty">왼쪽에서 계약을 고르면 상세가 여기 섭니다.</p>
          </>
        )}
      </section>
    </section>
  );
}
