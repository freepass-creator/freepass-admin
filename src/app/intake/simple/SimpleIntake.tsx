'use client';
import { useEffect, useRef, useState } from 'react';
import { PanelHeader } from '../../_design/Primitives';
import { blankRow, checks, fields, extraFields, normalizeRow, savedSchema, validateRow, type Row } from './model';
import './simple.css';

const storageKey = 'freepass-admin.simple-intake.draft.v1';
export default function SimpleIntake() {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Row | null>(null);
  const [entry, setEntry] = useState<Row | null>(null);
  const [entryDirty, setEntryDirty] = useState(false);
  const plateRef = useRef<HTMLInputElement>(null);
  const tableFields = [fields[1], fields[0], ...fields.slice(2), ...extraFields];
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
      if (entry?.id === row.id) { setEntry(newEntry()); setEntryDirty(false); requestAnimationFrame(() => plateRef.current?.focus()); }
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
        <p className="simple-table-help">맨 위에서 차량번호부터 Tab으로 입력 후 접수하기. 신규 접수는 입력 줄 바로 아래에 쌓입니다. 금액은 공급가액입니다. {shown.length}/{rows.length}건</p>
        <form id="simple-new-entry" onSubmit={e => { e.preventDefault(); save(entry); }} />
        <div className="simple-table-scroll" tabIndex={0} aria-label="접수현황 가로 스크롤">
        <table className="simple-table"><thead><tr>
          {tableFields.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}
          {checks.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}<th scope="col">환수</th><th scope="col">수정</th>
        </tr></thead><tbody>
        {entry && <tr className="simple-entry-row" aria-label="신규 접수 입력 줄">
          {tableFields.map(([key, label, type]) => {
            const suggested = key === 'product' ? ['신차렌트', '중고구독', '중고렌트', '오공구독', '픽업구독', '오플구독'] : key === 'term' ? ['12', '24', '36', '48', '60'] : [];
            const options = [...new Set([...suggested, ...rows.map(r => r[key]).filter(Boolean)])];
            const selectable = ['supplier', 'product', 'channel', 'agent', 'term', 'installment', 'rentKind', 'contractKind'].includes(key);
            return <td key={key}><input ref={key === 'plate' ? plateRef : undefined} form="simple-new-entry" aria-label={`신규 ${label}`} required={key === 'plate'} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} list={selectable ? `entry-${key}` : undefined} value={entry[key]} placeholder={label} className={key === 'claim' || key === 'pay' ? 'simple-money' : undefined} onChange={e => { setEntry(current => current ? { ...current, [key]: e.target.value } : current); setEntryDirty(true); }} onBlur={e => { const value = e.target.value; if (value !== entry[key]) { setEntry(current => current ? { ...current, [key]: value } : current); setEntryDirty(true); } }} />{selectable && <datalist id={`entry-${key}`}>{options.map(value => <option key={value} value={value} />)}</datalist>}</td>;
          })}
          {checks.map(([key, label]) => <td key={key}><input form="simple-new-entry" type="checkbox" aria-label={`신규 ${label}`} checked={entry[key]} onChange={e => { setEntry({ ...entry, [key]: e.target.checked }); setEntryDirty(true); }} /></td>)}
          <td><input form="simple-new-entry" type="checkbox" aria-label="신규 환수" checked={entry.refunded} onChange={e => { setEntry({ ...entry, refunded: e.target.checked }); setEntryDirty(true); }} /></td>
          <td className="simple-row-actions"><button form="simple-new-entry" type="submit" disabled={!ready}>접수하기</button>{entryDirty && <span>입력 중</span>}</td>
        </tr>}
        {shown.map(original => { const r = edits[original.id] ?? original;
          const change = (patch: Partial<Row>) => { setEdits(current => ({ ...current, [r.id]: { ...(current[r.id] ?? original), ...patch } })); setStatus('저장 전 변경이 있습니다.'); setError(''); };
          return <tr key={r.id} className={r.cancelled ? 'cancelled' : r.refunded ? 'refunded' : ''}>
            {tableFields.map(([key, label, type]) => <td key={key}>{key === 'billingMonth' || key === 'claim' || key === 'pay' ? <input aria-label={`${r.plate} ${label}`} type={key === 'billingMonth' ? 'month' : 'text'} inputMode={key === 'billingMonth' ? undefined : 'decimal'} className={key === 'billingMonth' ? undefined : 'simple-money'} value={r[key]} placeholder="미입력" onChange={e => change({ [key]: e.target.value })} onBlur={e => { if (e.target.value !== r[key]) change({ [key]: e.target.value }); }} /> : type === 'number' ? money(r[key]) : r[key]}</td>)}
            {checks.map(([key, label]) => <td key={key}><input type="checkbox" aria-label={`${r.plate} ${label}`} checked={r[key]} onChange={e => change({ [key]: e.target.checked })} /></td>)}
            <td><input type="checkbox" aria-label={`${r.plate} 환수`} checked={r.refunded} onChange={e => change({ refunded: e.target.checked })} /></td>
            <td className="simple-row-actions"><button onClick={() => select(r)}>상세</button>{edits[r.id] && <><span>저장 전</span><button onClick={() => save(r)}>저장</button></>}</td>
          </tr>;
        })}
        {!shown.length && <tr><td colSpan={tableFields.length + checks.length + 2}>{ready ? (rows.length ? '검색 조건에 맞는 접수가 없습니다.' : '맨 위 입력 줄에서 첫 접수를 입력하세요.') : '초안 확인 중입니다.'}</td></tr>}
        </tbody></table></div>
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
