/* ★자동 생성 — 손으로 고치지 않는다. scripts/sync-field-catalog.mts 가 erp4 lib/domain/policy-tier.ts (b4546461) 에서 뽑았다. */
export const POLICY_LAYER_LABEL = {
  "product": "상품 — 매물·견적에 필요한 것",
  "sales": "영업 — 상담에서 영업사원이 알아야 할 것",
  "contract": "계약 — 전자계약서를 쓰기 위해 필요한 것"
} as const;

export const POLICY_FIELDS = [
  {
    "key": "annual_mileage",
    "label": "약정 주행거리",
    "layer": "product",
    "exposure": "contract",
    "article": "제23조",
    "why": "기본 약정. 상향은 영업 층의 가격표로 정한다"
  },
  {
    "key": "max_annual_mileage",
    "label": "최대 주행거리",
    "layer": "product",
    "exposure": "quote",
    "why": "이 정책에서 올릴 수 있는 상한. 1만km씩 올리다가 어디서 멈추는지 — 없으면 손님도 영업자도 모른다(2026-09-05 신설)"
  },
  {
    "key": "basic_driver_age",
    "label": "기본 운전자 연령",
    "layer": "product",
    "exposure": "contract",
    "article": "제13조",
    "why": "기본 자격. 하향은 영업 층의 가격표로 정한다. 면책금 산정 기준이기도 하다"
  },
  {
    "key": "license_period",
    "label": "면허 경력요건",
    "layer": "product",
    "exposure": "contract",
    "article": "제13조",
    "why": "자격 요건"
  },
  {
    "key": "insurance_included",
    "label": "보험 포함 여부",
    "layer": "product",
    "exposure": "contract",
    "article": "제11조",
    "why": "회사 가입형이냐 개인보험형이냐에 따라 보험 유지 주체가 갈린다"
  },
  {
    "key": "maintenance_service",
    "label": "정비 상품",
    "layer": "product",
    "exposure": "contract",
    "article": "제14조",
    "why": "정비 범위"
  },
  {
    "key": "personal_driver_scope",
    "label": "운전자 범위(개인)",
    "layer": "product",
    "exposure": "contract",
    "article": "제13조",
    "why": "범위 밖 운전 사고는 보험 전액 제외"
  },
  {
    "key": "business_driver_scope",
    "label": "운전자 범위(사업자)",
    "layer": "product",
    "exposure": "contract",
    "article": "제13조",
    "why": "위와 같음"
  },
  {
    "key": "injury_compensation_limit",
    "label": "대인배상",
    "layer": "product",
    "exposure": "contract",
    "article": "제11조",
    "why": "담보 한도"
  },
  {
    "key": "property_compensation_limit",
    "label": "대물배상",
    "layer": "product",
    "exposure": "contract",
    "article": "제11조",
    "why": "담보 한도"
  },
  {
    "key": "self_body_accident",
    "label": "자기신체사고",
    "layer": "product",
    "exposure": "contract",
    "article": "제11조",
    "why": "담보 한도"
  },
  {
    "key": "uninsured_damage",
    "label": "무보험차상해",
    "layer": "product",
    "exposure": "contract",
    "article": "제11조",
    "why": "담보 한도"
  },
  {
    "key": "own_damage_compensation",
    "label": "자차 보상",
    "layer": "product",
    "exposure": "contract",
    "article": "제18조",
    "why": "담보 한도"
  },
  {
    "key": "own_damage_repair_ratio",
    "label": "자차 자기부담률",
    "layer": "product",
    "exposure": "contract",
    "article": "제18조",
    "why": "손님 부담분"
  },
  {
    "key": "annual_roadside_assistance",
    "label": "긴급출동",
    "layer": "product",
    "exposure": "contract",
    "article": "제14조",
    "why": "연간 횟수"
  },
  {
    "key": "mileage_upcharge_per_10000km",
    "label": "1만km 상향 요금",
    "layer": "sales",
    "exposure": "sales",
    "decides": "월 대여료",
    "why": "약정 주행거리를 올릴 때의 가산액. 2만km 65만 / 3만km 75만 — 확정되면 월 대여료에 녹는다"
  },
  {
    "key": "age_lowering_cost",
    "label": "연령 하향 요금",
    "layer": "sales",
    "exposure": "sales",
    "decides": "월 대여료 · 운전자 연령",
    "why": "하향을 선택하면 대여료가 오르고 연령이 내려간다"
  },
  {
    "key": "additional_driver_cost",
    "label": "추가운전자 요금",
    "layer": "sales",
    "exposure": "sales",
    "decides": "월 대여료",
    "why": "지정 인원만큼 대여료에 얹힌다"
  },
  {
    "key": "delivery_fee",
    "label": "탁송비",
    "layer": "sales",
    "exposure": "quote",
    "decides": "초기 비용",
    "why": "금액이 확정되면 견적·계약서로"
  },
  {
    "key": "driver_age_lowering",
    "label": "연령 하향 가능 범위",
    "layer": "sales",
    "exposure": "sales",
    "decides": "운전자 연령",
    "why": "만 21세까지 내릴 수 있다는 «선택지». 결정되면 계약서에는 굳은 연령만"
  },
  {
    "key": "driver_age_upper_limit",
    "label": "연령 상한",
    "layer": "sales",
    "exposure": "sales",
    "decides": "운전자 연령",
    "why": "자격 판정"
  },
  {
    "key": "additional_driver_allowance_count",
    "label": "추가운전자 허용 수",
    "layer": "sales",
    "exposure": "contract",
    "article": "제13조",
    "decides": "등록 가능 인원",
    "why": "몇 명까지 등록 가능한가 — 이건 계약 내내 적용되므로 계약서에도 실린다"
  },
  {
    "key": "deposit_installment",
    "label": "보증금 분납 가능 회차",
    "layer": "sales",
    "exposure": "sales",
    "decides": "보증금 납부 방식",
    "why": "선택지. 계약서에는 «3회 분납»처럼 굳은 값만"
  },
  {
    "key": "rental_card_payment",
    "label": "대여료카드",
    "layer": "sales",
    "exposure": "sales",
    "decides": "대여료 납부 방식·카드 수수료",
    "why": "결제 수단"
  },
  {
    "key": "deposit_card_payment",
    "label": "보증카드",
    "layer": "sales",
    "exposure": "sales",
    "decides": "보증금 납부 방식",
    "why": "결제 수단"
  },
  {
    "key": "payment_method",
    "label": "결제방식",
    "layer": "sales",
    "exposure": "contract",
    "article": "제6조",
    "decides": "대여료 납부 방식",
    "why": "CMS·카드 등"
  },
  {
    "key": "payment_timing",
    "label": "대여료 납부 조건",
    "layer": "sales",
    "exposure": "contract",
    "article": "제6조",
    "decides": "대여료 납부 시점",
    "why": "선불·후불은 결제수단과 별개인 계약조건. 정책 기본값을 가져오되 계약 건별로 확정한다"
  },
  {
    "key": "screening_criteria",
    "label": "심사조건",
    "layer": "sales",
    "exposure": "internal",
    "decides": "계약 승인 여부",
    "why": "⚠ **계약서에는 안 실린다**(exposure=internal 이 그걸 지킨다). 손님 «화면»에는 2026-09-05 부터 실린다 — 사장님 「심사 조건은 계속 띄워요」. 단 원문이 아니라 creditDisplay 가 셋(무심사/신용조회/소득확인)으로 접은 값이다"
  },
  {
    "key": "disqualification_conditions",
    "label": "불가조건",
    "layer": "sales",
    "exposure": "internal",
    "decides": "계약 가능 여부(상담)",
    "why": "⚠ 내부 상담 기준(「3년 이내 음주이력」). 손님 화면·계약서에 실리지 않는다"
  },
  {
    "key": "sales_notes",
    "label": "특이사항(영업)",
    "layer": "sales",
    "exposure": "internal",
    "decides": "영업 상담 안내",
    "why": "영업자가 알아야 할 그 밖의 조건. 손님 화면·계약서에 실리지 않는다"
  },
  {
    "key": "policy_extra_terms",
    "label": "기타사항(계약서)",
    "layer": "contract",
    "exposure": "contract",
    "decides": "계약서 특약",
    "why": "표에 없는 계약조건 — 계약서 특약 칸에 그대로 실린다(사장님 2026-08-20). 손님이 서명 전에 읽는 글이다"
  },
  {
    "key": "credit_grade",
    "label": "신용등급",
    "layer": "sales",
    "exposure": "internal",
    "decides": "계약 승인 여부",
    "why": "⚠ 위와 같음"
  },
  {
    "key": "contracts_per_customer_limit",
    "label": "1인당 계약 대수",
    "layer": "sales",
    "exposure": "sales",
    "decides": "둘째 대 계약 가능 여부",
    "why": "첫 대는 되고 둘째 대가 막히는 자리라 상담 초반에 걸러야 한다. 계약서 조항이 아니라 영업 기준이다"
  },
  {
    "key": "rental_region",
    "label": "대여지역",
    "layer": "sales",
    "exposure": "sales",
    "why": "상품 안내. 이 계약의 조건이 아니라 계약서에 싣지 않는다"
  },
  {
    "key": "commission_clawback_condition",
    "label": "수수료 환수조건",
    "layer": "sales",
    "exposure": "internal",
    "why": "⚠ 우리와 공급사 사이의 약정. 손님과 무관하다"
  },
  {
    "key": "payment_due_date",
    "label": "월 납부일",
    "layer": "contract",
    "exposure": "contract",
    "article": "제6조",
    "why": "직원이 매 계약마다 입력하지 않고 계약회사 정책에서 확정한다"
  },
  {
    "key": "over_mileage_rate_domestic",
    "label": "초과 주행요금 · 국산(1km당)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제23조",
    "why": "약정을 넘겨 달린 거리에 붙는다. 1만km 상향(가격표)과 다른 값"
  },
  {
    "key": "over_mileage_rate_imported",
    "label": "초과 주행요금 · 수입(1km당)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제23조",
    "why": "수입은 국산보다 높다 — 한 칸으로 두면 수입차에 국산 요율이 찍힌다"
  },
  {
    "key": "succession_allowed",
    "label": "승계 가능여부",
    "layer": "contract",
    "exposure": "contract",
    "article": "제8조·제10조",
    "why": "회사의 사전승인 아래 승계가 가능한지 회사별로 정한다"
  },
  {
    "key": "succession_fee",
    "label": "승계수수료(원)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제8조·제10조",
    "why": "승계 승인·심사·계약변경 업무에 적용하는 회사별 금액"
  },
  {
    "key": "early_termination_rate_under1y",
    "label": "중도해지 위약금 · 1년 미만(0~1)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제8조",
    "why": "잔여기간 대여료 × 이 율"
  },
  {
    "key": "early_termination_rate_over1y",
    "label": "중도해지 위약금 · 1년 이상(0~1)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제8조",
    "why": "경과가 길수록 낮아진다"
  },
  {
    "key": "late_fee_rate",
    "label": "지연손해금율",
    "layer": "contract",
    "exposure": "contract",
    "article": "제25조",
    "why": "연체 이자율"
  },
  {
    "key": "impound_fee",
    "label": "물품 보관료",
    "layer": "contract",
    "exposure": "contract",
    "article": "제22조",
    "why": "안 찾아가면 보증금에서 공제된다"
  },
  {
    "key": "deposit_return_days",
    "label": "보증금 반환기한(일)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제6조",
    "why": "언제까지 돌려주는가"
  },
  {
    "key": "impound_keep_days",
    "label": "물품 보관기간(일)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제22조",
    "why": "이 기간 뒤 폐기·매각할 수 있다"
  },
  {
    "key": "engine_control_overdue_days",
    "label": "운행제한(시동제어) 기준일",
    "layer": "contract",
    "exposure": "contract",
    "article": "제24조",
    "why": "각 납부기한 다음 날부터 며칠째 미납이면 시동제어할 수 있는가"
  },
  {
    "key": "auto_terminate_overdue_days",
    "label": "차량회수·해지 기준일",
    "layer": "contract",
    "exposure": "contract",
    "article": "제7조·제24조",
    "why": "며칠 밀리면 계약이 끊기고 차를 회수하는가"
  },
  {
    "key": "deposit_overdue_rounds",
    "label": "보증금 미납 시동제어(회차)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제6조·제24조",
    "why": "대상 회차를 정하고 실제 연체는 해당 회차 납부기한 다음 날부터 센다"
  },
  {
    "key": "accident_termination_count",
    "label": "사고 다발 시 계약해지 기준",
    "layer": "contract",
    "exposure": "contract",
    "article": "제7조",
    "why": "사고일 기준 직전 1년 내 과실 50% 이상 사고가 총 3회면 해지할 수 있다"
  },
  {
    "key": "claim_basis",
    "label": "청구 기준",
    "layer": "contract",
    "exposure": "contract",
    "article": "제7조·제8조",
    "why": "잔여 대여료냐 중도해지수수료냐 — 중복 청구하지 않는다"
  },
  {
    "key": "renewal_notice_days",
    "label": "연장 사전통지기한(일)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제10조",
    "why": "넘기면 연장하지 않는 것으로 본다"
  },
  {
    "key": "buyout_notice_days",
    "label": "인수 사전통지기한(일)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제26조",
    "why": "넘기면 인수하지 않는 것으로 본다"
  },
  {
    "key": "insurer_name",
    "label": "가입 보험사·공제조합(계약 체결일 기준)",
    "layer": "contract",
    "exposure": "contract",
    "article": "제11조",
    "why": "현재 가입처·사고 접수처"
  },
  {
    "key": "designated_garage",
    "label": "지정 정비점",
    "layer": "contract",
    "exposure": "contract",
    "article": "제14조·제17조",
    "why": "임의 수리 시 보험 처리 불가"
  },
  {
    "key": "self_damage_exclusions",
    "label": "자차 처리 제외",
    "layer": "contract",
    "exposure": "contract",
    "article": "제18조",
    "why": "가입 공제·보험 상품별로 상이하다"
  },
  {
    "key": "replacement_car_policy",
    "label": "대차 정책",
    "layer": "contract",
    "exposure": "contract",
    "article": "제5조·제20조",
    "why": "미가입 시 미제공 등"
  },
  {
    "key": "gps_installed",
    "label": "GPS 장착",
    "layer": "contract",
    "exposure": "contract",
    "article": "제24조",
    "why": "위치 수집 고지"
  }
] as const;
