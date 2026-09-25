// Isolated synthetic fixture. No app route, credentials, Firestore or server actions.
import { createRoot } from 'react-dom/client';
import { FilterSheet, type FacetAxis } from '../../src/app/_design/FilterSheet';
import { useSearchParams } from './filter-navigation';
const axes: FacetAxis[] = [
  { key: 'status', label: '출고상태', options: [
    { key: 'ready', label: '즉시출고', count: 12 },
    { key: 'blocked', label: '출고불가', count: 0 },
    ...Array.from({ length: 9 }, (_, i) => ({ key: `s${i+3}`, label: `시험 상태 ${i+3}`, count: i+1 })),
  ] },
  { key: 'kind', label: '상품구분', options: [
    { key: 'new', label: '신차렌트', count: 8 }, { key: 'used', label: '중고렌트', count: 4 },
  ] },
  { key: 'emptyAxis', label: '빈 항목', options: [] },
];
function Fixture() {
  const params = useSearchParams();
  const empty = params.get('empty') === '1';
  const count = params.get('status')?.split(',').includes('blocked') ? 0 : 12;
  return <section className="workspace" data-mode="find" data-phone="list">
    <section className="panel product-panel">
      <div className="dz-listtop">
        <h2>세부검색 브라우저 검증</h2>
        <div className="dz-find">
          <div className="dz-searchbox"><input name="q" aria-label="상품 검색" defaultValue="시험" /></div>
          <FilterSheet axes={empty ? [] : axes} count={count} unit="대" />
        </div>
      </div>
      <label>다른 입력칸<input id="outside" aria-label="다른 입력칸" /></label>
      <button type="button" id="outside-button">배경 동작</button>
      <p>검증 전용 합성 데이터 · 저장 및 발송 없음</p>
    </section>
    <section className="panel detail-panel"><h2>배경 상세</h2>
      <label>다음 입력칸<input id="outside-desktop" aria-label="다음 입력칸" /></label>
      <button type="button">상세 동작</button>
    </section>
  </section>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
