export type SheetSettlementRow = { plate?:string|null; receivedAt?:string|null; supplier?:string|null; customer?:string|null; model?:string|null; product?:string|null; rentKind?:string|null; term?:number|null; rent?:number|null; price?:number|null; supplierRate?:number|null; claim?:number|null; claimVat?:number|null; claimTotal?:number|null; billMonth?:string|null; delivered?:boolean; cancelled?:boolean; settleExclude?:boolean; billHold?:boolean; billed?:boolean; billState?:string|null; moneyConflicts?:string[] };
export type SheetClawbackRow = { plate?:string|null; supplier?:string|null; product?:string|null; month?:string|null; supplierAmt?:number|null; reason?:string|null; at?:string|null };
export type InvoiceParty = { name:string; bizNo:string; ceo?:string; address?:string };
export type InvoiceIssuer = InvoiceParty & { bank:string; account:string; holder:string; manager:string; phone:string; email:string; fax?:string };
export type InvoiceLine = { kind:'CLAIM'|'CLAWBACK'; product:string; plate:string; receivedAt:string; description:string; formula:string; supply:number; vat:number; total:number };
export type InvoiceGroup = { product:string; lines:number; claims:number; clawbacks:number; supply:number; vat:number; total:number };
export type MonthlyInvoice = { month:string; dueDate:string; supplier:string; issuer:InvoiceIssuer; receiver:InvoiceParty; lines:InvoiceLine[]; groups:InvoiceGroup[]; claimLineCount:number; clawbackLineCount:number; claimSupply:number; claimVat:number; claimTotal:number; clawbackSupply:number; clawbackVat:number; clawbackTotal:number; supply:number; vat:number; total:number };

const won = (n:number) => Math.round(n).toLocaleString('ko-KR');
const esc = (s:string) => s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
const masked = (name:string) => name.length < 2 ? name : `${name[0]}*${name.at(-1)}`;
const sumOf = (lines:InvoiceLine[], key:'supply'|'vat'|'total') => lines.reduce((sum,line) => sum + line[key], 0);

export const dueDateOf = (month:string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`청구월 형식 오류: ${month}`);
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 10)).toISOString().slice(0,10);
};

function moneyOf(row:SheetSettlementRow) {
  if (row.claim === null || row.claim === undefined) throw new Error(`${row.plate ?? '차량번호 없음'}: 판매수수료 미확인`);
  const supply = Math.round(row.claim);
  const vat = row.claimVat === null || row.claimVat === undefined ? Math.round(supply * .1) : Math.round(row.claimVat);
  const total = supply + vat;
  if (row.claimTotal !== null && row.claimTotal !== undefined && Math.round(row.claimTotal) !== total) throw new Error(`${row.plate ?? '차량번호 없음'}: 청구금액 불일치(시트 ${Math.round(row.claimTotal)}, 계산 ${total})`);
  return { supply, vat, total };
}

function formulaOf(row:SheetSettlementRow, supply:number) {
  const rate = row.supplierRate ?? null;
  if (row.price && rate !== null && rate > 0 && rate <= 1 && Math.round(row.price * rate) === supply) return `산출: 차량가액 ${won(row.price)}원 × ${(rate * 100).toLocaleString('ko-KR')}%`;
  if (row.rent && row.term && rate !== null && rate > 0 && rate <= 1 && Math.round(row.rent * row.term * rate) === supply) return `산출: 월 대여료 ${won(row.rent)}원 × ${row.term}개월 × ${(rate * 100).toLocaleString('ko-KR')}%`;
  if (rate !== null && rate > 1 && Math.round(rate) === supply) return `산출: 대당 정액 ${won(supply)}원`;
  return `산출: 정산원장 확정금액 ${won(supply)}원`;
}

export function buildMonthlyInvoice(input:{ month:string; supplier:string; rows:SheetSettlementRow[]; clawbacks?:SheetClawbackRow[]; issuer:InvoiceIssuer; receiver:InvoiceParty }):MonthlyInvoice {
  const selected = input.rows.filter((row) => row.billMonth === input.month && row.supplier === input.supplier && row.delivered && !row.cancelled && !row.settleExclude && !row.billHold && !row.billed && !/기청구|재청구금지|환수전용|미확정|검증보류|원본충돌|정산불가/.test(row.billState ?? ''));
  for (const row of selected) if (row.moneyConflicts?.length) throw new Error(`${row.plate ?? '차량번호 없음'}: 접수 금액 불일치`);
  for (const row of selected) if (!row.plate || !row.receivedAt) throw new Error('차량번호 또는 접수일이 없는 행은 발행할 수 없습니다');
  const claimLines:InvoiceLine[] = selected.map((row) => { const money=moneyOf(row); return { kind:'CLAIM', product:row.product?.trim() || '기타', plate:row.plate!, receivedAt:row.receivedAt!, description:[row.model,masked(row.customer ?? ''),row.term ? `${row.term}개월` : ''].filter(Boolean).join(' · '), formula:formulaOf(row,money.supply), ...money } });
  const clawbackLines:InvoiceLine[] = (input.clawbacks ?? []).filter((row) => row.month === input.month && row.supplier === input.supplier).map((row) => {
    if (!row.plate || !row.at) throw new Error('차량번호 또는 환수일이 없는 지급환수 행은 발행할 수 없습니다');
    if (!Number.isFinite(row.supplierAmt) || (row.supplierAmt ?? 0) <= 0) throw new Error(`${row.plate}: 지급환수 금액이 올바르지 않습니다`);
    const supply=-Math.round(row.supplierAmt!); const vat=-Math.round(row.supplierAmt! * .1);
    return { kind:'CLAWBACK', product:row.product?.trim() || '기타', plate:row.plate, receivedAt:row.at, description:row.reason ? `지급환수 · ${row.reason}` : '지급환수', formula:'기지급액 환수', supply, vat, total:supply+vat };
  });
  const lines=[...claimLines,...clawbackLines];
  if (!lines.length) throw new Error(`${input.month} ${input.supplier}: 발행할 확정 정산 행이 없습니다`);
  const groups=[...new Set(lines.map((line) => line.product))].map((product) => { const grouped=lines.filter((line) => line.product === product); return { product, lines:grouped.length, claims:grouped.filter((line) => line.kind === 'CLAIM').length, clawbacks:grouped.filter((line) => line.kind === 'CLAWBACK').length, supply:sumOf(grouped,'supply'), vat:sumOf(grouped,'vat'), total:sumOf(grouped,'total') } });
  return { month:input.month, dueDate:dueDateOf(input.month), supplier:input.supplier, issuer:input.issuer, receiver:input.receiver, lines, groups, claimLineCount:claimLines.length, clawbackLineCount:clawbackLines.length, claimSupply:sumOf(claimLines,'supply'), claimVat:sumOf(claimLines,'vat'), claimTotal:sumOf(claimLines,'total'), clawbackSupply:sumOf(clawbackLines,'supply'), clawbackVat:sumOf(clawbackLines,'vat'), clawbackTotal:sumOf(clawbackLines,'total'), supply:sumOf(lines,'supply'), vat:sumOf(lines,'vat'), total:sumOf(lines,'total') };
}

export function monthlyInvoiceHtml(invoice:MonthlyInvoice) {
  const [year,month]=invoice.month.split('-');
  const rows=invoice.lines.map((line,index) => `<tr class="${line.kind === 'CLAWBACK' ? 'clawback' : ''}"><td>${index+1}</td><td><b>${esc(line.plate)}</b></td><td>${esc(line.receivedAt.slice(2))}</td><td class="desc">${esc(line.description)}<small>${esc(line.formula)}</small></td><td class="num">${won(line.supply)}</td><td class="num">${won(line.vat)}</td><td class="num strong">${won(line.total)}</td></tr>`).join('');
  const countLabel=invoice.clawbackLineCount ? `${invoice.lines.length}건 (출고 ${invoice.claimLineCount}건 + 지급환수 ${invoice.clawbackLineCount}건)` : `${invoice.claimLineCount}건`;
  const clawbackSubtotal=invoice.clawbackLineCount ? `<tr class="subtotal clawback"><td></td><td>지급환수 소계</td><td>${invoice.clawbackLineCount}건</td><td></td><td class="num">${won(invoice.clawbackSupply)}</td><td class="num">${won(invoice.clawbackVat)}</td><td class="num">${won(invoice.clawbackTotal)}</td></tr>` : '';
  const groupRows=invoice.groups.map((group) => `<tr><td>${esc(group.product)} <small>${group.lines}건${group.clawbacks ? ` (출고 ${group.claims} + 지급환수 ${group.clawbacks})` : ''}</small></td><td class="num">${won(group.supply)}</td><td class="num">${won(group.vat)}</td><td class="num strong">${won(group.total)}</td></tr>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Pretendard,"Noto Sans KR",Arial,sans-serif;color:#111827}.page{width:210mm;min-height:297mm;padding:0 14mm 18mm;position:relative}.top{height:21mm;background:#12223f;color:white;margin:0 -14mm 12mm;padding:6mm 14mm;display:flex;justify-content:space-between}.brand{font-size:20px;font-weight:800}.brand small{display:block;font-size:10px;font-weight:500;opacity:.8}.head{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #13264a;padding-bottom:4mm}.head h1{font-size:25px;margin:0}.head p{margin:4px 0 0;color:#4b5563}.receiver{text-align:right}.receiver b{font-size:20px}.section{margin-top:7mm}.section-title{display:flex;justify-content:space-between;font-weight:800;margin-bottom:3mm}.section-title span{font-weight:500;font-size:11px}.summary,.detail{width:100%;border-collapse:collapse}.summary th,.detail th{background:#0f1d37;color:white;padding:3mm;text-align:left;font-size:11px}.summary td{background:#edf2f8;padding:4mm;font-weight:700}.summary .num,.detail .num{text-align:right}.strong{font-weight:800}.detail td{padding:3mm 2mm;border-bottom:1px solid #e5e7eb;font-size:10.5px}.detail td:first-child{text-align:center}.detail .desc small{display:block;color:#64748b;margin-top:1mm}.clawback td{color:#b42318}.subtotal td{background:#f8fafc;font-weight:700}.total td{background:#edf2f8;font-weight:800}.pay{margin-top:5mm;line-height:1.9;font-size:11px}.pay .due{font-size:14px;font-weight:800}.thanks{text-align:right;margin-top:12mm;font-weight:800;font-size:16px}.foot{margin:12mm -14mm -18mm;background:#17191e;color:white;padding:5mm 14mm;font-size:10px;display:flex;justify-content:space-between}.muted{color:#94a3b8}
  </style></head><body><main class="page"><header class="top"><div class="brand">freepassmobility<small>프리패스모빌리티 주식회사</small></div><div class="brand">freepasserp.com<small>장기렌터카 영업지원 플랫폼</small></div></header><section class="head"><div><h1>영업수수료 정산서</h1><p>${year}년 ${Number(month)}월 · ${invoice.month}.01 ~ ${invoice.month}.${new Date(Number(year),Number(month),0).getDate()}</p></div><div class="receiver"><span class="muted">회원사</span><br><b>${esc(invoice.receiver.name)} 귀중</b><p>사업자등록번호 ${esc(invoice.receiver.bizNo)}</p></div></section><section class="section"><div class="section-title">청구 금액<span>${countLabel} · 단위 원</span></div><table class="summary"><thead><tr><th>구분</th><th class="num">공급가액</th><th class="num">부가세</th><th class="num">청구 금액</th></tr></thead><tbody>${groupRows}<tr class="total"><td>${year}년 ${Number(month)}월 총합계</td><td class="num">${won(invoice.supply)}</td><td class="num">${won(invoice.vat)}</td><td class="num strong">${won(invoice.total)}</td></tr></tbody></table></section><section class="section"><div class="section-title">정산 내역<span>${countLabel} · 단위 원</span></div><table class="detail"><thead><tr><th>No.</th><th>차량번호</th><th>정산일</th><th>차량 · 계약조건</th><th class="num">공급가액</th><th class="num">부가세</th><th class="num">합계</th></tr></thead><tbody>${rows}<tr class="subtotal"><td></td><td>출고 정산 소계</td><td>${invoice.claimLineCount}건</td><td></td><td class="num">${won(invoice.claimSupply)}</td><td class="num">${won(invoice.claimVat)}</td><td class="num">${won(invoice.claimTotal)}</td></tr>${clawbackSubtotal}<tr class="total"><td></td><td>총합계</td><td>${invoice.lines.length}건</td><td></td><td class="num">${won(invoice.supply)}</td><td class="num">${won(invoice.vat)}</td><td class="num">${won(invoice.total)}</td></tr></tbody></table></section><section class="pay"><div class="due">${invoice.dueDate.replaceAll('-','. ')} 까지 입금 부탁드립니다</div><div>${esc(invoice.issuer.bank)} · ${esc(invoice.issuer.account)} · ${esc(invoice.issuer.holder)}</div><div>${esc(invoice.issuer.manager)} · ${esc(invoice.issuer.phone)} · ${esc(invoice.issuer.email)}${invoice.issuer.fax ? ` · 팩스 ${esc(invoice.issuer.fax)}` : ''}</div><div class="muted">세금계산서는 별도 발행해 드립니다</div></section><div class="thanks">한 달간 함께해 주셔서 감사합니다</div><footer class="foot"><div><b>${esc(invoice.issuer.name)}</b> 사업자등록번호 ${esc(invoice.issuer.bizNo)} · 대표 ${esc(invoice.issuer.ceo ?? '')}<br><span class="muted">${esc(invoice.issuer.address ?? '')}</span></div><div>freepassmobility.com<br>freepasserp.com</div></footer></main></body></html>`;
}


/** Published receipt documents are projections, never lifecycle issuance or money movements. */
export type DocumentParty = { name:string; bizNo:string; ceo:string; address:string; phone:string; bank:string; account:string; holder:string };
export type ReceiptDocumentLine = { receivedAt:string; plate:string; model:string; customer:string; product:string; term:number; base:string; amount:number; vat:number; total:number; minus?:boolean; reason?:string };
export type ReceiptDocument = { axis:'공급사'|'영업채널'; kind:'청구서'|'정산서'; month:string; party:string; issuer:DocumentParty; receiver:DocumentParty; lines:ReceiptDocumentLine[]; supply:number; vat:number; total:number; clawback:number; missing:string[]; heldCount:number };
export type ReceiptDocumentConfig = {
  issuer:DocumentParty;
  parties:Record<string,DocumentParty>;
  /** Explicitly registered same-entity aliases only; no fuzzy name matching. */
  supplierAliases?:Record<string,string>; channelAliases?:Record<string,string>;
};
export const receiptVat = (supply:number) => {
  if (!Number.isSafeInteger(supply)) throw new Error('공급가액이 원 단위 정수가 아닙니다');
  return Math.sign(supply)*Math.round(Math.abs(supply)*.1);
};
export function buildReceiptDocuments(input:{ month:string; rows:Record<string,unknown>[]; summary:{count:number;claimAmount:number;payAmount:number}; config:ReceiptDocumentConfig }):ReceiptDocument[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) throw new Error('실제 정산월을 선택하세요');
  const canonical = (v:unknown,axis:'공급사'|'영업채널') => {
    const name=typeof v==='string'?v.trim():'';
    if (!name) throw new Error('거래처명이 없습니다');
    // Direct user decision 2026-10-07, not an inferred alias.
    return axis==='영업채널'&&name==='유니오토'?'유니오토모빌':(axis==='공급사'?input.config.supplierAliases:input.config.channelAliases)?.[name]??name;
  };
  const selected=input.rows.filter(r=>{
    const raw=r.sourceReceiptRaw;
    if (!Array.isArray(raw)) return false;
    return `${Number(raw[18])}-${String(Number(raw[19])).padStart(2,'0')}`===input.month && r.cancelled!==true;
  });
  if (!selected.length || selected.length!==input.summary.count) throw new Error('월별 게시 건수와 접수 원장이 다릅니다 — 다시 동기화하세요');
  const amount=(r:Record<string,unknown>,key:string) => {
    const n=r[key]; if(typeof n!=='number'||!Number.isSafeInteger(n)) throw new Error('접수 공급가액이 비었거나 올바르지 않습니다');
    return n;
  };
  const claim=selected.reduce((s,r)=>s+amount(r,'sourceReceiptClaim'),0);
  const pay=selected.reduce((s,r)=>s+amount(r,'sourceReceiptPay'),0);
  if(claim!==input.summary.claimAmount||pay!==input.summary.payAmount) throw new Error('월별 게시 공급가액과 문서 합계가 다릅니다');
  const documents:ReceiptDocument[]=[];
  for(const axis of ['공급사','영업채널'] as const){
    const groups=new Map<string,Record<string,unknown>[]>();
    for(const r of selected){const party=canonical(axis==='공급사'?r.supplier:r.channel,axis);groups.set(party,[...(groups.get(party)??[]),r]);}
    for(const [party,rows] of groups){
      const receiver=input.config.parties[party];
      if(!receiver || !receiver.name) throw new Error(`${party}: 등록된 문서 거래처가 없습니다`);
      if(!input.config.issuer?.name || !/^\d{10}$/.test(input.config.issuer.bizNo.replace(/\D/g,''))) throw new Error('비공개 발행자 설정을 확인하세요');
      const lines=rows.map(r=>{
        const supply=amount(r,axis==='공급사'?'sourceReceiptClaim':'sourceReceiptPay');
        const vat=receiptVat(supply);
        return {receivedAt:String(r.receivedAt??''),plate:String(r.plate??''),model:String(r.model??''),customer:String(r.customer??''),product:String(r.product??''),term:typeof r.term==='number'?r.term:0,
          base:[r.billHold===true?'보류 · 확정 별도 확인':'',String(r.settleNote??r.note??'')].filter(Boolean).join(' · '),amount:supply,vat,total:supply+vat,
          ...(supply<0?{minus:true,reason:String(r.adjustReason??'과지급 정정')}:{}),
        };
      });
      if(lines.some(l=>!l.plate)) throw new Error(`${party}: 차량번호가 없습니다`);
      const heldCount=rows.filter(r=>r.billHold===true).length;
      const supply=lines.reduce((s,l)=>s+l.amount,0),vat=lines.reduce((s,l)=>s+l.vat,0);
      documents.push({axis,kind:axis==='공급사'?'청구서':'정산서',month:input.month,party,issuer:input.config.issuer,receiver,lines,supply,vat,total:supply+vat,
        clawback:-lines.filter(l=>l.amount<0).reduce((s,l)=>s+l.amount,0),heldCount,
        missing:['접수 원장 기록액 기준 · 공급사 확정 별도 확인',...(lines.some(l=>!l.receivedAt)?['접수일 미기재 건 포함']:[]),...(heldCount?[`보류 ${heldCount}건 포함`]:[]),...(!receiver.bizNo?['거래처 사업자등록번호 미기재']:[])]});
    }
  }
  return documents;
}
