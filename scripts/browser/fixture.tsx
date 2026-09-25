/* Browser-only component fixture. Synthetic data; never imported by an app route.
 * Next navigation, Firebase, authentication and writes are deliberately outside this receipt.
 */
import { createRoot } from 'react-dom/client';
import { ListRow } from '../../src/app/_design/ListRow';
import { OfferPicker } from '../../src/app/_design/OfferPicker';
import { DetailTabs } from '../../src/app/_design/DetailTabs';
import { ActionBar, PanelHeader, SummaryGrid, SummaryItem } from '../../src/app/_design/Primitives';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'list';
const mode = view === 'work' ? 'intake' : 'find';
const offers = [
  { id: 'test-12-20', termMonths: 12, monthlyRent: 670000, deposit: 1000000, annualMileageKm: 20000 },
  { id: 'test-12-30', termMonths: 12, monthlyRent: 720000, deposit: 1000000, annualMileageKm: 30000 },
  { id: 'test-60', termMonths: 60, monthlyRent: 1234567, deposit: 12345678, prepayment: 2345678, annualMileageKm: 50000 },
];
const title = '시험 차량 · 더 뉴 그랜저 하이브리드 캘리그래피';
const summary = <>
  <SummaryGrid>
    <SummaryItem label="상품">시험용 신차렌트</SummaryItem>
    <SummaryItem label="공급사">브라우저 검증 전용</SummaryItem>
  </SummaryGrid>
  <OfferPicker offers={offers} initial="test-12-20" perks={['무심사', '만21세', '경력무관']} />
</>;

createRoot(document.getElementById('root')!).render(
  <section className="workspace" data-mode={mode} data-phone={view}>
    <section className="panel product-panel">
      <div className="dz-listtop">
        <PanelHeader title="상품찾기" count={3} />
        <div className="quick-filters">
          {['전체', '신차렌트', '중고렌트', '구독', '즉시출고', '보증금 없음', '만21세'].map((text, i) =>
            <button type="button" key={text} className={i === 0 ? 'active' : ''}>{text}</button>)}
        </div>
      </div>
      <div className="list">
        {offers.map((offer, i) => <ListRow key={offer.id} href="#test-only" product thumb={null}
          title={title} badges={['신차렌트', '즉시출고']} selected={i === 0}
          value={`${offer.termMonths}개월 · 월 ${offer.monthlyRent.toLocaleString('ko-KR')}원 · 보증금 ${offer.deposit.toLocaleString('ko-KR')}원`}
          chips={['무심사', '만21세', '경력무관']} />)}
      </div>
    </section>
    <section className="panel detail-panel">
      <PanelHeader title="상품 상세" />
      <div className="vehicle-title"><div><h2>{title}</h2><p>합성 데이터 · 운영 접수 불가</p></div></div>
      <DetailTabs summary={summary} info={<p>시험용 상세정보</p>}
        applyBase="/intake?testOnly=1" initialOffer="test-12-20" />
    </section>
    {view === 'work' && <section className="panel work-panel">
      <PanelHeader title="신규 접수 · 검증용" />
      <div className="dz-picked"><b>{title}</b>
        <dl className="dz-picked-grid">
          <div><dt>기간</dt><dd>60개월</dd></div>
          <div><dt>월 대여료</dt><dd>1,234,567원</dd></div>
          <div><dt>보증금</dt><dd>12,345,678원</dd></div>
          <div><dt>수수료</dt><dd>시험용 1,234,567원</dd></div>
        </dl>
      </div>
      <SummaryGrid><SummaryItem label="상태">시험 중</SummaryItem><SummaryItem label="쓰기">비활성</SummaryItem></SummaryGrid>
      <ActionBar>
        <button type="button" className="dz-bar-sub">목록</button>
        <button type="button" className="dz-bar-sub">이전</button>
        <button type="button" className="primary" disabled>검증 전용</button>
      </ActionBar>
    </section>}
  </section>
);
