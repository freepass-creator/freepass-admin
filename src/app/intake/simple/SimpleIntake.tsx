'use client';
import { useEffect, useRef, useState } from 'react';
import { PanelHeader } from '../../_design/Primitives';
import { simplePlateLookupAction } from '../actions';
import { normalizedPlate, type CatalogChoice } from './model';
import { blankRow, checks, fields, extraFields, intakeGroups, followupFields, feeFields, normalizeRow, savedSchema, validateRow, type Row } from './model';
import './simple.css';

const storageKey = 'freepass-admin.simple-intake.draft.v1';
export default function SimpleIntake() {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Row | null>(null);
  const [entry, setEntry] = useState<Row | null>(null);
  const [entryDirty, setEntryDirty] = useState(false);
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const lookupSeq = useRef(0);
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const [lookupRelease, setLookupRelease] = useState('');
  async function lookupPlate() {
    if (!entry?.plate.trim()) return;
    const plate = entry.plate;
    const seq = ++lookupSeq.current;
    setLookupBusy(true); setCatalogChoices([]); setLookupMessage('차량 조건 조회 중…');
    try {
      const result = await simplePlateLookupAction(plate);
      if (seq !== lookupSeq.current || normalizedPlate(entryRef.current?.plate ?? '') !== normalizedPlate(plate)) return;
      setCatalogChoices(result.choices); setLookupRelease(result.release); setLookupMessage(result.message);
    } catch { if (seq === lookupSeq.current) setLookupMessage('조회 실패 · 직접 입력할 수 있습니다.'); }
    finally { if (seq === lookupSeq.current) setLookupBusy(false); }
  }
  function applyChoice(key: string) {
    const choice = catalogChoices.find(c => c.key === key);
    if (!choice) return;
    setEntry(current => current ? { ...current, supplier:choice.supplier,model:choice.model,product:choice.product,term:choice.term,rent:choice.rent,deposit:choice.deposit,vehiclePrice:choice.vehiclePrice,history:`프리패스 조회 당시 조건(수기수정 가능): ${JSON.stringify({plate:current.plate,release:lookupRelease,...choice})}` } : current);
    setEntryDirty(true); setLookupMessage('선택한 조건을 가져왔습니다. 직접 수정하면 선택 조건과 달라질 수 있으니 확인해 주세요.');
  }
  const plateRef = useRef<HTMLInputElement>(null);
  function newEntry() {
    return blankRow(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint32Array(4)), v => v.toString(16).padStart(8, '0')).join(''), new Date().toLocaleDateString('sv-SE'));
  }
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const sourceRaw = useRef<string | null>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false);
  const [rawBackup, setRawBackup] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('');
  const [view, setView] = useState('all');
  useEffect(() => {
    let raw: string | null;
    try { raw = localStorage.getItem(storageKey); }
    catch { setError('브라우저 저장소 접근이 차단됐습니다. 저장소를 사용할 수 있는 브라우저에서 열어 주세요.'); return; }
    try {
      if (raw) setRows(savedSchema.parse(JSON.parse(raw)).rows);
      sourceRaw.current = raw;
      setEntry(newEntry());
      setReady(true);
    } catch { setRawBackup(raw); setError('저장된 초안 형식을 읽을 수 없습니다. 덮어쓰지 않았습니다. 원문 백업을 내려받아 복구할 수 있습니다.'); }
  }, []);
  useEffect(() => {
    if (!draft && !entryDirty && !Object.keys(edits).length) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const linkGuard = (e: MouseEvent) => {
      if ((e.target as Element).closest('a[href]') && !window.confirm('저장 전 입력이 있습니다. 이 화면을 떠날까요?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', guard);
    document.addEventListener('click', linkGuard, true);
    return () => { window.removeEventListener('beforeunload', guard); document.removeEventListener('click', linkGuard, true); };
  }, [draft, edits, entryDirty]);
  useEffect(() => { if (error) alertRef.current?.scrollIntoView({ block: 'nearest' }); }, [error]);
  function select(row: Row) {
    if (draft && !window.confirm('저장하지 않은 입력을 닫을까요?')) return;
    setDraft({ ...(edits[row.id] ?? row) }); setError(''); setStatus('');
  }
  function save(input: Row | null = draft) {
    if (!input || !ready) return;
    const row = normalizeRow(input);
    const issue = validateRow(row);
    if (issue) { setError(issue); return; }
    const next = rows.some(r => r.id === row.id) ? rows.map(r => r.id === row.id ? row : r) : [row, ...rows];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== sourceRaw.current) {
        setRawBackup(raw);
        setError('다른 탭에서 저장 내용이 바뀌었습니다. 덮어쓰지 않았습니다. 저장 전 입력 백업을 내려받은 후 새로고침해서 대조해 주세요.'); return;
      }
      const data = JSON.stringify({ version: 2, rows: next });
      localStorage.setItem(storageKey, data);
      if (localStorage.getItem(storageKey) !== data) throw new Error('readback');
      sourceRaw.current = data;
      setRows(next); setDraft(null); setEdits(current => { const remaining = { ...current }; delete remaining[row.id]; return remaining; });
      if (entry?.id === row.id) { ++lookupSeq.current; setCatalogChoices([]); setLookupMessage(''); setLookupBusy(false); setEntry(newEntry()); setEntryDirty(false); requestAnimationFrame(() => plateRef.current?.focus()); }
      setQuery(''); setMonth(''); setView('all'); setError(''); setStatus(`${row.plate} · 이 브라우저에 저장됨`);
    } catch { setError('저장하지 못했습니다. 입력은 유지됩니다.'); }
  }
  function backup(unsaved = false) {
    const url = URL.createObjectURL(new Blob([unsaved ? JSON.stringify({ draft, entry, edits }, null, 2) : rawBackup ?? JSON.stringify({ version: 2, rows }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = unsaved ? '접수현황-저장전입력.json' : rawBackup ? '접수현황-복구원문.json' : '접수현황-초안.json';
    document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const shown = rows.filter(r => (!month || r.billingMonth === month) && (view === 'all' || r.cancelled === (view === 'cancelled')) &&
    [r.plate, r.customer, r.supplier, r.agent, r.channel, r.model].join(' ').toLowerCase().includes(query.toLowerCase()))
    ;
  const money = (v: string) => v === '' ? '미입력' : Number(v).toLocaleString('ko-KR');
  return <div className="erp-screen simple-intake">
    <PanelHeader title={draft ? (rows.some(r => r.id === draft.id) ? '접수 수정' : '접수하기') : '접수현황'} count={draft ? undefined : `${rows.length}건`} />
    <p className="simple-notice">초안 · 이 브라우저에만 저장됩니다. 구글시트·운영 원장과 연결되지 않습니다. 실제 고객정보 입력 전 운영 저장 연결이 필요합니다.</p>
    {!draft && <div className="simple-tools">
      <input aria-label="접수 검색" placeholder="차량번호 · 고객 · 담당자 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <input type="month" aria-label="청구월 필터" value={month} onChange={e => setMonth(e.target.value)} />
      <select aria-label="접수 상태 필터" value={view} onChange={e => setView(e.target.value)}><option value="all">전체</option><option value="active">취소 제외</option><option value="cancelled">취소</option></select>
      <button disabled={!ready} onClick={() => plateRef.current?.focus()}>신규 입력으로</button>
      <button disabled={!rawBackup && (!ready || !rows.length)} onClick={() => backup()}>{rawBackup ? '복구 원문 백업' : '초안 백업'}</button>
      {(entryDirty || Object.keys(edits).length > 0) && <button onClick={() => backup(true)}>저장 전 입력 백업</button>}
    </div>}
    {error && <p role="alert" ref={alertRef}>{error}{draft && <button onClick={() => backup(true)}>저장 전 입력 백업</button>}</p>}{status && <p role="status">{status}</p>}
    <div className="simple-body simple-single">
      {!draft &&
      <section aria-label="접수 목록" className="simple-list">
        <p className="simple-table-help">① 접수정보 입력 → 접수하기 → ② 수수료 확인 → ③ 저장된 행에서 계약·인도·청구 처리. 금액은 공급가액이며 빈 금액은 수수료 확인 필요입니다. {shown.length}/{rows.length}건</p>
        <form id="simple-new-entry" onSubmit={e => { e.preventDefault(); save(entry); }} />
        <div className="simple-flow" aria-label="접수현황">
        {entry && <section className="simple-entry-row simple-flow-record" aria-label="신규 접수 입력">
          <h2>신규 접수</h2><div className="simple-flow-actions"><button type="button" disabled={lookupBusy || !entry.plate.trim()} onClick={lookupPlate}>{lookupBusy ? '조회 중' : '차량번호로 프리패스 조회'}</button><span role="status">{lookupMessage}</span></div>
          {catalogChoices.length > 0 && <label className="simple-catalog-select">프리패스 차량 조건<select aria-label="프리패스 차량 조건" defaultValue="" key={catalogChoices.map(c=>c.key).join('|')} onChange={e=>applyChoice(e.target.value)}><option value="">공급사 · 상품 · 기간 · 대여료 묶음 선택</option>{catalogChoices.map(c=><option key={c.key} value={c.key}>{c.supplier || '공급사 미확인'} · {c.model} · {c.product} · {c.term}개월 · 월 {Number(c.rent).toLocaleString('ko-KR')}원 · 보증 {c.deposit === '' ? '미확인' : Number(c.deposit).toLocaleString('ko-KR')}</option>)}</select></label>}
          <div className="simple-input-groups">{intakeGroups.map(group=><fieldset className="simple-input-group" key={group.title}><legend>{group.title}</legend><div className="simple-flow-fields">
          {group.fields.map(([key, label, type]) => {
            const suggested = key === 'product' ? ['신차렌트', '중고구독', '중고렌트', '오공구독', '픽업구독', '오플구독', '장기렌트', '선출고', '견적출고', '구독'] : key === 'term' ? ['12', '24', '36', '48', '60'] : key === 'installment' ? ['일시납', '2회분납', '3회분납'] : [];
            const options = [...new Set([...suggested, ...catalogChoices.map(c => key in c ? String(c[key as keyof CatalogChoice]) : '').filter(Boolean), ...rows.map(r => r[key]).filter(Boolean)])];
            const selectable = ['supplier', 'model', 'rent', 'product', 'channel', 'agent', 'term', 'installment', 'rentKind', 'contractKind'].includes(key);
            if (key === 'installment' || key === 'product') return <label key={key}><span>{label}</span><select form="simple-new-entry" aria-label={`신규 ${label}`} value={entry[key]} onChange={e=>{setEntry({...entry,[key]:e.target.value});setEntryDirty(true);}}><option value="">선택</option>{[...new Set([...options,entry[key]].filter(Boolean))].map(value=><option key={value} value={value}>{value}</option>)}</select></label>;
            return <label key={key}><span>{label}</span><input ref={key === 'plate' ? plateRef : undefined} form="simple-new-entry" aria-label={`신규 ${label}`} required={key === 'plate'} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} list={selectable ? `entry-${key}` : undefined} value={entry[key]} placeholder={label} onChange={e => { if(key === 'plate') { ++lookupSeq.current;setCatalogChoices([]);setLookupMessage('');setLookupBusy(false); } setEntry(current => current ? { ...current, [key]: e.target.value } : current); setEntryDirty(true); }} onBlur={e => { const value = e.target.value; if (value !== entry[key]) { setEntry(current => current ? { ...current, [key]: value } : current); setEntryDirty(true); } }} />{selectable && <datalist id={`entry-${key}`}>{options.map(value => <option key={value} value={value} />)}</datalist>}</label>;
          })}
          </div></fieldset>)}</div><div className="simple-flow-actions"><span>계약·인도·청구는 접수 후 처리합니다.</span><button form="simple-new-entry" type="submit" disabled={!ready}>접수하기</button>{entryDirty && <span>입력 중</span>}</div>
        </section>}
        {shown.map(original => { const r = edits[original.id] ?? original;
          const change = (patch: Partial<Row>) => { setEdits(current => ({ ...current, [r.id]: { ...(current[r.id] ?? original), ...patch } })); setStatus('저장 전 변경이 있습니다.'); setError(''); };
          return <article key={r.id} aria-label={`${r.plate} 접수`} className={`simple-flow-record ${r.cancelled ? 'cancelled' : r.refunded ? 'refunded' : ''}`}>
            <h2>{r.plate} <small>{r.receiptDate}</small></h2>
            <div className="simple-input-groups">{intakeGroups.map(group=><fieldset className="simple-input-group" key={group.title}><legend>{group.title}</legend><div className="simple-flow-fields simple-flow-summary">{group.fields.map(([key,label,type]) => <div key={key}><span>{label}</span><div>{r[key] === '' ? '미입력' : type === 'number' ? money(r[key]) : r[key]}</div></div>)}</div></fieldset>)}</div>
            <fieldset className="simple-flow-group"><legend>수수료 · 청구 · 지급 · 환수 정보</legend><div className="simple-flow-fields">{[...followupFields.filter(([key])=>key==='billingMonth'),...feeFields,...extraFields.filter(([key])=>['refundReason','refundDate','refundAmount'].includes(key))].map(([key,label,type]) => <label key={key}><span>{label}</span><input aria-label={`${r.plate} ${label}`} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} className={type === 'number' ? 'simple-money' : undefined} value={r[key]} placeholder={key === 'claim'||key ==='pay' ? '확인 필요' : ''} onChange={e => change({[key]:e.target.value})} onBlur={e=>{if(e.target.value!==r[key])change({[key]:e.target.value});}} /></label>)}</div><div className="simple-flow-checks">{checks.filter(([key])=>['claimed','collected','paid','cancelled'].includes(key)).map(([key,label])=><label key={key}><input type="checkbox" aria-label={`${r.plate} ${label}`} checked={r[key]} onChange={e=>change({[key]:e.target.checked})}/>{label}</label>)}<label><input type="checkbox" aria-label={`${r.plate} 환수`} checked={r.refunded} onChange={e=>change({refunded:e.target.checked})}/>환수</label></div></fieldset>
            <fieldset className="simple-flow-group"><legend>계약 · 인도 진행</legend><div className="simple-flow-fields">{followupFields.filter(([key])=>key==='deliveryDate').map(([key,label,type]) => <label key={key}><span>{label}</span><input aria-label={`${r.plate} ${label}`} type={type} value={r[key]} onChange={e => change({[key]:e.target.value})} onBlur={e => {if(e.target.value !== r[key]) change({[key]:e.target.value});}} /></label>)}</div>
            <div className="simple-flow-checks">{checks.filter(([key])=>!['claimed','collected','paid','cancelled'].includes(key)).map(([key, label]) => <label key={key}><input type="checkbox" aria-label={`${r.plate} ${label}`} checked={r[key]} onChange={e => change({ [key]: e.target.checked })} />{label}</label>)}</div></fieldset>
            <div className="simple-flow-actions"><button onClick={() => select(r)}>상세</button>{edits[r.id] && <><span>저장 전</span><button onClick={() => save(r)}>저장</button></>}</div>
          </article>;
        })}
        {!shown.length && <p>{ready ? (rows.length ? '검색 조건에 맞는 접수가 없습니다.' : '맨 위에서 첫 접수를 입력하세요.') : '초안 확인 중입니다.'}</p>}
        </div>
      </section>}
      {draft &&
      <section aria-label="접수 입력" className="simple-editor">
        <form onSubmit={e => { e.preventDefault(); save(); }}>
          <h2>접수정보</h2>
          <div className="simple-fields">{fields.map(([key, label, type]) => <label key={key}>{label}<input type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
          <details className="simple-extra"><summary>분납 · 환수 · 계약 · 정산 추가 항목</summary>
            <div className="simple-fields">{extraFields.map(([key, label, type]) => <label key={key}>{label}<input type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
            <label><input type="checkbox" checked={draft.refunded} onChange={e => setDraft({ ...draft, refunded: e.target.checked })} />환수</label>
          </details>
          <fieldset><legend>진행 체크</legend>{checks.map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.checked })} />{label}</label>)}</fieldset>
          <p>금액은 직접 입력합니다. 체크는 기록용이며 발행·송금 작업을 실행하지 않습니다.</p>
          <div className="simple-tools simple-form-actions"><button type="button" onClick={() => { if (window.confirm('저장하지 않은 입력을 닫을까요?')) { setDraft(null); setError(''); setStatus(''); } }}>목록으로</button><button type="submit">{rows.some(r => r.id === draft.id) ? '수정 저장' : '접수하기'}</button></div>
        </form>
      </section>}
    </div>
  </div>;
}
