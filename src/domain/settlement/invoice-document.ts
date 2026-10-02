export type SheetSettlementRow = {
  plate?: string | null;
  receivedAt?: string | null;
  supplier?: string | null;
  customer?: string | null;
  model?: string | null;
  product?: string | null;
  rentKind?: string | null;
  term?: number | null;
  rent?: number | null;
  price?: number | null;
  supplierRate?: number | null;
  claim?: number | null;
  claimVat?: number | null;
  claimTotal?: number | null;
  billMonth?: string | null;
  delivered?: boolean;
  cancelled?: boolean;
};

export type InvoiceParty = {
  name: string;
  bizNo: string;
  ceo?: string;
  address?: string;
};

export type InvoiceIssuer = InvoiceParty & {
  bank: string;
  account: string;
  holder: string;
  manager: string;
  phone: string;
  email: string;
  fax?: string;
};

export type InvoiceLine = {
  plate: string;
  receivedAt: string;
  description: string;
  formula: string;
  supply: number;
  vat: number;
  total: number;
};

export type MonthlyInvoice = {
  month: string;
  dueDate: string;
  supplier: string;
  issuer: InvoiceIssuer;
  receiver: InvoiceParty;
  lines: InvoiceLine[];
  supply: number;
  vat: number;
  total: number;
};

const won = (n: number) => Math.round(n).toLocaleString('ko-KR');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const masked = (name: string) => name.length < 2 ? name : `${name[0]}*${name.at(-1)}`;

export const dueDateOf = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`청구월 형식 오류: ${month}`);
  const [year, mon] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, mon, 10));
  return next.toISOString().slice(0, 10);
};

function moneyOf(row: SheetSettlementRow) {
  if (row.claim === null || row.claim === undefined) throw new Error(`${row.plate ?? '차량번호 없음'}: 판매수수료 미확인`);
  const supply = Math.round(row.claim);
  const vat = row.claimVat === null || row.claimVat === undefined ? Math.round(supply * 0.1) : Math.round(row.claimVat);
  const total = supply + vat;
  if (row.claimTotal !== null && row.claimTotal !== undefined && Math.round(row.claimTotal) !== total) {
    throw new Error(`${row.plate ?? '차량번호 없음'}: 청구금액 불일치(시트 ${Math.round(row.claimTotal)}, 계산 ${total})`);
  }
  return { supply, vat, total };
}

function formulaOf(row: SheetSettlementRow, supply: number) {
  const rate = row.supplierRate ?? null;
  if (row.price && rate !== null && rate > 0 && rate <= 1 && Math.round(row.price * rate) === supply) {
    return `산출: 차량가액 ${won(row.price)}원 × ${(rate * 100).toLocaleString('ko-KR')}%`;
  }
  if (row.rent && row.term && rate !== null && rate > 0 && rate <= 1 && Math.round(row.rent * row.term * rate) === supply) {
    return `산출: 월 대여료 ${won(row.rent)}원 × ${row.term}개월 × ${(rate * 100).toLocaleString('ko-KR')}%`;
  }
  if (rate !== null && rate > 1 && Math.round(rate) === supply) return `산출: 대당 정액 ${won(supply)}원`;
  return `산출: 정산원장 확정금액 ${won(supply)}원`;
}

export function buildMonthlyInvoice(input: {
  month: string;
  supplier: string;
  rows: SheetSettlementRow[];
  issuer: InvoiceIssuer;
  receiver: InvoiceParty;
}): MonthlyInvoice {
  const selected = input.rows.filter((row) => row.billMonth === input.month && row.supplier === input.supplier && row.delivered && !row.cancelled);
  if (!selected.length) throw new Error(`${input.month} ${input.supplier}: 발행할 인도완료 정산 행이 없습니다`);
  for (const row of selected) if (!row.plate || !row.receivedAt) throw new Error('차량번호 또는 접수일이 없는 행은 발행할 수 없습니다');
  const lines = selected.map((row) => {
    const money = moneyOf(row);
    return {
      plate: row.plate!, receivedAt: row.receivedAt!,
      description: [row.model, masked(row.customer ?? ''), row.product, row.term ? `${row.term}개월` : ''].filter(Boolean).join(' · '),
      formula: formulaOf(row, money.supply), ...money,
    };
  });
  const sum = (key: 'supply' | 'vat' | 'total') => lines.reduce((n, line) => n + line[key], 0);
  return { month: input.month, dueDate: dueDateOf(input.month), supplier: input.supplier, issuer: input.issuer, receiver: input.receiver, lines, supply: sum('supply'), vat: sum('vat'), total: sum('total') };
}

export function monthlyInvoiceHtml(invoice: MonthlyInvoice) {
  const [year, month] = invoice.month.split('-');
  const rows = invoice.lines.map((line, index) => `<tr><td>${index + 1}</td><td><b>${esc(line.plate)}</b></td><td>${esc(line.receivedAt.slice(2))}</td><td class="desc">${esc(line.description)}<small>${esc(line.formula)}</small></td><td class="num">${won(line.supply)}</td><td class="num">${won(line.vat)}</td><td class="num strong">${won(line.total)}</td></tr>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Pretendard,"Noto Sans KR",Arial,sans-serif;color:#111827}.page{width:210mm;height:297mm;padding:0 14mm 18mm;position:relative}.top{height:21mm;background:#12223f;color:white;margin:0 -14mm 12mm;padding:6mm 14mm;display:flex;justify-content:space-between}.brand{font-size:20px;font-weight:800}.brand small{display:block;font-size:10px;font-weight:500;opacity:.8}.head{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #13264a;padding-bottom:4mm}.head h1{font-size:25px;margin:0}.head p{margin:4px 0 0;color:#4b5563}.receiver{text-align:right}.receiver b{font-size:20px}.section{margin-top:7mm}.section-title{display:flex;justify-content:space-between;font-weight:800;margin-bottom:3mm}.section-title span{font-weight:500;font-size:11px}.summary,.detail{width:100%;border-collapse:collapse}.summary th,.detail th{background:#0f1d37;color:white;padding:3mm;text-align:left;font-size:11px}.summary td{background:#edf2f8;padding:4mm;font-weight:700}.summary .num,.detail .num{text-align:right}.strong{font-weight:800}.detail td{padding:3mm 2mm;border-bottom:1px solid #e5e7eb;font-size:10.5px}.detail td:first-child{text-align:center}.detail .desc small{display:block;color:#64748b;margin-top:1mm}.total td{background:#edf2f8;font-weight:800}.pay{margin-top:5mm;line-height:1.9;font-size:11px}.pay .due{font-size:14px;font-weight:800}.thanks{text-align:right;margin-top:12mm;font-weight:800;font-size:16px}.foot{position:absolute;left:0;right:0;bottom:0;background:#17191e;color:white;padding:5mm 14mm;font-size:10px;display:flex;justify-content:space-between}.muted{color:#94a3b8}
  </style></head><body><main class="page"><header class="top"><div class="brand">freepassmobility<small>프리패스모빌리티 주식회사</small></div><div class="brand">freepasserp.com<small>장기렌터카 영업지원 플랫폼</small></div></header><section class="head"><div><h1>영업수수료 정산서</h1><p>${year}년 ${Number(month)}월 · ${invoice.month}.01 ~ ${invoice.month}.${new Date(Number(year), Number(month), 0).getDate()}</p></div><div class="receiver"><span class="muted">회원사</span><br><b>${esc(invoice.receiver.name)} 귀중</b><p>사업자등록번호 ${esc(invoice.receiver.bizNo)}</p></div></section><section class="section"><div class="section-title">청구 금액<span>${invoice.lines.length}건 · 단위 원</span></div><table class="summary"><thead><tr><th>구분</th><th class="num">공급가액</th><th class="num">부가세</th><th class="num">청구 금액</th></tr></thead><tbody><tr><td>${year}년 ${Number(month)}월 정산</td><td class="num">${won(invoice.supply)}</td><td class="num">${won(invoice.vat)}</td><td class="num strong">${won(invoice.total)}</td></tr></tbody></table></section><section class="section"><div class="section-title">정산 내역<span>${invoice.lines.length}건 · 단위 원</span></div><table class="detail"><thead><tr><th>No.</th><th>차량번호</th><th>접수일</th><th>차량 · 계약조건</th><th class="num">공급가액</th><th class="num">부가세</th><th class="num">합계</th></tr></thead><tbody>${rows}<tr class="total"><td></td><td>합계</td><td>${invoice.lines.length}건</td><td></td><td class="num">${won(invoice.supply)}</td><td class="num">${won(invoice.vat)}</td><td class="num">${won(invoice.total)}</td></tr></tbody></table></section><section class="pay"><div class="due">${invoice.dueDate.replaceAll('-', '. ')} 까지 입금 부탁드립니다</div><div>${esc(invoice.issuer.bank)} · ${esc(invoice.issuer.account)} · ${esc(invoice.issuer.holder)}</div><div>${esc(invoice.issuer.manager)} · ${esc(invoice.issuer.phone)} · ${esc(invoice.issuer.email)}${invoice.issuer.fax ? ` · 팩스 ${esc(invoice.issuer.fax)}` : ''}</div><div class="muted">세금계산서는 별도 발행해 드립니다</div></section><div class="thanks">한 달간 함께해 주셔서 감사합니다</div><footer class="foot"><div><b>${esc(invoice.issuer.name)}</b> 사업자등록번호 ${esc(invoice.issuer.bizNo)} · 대표 ${esc(invoice.issuer.ceo ?? '')}<br><span class="muted">${esc(invoice.issuer.address ?? '')}</span></div><div>freepassmobility.com<br>freepasserp.com</div></footer></main></body></html>`;
}
