import Link from 'next/link';
import { ListRow } from '../../_design/ListRow';
import { Tag, PerkMarks } from '../../_design/Badges';
import { ActionBar, PanelHeader, SummaryGrid, SummaryItem } from '../../_design/Primitives';
import { DetailTabs } from '../../_design/DetailTabs';
import { OfferPicker } from '../../_design/OfferPicker';

export const dynamic = 'force-static';

const MENU = [
  ['products', '상품찾기'],
  ['intake', '계약접수'],
  ['settlement', '정산관리'],
  ['esign', '전자계약'],
] as const;

function Chrome({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <>
      <nav className="fn-top">
        <Link href="#" className="dz-brand" aria-label="freepass admin">
          <span className="dz-word"><b>freepass</b><i>admin</i></span>
        </Link>
        <div className="dz-menu">
          {MENU.map(([key, label]) => <Link key={key} href={"#"} className={active === key ? 'on' : undefined}>{label}</Link>)}
        </div>
        <span className="fn-state">ERP5 freepasserp5 · 쓰기 켜짐</span>
        <span className="dz-me">관리자</span>
        <form className="dz-logout"><button type="button">로그아웃</button></form>
      </nav>
      <main className="fn-main">{children}</main>
    </>
  );
}

const products = [
  { id:'p1', title:'제네시스 GV70 2.5T', meta:'123가4567 · 2024년식 · 손오공', value:'36개월 · 월 690,000원 · 보증금 1,000,000원', badges:['중고렌트','즉시출고'], chips:['무심사','만21세','경력무관'] },
  { id:'p2', title:'그랜저 하이브리드', meta:'224나7812 · 2023년식 · 오토플러스', value:'36개월 · 월 520,000원 · 보증금 1,000,000원', badges:['중고렌트','출고가능'], chips:['소득확인','만26세'] },
  { id:'p3', title:'쏘렌토 하이브리드', meta:'신차 · 하이브리드 · 손오공', value:'48개월 · 월 480,000원 · 보증금 500,000원', badges:['신차렌트','출고협의'], chips:['무심사','경력무관'] },
  { id:'p4', title:'카니발 9인승', meta:'323버9102 · 디젤 · 손오공', value:'36개월 · 월 620,000원 · 보증금 1,000,000원', badges:['중고렌트','즉시출고'], chips:['소득확인'] },
  { id:'p5', title:'아이오닉 5', meta:'562루2201 · 전기 · 오토플러스', value:'24개월 · 월 450,000원 · 보증금 없음', badges:['중고구독','출고가능'], chips:['무심사','만21세'] },
];

function Search({ placeholder }: { placeholder: string }) {
  return <div className="dz-find"><div className="searchbox dz-searchbox"><span className="dz-search-ico" aria-hidden>⌕</span><input readOnly value="" placeholder={placeholder}/><button className="dz-fs-open" type="button">세부검색</button></div></div>;
}

function Quick({ labels, active=0 }: { labels: string[]; active?: number }) {
  return <div className="quick-filters">{labels.map((x,i)=><Link href="#" key={x} className={i===active?'active':undefined}>{x}</Link>)}</div>;
}

function ProductList({ selected=true }: { selected?: boolean }) {
  return <div className="list">
    {products.map((p,i)=><ListRow key={p.id} href="#" selected={selected && i===0} product
      thumb={null} title={p.title} badges={p.badges} value={p.value} chips={p.chips} meta={p.meta} />)}
  </div>;
}

function ProductDetail({ intake=false }: { intake?: boolean }) {
  return <>
    <PanelHeader title="상품 상세" />
    <DetailTabs initialOffer="o36" applyBase={intake ? '/intake?w=new&product=p1&v=work' : undefined}
      summary={<>
        <div className="dz-gal-main empty"><span>차량 사진</span></div>
        <div className="vehicle-title">
          <div><h2>제네시스 GV70 2.5T</h2><p>123가4567 · 손오공</p></div>
          <Tag icon="circle-check" good>즉시출고</Tag>
        </div>
        <OfferPicker
          initial="o36"
          perks={['무심사','만21세','경력무관']}
          offers={[
            {id:'o24',termMonths:24,monthlyRent:740000,deposit:1000000,annualMileageKm:20000},
            {id:'o36',termMonths:36,monthlyRent:690000,deposit:1000000,annualMileageKm:20000},
            {id:'o48',termMonths:48,monthlyRent:650000,deposit:1000000,annualMileageKm:20000},
            {id:'o60',termMonths:60,monthlyRent:620000,deposit:1000000,annualMileageKm:20000},
          ]}/>
      </>}
      info={<>
        <div className="vehicle-title"><div><h2>제네시스 GV70 2.5T</h2><p>123가4567 · 손오공</p></div><Tag icon="circle-check" good>즉시출고</Tag></div>
        <SummaryGrid>
          <SummaryItem label="상품구분">중고렌트</SummaryItem>
          <SummaryItem label="차량상태">정상</SummaryItem>
          <SummaryItem label="연식">2024년식</SummaryItem>
          <SummaryItem label="연료">가솔린</SummaryItem>
          <SummaryItem label="외장">우유니 화이트</SummaryItem>
          <SummaryItem label="내장">옵시디언 블랙</SummaryItem>
        </SummaryGrid>
      </>} />
  </>;
}

function Products() {
  return <Chrome active="products"><section className="workspace" data-mode="find" data-phone="list">
    <section className="panel product-panel"><div className="dz-listtop"><PanelHeader title="상품 목록" count="675대"/><Search placeholder="차번 · 모델 · 공급사"/><Quick labels={['전체','즉시출고','무심사','만21세','경력무관','무보증']}/></div><ProductList/></section>
    <section className="panel detail-panel"><ProductDetail/></section>
  </section></Chrome>;
}

function Intake() {
  return <Chrome active="intake"><section className="workspace" data-mode="intake" data-phone="list">
    <section className="panel product-panel"><div className="dz-listtop"><PanelHeader title="상품 목록" count="675대"/><Search placeholder="차번 · 모델 · 공급사"/><Quick labels={['전체','즉시출고','무심사']}/></div><ProductList/></section>
    <section className="panel detail-panel"><ProductDetail intake/></section>
    <section className="panel work-panel"><PanelHeader title="신규 접수"/>
      <div className="dz-picked"><span className="dz-picked-label">접수 상품</span><b>제네시스 GV70 2.5T</b><p>123가4567 · 36개월 · 월 690,000원</p><div className="dz-picked-grid"><div><dt>청구 수수료</dt><dd>1,160,000원</dd></div><div><dt>지급 수수료</dt><dd>900,000원</dd></div></div></div>
      <form className="dz-intake-form">
        <fieldset className="dz-form-group"><legend>고객 · 영업</legend><div className="dz-form-grid">
          <label>영업채널 *<input value="웰릭스" readOnly/></label>
          <label>담당자 *<input value="박영협" readOnly/></label>
          <label>고객명 *<input value="김고객" readOnly/></label>
          <label>연락처<input placeholder="선택 입력" readOnly/></label>
        </div></fieldset>
        <details className="dz-form-more"><summary>더 넣기 <small>상품구분 · 보험 · 계약형태 · 메모</small></summary></details>
        <ActionBar><button className="dz-bar-sub" type="button">취소</button><button className="primary" type="button">접수 저장</button></ActionBar>
      </form>
    </section>
  </section></Chrome>;
}

const settleRows = [
  ['손오공','4줄 · 환수 1','3,420,000원','2/4','navy'],
  ['오토플러스','3줄 · 보류 0','2,180,000원','완료','green'],
  ['뮤카','5줄 · 보류 1','4,920,000원','대기','grey'],
  ['롯데렌터카','2줄 · 청구월 미정','1,320,000원','미정','red'],
] as const;

function Settlement() {
  return <Chrome active="settlement"><section className="workspace" data-mode="settle" data-phone="list">
    <section className="panel product-panel"><div className="dz-listtop"><PanelHeader title="청구목록" count="12곳 · 48줄"/><Search placeholder="공급사 이름"/><Quick labels={['청구 · 공급사','지급 · 영업채널','청구월 미정 2']}/><div className="dz-month"><b>2026-09</b><span className="dz-month-sum">청구 <b>38,420,000원</b><small> · 환수 −1,180,000</small></span></div></div><div className="list">
      {settleRows.map((r,i)=><ListRow key={r[0]} href="#" selected={i===0} status={{icon:i===0?'clock':i===1?'circle-check':i===3?'alert':'file-text',label:r[3],tone:r[4]}} title={r[0]} meta={r[1]} value={r[2]} aside="공급사"/>)}
    </div></section>
    <section className="panel detail-panel st-lines"><div className="dz-listtop"><PanelHeader title="손오공" count="4줄"/><SummaryGrid><SummaryItem label="합">4,600,000원</SummaryItem><SummaryItem label="환수">−1,180,000원</SummaryItem><SummaryItem label="청구할 돈">3,420,000원</SummaryItem><SummaryItem label="청구서 보냄">2 / 4</SummaryItem></SummaryGrid><div className="dz-issue"><b>청구서 미리보기</b><p className="dz-issue-sum">합계 3,420,000원</p></div></div><div className="list">
      <ListRow href="#" selected status={{icon:'send',label:'청구',tone:'navy'}} title="김고객" meta="123가4567 · GV70 · 인도 09.18" value="1,160,000원" aside="완납"/>
      <ListRow href="#" status={{icon:'shield-check',label:'확인',tone:'navy'}} title="이서연" meta="224나7812 · 그랜저" value="900,000원" aside="완납"/>
      <ListRow href="#" status={{icon:'pause',label:'보류',tone:'amber'}} title="박준호" meta="323버9102 · 카니발" value="580,000원" aside="완납"/>
      <ListRow href="#" status={{icon:'alert',label:'끊김',tone:'red'}} title="최민지" meta="562루2201 · 아이오닉5" value="450,000원" aside="완납"/>
    </div><ActionBar><button className="primary" type="button">청구서 발행</button></ActionBar></section>
    <section className="panel work-panel"><PanelHeader title="접수 상세"/><div className="vehicle-title"><div><h2>김고객</h2><p>123가4567 · 제네시스 GV70 · 접수 2026-09-18</p></div><Tag tone="act" icon="clock">다음 · 확인</Tag></div><h3 className="dz-sub">정산 걸음 · 공급사</h3><ol className="dz-path"><li>접수</li><li className="on">청구</li><li>확인</li><li>수금</li></ol><SummaryGrid><SummaryItem label="청구금액">1,160,000원</SummaryItem><SummaryItem label="지급액">900,000원</SummaryItem><SummaryItem label="남는 것">260,000원</SummaryItem><SummaryItem label="청구월">2026-09</SummaryItem></SummaryGrid><h3 className="dz-sub">진행</h3><div className="fn-box">계약서 받음 · 인도 완료 · 완납</div><h3 className="dz-sub">돈 고치기</h3><div className="fn-box">수수료 · 프로모션 · 가감</div><ActionBar><button className="dz-bar-sub" type="button">정정 요청</button><button className="primary" type="button">공급사 확인</button></ActionBar></section>
  </section></Chrome>;
}

const contracts = [
  ['김고객','123가4567 · GV70 · 박영협 · FP-260918-001','690,000원','서명완료','green','36개월'],
  ['이서연','224나7812 · 그랜저 · 박영협 · FP-260918-002','520,000원','진행중','navy','36개월'],
  ['박준호','323버9102 · 카니발 · 김영엽 · FP-260917-003','620,000원','발행','navy','48개월'],
  ['최민지','562루2201 · 아이오닉5 · 김영엽 · FP-260917-004','450,000원','열람','amber','24개월'],
  ['정현우','88하1122 · 쏘렌토 · 박영협 · FP-260916-005','480,000원','미연결','grey','48개월'],
] as const;

function Esign() {
  return <Chrome active="esign"><section className="workspace" data-mode="esign" data-phone="list">
    <section className="panel product-panel"><div className="dz-listtop"><PanelHeader title="계약 목록" count="128건"/><Search placeholder="고객 · 차량번호 · 계약코드 · 담당자"/><Quick labels={['전체','전자서명 46','발행 12','열람 8','진행중 18','서명완료 28','미연결 16']}/></div><div className="list">{contracts.map((c,i)=><ListRow key={c[0]} href="#" selected={i===0} status={{icon:c[3]==='서명완료'?'circle-check':c[3]==='열람'?'info':c[3]==='미연결'?'file-text':'clock',label:c[3],tone:c[4]}} title={c[0]} meta={c[1]} value={c[2]} aside={c[5]}/>)}</div></section>
    <section className="panel detail-panel"><PanelHeader title="계약 상세" count="FP-260918-001"/><div className="vehicle-title"><div><h2>김고객</h2><p>123가4567 · 제네시스 GV70 · 박영협</p></div><Tag good icon="circle-check">서명완료</Tag></div><SummaryGrid><SummaryItem label="계약상태">완료</SummaryItem><SummaryItem label="서명상태">서명완료</SummaryItem><SummaryItem label="기간">36개월</SummaryItem><SummaryItem label="월 대여료">690,000원</SummaryItem></SummaryGrid><h3 className="dz-sub">계약 정보</h3><SummaryGrid><SummaryItem label="양식">장기렌터카 계약서</SummaryItem><SummaryItem label="보험">법인보험</SummaryItem><SummaryItem label="발송">09.18 10:24</SummaryItem><SummaryItem label="서명">09.18 10:41</SummaryItem></SummaryGrid><section className="dz-contract-preview"><div className="dz-contract-paper"><div className="dz-contract-brand">freepass</div><h3>장기렌터카 계약서</h3><dl><div><dt>계약코드</dt><dd>FP-260918-001</dd></div><div><dt>고객</dt><dd>김고객</dd></div><div><dt>차량</dt><dd>제네시스 GV70</dd></div><div><dt>상태</dt><dd>서명완료</dd></div><div><dt>서명일</dt><dd>2026-09-18</dd></div></dl></div></section><ActionBar><button className="dz-bar-sub" type="button">서명창 열기</button><button className="primary" type="button">서명본 열기</button></ActionBar></section>
  </section></Chrome>;
}

export default async function VisualPreview({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (view === 'intake') return <Intake/>;
  if (view === 'settlement') return <Settlement/>;
  if (view === 'esign') return <Esign/>;
  return <Products/>;
}
