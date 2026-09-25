import Link from 'next/link';
import { contracts } from '../../server/freepass-data';
import { num, sp, txt, when, won } from '../_fn/fmt';
import { ListRow, type RowStatus } from '../_design/ListRow';
import { ActionBar, EmptyState, Notice, PanelHeader, SearchField, SummaryGrid, SummaryItem } from '../_design/Primitives';

export const dynamic = 'force-dynamic';

type 계약 = Awaited<ReturnType<typeof contracts.list>>[number];

const SIGN_FILTERS = ['', '전자서명', '발행', '열람', '진행중', '서명완료', '미연결'] as const;

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
  const status = sp(q.status);
  const id = sp(q.id);

  let all: Awaited<ReturnType<typeof contracts.list>>;
  try {
    all = await contracts.list();
  } catch (e) {
    return <><h1>전자계약</h1><p className="fn-err">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></>;
  }

  const searched = all.filter((c) => (!status || c.status === status))
    .filter((c) => !text
      || [c.code, c.plate, c.vehicle, c.customer, c.agent, c.signStatus, c.status]
        .join(' ').toLowerCase().includes(text));
  const shown = searched.filter((c) => {
    if (!sign) return true;
    if (sign === '전자서명') return !!c.signStatus;
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

  const count = (s: string) => s === '전자서명'
    ? all.filter((c) => !!c.signStatus).length
    : s === '미연결'
      ? all.filter((c) => !c.signStatus).length
      : s ? all.filter((c) => c.signStatus === s).length : all.length;
  const contractStatuses = [...new Set(all.map((c) => c.status).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko'));

  const byCode = new Map<string, number>();
  for (const c of all) byCode.set(c.code, (byCode.get(c.code) ?? 0) + 1);
  const duplicateCodes = [...byCode].filter(([, n]) => n > 1);

  return (
    <section className="workspace" data-mode="esign" data-phone={view}>
      <section className="panel product-panel">
        <div className="dz-listtop">
          <PanelHeader title="계약 목록" count={`${shown.length.toLocaleString()}건`} />

          <form className="dz-find" action="/esign">
            {sign && <input type="hidden" name="sign" value={sign} />}
            {status && <input type="hidden" name="status" value={status} />}
            <div className="searchbox dz-searchbox">
              <SearchField name="q" defaultValue={sp(q.q)} placeholder="고객 · 차량번호 · 계약코드 · 담당자" />
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

          {contractStatuses.length > 1 && (
            <div className="quick-filters">
              <Link className={!status ? 'active' : ''} href={keep({ status: '', id: '', v: 'list' })}>계약 전체</Link>
              {contractStatuses.map((s) => (
                <Link key={String(s)} className={status === s ? 'active' : ''}
                  href={keep({ status: String(s), id: '', v: 'list' })}>
                  {txt(s)} <small>{all.filter((c) => c.status === s).length}</small>
                </Link>
              ))}
            </div>
          )}

          {duplicateCodes.length > 0 && (
            <Notice tone="warn">
              같은 계약코드가 둘 이상인 항목 {duplicateCodes.length}개 — ERP5 정리 대상이며 화면에서는 합치지 않습니다.
            </Notice>
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
          {shown.length === 0 && <EmptyState>이 조건에 맞는 계약이 없습니다.</EmptyState>}
        </div>
      </section>

      <section className="panel detail-panel">
        {selected ? (
          <>
            <PanelHeader title="계약 상세" count={txt(selected.code)}
              backHref={keep({ id: '', v: 'list' })} backLabel="계약 목록으로" />

            <div className="vehicle-title">
              <div>
                <h2>{txt(selected.customer)}</h2>
                <p>{[selected.plate, selected.vehicle, selected.agent].filter(Boolean).join(' · ') || '계약 정보'}</p>
              </div>
            </div>

            <SummaryGrid>
              <SummaryItem label="계약상태">{txt(selected.status)}</SummaryItem>
              <SummaryItem label="서명상태">{txt(selected.signStatus)}</SummaryItem>
              <SummaryItem label="기간">{selected.term === null || selected.term === undefined ? '—' : `${num(selected.term)}개월`}</SummaryItem>
              <SummaryItem label="월 대여료">{selected.rent === null || selected.rent === undefined ? '—' : `${won(selected.rent)}원`}</SummaryItem>
            </SummaryGrid>

            <h3 className="dz-sub">계약 정보</h3>
            <SummaryGrid>
              <SummaryItem label="양식">{txt(selected.kind)}</SummaryItem>
              <SummaryItem label="보험">{txt(selected.insurance)}</SummaryItem>
              <SummaryItem label="계약일">{txt(selected.contractDate)}</SummaryItem>
              <SummaryItem label="만든 때">{when(selected.createdAt)}</SummaryItem>
              <SummaryItem label="발송">{when(selected.signSentAt)}</SummaryItem>
              <SummaryItem label="서명">{when(selected.signedAt)}</SummaryItem>
            </SummaryGrid>

            <ActionBar>
              {selected.signUrl && (
                <a className="dz-bar-sub" href={selected.signUrl} target="_blank" rel="noreferrer">서명창 열기</a>
              )}
              {selected.signedPdfUrl && (
                <a className="primary" href={selected.signedPdfUrl} target="_blank" rel="noreferrer">서명본 열기</a>
              )}
            </ActionBar>

            {!selected.signUrl && !selected.signedPdfUrl && (
              <EmptyState>연결된 전자서명 링크나 완료 문서가 없습니다.</EmptyState>
            )}
          </>
        ) : (
          <>
            <PanelHeader title="계약 상세" />
            <EmptyState>왼쪽에서 계약을 고르면 상세가 여기 섭니다.</EmptyState>
          </>
        )}
      </section>
    </section>
  );
}
