/**
 * **가상 데이터 모드(FPA_DEMO=on) 전용 — ERP5 모양의 «지어낸» 문서.**
 *
 * ★전부 가상이다. 고객 이름은 가려 쓴 가짜(김*수 …), 공급사·영업채널·차량번호도 지어낸 것이다.
 *   실제 ERP5 문서를 복사하지 않았다. 화면 검토(자격증명이 없을 때)에만 쓴다.
 * ★날짜는 «부를 때의 오늘(한국 날짜)» 기준으로 센다 — 당월접수·미완료·분납실적·완납실적·취소가 늘 고르게 보이게.
 * ★모양은 ERP5 원자 그대로다 — 어댑터(to-canonical · to-settlement · contract-repository)가 실데이터와 같은 길로 읽는다.
 */

export type DemoDoc = Record<string, unknown>;
/** 컬렉션 이름 → 문서 id → 문서 */
export type DemoCollections = Record<string, Record<string, DemoDoc>>;

type SupKey = 'HB' | 'DS' | 'GR' | 'DH';
const SUP: Record<SupKey, { code: string; name: string }> = {
  HB: { code: 'SUP-HB', name: '한빛렌터카' },
  DS: { code: 'SUP-DS', name: '대성모빌리티' },
  GR: { code: 'SUP-GR', name: '그린카렌탈' },
  DH: { code: 'SUP-DH', name: '동해오토리스' },
};

const AGENTS = [
  { name: '이영업', code: 'AG-01', channel: '프리패스 직영', channelCode: 'CH-01' },
  { name: '박과장', code: 'AG-02', channel: '서울중앙지점', channelCode: 'CH-02' },
  { name: '최대리', code: 'AG-03', channel: '프리패스 직영', channelCode: 'CH-01' },
  { name: '김팀장', code: 'AG-04', channel: '부산제휴채널', channelCode: 'CH-03' },
];

const CUSTOMERS = [
  '김*수', '이*진', '박*현', '최*영', '정*호', '강*미', '조*우', '윤*아', '장*석', '임*희', '한*준', '오*린',
  '서*민', '신*태', '권*나', '황*성', '송*연', '문*빈', '배*람', '유*경', '노*훈', '하*은', '전*혁', '고*윤',
];

const POLICIES: DemoDoc[] = [
  {
    policy_code: 'POL-HB-A', provider_company_code: SUP.HB.code, screening_criteria: '무심사',
    deposit_installment: '가능 (3회)', basic_driver_age: '만 26세 이상', driver_age_lowering: '만 21세 (월 3만원)',
    age_lowering_cost: '3만원', license_period: '제한없음', annual_mileage: '연 20,000km',
    mileage_upcharge_per_10000km: '5만원', insurance_included: '포함', own_damage_min_deductible: '30만원',
    own_damage_max_deductible: '50만원', early_termination_rate_under1y: '30%', early_termination_rate_over1y: '20%',
    maintenance_service: '불가', deposit_return_days: 14, additional_driver_cost: '2만원',
  },
  {
    policy_code: 'POL-DS-A', provider_company_code: SUP.DS.code, screening_criteria: '소득확인',
    deposit_installment: '불가', basic_driver_age: '만 26세 이상', driver_age_lowering: '불가',
    license_period: '1년 이상', annual_mileage: '연 30,000km', mileage_upcharge_per_10000km: '7만원',
    insurance_included: '포함', own_damage_min_deductible: '50만원', early_termination_rate_under1y: '35%',
    early_termination_rate_over1y: '25%', maintenance_service: '포함', deposit_return_days: 30,
  },
  {
    policy_code: 'POL-GR-A', provider_company_code: SUP.GR.code, screening_criteria: '무심사',
    deposit_installment: '가능', basic_driver_age: '만 21세 이상', driver_age_lowering: '해당없음',
    license_period: '6개월 이상', annual_mileage: '연 2만km', mileage_upcharge_per_10000km: '4만원',
    insurance_included: '포함', own_damage_min_deductible: '20만원', early_termination_rate_under1y: '25%',
    maintenance_service: '불가', deposit_return_days: 14,
  },
  {
    policy_code: 'POL-DH-A', provider_company_code: SUP.DH.code, screening_criteria: '신용조회',
    deposit_installment: '협의', basic_driver_age: '만 24세 이상', driver_age_lowering: '만 23세',
    license_period: '2년 이상', annual_mileage: '연 25,000km', mileage_upcharge_per_10000km: '6만원',
    insurance_included: '별도', own_damage_min_deductible: '30만원', early_termination_rate_under1y: '30%',
    maintenance_service: '포함', deposit_return_days: 21,
  },
];

/** [id, maker, model, sub_model, trims, year_start, year_end] */
const MASTER: [string, string, string, string, string[], number, number | null][] = [
  ['VM-KIA-SORENTO', '기아', '쏘렌토', '쏘렌토 MQ4 PE', ['노블레스', '시그니처', '프레스티지'], 2023, null],
  ['VM-HY-GRANDEUR', '현대', '그랜저', '디 올 뉴 그랜저', ['익스클루시브', '캘리그래피', '프리미엄'], 2022, null],
  ['VM-KIA-CARNIVAL', '기아', '카니발', '더 뉴 카니발 KA4 PE', ['노블레스', '시그니처', '프레스티지'], 2023, null],
  ['VM-HY-AVANTE', '현대', '아반떼', '더 뉴 아반떼 CN7', ['모던', '인스퍼레이션', '스마트'], 2023, null],
  ['VM-GN-G80', '제네시스', 'G80', 'G80 RG3', ['2.5T AWD', '3.5T AWD'], 2020, null],
  ['VM-KIA-RAY', '기아', '레이', '더 뉴 레이', ['프레스티지', '시그니처', '트렌디'], 2022, null],
  ['VM-HY-PALISADE', '현대', '팰리세이드', '더 뉴 팰리세이드', ['프레스티지', '캘리그래피'], 2022, 2025],
  ['VM-KIA-K5', '기아', 'K5', '더 뉴 K5 DL3', ['노블레스', '시그니처', '프레스티지'], 2023, null],
  ['VM-KIA-SPORTAGE', '기아', '스포티지', '스포티지 NQ5', ['노블레스', '시그니처', '프레스티지'], 2021, null],
  ['VM-HY-CASPER', '현대', '캐스퍼', '캐스퍼', ['인스퍼레이션', '디 에센셜', '스마트'], 2021, null],
  ['VM-HY-TUCSON', '현대', '투싼', '더 뉴 투싼 NX4', ['인스퍼레이션', '프리미엄'], 2023, null],
  ['VM-KIA-EV6', '기아', 'EV6', '더 뉴 EV6', ['롱레인지 어스', 'GT-Line'], 2024, null],
  ['VM-HY-SANTAFE', '현대', '싼타페', '디 올 뉴 싼타페 MX5', ['익스클루시브', '프레스티지', '캘리그래피'], 2023, null],
  ['VM-GN-GV70', '제네시스', 'GV70', 'GV70 JK1 PE', ['2.5T AWD', '3.5T AWD'], 2024, null],
];

type OfferMap = Record<string, { rent: number; deposit: number }>;
const O = (pairs: [number, number, number][]): OfferMap =>
  Object.fromEntries(pairs.map(([t, rent, deposit]) => [String(t), { rent, deposit }]));

type ProductSpec = {
  code: string; plate: string; sup: SupKey; policy: string; kind: string;
  maker: string; model: string; sub: string; trim: string; year: number; km: number; fuel: string; cc: number; seats: number;
  cls: string; color: string; consumer: number; status: string; reason: string; price: OfferMap; extra?: DemoDoc;
};
type Tuple = [string, string, SupKey, string, string, string, string, string, string, number, number, string, number, number, string, string, number, string, string, OfferMap, DemoDoc?];
const spec = (t: Tuple): ProductSpec => {
  const [code, plate, sup, policy, kind, maker, model, sub, trim, year, km, fuel, cc, seats, cls, color, consumer, status, reason, price, extra] = t;
  return { code, plate, sup, policy, kind, maker, model, sub, trim, year, km, fuel, cc, seats, cls, color, consumer, status, reason, price, extra };
};

const PRODUCTS: ProductSpec[] = ([
  ['FP-0001', '123하4567', 'HB', 'POL-HB-A', '중고렌트', '기아', '쏘렌토', '쏘렌토 MQ4 PE', '시그니처', 2024, 18400, '하이브리드', 1598, 5, '중형 SUV', '스노우화이트펄', 45800000, '즉시출고', '',
    O([[12, 890000, 0], [24, 820000, 0], [36, 760000, 0], [48, 720000, 0]]), { accident_history: '무사고' }],
  ['FP-0002', '45호1289', 'HB', 'POL-HB-A', '중고렌트', '현대', '그랜저', '디 올 뉴 그랜저', '캘리그래피', 2023, 32100, '가솔린', 2497, 5, '준대형 세단', '어비스블랙펄', 52100000, '즉시출고', '',
    O([[12, 1090000, 1000000], [24, 990000, 1000000], [36, 930000, 1000000], [48, 890000, 1000000], [60, 850000, 1000000]])],
  ['FP-0003', '78허3321', 'DS', 'POL-DS-A', '중고렌트', '기아', '카니발', '더 뉴 카니발 KA4 PE', '노블레스', 2024, 12050, '디젤', 2151, 9, '대형 MPV', '판테라메탈', 49500000, '출고가능', '',
    O([[24, 1150000, 3000000], [36, 1080000, 3000000], [48, 1020000, 2000000], [60, 980000, 2000000]]), { accident_history: '무사고' }],
  ['FP-0004', '31하7702', 'GR', 'POL-GR-A', '중고렌트', '현대', '아반떼', '더 뉴 아반떼 CN7', '인스퍼레이션', 2023, 41200, '가솔린', 1598, 5, '준중형 세단', '사이버그레이', 27900000, '즉시출고', '',
    O([[12, 560000, 0], [24, 520000, 0], [36, 490000, 0]])],
  ['FP-0005', '12허9981', 'DH', 'POL-DH-A', '중고렌트', '제네시스', 'G80', 'G80 RG3', '2.5T AWD', 2022, 38800, '가솔린', 2497, 5, '대형 세단', '우유니화이트', 68900000, '출고협의', '공급사협의',
    O([[24, 1490000, 5000000], [36, 1390000, 5000000], [48, 1320000, 5000000]])],
  ['FP-0006', '67하2045', 'GR', 'POL-GR-A', '중고렌트', '기아', '레이', '더 뉴 레이', '시그니처', 2024, 8900, '가솔린', 998, 4, '경형', '밀키베이지', 17800000, '즉시출고', '',
    O([[12, 420000, 0], [24, 390000, 0], [36, 360000, 0]]), { accident_history: '무사고' }],
  ['FP-0007', '88호5510', 'DS', 'POL-DS-A', '중고렌트', '현대', '팰리세이드', '더 뉴 팰리세이드', '캘리그래피', 2023, 27600, '디젤', 2199, 7, '대형 SUV', '크리미화이트펄', 58200000, '출고가능', '',
    O([[24, 1290000, 3000000], [36, 1190000, 3000000], [48, 1130000, 3000000], [60, 1090000, 3000000]])],
  ['FP-0008', '24허6634', 'HB', 'POL-HB-A', '중고렌트', '기아', 'K5', '더 뉴 K5 DL3', '노블레스', 2023, 35400, 'LPG', 1999, 5, '중형 세단', '스틸그레이', 31200000, '즉시출고', '',
    O([[12, 690000, 0], [24, 640000, 0], [36, 600000, 0], [48, 570000, 0]])],
  ['FP-0009', '56하8812', 'GR', 'POL-GR-A', '중고렌트', '기아', '스포티지', '스포티지 NQ5', '프레스티지', 2023, 29800, '하이브리드', 1598, 5, '준중형 SUV', '그래비티그레이', 36900000, '출고가능', '',
    O([[12, 780000, 500000], [24, 720000, 500000], [36, 680000, 500000]])],
  ['FP-0010', '19호4402', 'DH', 'POL-DH-A', '중고렌트', '현대', '캐스퍼', '캐스퍼', '인스퍼레이션', 2024, 6200, '가솔린', 998, 4, '경형', '톰보이카키', 19600000, '즉시출고', '',
    O([[12, 450000, 1000000], [24, 420000, 1000000], [36, 395000, 1000000]]), { accident_history: '무사고' }],
  ['FP-0011', '72하1193', 'HB', 'POL-HB-A', '신차렌트', '기아', '쏘렌토', '쏘렌토 MQ4 PE', '노블레스', 2026, 30, '가솔린', 2497, 5, '중형 SUV', '오로라블랙펄', 42100000, '출고가능', '',
    O([[36, 820000, 0], [48, 780000, 0], [60, 740000, 0]])],
  ['FP-0012', '09허7788', 'DS', 'POL-DS-A', '신차렌트', '현대', '그랜저', '디 올 뉴 그랜저', '익스클루시브', 2026, 15, '하이브리드', 1598, 5, '준대형 세단', '트랜스미션블루펄', 49800000, '출고협의', '계약선점',
    O([[36, 990000, 2000000], [48, 950000, 2000000], [60, 910000, 2000000]])],
  ['FP-0013', '33호2217', 'GR', 'POL-GR-A', '중고구독', '현대', '투싼', '더 뉴 투싼 NX4', '프리미엄', 2024, 21300, '가솔린', 1598, 5, '준중형 SUV', '아마존그레이', 33500000, '즉시출고', '',
    O([[12, 690000, 0], [24, 650000, 0]])],
  ['FP-0014', '81하5006', 'DH', 'POL-DH-A', '중고렌트', '기아', 'EV6', '더 뉴 EV6', '롱레인지 어스', 2024, 19900, '전기', 0, 5, '중형 SUV', '문스케이프', 55600000, '출고불가', '공급사불가',
    O([[24, 990000, 3000000], [36, 940000, 3000000]])],
  ['FP-0015', '14허3390', 'HB', 'POL-HB-A', '중고렌트', '현대', '아반떼', '더 뉴 아반떼 CN7', '모던', 2022, 52300, '가솔린', 1598, 5, '준중형 세단', '폴라화이트', 24500000, '즉시출고', '',
    O([[12, 520000, 0], [24, 480000, 0], [36, 450000, 0]])],
  ['FP-0016', '63호8124', 'DS', 'POL-DS-A', '중고렌트', '기아', '카니발', '더 뉴 카니발 KA4 PE', '시그니처', 2025, 9800, '하이브리드', 1598, 7, '대형 MPV', '아스트라블루', 57800000, '즉시출고', '',
    O([[24, 1350000, 3000000], [36, 1260000, 3000000], [48, 1190000, 3000000]]), { accident_history: '무사고' }],
  ['FP-0017', '27하6651', 'GR', 'POL-GR-A', '중고렌트', '기아', '레이', '더 뉴 레이', '프레스티지', 2023, 24100, '가솔린', 998, 4, '경형', '클리어화이트', 15900000, '출고가능', '',
    O([[12, 390000, 0], [24, 360000, 0]])],
  ['FP-0018', '90허1457', 'DH', 'POL-DH-A', '중고렌트', '제네시스', 'G80', 'G80 RG3', '3.5T AWD', 2023, 22700, '가솔린', 3470, 5, '대형 세단', '비크블랙', 79800000, '즉시출고', '',
    O([[24, 1690000, 5000000], [36, 1590000, 5000000], [48, 1520000, 5000000]])],
  ['FP-0019', '38호9063', 'HB', 'POL-HB-A', '중고렌트', '기아', '스포티지', '스포티지 NQ5', '시그니처', 2024, 15600, '가솔린', 1598, 5, '준중형 SUV', '비스타블루', 35200000, '즉시출고', '',
    O([[12, 740000, 0], [24, 690000, 0], [36, 650000, 0], [48, 620000, 0]])],
  ['FP-0020', '52하3378', 'GR', 'POL-GR-A', '중고구독', '현대', '캐스퍼', '캐스퍼', '디 에센셜', 2023, 18800, '가솔린', 998, 4, '경형', '언블리치드아이보리', 17200000, '출고협의', '공급사협의',
    O([[12, 430000, 0], [24, 400000, 0]])],
  ['FP-0021', '41허2286', 'DS', 'POL-DS-A', '중고렌트', '현대', '싼타페', '디 올 뉴 싼타페 MX5', '프레스티지', 2024, 16700, '하이브리드', 1598, 5, '중형 SUV', '어스그린', 48600000, '즉시출고', '',
    O([[24, 1090000, 2000000], [36, 1020000, 2000000], [48, 970000, 2000000]]), { accident_history: '무사고' }],
  ['FP-0022', '75하6149', 'HB', 'POL-HB-A', '중고렌트', '제네시스', 'GV70', 'GV70 JK1 PE', '2.5T AWD', 2024, 21800, '가솔린', 2497, 5, '중형 SUV', '마우이블랙', 64300000, '출고가능', '',
    O([[24, 1390000, 0], [36, 1290000, 0], [48, 1220000, 0]])],
  ['FP-0023', '29호7730', 'GR', 'POL-GR-A', '중고구독', '기아', 'K5', '더 뉴 K5 DL3', '시그니처', 2024, 12400, '가솔린', 1598, 5, '중형 세단', '울프그레이', 33800000, '즉시출고', '',
    O([[12, 710000, 0], [24, 670000, 0]])],
  ['FP-0024', '96허0815', 'DH', 'POL-DH-A', '중고렌트', '현대', '투싼', '더 뉴 투싼 NX4', '인스퍼레이션', 2023, 33900, '디젤', 1598, 5, '준중형 SUV', '쉬머링실버', 31700000, '출고협의', '계약선점',
    O([[24, 760000, 1000000], [36, 710000, 1000000], [48, 680000, 1000000]])],
] as Tuple[]).map(spec);

/** 한 번 부를 때의 «오늘» — 한국 날짜 */
function clock(nowMs: number) {
  const now = new Date(nowMs + 9 * 3600_000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const ymOf = (d: Date) => d.toISOString().slice(0, 7);
  const monthsBack = (n: number) => ymOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15)));
  return {
    ymd,
    daysAgo: (n: number) => ymd(new Date(now.getTime() - n * 86400_000)),
    thisMonth: ymOf(now),
    lastMonth: monthsBack(1),
    twoMonthsAgo: monthsBack(2),
    inMonth: (m: string, day: number) => `${m}-${String(day).padStart(2, '0')}`,
    tsDaysAgo: (n: number, h = 3) => nowMs - n * 86400_000 - h * 3600_000,
  };
}

function productDoc(p: ProductSpec, daysAgo: (n: number) => string): DemoDoc {
  const s = SUP[p.sup];
  return {
    product_code: p.code, car_number: p.plate, listable: true, price: p.price,
    policy_code: p.policy, policy_reference_state: 'linked_by_operator',
    provider_company_code: s.code, partner_code: s.code, provider_name: s.name,
    vehicle_status: p.status, ...(p.reason ? { status_reason: p.reason } : {}),
    product_type: p.kind, maker: p.maker, model: p.model, sub_model: p.sub, trim_name: p.trim,
    year: p.year, mileage: p.km, fuel_type: p.fuel, ...(p.cc ? { engine_cc: p.cc } : {}), seats: p.seats,
    drive_type: /AWD/.test(p.trim) ? 'AWD' : '2WD', ...(p.fuel === '전기' ? { battery_capacity: 84 } : {}),
    vehicle_class: p.cls, ext_color: p.color, int_color: '블랙', consumer_price: p.consumer,
    options: '스마트크루즈, 통풍시트, 360도 카메라, 헤드업디스플레이',
    first_registration_date: `${p.year}-0${(p.year % 9) + 1}-12`,
    erp_first_seen_date: daysAgo((Number(p.code.slice(-2)) * 3) % 40),
    ...(p.extra ?? {}),
  };
}

function feeRules(): { rules: Record<string, DemoDoc>; current: DemoDoc } {
  const rules: Record<string, DemoDoc> = {};
  let seq = 0;
  for (const s of Object.values(SUP)) {
    const head = s.name.replace(/렌터카|모빌리티|렌탈|오토리스/g, '');
    rules[`${head}_재렌트_기본_0`] = { seq: seq++, supplier: s.name, kind: '재렌트', form: '', term: 0, basis: '대여료×기간', claim: 0.035, pay: 0.02, when: '인도월', auto: true };
    rules[`${head}_신차_선출고_0`] = { seq: seq++, supplier: s.name, kind: '신차', form: '선출고', term: 0, basis: '차량가액', claim: 0.04, pay: 0.025, when: '인도월', auto: true };
    rules[`${head}_구독_기본_0`] = { seq: seq++, supplier: s.name, kind: '구독', form: '', term: 0, basis: '정액', claim: 600000, pay: 400000, when: '인도월', auto: true };
  }
  const current: DemoDoc = {
    aliases: {}, evModel: 'EV\\d|아이오닉|일렉트릭', version: 'fee-demo-fixture',
    kindRules: [
      { match: '견적출고|매칭출고', kind: '신차', form: '매칭출고' },
      { match: '신차발주', kind: '신차', form: '발주' },
      { match: '선발주', kind: '신차', form: '선발주', evKind: '전기차', evFallback: '신차' },
      { match: '선출고', kind: '신차', form: '선출고', evKind: '전기차', evFallback: '신차' },
      { match: '구독', kind: '구독', evKind: '전기차', evFallback: '구독' },
    ],
  };
  return { rules, current };
}

type RowOpt = { term: number; receivedAt: string; payKind?: string; paidRounds?: number; claimWritten?: number; payWritten?: number; set?: DemoDoc };

/** 가상 ERP5 컬렉션 전부 — 부를 때의 오늘 기준. */
export function demoCollections(nowMs: number = Date.now()): DemoCollections {
  const c = clock(nowMs);
  const byCode = new Map(PRODUCTS.map((p) => [p.code, p]));
  const P = (code: string) => {
    const p = byCode.get(code);
    if (!p) throw new Error(`demo fixture: 없는 상품 ${code}`);
    return p;
  };

  let rowN = 0;
  const row = (productCode: string, o: RowOpt): DemoDoc => {
    const p = P(productCode);
    const s = SUP[p.sup];
    const cell = p.price[String(o.term)];
    const ag = AGENTS[rowN % AGENTS.length];
    const ledgerProduct = p.kind === '중고렌트' ? '장기렌트' : p.kind === '신차렌트' ? '선출고' : '구독';
    const rentKind = p.kind === '중고렌트' ? '재렌트' : p.kind === '신차렌트' ? '신차렌트' : '구독';
    const { rent, deposit } = cell;
    const claim = ledgerProduct === '선출고' ? Math.round(p.consumer * 0.04) : ledgerProduct === '구독' ? 600000 : Math.round(rent * o.term * 0.035);
    const pay = ledgerProduct === '선출고' ? Math.round(p.consumer * 0.025) : ledgerProduct === '구독' ? 400000 : Math.round(rent * o.term * 0.02);
    const code = `stl_demo_${String(++rowN).padStart(3, '0')}`;
    const created = Date.parse(`${o.receivedAt}T10:00:00+09:00`);
    return {
      code, plate: p.plate, receivedAt: o.receivedAt, customer: CUSTOMERS[(rowN - 1) % CUSTOMERS.length], customerPhone: '010-****-5678',
      supplier: s.name, supplierCode: s.code, channel: ag.channel, channelCode: ag.channelCode,
      agent: ag.name, agentCode: ag.code, model: p.sub.includes(p.model) ? p.sub : `${p.model} ${p.sub}`,
      product: ledgerProduct, rentKind, contractType: '개인', term: o.term, rent, deposit,
      price: ledgerProduct === '선출고' ? p.consumer : 0,
      payKind: o.payKind ?? '일시납', ...(o.paidRounds ? { paidRounds: o.paidRounds } : {}),
      sourceProductId: p.code, sourceOfferId: `${p.code}#${o.term}`,
      supplierRate: ledgerProduct === '장기렌트' ? 0.035 : ledgerProduct === '선출고' ? 0.04 : 600000,
      agentRate: ledgerProduct === '장기렌트' ? 0.02 : ledgerProduct === '선출고' ? 0.025 : 400000,
      claimWritten: o.claimWritten === undefined ? claim : o.claimWritten,
      payWritten: o.payWritten === undefined ? pay : o.payWritten,
      paper: false, delivered: false, cancelled: false, billed: false, invoiceIssued: false,
      collected: false, paid: false, supplierOk: false, channelOk: false, billHold: false, settleExclude: false,
      claimStage: '접수', payStage: '접수', settleTarget: '양쪽', settleRatio: 1,
      createdAt: created, updatedAt: created, createdBy: 'demo-fixture',
      ...(o.set ?? {}),
    };
  };
  const done = (m: string, day: number, extra: DemoDoc = {}): DemoDoc => ({
    paper: true, delivered: true, deliveredAt: c.inMonth(m, day), billed: true, billMonth: m, billedAt: c.inMonth(m, 28),
    invoiceIssued: true, invoiceAt: c.inMonth(m, 28), invoiceBiz: '000-00-00000',
    supplierOk: true, channelOk: true, claimStage: '확인', payStage: '확인', ...extra,
  });
  const { daysAgo, thisMonth, lastMonth, twoMonthsAgo, inMonth } = c;

  const rows: DemoDoc[] = [
    // 당월접수 — 이번 달 접수 (인도 전 · 인도 · 청구 단계가 섞인다)
    row('FP-0001', { term: 36, receivedAt: daysAgo(0) }),
    row('FP-0004', { term: 24, receivedAt: daysAgo(1), set: { paper: true } }),
    row('FP-0006', { term: 12, receivedAt: daysAgo(2), set: { paper: true, delivered: true, deliveredAt: daysAgo(1) } }),
    row('FP-0011', { term: 48, receivedAt: daysAgo(4), set: { paper: true, delivered: true, deliveredAt: daysAgo(2), claimStage: '청구', billed: true, billMonth: thisMonth } }),
    row('FP-0013', { term: 12, receivedAt: daysAgo(6), set: { paper: true, delivered: true, deliveredAt: daysAgo(5), claimStage: '청구', payStage: '통보', billed: true, billMonth: thisMonth } }),
    row('FP-0008', { term: 36, receivedAt: daysAgo(8), set: { paper: true, delivered: true, deliveredAt: daysAgo(6), claimStage: '확인', payStage: '통보', billed: true, billMonth: thisMonth, supplierOk: true } }),
    row('FP-0019', { term: 24, receivedAt: daysAgo(10), payKind: '3회분납', set: { paper: true, delivered: true, deliveredAt: daysAgo(9) } }),
    row('FP-0015', { term: 12, receivedAt: daysAgo(12), claimWritten: 0, set: { paper: true } }),
    row('FP-0021', { term: 36, receivedAt: daysAgo(3), set: { paper: true, note: '인도일 조율 중' } }),
    // 완납실적 — 지난달 인도 · 청구/수금/지급 단계
    row('FP-0002', { term: 36, receivedAt: inMonth(lastMonth, 4), set: done(lastMonth, 8, { claimStage: '수금', payStage: '지급', collected: true, paid: true }) }),
    row('FP-0003', { term: 48, receivedAt: inMonth(lastMonth, 11), set: done(lastMonth, 16, { claimStage: '수금', collected: true, payStage: '확인' }) }),
    row('FP-0009', { term: 24, receivedAt: inMonth(lastMonth, 18), set: done(lastMonth, 22, { claimStage: '정정', payStage: '통보', claimAdjust: -150000, adjustReason: '공급사 프로모션 차감' }) }),
    row('FP-0022', { term: 36, receivedAt: inMonth(lastMonth, 6), set: done(lastMonth, 10, { claimStage: '청구', payStage: '통보', supplierOk: false, channelOk: false }) }),
    // 분납실적 — 인도됐고 분납이 아직 끝나지 않았다
    row('FP-0016', { term: 36, receivedAt: inMonth(lastMonth, 20), payKind: '3회분납', paidRounds: 2, set: { paper: true, delivered: true, deliveredAt: inMonth(lastMonth, 24), claimStage: '청구', billed: true } }),
    row('FP-0023', { term: 12, receivedAt: inMonth(lastMonth, 13), payKind: '6회분납', set: { paper: true, delivered: true, deliveredAt: inMonth(lastMonth, 15) } }),
    // 미완료 — 지난달 접수 · 아직 인도 전
    row('FP-0005', { term: 36, receivedAt: inMonth(lastMonth, 26), set: { paper: true, note: '공급사 출고일 협의 중' } }),
    row('FP-0012', { term: 48, receivedAt: inMonth(lastMonth, 29), set: { paper: false, note: '계약서 회수 대기' } }),
    row('FP-0024', { term: 24, receivedAt: inMonth(lastMonth, 21), set: { paper: true, note: '보증금 입금 확인 대기' } }),
    // 두 달 전 — 끝까지 정산됨
    row('FP-0018', { term: 24, receivedAt: inMonth(twoMonthsAgo, 7), set: done(twoMonthsAgo, 12, { claimStage: '수금', payStage: '지급', collected: true, paid: true }) }),
    row('FP-0007', { term: 36, receivedAt: inMonth(twoMonthsAgo, 14), set: done(twoMonthsAgo, 19, { claimStage: '수금', payStage: '지급', collected: true, paid: true }) }),
    // 취소
    row('FP-0017', { term: 12, receivedAt: inMonth(lastMonth, 9), set: { cancelled: true, note: '고객 변심 취소' } }),
    row('FP-0010', { term: 24, receivedAt: daysAgo(5), set: { cancelled: true, note: '심사 부결로 취소' } }),
  ];
  for (const r of rows) {
    if (r.collected) r.collectedAmt = Number(r.claimWritten) + Number(r.claimAdjust ?? 0);
    if (r.paid) r.paidAmt = Number(r.payWritten);
  }

  const cbRow = rows.find((r) => r.sourceProductId === 'FP-0007')!;
  const clawbacks: Record<string, DemoDoc> = {
    cb_demo_001: {
      code: cbRow.code, plate: cbRow.plate, month: lastMonth, supplier: cbRow.supplier, channel: cbRow.channel,
      supplierAmt: 320000, agentAmt: 180000, reason: '중도해지 (3개월 내) 환수', at: inMonth(lastMonth, 27),
    },
  };

  type CtOpt = { term: number; daysAgo: number; status: string; sign?: string; kind?: string; ins?: string };
  const contract = (i: number, productCode: string, o: CtOpt): DemoDoc => {
    const p = P(productCode);
    const created = c.tsDaysAgo(o.daysAgo);
    return {
      contract_code: `CT-DEMO-${String(100 + i)}`, contract_status: o.status, sign_status: o.sign ?? '',
      esign_contract_kind: o.kind ?? 'rent_return', esign_insurance_side: o.ins ?? '보험 포함',
      car_number_snapshot: p.plate, maker_snapshot: p.maker, model_snapshot: p.model, sub_model_snapshot: p.sub,
      customer_name: CUSTOMERS[(i + 3) % CUSTOMERS.length], customer_phone: '010-****-5678',
      agent_name: AGENTS[i % AGENTS.length].name, provider_company_code: SUP[p.sup].code,
      rent_amount_snapshot: p.price[String(o.term)].rent, rent_month_snapshot: o.term,
      contract_date: c.ymd(new Date(created + 9 * 3600_000)), created_at: created,
      ...(o.sign ? { sign_sent_at: created + 3600_000, esign_sign_url: `https://example.invalid/sign/demo-${i}` } : {}),
      ...(o.sign === '서명완료' ? { sign_signed_at: created + 5 * 3600_000, signed_pdf_url: `https://example.invalid/pdf/demo-${i}.pdf` } : {}),
    };
  };
  const contracts = [
    contract(1, 'FP-0001', { term: 36, daysAgo: 0, status: '계약요청', sign: '발행' }),
    contract(2, 'FP-0004', { term: 24, daysAgo: 1, status: '계약요청', sign: '열람' }),
    contract(3, 'FP-0006', { term: 12, daysAgo: 2, status: '계약대기', sign: '진행중' }),
    contract(4, 'FP-0011', { term: 48, daysAgo: 4, status: '계약완료', sign: '서명완료', ins: '보험 별도' }),
    contract(5, 'FP-0013', { term: 12, daysAgo: 6, status: '계약완료', sign: '서명완료', kind: 'sub_return' }),
    contract(6, 'FP-0008', { term: 36, daysAgo: 8, status: '계약완료', sign: '서명완료' }),
    contract(7, 'FP-0005', { term: 36, daysAgo: 12, status: '계약요청', sign: '' }),
    contract(8, 'FP-0017', { term: 12, daysAgo: 20, status: '계약취소', sign: '' }),
    contract(9, 'FP-0019', { term: 24, daysAgo: 10, status: '계약완료', sign: '서명완료' }),
    contract(10, 'FP-0021', { term: 36, daysAgo: 3, status: '계약대기', sign: '열람' }),
    contract(11, 'FP-0010', { term: 24, daysAgo: 5, status: '계약취소', sign: '발행' }),
  ];

  const fee = feeRules();
  const keyed = (docs: DemoDoc[], key: (d: DemoDoc, i: number) => string) =>
    Object.fromEntries(docs.map((d, i) => [key(d, i), d]));

  return {
    policy: keyed(POLICIES, (d) => String(d.policy_code)),
    vehicle_master: Object.fromEntries(MASTER.map(([id, maker, model, sub, trims, ys, ye]) =>
      [id, { maker, model, sub_model: sub, trims, aliases: [], year_start: ys, year_end: ye }])),
    /* ★문서 id = 차번 (ERP5 꼴) */
    products: keyed(PRODUCTS.map((p) => productDoc(p, daysAgo)), (d) => String(d.car_number)),
    settlement_fee_rules: fee.rules,
    settlement_rules: { current: fee.current },
    settlement_rows: keyed(rows, (d) => String(d.code)),
    settlement_clawbacks: clawbacks,
    contract: keyed(contracts, (_d, i) => `ct_demo_${String(i + 1).padStart(2, '0')}`),
  };
}
