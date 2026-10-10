// CREATE_NEW_JUSTIFIED: academy READY 2026-10-07. Reuse AI-OPS SheetFixer
// conflict inspection only; writes moved out of this public Admin repository.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { tsImport } from 'tsx/esm/api';
const { verifiedReceiptBasis } = await tsImport('../src/domain/settlement/fee.ts', import.meta.url);

const ID = process.env.F04_SPREADSHEET_ID;
if (!ID && !process.argv.includes('--self-test')) throw new Error('F04_SPREADSHEET_ID is required');
// freepass-data migration target: Admin keeps only local basis projection checks.
const HANDS_OFF_PLATES = new Set((process.env.F04_BASIS_HANDS_OFF_PLATES ?? '').split(',').map(s => s.trim()).filter(Boolean));
const money = n => Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export function sideBasis(cell = {}) {
  const amount = cell.userEnteredValue?.numberValue;
  const note = cell.note || '';
  if (amount === undefined) return '미확정';
  if (!Number.isFinite(amount)) throw new Error('INVALID_AMOUNT');
  // A rate may only come from a reconciled expression in the existing note.
  const m = note.match(/([\d,.]+(?:\s*(?:×|\*)\s*[\d,.]+\s*(?:개월|%)?)*?)\s*=\s*([\d,.]+)\s*원/);
  if (m) {
    const parts = m[1].split(/[×*]/).map(s => s.trim());
    const nums = parts.map(s => Number(s.replace(/개월|%|,/g, '')) / (s.includes('%') ? 100 : 1));
    const computed = nums.reduce((a, b) => a * b, 1);
    const declared = Number(m[2].replaceAll(',', ''));
    if (nums.some(n => !Number.isFinite(n)) || Math.round(computed) !== declared || declared !== amount) {
      return '검증보류(메모·금액 불일치)';
    }
    if (parts.length === 1) return `정액 ${money(amount)}원`;
    const last = nums.at(-1);
    const rate = parts.at(-1).includes('%') || (last > 0 && last < 1)
      ? `${Number((last * 100).toFixed(6))}%` : null;
    return `${rate || '산식 확인'} · ${money(amount)}원`;
  }
  if (/HOLD|검증보류|개별.*확인.*필요/.test(note)) return `검증보류 · 기재 ${money(amount)}원`;
  return `직접입력액 ${money(amount)}원 · 산식근거 미기록`;
}

export function makeBasis(claim, pay) {
  const compact = s => s;
  return `공급사: ${compact(sideBasis(claim))}\n영업자: ${compact(sideBasis(pay))}`;
}

/** Exact source-table match only. Multiple/special/manual rules never fall back to a guessed rate. */
export function sourceRowBasis(values, headers, feeRows) {
  const raw = c => c?.effectiveValue?.numberValue ?? c?.effectiveValue?.stringValue ?? c?.userEnteredValue?.numberValue ?? c?.userEnteredValue?.stringValue;
  const get = name => raw(values[headers.indexOf(name)]);
  const kind = get('렌트구분');
  const supplier = get('공급사');
  const term = get('계약기간');
  const candidates = feeRows.slice(2).map((r,i)=>({v:(r.values??[]).map(raw),row:i+3})).filter(({v})=>v[0]===supplier && v[1]===kind && (v[3]===term || v[3]==='기간 무관'));
  // Source intake has no reliable 선출고/발주 discriminator; preserve those as unknown.
  const picked = candidates.length===1 && !candidates[0].v[2] ? candidates[0] : undefined;
  return ['공급사','영업자'].map((label,i)=>{
    const cell=values[headers.indexOf(i?'지급액':'청구액')]??{};
    const noteBasis=sideBasis(cell);
    const result=verifiedReceiptBasis({amount:raw(cell),rate:get(i?'에이전시수수료율':'공급사수수료율'),rent:get('렌탈료'),term,price:get('차량가액')},picked?{basis:picked.v[4],rate:picked.v[i?6:5],auto:picked.v[7]==='예' && picked.v[12]==='탭 기준 확정',source:`수수료표 ${picked.row}행 · 접수 ${i?'AI':'AD'}`} : undefined);
    return `${label}: ${result.includes('산식근거 미기록') && noteBasis!=='미확정' && !noteBasis.includes('산식근거 미기록') ? noteBasis : result}`;
  }).join('\n');
}

function selfTest() {
  const c = (amount, note) => ({ userEnteredValue: { numberValue: amount }, note });
  assert.match(sideBasis(c(2418, '기준료 74400 × 0.0325 = 2418원')), /^3.25%/);
  assert.match(sideBasis(c(675, '산출식 500 × 36개월 × 3.75% = 675원')), /^3.75%/);
  assert.match(sideBasis(c(100, '산출식: 100 = 100원')), /^정액/);
  assert.match(sideBasis(c(101, '산출식: 100 = 100원')), /^검증보류/); // no undeclared rounding allowance
  assert.match(sideBasis(c(105, '산출식: 100 = 100원')), /^검증보류/);
  assert.match(sideBasis(c(100, '基準100 × 0.5 = 100원')), /^검증보류/);
  assert.equal(sideBasis({}), '미확정');
  assert.match(sideBasis(c(0, '기재0원')), /직접입력액 0원/);
  assert.match(sideBasis(c(100, '부가세 포함합계110 - 부가세10 = 공급가100. 신규 요율 계산 아님')), /산식근거 미기록/);
  assert.match(sideBasis(c(100, 'HOLD: 원본 대조 필요')), /검증보류/);
  assert.match(makeBasis(c(100, '100 = 100원'), {}), /영업자: 미확정/);
  console.log('basis regression: 11 PASS');
}

function col(index) {
  let out = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest();
  if (argv.some(a => a !== '--dry-run')) throw new Error('Only --dry-run is supported. F04 writes are not available in freepass-admin.');
  if (!argv.includes('--dry-run')) throw new Error('Use --dry-run. F04 writes are not available in freepass-admin.');
  const root = process.env.AI_OPS_ROOT || 'C:/dev/ai-ops';
  const { SheetFixer, validatePlan } = await import(pathToFileURL(resolve(root, 'scripts/시트/시트고치기.mjs')));
  const fixer = new SheetFixer({ root });
  // SheetFixer treats a protected sheet as fully protected. Honor Google's
  // explicit editable exceptions without removing or changing protections.
  fixer.spreadsheetMeta = id => fixer.call(['sheets', 'spreadsheets', 'get'], {
    spreadsheetId: id, fields: 'properties(title),sheets(properties(title,sheetId),protectedRanges(range,unprotectedRanges))',
  });
  const originalReject = fixer.rejectUnsafe.bind(fixer);
  fixer.rejectUnsafe = (plan, cfg, meta, formulas) => {
    for (const cell of plan.cells) {
      const filtered = { ...meta, sheets: meta.sheets.map(s => ({ ...s,
        protectedRanges: (s.protectedRanges || []).filter(p => !(p.unprotectedRanges || []).some(r =>
          r.sheetId === s.properties.sheetId && s.properties.title === cell.tab &&
          cell.row - 1 >= (r.startRowIndex || 0) && cell.row - 1 < (r.endRowIndex ?? Infinity) &&
          cell.colIndex1 - 1 >= (r.startColumnIndex || 0) && cell.colIndex1 - 1 < (r.endColumnIndex ?? Infinity))),
      })) };
      originalReject({ ...plan, cells: [cell] }, cfg, filtered, formulas);
    }
  };
  function read() {
    const meta = fixer.call(['sheets', 'spreadsheets', 'get'], { spreadsheetId: ID, fields: 'sheets.properties' });
    const sheet = meta.sheets.find(s => s.properties.title === '접수');
    if (!sheet) throw new Error('F04_INTAKE_TAB_MISSING');
    const rowCount = Math.min(sheet.properties.gridProperties.rowCount,1000);
    const columnCount = Math.min(sheet.properties.gridProperties.columnCount,72);
    const snapshot = fixer.call(['sheets', 'spreadsheets', 'get'], {
      spreadsheetId: ID, ranges: [`'접수'!A1:${col(columnCount - 1)}${rowCount}`], includeGridData: true,
      fields: 'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue,note))))',
    });
    return snapshot.sheets[0].data[0].rowData;
  }
  // Read a bounded rectangle instead of thousands of ranges in a GET URL.
  // Each conflict/readback call still takes a fresh snapshot.
  let latestGrid;
  const value = (cell = {}, formula = false) => {
    const v = formula ? cell.userEnteredValue : cell.effectiveValue || cell.userEnteredValue;
    return String(v?.formulaValue ?? v?.numberValue ?? v?.stringValue ?? v?.boolValue ?? '');
  };
  fixer.readCells = (id, targets, render = 'UNFORMATTED_VALUE') => {
    assert.equal(id, ID);
    latestGrid = read();
    return new Map(targets.map(c => {
      assert.equal(c.tab, '접수');
      return [c.key, value(latestGrid[c.row - 1]?.values?.[c.colIndex1 - 1], render === 'FORMULA')];
    }));
  };
  fixer.readHeaderAndPlate = (id, tab, row, column, headerRow) => {
    assert.equal(id, ID); assert.equal(tab, '접수');
    const header = latestGrid[headerRow - 1].values.map(c => value(c));
    const line = latestGrid[row - 1]?.values || [];
    return { column: header[column - 1], plate: value(line[header.indexOf('차량번호')]), company: value(line[header.indexOf('공급사')]) };
  };
  const rows = read();
  const feeSnapshot=fixer.call(['sheets','spreadsheets','get'],{spreadsheetId:ID,ranges:["'수수료표'!A1:M1000"],includeGridData:true,fields:'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue,note))))'});
  const feeRows=feeSnapshot.sheets[0].data[0].rowData;
  const h = rows[1].values.map(c => c.formattedValue || '');
  const names = ['차량번호', '접수일', '청구액', '지급액', '산출근거'];
  const ix = Object.fromEntries(names.map(n => {
    const matches = h.flatMap((v, i) => v === n ? [i] : []);
    if (matches.length !== 1) throw new Error(`HEADER_NOT_UNIQUE:${n}`);
    return [n, matches[0]];
  }));
  const cells = [], confirm = [], held = [], displayRows = [];
  let same = 0;
  for (let i = 2; i < rows.length; i++) {
    const v = rows[i].values || [];
    if (!v[ix.차량번호]?.formattedValue) continue;
    if (HANDS_OFF_PLATES.has(v[ix.차량번호].formattedValue)) { held.push(i + 1); continue; }
    const claim = v[ix.청구액] || {}, pay = v[ix.지급액] || {}, old = v[ix.산출근거] || {};
    if (claim.userEnteredValue?.numberValue === undefined && pay.userEnteredValue?.numberValue === undefined) continue;
    const text = sourceRowBasis(v,h,feeRows);
    if (old.userEnteredValue?.stringValue === text) { same++; displayRows.push(i); continue; }
    // Never rewrite existing employee text, formula, or a previously generated snapshot.
    if (old.userEnteredValue) { held.push(i + 1); continue; }
    displayRows.push(i);
    cells.push({ 범위: `'접수'!${col(ix.산출근거)}${i + 1}`, 전: '', 후: text });
    for (const key of ['차량번호', '접수일', '청구액', '지급액']) {
      const cell = v[ix[key]];
      const raw = cell?.userEnteredValue?.numberValue ?? cell?.userEnteredValue?.stringValue;
      if (raw !== undefined && String(raw) !== '') confirm.push({ 범위: `'접수'!${col(ix[key])}${i + 1}`, 값: String(raw) });
    }
  }
  if (!cells.length) {
    console.log(JSON.stringify({ status: 'NO_CHANGE', same, held })); return;
  }
  const plan = validatePlan({ 시트ID: ID, 이유: '정산 산출근거 표시 dry-run; 실제 F04 쓰기는 freepass-data 이관 대상', 요청자: 'freepass-admin dry-run', 바꿀칸: cells, 줄확인: confirm });
  const digest = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const cfg = { ...fixer.config(), 머리줄번호: 2 };
  const check = fixer.inspect(plan, cfg);
  if (check.rows.some(r => r.status === 'CONFLICT')) throw new Error('BASIS_CONFLICT');
  console.log(JSON.stringify({ status: 'DRY_RUN', planned: cells.length, same, held, sourceDigest: digest }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
}
