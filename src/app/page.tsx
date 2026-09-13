const products = [
  { id: 'p1', name: '쏘나타', sub: '세부모델 미확인', term: '36개월', rent: '월 690,000원', badge: '21세 가능' },
  { id: 'p2', name: '싼타페 MX5', sub: '캘리그래피', term: '36개월', rent: '월 920,000원', badge: '카드결제' },
  { id: 'p3', name: 'K5', sub: '더 뉴 K5 DL3 · 노블레스', term: '24개월', rent: '월 780,000원', badge: '후불' },
  { id: 'p4', name: 'GV80', sub: '세부트림 미확인', term: '48개월', rent: '월 1,090,000원', badge: '보증금 분납' },
];

const applications = [
  { no: 'A-260913-014', customer: '김OO', vehicle: '싼타페 MX5', contract: true, docs: true, delivery: false },
  { no: 'A-260913-013', customer: '이OO', vehicle: 'K5', contract: true, docs: false, delivery: false },
  { no: 'A-260912-041', customer: '박OO', vehicle: 'GV80', contract: true, docs: true, delivery: true },
  { no: 'A-260912-038', customer: '최OO', vehicle: '쏘나타', contract: false, docs: false, delivery: false },
];

export default function AdminHome() {
  const selected = products[1];

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div><strong>freepasserp.com</strong><span>admin · v1</span></div>
        <nav><button className="active">상품·접수</button><button>정산</button><button>설정</button></nav>
        <div className="admin-user">관리자</div>
      </header>

      <section className="workspace">
        <section className="panel product-panel">
          <div className="panel-head"><div><p className="eyebrow">PRODUCT</p><h1>상품 목록</h1></div><span className="count">{products.length}대</span></div>
          <div className="searchbox">⌕ <span>모델, 조건, 정책 검색</span></div>
          <div className="quick-filters"><button>전체</button><button>21세</button><button>무보증</button><button>후불</button><button>상세필터</button></div>
          <div className="list">
            {products.map((product) => (
              <article key={product.id} className={`product-row ${product.id === selected.id ? 'selected' : ''}`}>
                <div className="thumb">CAR</div><div className="grow"><div className="row-title"><strong>{product.name}</strong><span>{product.badge}</span></div><p>{product.sub}</p><div className="price"><b>{product.rent}</b><small>{product.term}</small></div></div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-head"><div><p className="eyebrow">DETAIL</p><h1>상품 상세</h1></div><button className="icon-btn">공유</button></div>
          <div className="tabs"><button className="active">요약</button><button>상세정보</button></div>
          <div className="hero-car"><span>차량 이미지</span><small>1 / 4</small></div>
          <div className="vehicle-title"><div><h2>{selected.name}</h2><p>{selected.sub}</p></div><span className="status-dot">판매중</span></div>
          <dl className="summary-grid"><div><dt>공급사</dt><dd>A 렌터카</dd></div><div><dt>차종 매칭</dt><dd>세부트림</dd></div><div><dt>보증금</dt><dd>0원</dd></div><div><dt>약정주행</dt><dd>연 20,000km</dd></div></dl>
          <div className="offer-block"><div><span>선택 조건</span><b>36개월</b></div><strong>월 920,000원</strong><p>보증금 0원 · 연 20,000km · 카드결제 가능</p></div>
          <div className="chips"><span>만 21세 가능</span><span>카드결제</span><span>보증금 분납</span></div>
          <button className="primary">이 상품 접수하기</button>
        </section>

        <section className="panel work-panel">
          <div className="panel-head"><div><p className="eyebrow">WORK</p><h1>접수 목록</h1></div><button className="new-app">+ 신규접수</button></div>
          <div className="work-tabs"><button className="active">전체 24</button><button>진행중 17</button><button>인도완료 6</button><button>취소 1</button></div>
          <div className="application-list">
            {applications.map((app) => (
              <article className="application-card" key={app.no}>
                <div className="app-top"><div><b>{app.customer}</b><span>{app.no}</span></div><strong>{app.vehicle}</strong></div>
                <div className="checks"><span className={app.contract ? 'done' : ''}>계약서</span><span className={app.docs ? 'done' : ''}>서류</span><span className={app.delivery ? 'done' : ''}>인도</span></div>
                <p>{app.delivery ? '인도 완료 · 정산 대상' : app.contract ? '진행중 · 다음 확인 필요' : '신규 접수 · 계약 확인 전'}</p>
              </article>
            ))}
          </div>
          <div className="work-hint"><b>접수 상세</b><span>목록을 더블 클릭하면 계약서 · 서류 · 인도 상태를 확인하고 변경합니다.</span></div>
        </section>
      </section>
    </main>
  );
}
