/* 자료 — 화면 코드와 갈라 둔다. 화면을 고쳐도 자료가 안 흔들린다. */
const won = n => n.toLocaleString('ko-KR') + '원';
const man = n => (n / 10000).toLocaleString('ko-KR') + '만';
const km = n => n.toLocaleString('ko-KR') + 'km';
const dep = n => (n ? man(n) + '원' : '없음');
const yr = n => (n == null ? null : '연 ' + (n / 10000).toLocaleString('ko-KR') + '만km');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = s => document.querySelector(s);

/**
 * 차 그림 — 시안이라 실물 사진 대신 자리와 결만 세운다.
 * 사진 위에는 아무것도 얹지 않는다 (대표 2026-09-04).
 */
function carSvg(body) {
  return [
    '<svg viewBox="0 0 168 78" role="img" aria-label="차량 사진">',
    '<ellipse cx="84" cy="70" rx="70" ry="4.5" fill="rgba(0,0,0,.09)"/>',
    '<path d="M8,56 L8,45 C8,39 12,36 20,34.5 L44,31 C52,20 63,16 79,16 L108,16 C122,16 131,20 139,30 L153,36 C159,38 161,41 161,47 L161,56 Z" fill="' + body + '" stroke="rgba(0,0,0,.14)"/>',
    '<path d="M50,31 C57,22 65,19 78,19 L85,19 L85,32 Z" fill="#78868f" opacity=".82"/>',
    '<path d="M91,19 L107,19 C118,19 124,22 129,30 L91,32 Z" fill="#78868f" opacity=".82"/>',
    '<circle cx="46" cy="56" r="12.5" fill="#1b2126"/><circle cx="46" cy="56" r="4.8" fill="#98a1a8"/>',
    '<circle cx="129" cy="56" r="12.5" fill="#1b2126"/><circle cx="129" cy="56" r="4.8" fill="#98a1a8"/>',
    '</svg>',
  ].join('');
}

/** 전자계약 — 보냈나 · 봤나 · 서명했나. 셋은 서로 다른 사실이다. */
const ESIGNS = [
  { no: 'E-2609-041', app: 'A-260916-015', cust: '김서연', veh: '싼타페 MX5', st: '서명 대기',
    sent: '09-16 14:40', seen: '09-16 14:52', signed: null, to: '010-2841-0093', doc: '장기렌터카 이용계약서 v3' },
  { no: 'E-2609-040', app: 'A-260915-031', cust: '이서진', veh: '싼타페 TM', st: '열람 전',
    sent: '09-15 16:20', seen: null, signed: null, to: '', doc: '장기렌터카 이용계약서 v3' },
  { no: 'E-2609-038', app: 'A-260915-022', cust: '최윤호', veh: '싼타페 MX5', st: '완료',
    sent: '09-15 11:30', seen: '09-15 11:44', signed: '09-15 11:51', to: '010-3312-8890', doc: '장기렌터카 이용계약서 v3' },
];

const PRODUCTS = [
  { id:'P-2411-0832', v:7, supplier:'대영렌터카', name:'싼타페 MX5', sub:'캘리그래피 2.5 터보 7인승',
    match:'TRIM', matchLabel:'세부트림 확정', year:2024, mileage:12400, fuel:'가솔린', seats:7,
    color:'어비스 블랙 펄', body:'#20262c', maker:'현대', plate:'서울 12가 3456', offers:[
      { id:'O-36-A', term:36, rent:1090000, dep:0,       depRate:0,  mile:20000, pol:['만 21세 가능','카드결제','후불'] },
      { id:'O-24-A', term:24, rent:1180000, dep:1000000, depRate:10, mile:20000, pol:['카드결제'] },
      { id:'O-48-A', term:48, rent: 990000, dep:0,       depRate:0,  mile:30000, pol:['만 26세 이상','보증금 분납'] }]},
  { id:'P-2411-0790', v:3, supplier:'한빛모빌리티', name:'싼타페 MX5', sub:'익스클루시브 1.6 하이브리드',
    match:'TRIM', matchLabel:'세부트림 확정', year:2025, mileage:null, fuel:'하이브리드', seats:5,
    color:'크리미 화이트 펄', body:'#e9e7e1', maker:'현대', plate:null, offers:[
      { id:'O-36-B', term:36, rent:1040000, dep:0, depRate:0, mile:20000, pol:['만 21세 가능','후불'] },
      { id:'O-60-B', term:60, rent: 880000, dep:0, depRate:0, mile:20000, pol:['만 26세 이상'] }]},
  { id:'P-2410-0641', v:11, supplier:'새턴렌탈', name:'싼타페 TM', sub:'세부트림 미확인',
    match:'SUB_MODEL', matchLabel:'세부모델까지만 확인됨', year:2021, mileage:58700, fuel:'디젤', seats:null,
    /* ★사진은 있는데 «색상 원자»는 없다 — 사진이 있다고 값이 있는 것이 아니다 */
    color:null, body:'#a2aab0', maker:'현대', plate:'경기 78너 1204', offers:[
      { id:'O-36-C', term:36, rent:690000, dep:0, depRate:0, mile:20000, pol:['만 21세 가능','후불'] }]},
  { id:'P-2409-0388', v:2, supplier:'대영렌터카', name:'싼타페', sub:'세부모델 미확인',
    match:'MODEL', matchLabel:'모델까지만 확인됨', year:null, mileage:null, fuel:null, seats:null,
    /* ★사진 없는 차가 실측 28% 다 — 네모 빈 상자 말고 둥근 「사진 준비 중」 */
    color:null, body:null, maker:'현대', plate:null, offers:[
      { id:'O-36-D', term:36, rent:760000, dep:0, depRate:null, mile:null, pol:[] }]},
];

/**
 * 조건 축 — `scope` 가 «잣대를 어디에 대나»를 가른다.
 * ★`offer` 축은 **하나의 Offer** 가 그 축들을 «전부» 만족해야 한다. 36개월의 대여료와
 *   48개월의 보증금을 섞어 없는 조건을 만들지 않는다.
 * ★`product` 축은 차 자체에 댄다(연료·연식·공급사·확정도).
 */
const TERM_OPTIONS = [...new Set(PRODUCTS.flatMap(p => p.offers.map(o => o.term)))]
  .filter(month => Number.isInteger(month) && month > 0)
  .sort((a,b) => a-b)
  .map(month => ({ k:String(month), label:`${month}개월`, test:o => o.term === month }));

const AXES = [
  { k:'term', t:'대여기간', scope:'offer', val:o=>`${o.term}개월`, opts:TERM_OPTIONS},
  { k:'rent', t:'월 대여료', scope:'offer', tok:o=>'월 '+o.label, val:o=>won(o.rent), opts:[
    {k:'r70',label:'70만원 이하',test:o=>o.rent<=700000},
    {k:'r100',label:'100만원 이하',test:o=>o.rent<=1000000},
    {k:'r100u',label:'100만원 초과',test:o=>o.rent>1000000}]},
  { k:'dep', t:'보증금', scope:'offer', tok:o=>o.k==='d0'?'무보증':'보증금 '+o.label, val:o=>dep(o.dep), opts:[
    {k:'d0',label:'무보증 (0원)',test:o=>o.dep===0},
    {k:'d100',label:'100만원 이하',test:o=>o.dep>0&&o.dep<=1000000},
    {k:'d100u',label:'100만원 초과',test:o=>o.dep>1000000}]},
  /* ★미확인은 어느 구간에도 안 든다 — 「모른다」는 조건이 아니다 */
  { k:'mile', t:'약정주행', scope:'offer', val:o=>yr(o.mile)??'미확인', opts:[
    {k:'m2',label:'연 2만km',test:o=>o.mile===20000},
    {k:'m3',label:'연 3만km',test:o=>o.mile===30000}]},
  { k:'pol', t:'정책', scope:'offer', val:o=>o.pol.join(' · ')||'정책 없음', opts:[
    {k:'age21',label:'만 21세 가능',test:o=>o.pol.includes('만 21세 가능')},
    {k:'card',label:'카드결제',test:o=>o.pol.includes('카드결제')},
    {k:'post',label:'후불',test:o=>o.pol.includes('후불')},
    {k:'split',label:'보증금 분납',test:o=>o.pol.includes('보증금 분납')}]},
  { k:'fuel', t:'연료', scope:'product', val:p=>p.fuel||'미확인', opts:[
    {k:'가솔린',label:'가솔린',test:p=>p.fuel==='가솔린'},
    {k:'디젤',label:'디젤',test:p=>p.fuel==='디젤'},
    {k:'하이브리드',label:'하이브리드',test:p=>p.fuel==='하이브리드'}]},
  { k:'year', t:'연식', scope:'product', val:p=>p.year?p.year+'년형':'미확인', opts:[
    {k:'y25',label:'2025년형',test:p=>p.year===2025},{k:'y24',label:'2024년형',test:p=>p.year===2024},
    {k:'y21',label:'2021년형',test:p=>p.year===2021}]},
  { k:'match', t:'차종 확정도', scope:'product', val:p=>p.matchLabel, opts:[
    {k:'TRIM',label:'세부트림까지',test:p=>p.match==='TRIM'},
    {k:'SUB_MODEL',label:'세부모델까지',test:p=>p.match==='SUB_MODEL'},
    {k:'MODEL',label:'모델까지',test:p=>p.match==='MODEL'}]},
  { k:'sup', t:'공급사', scope:'product', val:p=>p.supplier, opts:[
    {k:'대영렌터카',label:'대영렌터카',test:p=>p.supplier==='대영렌터카'},
    {k:'한빛모빌리티',label:'한빛모빌리티',test:p=>p.supplier==='한빛모빌리티'},
    {k:'새턴렌탈',label:'새턴렌탈',test:p=>p.supplier==='새턴렌탈'}]},
];

/**
 * ★관리자는 퀵필터 알약을 두지 않는다 — **검색창이 조건을 먹는다**
 *   (대표 2026-09-16 「어차피 검색창에 무보증 이런거 21세 이런거 다 먹히게 할거니까」).
 *   손님은 알약을 눌러 찾지만, 직원은 전화를 받으며 «들은 그대로» 친다.
 * ★읽어낸 말은 조건 토큰으로 «보여 준다». 안 보여 주면 「내가 뭘 걸었는지」 모른 채
 *   결과만 줄어들어, 그때부터 화면의 숫자를 안 믿는다.
 */
const TERMS = [
  { re:/무보증|보증금\s*없|보증금\s*0/,       axis:'dep',  key:'d0'    },
  { re:/만?\s*21\s*세|21살/,                 axis:'pol',  key:'age21' },
  { re:/카드(결제)?/,                         axis:'pol',  key:'card'  },
  { re:/후불/,                                axis:'pol',  key:'post'  },
  { re:/분납/,                                axis:'pol',  key:'split' },
  { re:/하이브리드|하브|HEV/i,                 axis:'fuel', key:'하이브리드' },
  { re:/디젤/,                                axis:'fuel', key:'디젤'   },
  { re:/가솔린|휘발유/,                        axis:'fuel', key:'가솔린' },
  { re:/12\s*개월/, axis:'term', key:'12' }, { re:/24\s*개월/, axis:'term', key:'24' },
  { re:/36\s*개월/, axis:'term', key:'36' }, { re:/48\s*개월/, axis:'term', key:'48' },
  { re:/60\s*개월/, axis:'term', key:'60' },
  { re:/(월\s*)?70\s*만\s*(원)?\s*(이하|이내|↓|밑)/, axis:'rent', key:'r70'  },
  { re:/(월\s*)?100\s*만\s*(원)?\s*(이하|이내|↓|밑)/,axis:'rent', key:'r100' },
  { re:/대영(렌터카)?/,   axis:'sup', key:'대영렌터카' },
  { re:/한빛(모빌리티)?/, axis:'sup', key:'한빛모빌리티' },
  { re:/새턴(렌탈)?/,     axis:'sup', key:'새턴렌탈' },
];

/**
 * ★진행은 «사실 넷» 이다 (대표 2026-09-16).
 *   계약금·잔금은 «정산과 무관» 하고 «완료만» 잡는다 — 금액을 여기 두지 않는다.
 *   잔금이 들어와야 인도가 나가므로 서류와 인도 사이에 선다.
 */
const STEPS = [['contract','계약서'], ['docs','필수서류'], ['balance','잔금'], ['deliv','인도']];

const CHANNELS = ['다이렉트 (본사)','유니오토','카링크모빌리티','한결오토리스'];
const STAFF    = ['박지훈 · 운영지원','정수아 · 운영지원','최민석 · 영업지원'];

let APPS = [
  { no:'A-260916-015', plate:'서울 12가 3456', cust:'김서연', phone:'010-2841-0093', veh:'싼타페 MX5', trim:'캘리그래피 2.5 터보',
    pid:'P-2411-0832', pv:7, sup:'대영렌터카', oid:'O-36-A', term:36, rent:1090000, dep:0, mile:20000,
    ch:'유니오토', staff:'박지훈', at:'09-16 14:22', memoAgent:'고객이 주말 인도 희망', memoProvider:'', memoAdmin:'', memoAgent:'고객이 주말 인도 희망', memoProvider:'', memoAdmin:'', contract:false, docs:false, balance:false, deliv:false, cxl:false },
  { no:'A-260916-014', plate:'인천 41버 7790', cust:'김도호', phone:'010-5520-7741', veh:'싼타페 MX5', trim:'익스클루시브 1.6 HEV',
    pid:'P-2411-0790', pv:3, sup:'한빛모빌리티', oid:'O-36-B', term:36, rent:1040000, dep:0, mile:20000,
    ch:'다이렉트 (본사)', staff:'정수아', at:'09-16 09:40', contract:true, docs:true, balance:true, deliv:true, cxl:false },
  { no:'A-260915-031', plate:'경기 78너 1204', cust:'이서진', phone:'', veh:'싼타페 TM', trim:'세부트림 미확인',
    pid:'P-2410-0641', pv:11, sup:'새턴렌탈', oid:'O-36-C', term:36, rent:690000, dep:0, mile:20000,
    ch:'카링크모빌리티', staff:'박지훈', at:'09-15 16:05', memoAgent:'', memoProvider:'재직증명서 아직 안 옴', memoAdmin:'', memoAgent:'', memoProvider:'재직증명서 아직 안 옴', memoAdmin:'', contract:true, docs:false, balance:false, deliv:false, cxl:false },
  { no:'A-260915-022', plate:'서울 33다 9012', cust:'최윤호', phone:'010-3312-8890', veh:'싼타페 MX5', trim:'캘리그래피 2.5 터보',
    pid:'P-2411-0832', pv:6, sup:'대영렌터카', oid:'O-48-A', term:48, rent:990000, dep:0, mile:30000,
    ch:'한결오토리스', staff:'최민석', at:'09-15 11:12', contract:true, docs:true, balance:true, deliv:true, cxl:false },
  { no:'A-260914-009', plate:'경기 05러 6621', cust:'한지우', phone:'010-7781-2043', veh:'싼타페 TM', trim:'세부트림 미확인',
    pid:'P-2410-0641', pv:10, sup:'새턴렌탈', oid:'O-36-C', term:36, rent:690000, dep:0, mile:20000,
    ch:'카링크모빌리티', staff:'정수아', at:'09-14 13:38', contract:true, docs:true, balance:true, deliv:true, cxl:false },
  { no:'A-260912-008', plate:'서울 77머 3308', cust:'박민석', phone:'010-2204-6611', veh:'싼타페', trim:'세부모델 미확인',
    pid:'P-2409-0388', pv:2, sup:'대영렌터카', oid:'O-36-D', term:36, rent:760000, dep:0, mile:null,
    ch:'유니오토', staff:'박지훈', at:'09-12 10:20', contract:false, docs:false, balance:false, deliv:false, cxl:true,
    cxlReason:'고객 변심 — 타사 계약' },
];
/**
 * 실적 — «갈래» 가 둘이다 (대표 2026-09-16).
 *   NEW      인도완료가 올라온 정상 실적
 *   CLAWBACK 환수 — 되돌리는 줄
 *
 * ★★환수를 «접수의 체크» 로 달지 않는다.
 *   체크로 달면 이미 선 실적을 나중에 손대게 되고, 그 순간 원장이 더러워진다.
 *   환수는 «반대 부호의 실적 한 줄» 이다. 원 실적은 그대로 두고 되돌리는 줄을 더한다.
 *   WORK-INBOX §12 가 못박은 「부분수금·조정은 원금액을 덮어쓰지 않고
 *   거래 이력으로 추가한다」와 같은 결이다.
 * ★환수 줄은 «어느 실적을 되돌리나»(origin)를 반드시 들고 있어야 한다.
 *   안 들면 합계만 맞고 «왜 줄었는지» 를 못 댄다.
 */
let PERFS = [
  { no:'S-2609-018', kind:'NEW', app:'A-260916-014', stage:1, issue:false, bill:720000,  pay:0,
    note:'다이렉트 건이라 채널 지급이 없다', at:'09-16' },
  { no:'S-2609-017', kind:'NEW', app:'A-260915-022', stage:2, issue:true,  bill:1150000, pay:700000,
    note:'공급사가 인도일을 09-16 으로 본다 — 09-15 과 하루 어긋남', at:'09-15' },
  { no:'S-2609-016', kind:'NEW', app:'A-260914-009', stage:4, issue:false, bill:480000,  pay:290000,
    note:'', at:'09-14' },
  { no:'S-2609-015', kind:'CLAWBACK', app:'A-260914-009', origin:'S-2609-016', stage:2, issue:false,
    bill:-480000, pay:-290000, at:'09-16',
    reason:'인도 후 14일 이내 계약 해지 — 수수료 전액 환수',
    note:'원 실적 S-2609-016 을 되돌린다. 그 줄은 «그대로» 두고 반대 부호로 한 줄 더 세운다.' },
];
let BILLS = [
  { sup:'대영렌터카',   month:'2026-09', fixed:4320000, tax:'발행', got:2000000, cnt:6,
    hist:[{t:'09-10',w:'청구서 생성',a:4320000},{t:'09-11',w:'계산서 처리',a:null},{t:'09-14',w:'수금 등록 — 부분',a:2000000}] },
  { sup:'한빛모빌리티', month:'2026-09', fixed:2160000, tax:'미발행', got:0, cnt:3,
    hist:[{t:'09-12',w:'청구서 생성',a:2160000}] },
  { sup:'새턴렌탈',     month:'2026-09', fixed:1440000, tax:'발행', got:1440000, cnt:2,
    hist:[{t:'09-08',w:'청구서 생성',a:1440000},{t:'09-09',w:'계산서 처리',a:null},{t:'09-13',w:'수금 등록 — 전액',a:1440000}] },
];
let PAYS = [
  { ch:'유니오토',       month:'2026-09', fixed:2100000, paid:2100000, cnt:3, hold:false,
    hist:[{t:'09-13',w:'지급 확정',a:2100000},{t:'09-15',w:'지급 등록 — 전액',a:2100000}] },
  { ch:'카링크모빌리티', month:'2026-09', fixed:870000,  paid:0,       cnt:2, hold:true,
    holdWhy:'새턴렌탈 수금은 끝났지만 대영렌터카 건이 미수다. «공급사 수금 전 채널 지급» 정책이 아직 안 정해졌다.',
    hist:[{t:'09-13',w:'지급 확정',a:870000},{t:'09-14',w:'지급 보류',a:null}] },
  { ch:'한결오토리스',   month:'2026-09', fixed:1160000, paid:600000,  cnt:2, hold:false,
    hist:[{t:'09-12',w:'지급 확정',a:1160000},{t:'09-15',w:'지급 등록 — 부분',a:600000}] },
];

