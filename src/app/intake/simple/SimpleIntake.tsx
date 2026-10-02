'use client';
import { useEffect, useState } from 'react';
import { PanelHeader } from '../../_design/Primitives';
import { blankRow, checks, fields, extraFields, savedSchema, validateRow, type Row } from './model';
import './simple.css';

const storageKey = 'freepass-admin.simple-intake.draft.v1';
export default function SimpleIntake() {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Row | null>(null);
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
      setReady(true);
    } catch { setRawBackup(raw); setError('저장된 초안 형식을 읽을 수 없습니다. 덮어쓰지 않았습니다. 원문 백업을 내려받아 복구할 수 있습니다.'); }
  }, []);
  useEffect(() => {
    if (!draft) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [draft]);
  function select(row: Row) {
    if (draft && !window.confirm('저장하지 않은 입력을 닫을까요?')) return;
    setDraft({ ...row }); setError(''); setStatus('');
  }
  function save() {
    if (!draft || !ready) return;
    const issue = validateRow(draft);
    if (issue) { setError(issue); return; }
    const next = rows.some(r => r.id === draft.id) ? rows.map(r => r.id === draft.id ? draft : r) : [...rows, draft];
    try {
      const raw = localStorage.getItem(storageKey);
      if ((!raw && rows.length > 0) || (raw && JSON.stringify(savedSchema.parse(JSON.parse(raw)).rows) !== JSON.stringify(rows))) {
        setError('다른 탭에서 초안이 변경됐습니다. 입력을 보존한 채 새로고침 후 확인해 주세요.'); return;
      }
      const data = JSON.stringify({ version: 1, rows: next });
      localStorage.setItem(storageKey, data);
      if (localStorage.getItem(storageKey) !== data) throw new Error('readback');
      setRows(next); setDraft(null); setError(''); setStatus('이 브라우저에 저장됨');
    } catch { setError('저장하지 못했습니다. 입력은 유지됩니다.'); }
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([rawBackup ?? JSON.stringify({ version: 1, rows }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = rawBackup ? '접수현황-복구원문.json' : '접수현황-초안.json';
    document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const shown = rows.filter(r => (!month || r.billingMonth === month) && (view === 'all' || r.cancelled === (view === 'cancelled')) &&
    [r.plate, r.customer, r.supplier, r.agent, r.channel, r.model].join(' ').toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.receiptDate.localeCompare(b.receiptDate));
  const money = (v: string) => v === '' ? '미입력' : Number(v).toLocaleString('ko-KR');
  return <div className="erp-screen simple-intake">
    <PanelHeader title={draft ? (rows.some(r => r.id === draft.id) ? '접수 수정' : '접수하기') : '접수현황'} count={draft ? undefined : `${rows.length}건`} />
    <p className="simple-notice">초안 · 이 브라우저에만 저장됩니다. 구글시트·운영 원장과 연결되지 않습니다. 실제 고객정보 입력 전 운영 저장 연결이 필요합니다.</p>
    {!draft && <div className="simple-tools">
      <input aria-label="접수 검색" placeholder="차량번호 · 고객 · 담당자 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <input type="month" aria-label="청구월 필터" value={month} onChange={e => setMonth(e.target.value)} />
      <select aria-label="접수 상태 필터" value={view} onChange={e => setView(e.target.value)}><option value="all">전체</option><option value="active">취소 제외</option><option value="cancelled">취소</option></select>
      <button disabled={!ready} onClick={() => select(blankRow(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint32Array(4)), v => v.toString(16).padStart(8, '0')).join(''), new Date().toLocaleDateString('sv-SE')))}>접수하기</button>
      <button disabled={!rawBackup && (!ready || !rows.length)} onClick={backup}>{rawBackup ? '복구 원문 백업' : '초안 백업'}</button>
    </div>}
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    <div className="simple-body simple-single">
      {!draft &&
      <section aria-label="접수 목록" className="simple-list">
        {!shown.length && <p>{ready ? '접수가 없습니다. 접수하기로 시작하세요.' : '초안 확인 중입니다.'}</p>}
        {shown.map(r => <button key={r.id} className={`simple-record ${r.cancelled ? 'cancelled' : ''}`} onClick={() => select(r)}>
          <span><strong>{r.plate}</strong><span>{r.receiptDate} · {r.customer || '고객 미입력'}</span></span>
          <span>{r.supplier} · {r.product} · {r.agent}</span>
          <span>청구 {money(r.claim)} / 지급 {money(r.pay)}{r.billingMonth && ` · ${r.billingMonth}`}</span>
          <span>{checks.filter(([key]) => r[key]).map(([, label]) => label).join(' · ') || '진행 체크 없음'}</span>
        </button>)}
      </section>}
      {draft &&
      <section aria-label="접수 입력" className="simple-editor">
        <form onSubmit={e => { e.preventDefault(); save(); }}>
          <h2>접수정보</h2>
          <div className="simple-fields">{fields.map(([key, label, type]) => <label key={key}>{label}<input type={type} step={type === 'number' ? 'any' : undefined} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
          <details className="simple-extra"><summary>분납 · 환수 · 계약 · 정산 추가 항목</summary>
            <div className="simple-fields">{extraFields.map(([key, label, type]) => <label key={key}>{label}<input type={type} step={type === 'number' ? 'any' : undefined} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
            <label><input type="checkbox" checked={draft.refunded} onChange={e => setDraft({ ...draft, refunded: e.target.checked })} />환수</label>
          </details>
          <fieldset><legend>진행 체크</legend>{checks.map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.checked })} />{label}</label>)}</fieldset>
          <p>금액은 직접 입력합니다. 체크는 기록용이며 발행·송금 작업을 실행하지 않습니다.</p>
          <div className="simple-tools simple-form-actions"><button type="button" onClick={() => { if (window.confirm('저장하지 않은 입력을 닫을까요?')) setDraft(null); }}>목록으로</button><button type="submit">{rows.some(r => r.id === draft.id) ? '수정 저장' : '접수하기'}</button></div>
        </form>
      </section>}
    </div>
  </div>;
}
