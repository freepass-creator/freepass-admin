'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createAdminApplication } from '@/domain/application/create-admin-application';
import { cancelApplication, updateApplicationProgress } from '@/domain/application/update-progress';
import type { Application } from '@/domain/application/types';
import {
  acceptSupplierIssue,
  confirmBySalesperson,
  confirmBySupplier,
  createPerformanceFromDelivery,
  disputeBySalesperson,
  registerSupplierIssue,
  resolveOpenIssue,
  setSettlementAmounts,
} from '@/domain/performance/performance';
import type { Performance, VatMode } from '@/domain/performance/types';
import { getPerformanceActionAvailability } from '@/domain/performance/action-availability';
import { matchProduct } from '@/domain/search/match-product';
import {
  createBilling,
  createSettlementFromPerformance,
  getSettlementBalance,
  registerCollection,
  registerPayout,
} from '@/domain/settlement/settlement';
import type { BillingRecord, LedgerEntry, SettlementItem } from '@/domain/settlement/types';
import { assertCan, type StaffRole } from '@/domain/access/access-control';
import { PRODUCTS, type ProductView } from '@/demo/catalog';
import { money, offerSummary, TERM_OPTIONS } from '@/domain/product/display';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Field } from '@/ui/field';
import { PanelHeader } from '@/ui/panel-header';
import { StatusBadge } from '@/ui/status-badge';

type Screen = 'products' | 'applications' | 'performances' | 'settlements';
type PersistedState = {
  applications: Application[];
  performances: Performance[];
  settlements: SettlementItem[];
  billings: BillingRecord[];
  ledgerEntries: LedgerEntry[];
};

const STORAGE_KEY = 'freepasserp-v1-functional-mvp-v2';
const CURRENT_ROLE: StaffRole = 'ADMIN';
const CHANNELS = [{ id: 'online', name: '온라인' }, { id: 'partner-a', name: '파트너 A' }];
const ASSIGNEES = [{ id: 'park', name: '박지훈' }, { id: 'kim', name: '김서연' }];
const nowIso = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function createSeedState(): PersistedState {
  const view = PRODUCTS[0];
  const application = createAdminApplication(CURRENT_ROLE, {
    id: 'application-sample', applicationNumber: 'A-260913-001', submissionId: 'submission-sample',
    customerName: '김민수', salesChannelId: 'online', assigneeId: 'park',
    product: view.product, productVersion: view.product.version, offerId: 'cv-36', now: '2026-09-13T09:00:00.000Z',
  });
  return { applications: [application], performances: [], settlements: [], billings: [], ledgerEntries: [] };
}

function channelName(id: string) { return CHANNELS.find((item) => item.id === id)?.name ?? id; }
function assigneeName(id: string) { return ASSIGNEES.find((item) => item.id === id)?.name ?? id; }

export default function AdminDashboard({
  adminId,
  enableLocalPersistence,
}: {
  adminId: string;
  enableLocalPersistence: boolean;
}) {
  const [screen, setScreen] = useState<Screen>('products');
  const [query, setQuery] = useState('');
  const [termMonths, setTermMonths] = useState(36);
  const [selectedProductId, setSelectedProductId] = useState(PRODUCTS[0].product.id);
  const [selectedOfferId, setSelectedOfferId] = useState('cv-36');
  const [draftSelection, setDraftSelection] = useState<{ productId: string; productVersion: string; offerId: string; submissionId: string } | null>(null);
  const [work, setWork] = useState<'list' | 'new' | 'detail'>('list');
  const [state, setState] = useState<PersistedState>(() => createSeedState());
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>('application-sample');
  const [activePerformanceId, setActivePerformanceId] = useState<string | null>(null);
  const [activeSettlementId, setActiveSettlementId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [salesChannelId, setSalesChannelId] = useState('online');
  const [assigneeId, setAssigneeId] = useState('park');
  const [receivable, setReceivable] = useState('');
  const [payable, setPayable] = useState('');
  const [vatMode, setVatMode] = useState<VatMode>('UNDECIDED');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [notice, setNotice] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const submissionLock = useRef(new Set<string>());
  const financialLock = useRef(new Set<string>());

  useEffect(() => {
    if (!enableLocalPersistence) {
      setHydrated(true);
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<PersistedState>;
        setState({
          applications: parsed.applications ?? [], performances: parsed.performances ?? [],
          settlements: parsed.settlements ?? [], billings: parsed.billings ?? [], ledgerEntries: parsed.ledgerEntries ?? [],
        });
      } catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setHydrated(true);
  }, [enableLocalPersistence]);

  useEffect(() => {
    if (hydrated && enableLocalPersistence) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [enableLocalPersistence, hydrated, state]);

  const filteredProducts = useMemo(() => PRODUCTS.flatMap((item) => {
    const text = `${item.name} ${item.sub} ${item.supplierName} ${item.category} ${item.product.registration?.vehicleNumber ?? ''}`;
    if (!text.toLowerCase().includes(query.trim().toLowerCase())) return [];
    const match = matchProduct(item.product, { termMonths });
    return match ? [{ item, offer: match.matchedOffers[0] }] : [];
  }), [query, termMonths]);
  const selectedProduct = PRODUCTS.find((item) => item.product.id === selectedProductId) ?? PRODUCTS[0];
  const selectedOfferMatch = selectedProduct.product.offers.find((item) => item.id === selectedOfferId);
  if (!selectedOfferMatch) throw new Error('Selected offer is no longer available.');
  const selectedOffer = selectedOfferMatch;
  const draftProduct = draftSelection ? PRODUCTS.find((item) => item.product.id === draftSelection.productId) : undefined;
  const draftOffer = draftSelection ? draftProduct?.product.offers.find((item) => item.id === draftSelection.offerId) : undefined;
  const activeApplication = state.applications.find((item) => item.id === activeApplicationId) ?? null;
  const activePerformance = state.performances.find((item) => item.id === activePerformanceId) ?? null;
  const activeSettlement = state.settlements.find((item) => item.id === activeSettlementId) ?? null;
  const activeBilling = activeSettlement ? state.billings.find((item) => item.settlementId === activeSettlement.id) : undefined;
  const performanceActions = activePerformance ? getPerformanceActionAvailability(activePerformance.status) : null;

  function fail(error: unknown) { setNotice(error instanceof Error ? error.message : '처리하지 못했습니다.'); }
  function chooseProduct(item: ProductView, offerId: string) {
    setSelectedProductId(item.product.id);
    setSelectedOfferId(offerId);
  }
  function changeTerm(nextTerm: number) {
    setTermMonths(nextTerm);
    const currentMatch = matchProduct(selectedProduct.product, { termMonths: nextTerm });
    if (currentMatch) {
      setSelectedOfferId(currentMatch.matchedOffers[0].id);
      return;
    }
    const firstMatch = PRODUCTS.map((item) => ({ item, match: matchProduct(item.product, { termMonths: nextTerm }) }))
      .find((candidate) => candidate.match);
    if (firstMatch?.match) chooseProduct(firstMatch.item, firstMatch.match.matchedOffers[0].id);
  }
  function openNewApplication() {
    assertCan(CURRENT_ROLE, 'APPLICATION_MANAGE');
    setDraftSelection({ productId: selectedProduct.product.id, productVersion: selectedProduct.product.version, offerId: selectedOffer.id, submissionId: newId('submission') });
    setCustomerName(''); setSalesChannelId('online'); setAssigneeId('park'); setNotice(''); setWork('new');
  }
  function closeApplicationDraft() {
    const dirty = customerName.trim() !== '' || salesChannelId !== 'online' || assigneeId !== 'park';
    if (dirty && !window.confirm('입력한 접수 내용이 저장되지 않습니다. 접수 창을 닫을까요?')) return;
    setDraftSelection(null); setWork('list'); setNotice('');
  }
  function submitApplication() {
    assertCan(CURRENT_ROLE, 'APPLICATION_MANAGE');
    if (!draftSelection) return;
    if (submissionLock.current.has(draftSelection.submissionId)) return;
    const view = PRODUCTS.find((item) => item.product.id === draftSelection.productId);
    if (!view) return setNotice('선택한 차량을 찾을 수 없습니다.');
    if (view.product.version !== draftSelection.productVersion) return setNotice('상품 조건이 변경됐습니다. 최신 조건을 다시 선택하세요.');
    if (!view.product.offers.some((item) => item.id === draftSelection.offerId)) return setNotice('선택한 기간 조건이 종료됐습니다. 다시 선택하세요.');
    submissionLock.current.add(draftSelection.submissionId);
    try {
      const created = createAdminApplication(CURRENT_ROLE, {
        id: newId('application'), applicationNumber: `A-${Date.now().toString().slice(-9)}`,
        submissionId: draftSelection.submissionId, customerName, salesChannelId, assigneeId,
        product: view.product, productVersion: draftSelection.productVersion, offerId: draftSelection.offerId, now: nowIso(),
      });
      setState((current) => ({ ...current, applications: [created, ...current.applications] }));
      setActiveApplicationId(created.id); setWork('detail'); setNotice('접수를 저장했습니다.');
    } catch (error) { submissionLock.current.delete(draftSelection.submissionId); fail(error); }
  }
  function patchProgress(key: 'contractCompleted' | 'documentsCompleted' | 'deliveryCompleted') {
    assertCan(CURRENT_ROLE, 'APPLICATION_MANAGE');
    if (!activeApplication) return;
    if (key === 'deliveryCompleted' && !window.confirm('인도완료 처리하면 실적이 생성되며 되돌릴 수 없습니다. 계속할까요?')) return;
    try {
      const completed = key === 'deliveryCompleted' ? true : !activeApplication.progress[key];
      const at = nowIso();
      const updated = updateApplicationProgress(
        activeApplication, key, completed, at,
        key === 'deliveryCompleted' ? `delivery:${activeApplication.id}` : undefined,
      );
      let performances = state.performances;
      if (key === 'deliveryCompleted' && !performances.some((item) => item.applicationId === updated.id)) {
        const performance = createPerformanceFromDelivery(updated, `performance:${updated.id}`);
        performances = [performance, ...performances];
        setActivePerformanceId(performance.id);
      }
      setState({ ...state, applications: state.applications.map((item) => item.id === updated.id ? updated : item), performances });
      setNotice(key === 'deliveryCompleted' ? '인도완료와 실적 1건을 생성했습니다.' : '진행 상태를 저장했습니다.');
    } catch (error) { fail(error); }
  }
  function cancelActiveApplication() {
    assertCan(CURRENT_ROLE, 'APPLICATION_MANAGE');
    if (!activeApplication) return;
    const reason = window.prompt('취소 사유를 입력하세요.');
    if (reason === null) return;
    try {
      const updated = cancelApplication(activeApplication, reason, nowIso());
      setState({ ...state, applications: state.applications.map((item) => item.id === updated.id ? updated : item) });
      setNotice('접수를 취소했습니다. 원접수는 삭제하지 않았습니다.');
    } catch (error) { fail(error); }
  }
  function saveAmounts() {
    assertCan(CURRENT_ROLE, 'PERFORMANCE_MANAGE');
    if (!activePerformance) return;
    if (!receivable.trim() || !payable.trim()) return setNotice('받을액과 줄액을 모두 입력하세요. 0원은 0으로 명시해야 합니다.');
    try {
      const updated = setSettlementAmounts(activePerformance, {
        supplierReceivable: Number(receivable), channelPayable: Number(payable), vatMode,
      }, nowIso());
      setState({ ...state, performances: state.performances.map((item) => item.id === updated.id ? updated : item) });
      setNotice('정산 예정 금액을 저장했습니다.');
    } catch (error) { fail(error); }
  }
  function updatePerformance(action: 'sales' | 'salesDispute' | 'supplier' | 'supplierIssue' | 'acceptIssue' | 'resolveIssue' | 'finalize') {
    assertCan(CURRENT_ROLE, action === 'finalize' ? 'SETTLEMENT_MANAGE' : 'PERFORMANCE_MANAGE');
    if (!activePerformance) return;
    try {
      const at = nowIso();
      if (action === 'finalize') {
        if (!window.confirm('확정 후에는 실적 금액을 변경할 수 없습니다. 정산을 확정할까요?')) return;
        if (state.settlements.some((item) => item.performanceId === activePerformance.id)) throw new Error('이미 정산 확정된 실적입니다.');
        const result = createSettlementFromPerformance(activePerformance, `settlement:${activePerformance.id}`, at);
        setState({
          ...state,
          performances: state.performances.map((item) => item.id === result.performance.id ? result.performance : item),
          settlements: [result.settlement, ...state.settlements],
        });
        setActiveSettlementId(result.settlement.id); setNotice('정산을 확정했습니다.'); return;
      }
      let updated: Performance;
      if (action === 'sales') updated = confirmBySalesperson(activePerformance, activePerformance.snapshot.salesChannelId, adminId, at);
      else if (action === 'supplier') updated = confirmBySupplier(activePerformance, activePerformance.snapshot.supplierId, adminId, at);
      else if (action === 'acceptIssue') updated = acceptSupplierIssue(activePerformance, activePerformance.snapshot.salesChannelId, adminId, at);
      else if (action === 'salesDispute') {
        const reason = window.prompt('영업채널 이견 사유를 입력하세요.');
        if (reason === null) return;
        updated = disputeBySalesperson(activePerformance, activePerformance.snapshot.salesChannelId, adminId, reason, at);
      } else if (action === 'supplierIssue') {
        const reason = window.prompt('공급사 이슈 사유를 입력하세요. 현재 입력된 금액을 공급사 제안 금액으로 기록합니다.');
        if (reason === null) return;
        if (!receivable.trim() || !payable.trim()) throw new Error('공급사 제안 받을액과 줄액을 모두 입력하세요.');
        updated = registerSupplierIssue(activePerformance, activePerformance.snapshot.supplierId, adminId, reason, {
          supplierReceivable: Number(receivable), channelPayable: Number(payable), vatMode,
        }, at);
      } else {
        const reason = window.prompt('이슈 해결 근거를 입력하세요.');
        if (reason === null) return;
        updated = resolveOpenIssue(activePerformance, adminId, reason, at);
      }
      setState({ ...state, performances: state.performances.map((item) => item.id === updated.id ? updated : item) });
      const messages = {
        sales: '영업채널 확인을 저장했습니다.', salesDispute: '영업채널 이견을 기록했습니다.',
        supplier: '공급사 확인을 저장했습니다.', supplierIssue: '공급사 이슈와 제안 금액을 기록했습니다.',
        acceptIssue: '변경 금액 수용을 기록했습니다.', resolveIssue: '이슈 해결 근거를 기록했습니다.',
      } as const;
      setNotice(messages[action]);
    } catch (error) { fail(error); }
  }
  function updateSettlement(action: 'billing' | 'collection' | 'payout') {
    assertCan(CURRENT_ROLE, 'SETTLEMENT_MANAGE');
    if (!activeSettlement) return;
    const lockKey = `${action}:${activeSettlement.id}`;
    if (financialLock.current.has(lockKey)) return;
    financialLock.current.add(lockKey);
    try {
      const at = nowIso();
      let billings = state.billings;
      let ledgerEntries = state.ledgerEntries;
      if (action === 'billing') {
        if (!activeBilling) billings = [createBilling(activeSettlement, `billing:${activeSettlement.id}`, at), ...billings];
      }
      if (action === 'collection') {
        if (!collectionAmount.trim()) throw new Error('수금액을 입력하세요.');
        if (!window.confirm(`${Number(collectionAmount).toLocaleString('ko-KR')}원을 수금 등록할까요?`)) return;
        ledgerEntries = registerCollection(activeSettlement, activeBilling, ledgerEntries, { id: newId('collection'), settlementId: activeSettlement.id, account: 'SUPPLIER_COLLECTION', kind: 'CASH', amount: Number(collectionAmount), actorId: adminId, occurredAt: at });
        setCollectionAmount('');
      }
      if (action === 'payout') {
        if (!payoutAmount.trim()) throw new Error('지급액을 입력하세요.');
        if (!window.confirm(`${Number(payoutAmount).toLocaleString('ko-KR')}원을 지급 등록할까요?`)) return;
        ledgerEntries = registerPayout(activeSettlement, activeBilling, ledgerEntries, { id: newId('payout'), settlementId: activeSettlement.id, account: 'CHANNEL_PAYOUT', kind: 'CASH', amount: Number(payoutAmount), actorId: adminId, occurredAt: at }, 'AFTER_FULL_COLLECTION');
        setPayoutAmount('');
      }
      setState({ ...state, billings, ledgerEntries });
      setNotice(action === 'billing' ? '청구서를 생성했습니다.' : action === 'collection' ? '수금 내역을 추가했습니다.' : '지급 내역을 추가했습니다.');
    } catch (error) { fail(error); }
    finally { window.setTimeout(() => financialLock.current.delete(lockKey), 500); }
  }

  return <main className="erp-shell">
    <aside className="global-nav">
      <div className="brand"><strong>FP</strong><span>freepasserp.com</span></div>
      <nav>
        {([['products', '상품'], ['applications', '접수'], ['performances', '실적'], ['settlements', '정산']] as const).map(([id, label]) =>
          <button key={id} className={screen === id ? 'active' : ''} onClick={() => { setScreen(id); setNotice(''); }}>{label}</button>)}
      </nav>
      <div className="nav-user"><b>{adminId}</b><span>{CURRENT_ROLE}</span><small>{enableLocalPersistence ? '로컬 기능 시뮬레이션' : '메모리 기능 시뮬레이션'} · 운영 저장 아님</small></div>
    </aside>

    {screen === 'products' && <section className="workspace">
      <section className="panel">
        <PanelHeader title="상품 목록" meta={<span className="count">{filteredProducts.length}건</span>} />
        <label className="searchbox"><span>검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="차량명, 차량번호, 상품구분" /></label>
        <label className="compact-filter">계약기간<select value={termMonths} onChange={(event) => changeTerm(Number(event.target.value))}>{TERM_OPTIONS.map((term) => <option key={term} value={term}>{term}개월</option>)}</select></label>
        <div className="list">{filteredProducts.map(({ item, offer }) => {
          return <button className={`data-row product-row ${item.product.id === selectedProduct.product.id ? 'selected' : ''}`} key={item.product.id} onClick={() => chooseProduct(item, offer.id)}>
            <span className="status-line"><i />{item.status} · {item.category}</span>
            <strong>{item.product.registration?.vehicleNumber ?? '차량번호 미배정'} · {item.name}</strong>
            <span>{item.sub}</span><b className="numeric">{offer.termMonths}개월 · 월 {money(offer.monthlyRent)}</b>
          </button>;
        })}</div>
      </section>
      <section className="panel">
        <PanelHeader title="상품 상세" meta={selectedProduct.supplierName} />
        <div className="vehicle-heading"><span>{selectedProduct.category} · {selectedProduct.status}</span><h2>{selectedProduct.name}</h2><p>{selectedProduct.product.registration?.vehicleNumber ?? '차량번호 미배정'} · {selectedProduct.sub}</p></div>
        <h3>기간별 대여료 및 보증금</h3>
        <div className="offer-list">{selectedProduct.product.offers.map((offer) => <button key={offer.id} className={offer.id === selectedOffer.id ? 'selected' : ''} onClick={() => setSelectedOfferId(offer.id)}>
          <b>{offer.termMonths}개월</b><span className="numeric">월 {money(offer.monthlyRent)}</span><span className="numeric">보증금 {offer.deposit === undefined ? '미확인' : money(offer.deposit)}</span><span className="numeric">연 {offer.annualMileageKm?.toLocaleString('ko-KR') ?? '미확인'}km</span>
        </button>)}</div>
        <div className="detail-lines"><p><b>색상 및 옵션</b><span>접수 후 확인</span></p><p><b>이용 정책</b><span>만 21세 가능 · 카드/계좌이체</span></p><p><b>차량 상세</b><span>{selectedProduct.product.specs.fuel} · {selectedProduct.product.specs.seats}인승</span></p></div>
        <Button variant="primary" className="full-width" onClick={openNewApplication}>이 상품으로 접수하기</Button>
      </section>
      <section className="panel">
        {work === 'list' && <><PanelHeader title="접수 목록" action={<Button onClick={openNewApplication}>+ 신규접수</Button>} /><ApplicationList applications={state.applications} onOpen={(id) => { setActiveApplicationId(id); setWork('detail'); }} /></>}
        {work === 'new' && <form onSubmit={(event) => { event.preventDefault(); submitApplication(); }}><PanelHeader title="신규 접수" action={<Button variant="quiet" className="icon-close" aria-label="접수 닫기" onClick={closeApplicationDraft}>×</Button>} />
          <div className="form-stack"><Field label="차량 선택" required><input readOnly value={draftProduct && draftOffer ? `${draftProduct.name} · ${offerSummary(draftOffer)}` : '선택 조건이 변경되었습니다.'} /></Field>
            <Field label="영업채널" required><select required value={salesChannelId} onChange={(event) => setSalesChannelId(event.target.value)}>{CHANNELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="담당자" required><select required value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{ASSIGNEES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="고객명" required><input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="고객명 입력" /></Field></div>
          <div className="button-row"><Button onClick={closeApplicationDraft}>취소</Button><Button type="submit" variant="primary">접수 저장</Button></div></form>}
        {work === 'detail' && activeApplication && <ApplicationDetail application={activeApplication} onList={() => setWork('list')} onProgress={patchProgress} onCancel={cancelActiveApplication} />}
        {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
      </section>
    </section>}

    {screen === 'applications' && <ThreePanel title="접수">
      <><div className="panel-head"><h1>접수 목록</h1><span className="count">{state.applications.length}건</span></div><ApplicationList applications={state.applications} onOpen={setActiveApplicationId} /></>
      {activeApplication ? <ApplicationSnapshot application={activeApplication} /> : <EmptyState>접수를 선택하세요.</EmptyState>}
      {activeApplication ? <ApplicationDetail application={activeApplication} onProgress={patchProgress} onCancel={cancelActiveApplication} /> : <EmptyState>진행할 접수가 없습니다.</EmptyState>}
    </ThreePanel>}

    {screen === 'performances' && <ThreePanel title="실적">
      <><div className="panel-head"><h1>실적 목록</h1><span className="count">{state.performances.length}건</span></div><div className="list">{state.performances.map((item) => <button className={`data-row ${item.id === activePerformanceId ? 'selected' : ''}`} key={item.id} onClick={() => { setActivePerformanceId(item.id); setReceivable(item.amounts.supplierReceivable?.toString() ?? ''); setPayable(item.amounts.channelPayable?.toString() ?? ''); setVatMode(item.amounts.vatMode); }}><span>{item.snapshot.deliveredAt.slice(0, 10)}</span><strong>{item.snapshot.customerName} · {item.snapshot.applicationNumber}</strong><span>{item.status}</span></button>)}</div></>
      {activePerformance ? <><PanelHeader title="실적 상세" meta={<StatusBadge>{activePerformance.status}</StatusBadge>} /><KeyValues rows={[["고객", activePerformance.snapshot.customerName], ["공급사", activePerformance.snapshot.supplierId], ["영업채널", channelName(activePerformance.snapshot.salesChannelId)], ["담당자", assigneeName(activePerformance.snapshot.assigneeId)], ["접수번호", activePerformance.snapshot.applicationNumber], ["상품 버전", activePerformance.snapshot.productVersion]]} /></> : <EmptyState>실적을 선택하세요.</EmptyState>}
      {activePerformance && performanceActions ? <><PanelHeader title="대조·확정" meta="현재 단계의 작업만 활성화" />
        <div className="form-stack"><Field label="공급사 받을액"><input disabled={!performanceActions.editAmounts && !performanceActions.supplierReview} className="numeric" inputMode="numeric" value={receivable} onChange={(event) => setReceivable(event.target.value.replace(/\D/g, ''))} /></Field><Field label="영업채널 줄액"><input disabled={!performanceActions.editAmounts && !performanceActions.supplierReview} className="numeric" inputMode="numeric" value={payable} onChange={(event) => setPayable(event.target.value.replace(/\D/g, ''))} /></Field><Field label="VAT 기준"><select disabled={!performanceActions.editAmounts && !performanceActions.supplierReview} value={vatMode} onChange={(event) => setVatMode(event.target.value as VatMode)}><option value="UNDECIDED">선택 필요</option><option value="EXCLUDED">VAT 별도</option><option value="INCLUDED">VAT 포함</option></select></Field></div>
        <div className="action-stack">
          <Button disabled={!performanceActions.editAmounts} onClick={saveAmounts}>금액 저장</Button>
          <div className="split-actions"><Button disabled={!performanceActions.salesReview} onClick={() => updatePerformance('sales')}>영업채널 확인</Button><Button variant="danger" disabled={!performanceActions.salesReview} onClick={() => updatePerformance('salesDispute')}>이견 있음</Button></div>
          <div className="split-actions"><Button disabled={!performanceActions.supplierReview} onClick={() => updatePerformance('supplier')}>공급사 확인</Button><Button variant="danger" disabled={!performanceActions.supplierReview} onClick={() => updatePerformance('supplierIssue')}>공급사 이슈</Button></div>
          <Button disabled={!performanceActions.salesReconfirmation} onClick={() => updatePerformance('acceptIssue')}>변경 금액 수용</Button>
          <Button disabled={!performanceActions.resolveIssue} onClick={() => updatePerformance('resolveIssue')}>이슈 해결 기록</Button>
          <Button variant="primary" disabled={!performanceActions.finalize} onClick={() => updatePerformance('finalize')}>정산 확정</Button>
        </div>{notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}</> : <EmptyState>처리할 실적이 없습니다.</EmptyState>}
    </ThreePanel>}

    {screen === 'settlements' && <ThreePanel title="정산">
      <><div className="panel-head"><h1>정산 목록</h1><span className="count">{state.settlements.length}건</span></div><div className="list">{state.settlements.map((item) => { const billing = state.billings.find((candidate) => candidate.settlementId === item.id); const balance = getSettlementBalance(item, billing, state.ledgerEntries); return <button className={`data-row ${item.id === activeSettlementId ? 'selected' : ''}`} key={item.id} onClick={() => setActiveSettlementId(item.id)}><span>{item.applicationNumber}</span><strong>{item.customerName}</strong><span className="numeric">청구 {money(balance.billed)} · 지급 {money(balance.payable)}</span></button>; })}</div></>
      {activeSettlement ? <><PanelHeader title="정산 상세" meta={<StatusBadge>{activeBilling?.status ?? '청구 전'}</StatusBadge>} /><SettlementSummary settlement={activeSettlement} billing={activeBilling} entries={state.ledgerEntries} /></> : <EmptyState>정산 건을 선택하세요.</EmptyState>}
      {activeSettlement ? <><PanelHeader title="청구 / 지급" meta="별도 원장" /><SettlementSummary settlement={activeSettlement} billing={activeBilling} entries={state.ledgerEntries} /><div className="action-stack"><Button disabled={Boolean(activeBilling)} onClick={() => updateSettlement('billing')}>{activeBilling ? '청구서 생성 완료' : '청구서 생성'}</Button><Field label="수금액"><input className="numeric" inputMode="numeric" value={collectionAmount} onChange={(event) => setCollectionAmount(event.target.value.replace(/\D/g, ''))} /></Field><Button disabled={!activeBilling} onClick={() => updateSettlement('collection')}>수금 등록</Button><Field label="지급액"><input className="numeric" inputMode="numeric" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value.replace(/\D/g, ''))} /></Field><Button disabled={!activeBilling} onClick={() => updateSettlement('payout')}>지급 등록</Button></div><p className="policy-note">현재 안전정책: 공급사 수금 완료 후 지급 가능</p>{notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}</> : <EmptyState>처리할 정산 건이 없습니다.</EmptyState>}
    </ThreePanel>}
  </main>;
}

function ThreePanel({ children }: { title: string; children: [React.ReactNode, React.ReactNode, React.ReactNode] }) {
  return <section className="workspace">{children.map((child, index) => <section className="panel" key={index}>{child}</section>)}</section>;
}

function ApplicationList({ applications, onOpen }: { applications: Application[]; onOpen: (id: string) => void }) {
  return <div className="list">{applications.map((application) => <button className="data-row" key={application.id} onClick={() => onOpen(application.id)}><span>{application.status} · {application.applicationNumber}</span><strong>{application.customerName} · {application.snapshot.vehicleLabel}</strong><span>{application.snapshot.registration?.vehicleNumber ?? '차량번호 미배정'} · {application.snapshot.offer.termMonths}개월 · 월 {money(application.snapshot.offer.monthlyRent)}</span></button>)}</div>;
}

function ApplicationSnapshot({ application, showHeader = true }: { application: Application; showHeader?: boolean }) {
  return <>{showHeader && <PanelHeader title="접수 상세" meta="접수 당시 Snapshot" />}<KeyValues rows={[["접수번호", application.applicationNumber], ["고객명", application.customerName], ["차량", application.snapshot.vehicleLabel], ["차량번호", application.snapshot.registration?.vehicleNumber ?? '미배정'], ["영업채널", channelName(application.salesChannelId)], ["담당자", assigneeName(application.assigneeId)], ["상품 버전", application.snapshot.productVersion], ["선택 조건", offerSummary(application.snapshot.offer)]]} /></>;
}

function ApplicationDetail({ application, onList, onProgress, onCancel }: { application: Application; onList?: () => void; onProgress: (key: 'contractCompleted' | 'documentsCompleted' | 'deliveryCompleted') => void; onCancel: () => void }) {
  return <><PanelHeader title="접수 진행" action={onList ? <Button onClick={onList}>이전</Button> : undefined} /><ApplicationSnapshot application={application} showHeader={false} /><div className="action-stack"><Button className={application.progress.contractCompleted ? 'done' : ''} disabled={application.status === 'CANCELLED' || application.status === 'DELIVERED'} onClick={() => onProgress('contractCompleted')}>계약서 {application.progress.contractCompleted ? '완료' : '확인'}</Button><Button className={application.progress.documentsCompleted ? 'done' : ''} disabled={application.status === 'CANCELLED' || application.status === 'DELIVERED'} onClick={() => onProgress('documentsCompleted')}>필수서류 {application.progress.documentsCompleted ? '완료' : '확인'}</Button><Button className={application.progress.deliveryCompleted ? 'done' : ''} disabled={application.status === 'CANCELLED' || application.progress.deliveryCompleted} onClick={() => onProgress('deliveryCompleted')}>인도 {application.progress.deliveryCompleted ? '완료' : '완료 처리'}</Button><Button variant="danger" disabled={application.status === 'CANCELLED' || application.status === 'DELIVERED'} onClick={onCancel}>접수 취소</Button></div></>;
}

function KeyValues({ rows }: { rows: Array<[string, string]> }) {
  return <dl className="key-values">{rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>;
}

function SettlementSummary({ settlement, billing, entries }: { settlement: SettlementItem; billing?: BillingRecord; entries: LedgerEntry[] }) {
  const balance = getSettlementBalance(settlement, billing, entries);
  return <KeyValues rows={[["확정 받을액", money(balance.confirmedReceivable)], ["실제 청구액", money(balance.billed)], ["실제 수금액", money(balance.collected)], ["미수액", money(balance.collectionOutstanding)], ["지급 확정액", money(balance.payable)], ["실제 지급액", money(balance.paid)], ["미지급액", money(balance.payoutOutstanding)], ["FreePass 마진", money(balance.margin)], ["VAT", settlement.vatMode === 'INCLUDED' ? '포함' : '별도']]} />;
}
