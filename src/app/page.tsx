'use client';

import { useEffect, useMemo, useState } from 'react';
import { FixtureAdminDataAdapter } from '../adapters/freepass-data/fixture-admin-data';
import type {
  AdminDashboardReadModel,
  AdminDataQuery,
  AdminRole,
  EvidenceField,
  FreshnessState,
  HoldState,
  ProductSort,
} from '../ports/admin-data';

type MobileView = 'products' | 'detail' | 'work';
type OpsView = 'sources' | 'holds' | 'audit';
type Scenario = NonNullable<AdminDataQuery['scenario']>;

const dataPort = new FixtureAdminDataAdapter();

const initialQuery: AdminDataQuery = {
  role: 'ADMIN', search: '', hold: 'ALL', freshness: 'ALL', sort: 'MATCH', limit: 2, scenario: 'NORMAL',
};

const stateLabel = {
  KNOWN: '확인', UNKNOWN: '미확인', CONFLICT: '충돌', PARTIAL: '부분', REDACTED: '권한 제한',
} as const;

function formatTime(value?: string) {
  if (!value) return '미확인';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

function FieldEvidence<T>({ label, field }: { label: string; field: EvidenceField<T> }) {
  return (
    <div className={`evidence-field state-${field.state.toLowerCase()}`}>
      <div className="evidence-value"><span>{label}</span><b>{field.display}</b><em>{stateLabel[field.state]}</em></div>
      <div className="provenance-line">
        <code>{field.provenance.provenanceRef}</code><span>{formatTime(field.provenance.observedAt)}</span>
        {field.provenance.sourceRecordRef ? <span>{field.provenance.sourceRecordRef}</span> : null}
      </div>
      {field.provenance.note ? <p>{field.provenance.note}</p> : null}
    </div>
  );
}

function FreshnessBadge({ state }: { state: FreshnessState }) {
  return <span className={`data-badge badge-${state.toLowerCase()}`}>{state}</span>;
}

export default function AdminHome() {
  const [query, setQuery] = useState<AdminDataQuery>(initialQuery);
  const [data, setData] = useState<AdminDashboardReadModel | null>(null);
  const [error, setError] = useState<{ code: string; message: string; retryable: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('products');
  const [opsView, setOpsView] = useState<OpsView>('sources');
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dataPort.readDashboard(query).then((result) => {
      if (!active) return;
      if (result.ok) { setData(result.data); setError(null); }
      else { setData(null); setError(result); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [query]);

  const selected = useMemo(
    () => data?.products.find((product) => product.canonicalProductId === selectedId) ?? data?.products[0] ?? null,
    [data, selectedId],
  );

  function resetPage(patch: Partial<AdminDataQuery>) {
    setCursorStack([]);
    setQuery((current) => ({ ...current, ...patch, cursor: undefined }));
  }

  function openProduct(canonicalProductId: string) {
    setSelectedId(canonicalProductId);
    setMobileView('detail');
  }

  function nextPage() {
    if (!data?.page.nextCursor) return;
    setCursorStack((stack) => [...stack, query.cursor]);
    setQuery((current) => ({ ...current, cursor: data.page.nextCursor }));
  }

  function previousPage() {
    setCursorStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setQuery((current) => ({ ...current, cursor: previous }));
      return stack.slice(0, -1);
    });
  }

  return (
    <main className="admin-shell">
      <aside className="rail" aria-label="관리자 업무">
        <div className="brand"><strong>FREEPASS</strong><span>ADMIN · DATA V1</span></div>
        <nav className="rail-nav">
          <button className="active" onClick={() => setMobileView('products')}>상품</button>
          <button onClick={() => { setOpsView('sources'); setMobileView('work'); }}>수집 현황</button>
          <button onClick={() => { setOpsView('holds'); setMobileView('work'); }}>HOLD <span>{data?.holds.length ?? 0}</span></button>
          <button onClick={() => { setOpsView('audit'); setMobileView('work'); }}>변경 이력</button>
        </nav>
        <div className="rail-user">
          <label htmlFor="role">접근권한 fixture</label>
          <select id="role" value={query.role} onChange={(event) => resetPage({ role: event.target.value as AdminRole })}>
            <option value="ADMIN">관리자</option><option value="OPERATOR">운영자</option><option value="AUDITOR">감사자</option>
          </select>
          <span>실제 인증 연결 전 contract 검증용</span>
        </div>
      </aside>

      <section className="workspace">
        <section className={`panel product-panel ${mobileView === 'products' ? 'mobile-active' : ''}`}>
          <header className="panel-head">
            <div><p className="eyebrow">PRODUCT READ MODEL</p><h1>상품 찾기</h1></div>
            <div className="header-badges"><FreshnessBadge state={data?.freshness ?? 'ERROR'} /><span className="count">{data?.page.totalCount ?? 0}건</span></div>
          </header>
          <div className="searchline"><label className="searchbox"><span aria-hidden="true">⌕</span><input value={query.search} onChange={(event) => resetPage({ search: event.target.value })} placeholder="차량·공급사·무보증·정책 검색" aria-label="상품 검색" /></label></div>
          <div className="filter-grid" aria-label="상품 필터와 정렬">
            <label>공급사<select value={query.supplier ?? ''} onChange={(event) => resetPage({ supplier: event.target.value || undefined })}><option value="">전체</option><option>A 렌터카</option><option>B 렌터카</option><option>C 렌터카</option><option>D 렌터카</option></select></label>
            <label>HOLD<select value={query.hold} onChange={(event) => resetPage({ hold: event.target.value as HoldState | 'ALL' })}><option value="ALL">전체</option><option value="CLEAR">정상</option><option value="HOLD">HOLD</option></select></label>
            <label>신선도<select value={query.freshness} onChange={(event) => resetPage({ freshness: event.target.value as FreshnessState | 'ALL' })}><option value="ALL">전체</option><option value="FRESH">FRESH</option><option value="PARTIAL">PARTIAL</option><option value="STALE">STALE</option></select></label>
            <label>정렬<select value={query.sort} onChange={(event) => resetPage({ sort: event.target.value as ProductSort })}><option value="MATCH">정확도</option><option value="RENT_ASC">월대여료 낮은순</option><option value="UPDATED_DESC">최근 갱신순</option></select></label>
          </div>
          {data?.appliedQuery.interpretedConditions.length ? <div className="query-hint"><span>Data 해석</span>{data.appliedQuery.interpretedConditions.map((condition) => <b key={condition}>{condition}</b>)}</div> : null}
          {loading ? <div className="state-box">versioned read model을 읽는 중입니다.</div> : null}
          {error ? <div className="state-box error"><b>{error.code}</b><p>{error.message}</p><span>{error.retryable ? '재시도 가능' : '조건 초기화 필요'}</span></div> : null}
          {!loading && !error && data?.products.length === 0 ? <div className="state-box">조건에 맞는 refined product가 없습니다.</div> : null}
          <div className="list" aria-label="상품 목록">
            {data?.products.map((product) => {
              const offer = product.offers.find((item) => product.matchedOfferIds.includes(item.offerId)) ?? product.offers[0];
              return (
                <button key={`${product.canonicalProductId}:${product.productRevision}`} onClick={() => openProduct(product.canonicalProductId)} className={`product-row ${selected?.canonicalProductId === product.canonicalProductId ? 'selected' : ''}`}>
                  <div className={`thumb field-${product.photo.state.toLowerCase()}`}><span>{product.photo.display}</span></div>
                  <div className="grow"><div className="row-title"><strong>{product.vehicleName.display}</strong><span>{product.vehicleMatch}</span></div><p>{product.supplier.display} · rev {product.productRevision}</p><div className="price"><b>{offer?.monthlyRent.display ?? '가격 미확인'}</b><small>{offer?.termMonths.display ?? '기간 미확인'}</small></div><div className="row-flags">{product.hold === 'HOLD' ? <em>HOLD</em> : null}<FreshnessBadge state={product.freshness} /></div></div>
                </button>
              );
            })}
          </div>
          <div className="pagination" aria-label="cursor 페이지 이동"><button onClick={previousPage} disabled={cursorStack.length === 0}>이전</button><span>{data?.page.countAccuracy === 'ESTIMATED' ? '약 ' : ''}{data?.page.totalCount ?? 0}건 · rev {data?.datasetRevision ?? '-'}</span><button onClick={nextPage} disabled={!data?.page.hasNext}>다음</button></div>
        </section>

        <section className={`panel detail-panel ${mobileView === 'detail' ? 'mobile-active' : ''}`}>
          <header className="panel-head"><div><p className="eyebrow">CANONICAL DETAIL</p><h1>상품 상세</h1></div>{selected ? <span className={`status status-${selected.hold.toLowerCase()}`}>{selected.hold}</span> : null}</header>
          {!selected ? <div className="state-box">목록에서 상품을 선택하세요.</div> : <>
            <div className={`hero-car field-${selected.photo.state.toLowerCase()}`}><span>{selected.photo.display}</span><small>{selected.supplier.display}</small></div>
            <div className="vehicle-title"><div><h2>{selected.vehicleName.display}</h2><p>{selected.canonicalProductId} · revision {selected.productRevision}</p></div><span className="match">{selected.vehicleMatch}</span></div>
            <div className="identity-strip"><code>{selected.provenanceRef}</code><span>{selected.sourceSnapshotId}</span></div>
            {selected.holdReasons.length ? <div className="hold-summary"><b>HOLD 사유</b>{selected.holdReasons.map((reason) => <span key={reason}>{reason}</span>)}</div> : null}
            <div className="section-title"><b>필드 provenance</b><span>Data 값을 그대로 표시</span></div>
            <FieldEvidence label="차량" field={selected.vehicleName} /><FieldEvidence label="사진" field={selected.photo} /><FieldEvidence label="옵션" field={selected.options} />
            <div className="section-title"><b>일치 Offer</b><span>{selected.matchedOfferIds.join(', ')}</span></div>
            <div className="offer-list">{selected.offers.map((offer) => <article className={`offer-row ${selected.matchedOfferIds.includes(offer.offerId) ? 'active' : ''}`} key={offer.offerId}><div><strong>{offer.termMonths.display}</strong><span>{offer.monthlyRent.display}</span></div><FieldEvidence label="가격" field={offer.monthlyRent} /><FieldEvidence label="보증금" field={offer.deposit} /><FieldEvidence label="정책" field={offer.policies} /></article>)}</div>
          </>}
        </section>

        <section className={`panel work-panel ${mobileView === 'work' ? 'mobile-active' : ''}`}>
          <header className="panel-head"><div><p className="eyebrow">DATA CONTROL</p><h1>데이터 상태</h1></div><select className="scenario-select" aria-label="fixture 상태" value={query.scenario} onChange={(event) => resetPage({ scenario: event.target.value as Scenario })}><option value="NORMAL">정상 fixture</option><option value="STALE">STALE fixture</option><option value="ERROR">오류 fixture</option></select></header>
          <div className="monitor-card"><div><span>계약</span><b>{data?.contract ?? '응답 없음'}</b></div><div><span>dataset</span><b>{data?.datasetRevision ?? '-'}</b></div><div><span>생성</span><b>{formatTime(data?.generatedAt)}</b></div><div><span>STALE 기준</span><b>{formatTime(data?.staleAt)}</b></div></div>
          <div className="permission-card"><b>{data?.permissions.role ?? query.role}</b><span>provenance {data?.permissions.canViewInternalProvenance ? '허용' : '제한'}</span><span>audit {data?.permissions.canViewAudit ? '허용' : '제한'}</span>{data?.permissions.redactedFields.map((field) => <em key={field}>{field} redacted</em>)}</div>
          <div className="ops-tabs" role="tablist" aria-label="데이터 운영 보기"><button className={opsView === 'sources' ? 'active' : ''} onClick={() => setOpsView('sources')}>수집</button><button className={opsView === 'holds' ? 'active' : ''} onClick={() => setOpsView('holds')}>HOLD</button><button className={opsView === 'audit' ? 'active' : ''} onClick={() => setOpsView('audit')}>변경이력</button></div>
          {opsView === 'sources' ? <div className="ops-list">{data?.sources.map((source) => <article key={source.sourceId}><div><b>{source.label}</b><FreshnessBadge state={source.state} /></div><p>{source.message}</p><span>최근 수집 {formatTime(source.lastCollectedAt)} · {source.datasetRevision ?? 'revision 없음'}</span></article>)}</div> : null}
          {opsView === 'holds' ? <div className="ops-list">{data?.holds.map((hold) => <article className={`severity-${hold.severity.toLowerCase()}`} key={hold.holdId}><div><b>{hold.category} · {hold.field}</b><em>{hold.severity}</em></div><p>{hold.message}</p><span>{hold.canonicalProductId ?? 'dataset'} · {hold.provenanceRef}</span></article>)}</div> : null}
          {opsView === 'audit' ? <div className="ops-list">{data?.permissions.canViewAudit ? data.audit.map((event) => <article key={event.eventId}><div><b>{event.action}</b><em>{event.result}</em></div><p>{event.entityRef}</p><span>{formatTime(event.occurredAt)} · {event.actor} · rev {event.revision}</span></article>) : <div className="state-box">현재 역할은 audit readback 권한이 없습니다.</div>}</div> : null}
        </section>
      </section>

      <nav className="mobile-nav" aria-label="모바일 화면 전환"><button className={mobileView === 'products' ? 'active' : ''} onClick={() => setMobileView('products')}>상품</button><button className={mobileView === 'detail' ? 'active' : ''} onClick={() => setMobileView('detail')}>상세</button><button className={mobileView === 'work' ? 'active' : ''} onClick={() => setMobileView('work')}>데이터</button></nav>
    </main>
  );
}
