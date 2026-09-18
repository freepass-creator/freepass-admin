'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject,
} from 'react';
import { AGREEMENT_SECTIONS, AGREEMENT_TITLE } from '../../../domain/esign/agreement';
import { applySignerRole } from '../../../domain/esign/required-documents';
import type { EsignSession } from '../../../domain/esign/types';

type View = {
  error?: string;
  session?: Omit<EsignSession, 'tokenHash'> & { tokenHash?: string };
  stage?: { state: string; label: string };
  rejectReason?: string;
  supplementItems?: string[];
  uploadedKeys?: string[];
  draft?: Record<string, unknown> | null;
};

type FormState = {
  customer_name: string;
  customer_phone: string;
  customer_birth: string;
  customer_address: string;
  driver_license_no: string;
  signer_name: string;
  signer_role: string;
  emergency_relation: string;
  emergency_name: string;
  emergency_phone: string;
  cms_holder_name: string;
  cms_holder_relation: string;
  cms_holder_phone: string;
  cms_bank: string;
  cms_account_no: string;
  cms_holder_identifier: string;
};

const emptyForm: FormState = {
  customer_name: '', customer_phone: '', customer_birth: '', customer_address: '', driver_license_no: '',
  signer_name: '', signer_role: '대표이사', emergency_relation: '', emergency_name: '', emergency_phone: '',
  cms_holder_name: '', cms_holder_relation: '', cms_holder_phone: '', cms_bank: '', cms_account_no: '', cms_holder_identifier: '',
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const body = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw new Error(body.error || '요청을 처리하지 못했습니다.');
  return body;
}

function SignaturePad({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * 600 / rect.width, y: (e.clientY - rect.top) * 180 / rect.height };
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d');
    if (!ctx) return;
    const next = point(e);
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(next.x, next.y); ctx.stroke();
    last.current = next;
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => {
    const c = canvasRef.current, ctx = c?.getContext('2d');
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
  };
  return <div className="sg-signbox">
    <canvas ref={canvasRef} width={600} height={180} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="전자서명"/>
    <div className="sg-sign-tools"><button type="button" onClick={clear}>다시 쓰기</button></div>
  </div>;
}

export function SignClient({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [step, setStep] = useState(0);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [consents, setConsents] = useState<Set<string>>(new Set());
  const [summaryAt, setSummaryAt] = useState(0);
  const [agreementAt, setAgreementAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    try {
      const next = await json<View>('/api/esign/public/' + encodeURIComponent(token));
      setView(next);
      setUploaded(new Set(next.uploadedKeys || []));
      if (next.session?.snapshot) {
        const draft = next.draft || {};
        setForm((f) => ({
          ...f,
          customer_name: String(draft.customer_name ?? '') || f.customer_name || next.session!.snapshot.customerName || '',
          customer_phone: String(draft.customer_phone ?? '') || f.customer_phone || next.session!.snapshot.customerPhone || '',
          customer_birth: String(draft.customer_birth ?? '') || f.customer_birth,
          customer_address: String(draft.customer_address ?? '') || f.customer_address,
          driver_license_no: String(draft.driver_license_no ?? '') || f.driver_license_no,
          signer_name: String(draft.signer_name ?? '') || f.signer_name,
          signer_role: String(draft.signer_role ?? '') || f.signer_role,
          emergency_relation: String(draft.emergency_relation ?? '') || f.emergency_relation,
          emergency_name: String(draft.emergency_name ?? '') || f.emergency_name,
          emergency_phone: String(draft.emergency_phone ?? '') || f.emergency_phone,
          cms_holder_name: String(draft.cms_holder_name ?? '') || f.cms_holder_name,
          cms_holder_relation: String(draft.cms_holder_relation ?? '') || f.cms_holder_relation,
          cms_holder_phone: String(draft.cms_holder_phone ?? '') || f.cms_holder_phone,
          cms_bank: String(draft.cms_bank ?? '') || f.cms_bank,
          cms_account_no: String(draft.cms_account_no ?? '') || f.cms_account_no,
          cms_holder_identifier: String(draft.cms_holder_identifier ?? '') || f.cms_holder_identifier,
        }));
        const savedConsents = Array.isArray(draft.consents) ? draft.consents.map(String) : [];
        if (savedConsents.length) setConsents(new Set(savedConsents));
        if (Number(draft.summaryConfirmedAt || 0)) setSummaryAt(Number(draft.summaryConfirmedAt));
        if (Number(draft.agreementReadAt || 0)) setAgreementAt(Number(draft.agreementReadAt));
        const maxStep = next.session.snapshot.customerType === '법인' ? 4 : 6;
        const savedStep = Number(draft.step || 0);
        if (Number.isInteger(savedStep) && savedStep > 0) setStep(Math.min(savedStep, maxStep));
        if (next.session.status === 'rejected' && next.supplementItems?.length) {
          const requested = new Set(next.supplementItems);
          const target = next.session.snapshot.customerType === '법인'
            ? (requested.has('documents') ? 3 : requested.has('signature') ? 4 : 1)
            : (requested.has('identity') ? 2 : requested.has('selfie') ? 3 : requested.has('documents') ? 5 : requested.has('signature') ? 6 : 1);
          setStep(target);
        }
      }
      return next;
    } catch (e) {
      setView({ error: (e as Error).message });
      return null;
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (view?.session?.status !== 'pending_review') return;
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [view?.session?.status, load]);

  const snapshot = view?.session?.snapshot;
  const corporate = snapshot?.customerType === '법인';
  const steps = useMemo(() => corporate
    ? [
      ['summary', '계약 확인'], ['information', '계약자 정보'], ['agreement', '계약·약관'],
      ['documents', '부속서류'], ['signature', '전자서명'],
    ]
    : [
      ['summary', '계약 확인'], ['information', '계약자 정보'], ['id-card', '면허증'],
      ['selfie', '본인 확인'], ['agreement', '계약·약관'], ['documents', '부속서류'], ['signature', '전자서명'],
    ], [corporate]);
  const current = steps[step] || steps[0];
  const requiredDocs = snapshot ? applySignerRole(snapshot.requiredDocuments, form.signer_role) : [];
  const cmsRequired = snapshot?.consentProfile.cmsRequiredBeforeHandover === true;
  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function saveDraft(nextStep: number, summaryConfirmedAt = summaryAt, agreementReadAt = agreementAt) {
    await json('/api/esign/public/' + encodeURIComponent(token), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'draft',
        payload: { ...form, consents: [...consents], summaryConfirmedAt, agreementReadAt, step: nextStep },
      }),
    });
  }

  async function progress(key: string) {
    const map: Record<string, string> = { summary: 'summary', information: 'information', 'id-card': 'identity', selfie: 'identity', agreement: 'agreement', documents: 'documents' };
    if (!map[key]) return;
    await json('/api/esign/public/' + encodeURIComponent(token), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'progress', step: map[key] }),
    });
  }

  async function upload(kind: string, file: File | null) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData(); fd.set('kind', kind); fd.set('file', file);
      await json('/api/esign/public/' + encodeURIComponent(token) + '/asset', { method: 'POST', body: fd });
      setUploaded((prev) => new Set([...prev, kind]));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function validateStep(key: string) {
    if (key === 'information') {
      if (!form.customer_name.trim()) return '성명을 입력해 주세요.';
      if (form.customer_phone.replace(/\D/g, '').length < 10) return '연락처를 확인해 주세요.';
      if (!form.customer_address.trim()) return '주소를 입력해 주세요.';
      if (!corporate && !/^\d{4}-\d{2}-\d{2}$/.test(form.customer_birth)) return '생년월일을 확인해 주세요.';
      if (!corporate && !form.driver_license_no.trim()) return '운전면허번호를 입력해 주세요.';
      if (corporate && (!form.signer_name.trim() || !form.signer_role)) return '법인 서명자를 확인해 주세요.';
      if (cmsRequired) {
        if (!form.cms_holder_name.trim() || !form.cms_holder_relation.trim() || form.cms_holder_phone.replace(/\D/g, '').length < 10
          || !form.cms_bank.trim() || form.cms_account_no.replace(/\D/g, '').length < 6
          || !/^\d{6}(\d{4})?$/.test(form.cms_holder_identifier.replace(/\D/g, ''))) {
          return '자동이체 예금주·관계·연락처·은행·계좌번호·생년월일 또는 사업자번호를 확인해 주세요.';
        }
      }
      if (!form.emergency_relation || !form.emergency_name || form.emergency_phone.replace(/\D/g, '').length < 10) return '비상연락처를 확인해 주세요.';
    }
    if (key === 'id-card' && !uploaded.has('id_card')) return '운전면허증 사진을 올려 주세요.';
    if (key === 'selfie' && !uploaded.has('selfie')) return '본인 얼굴 사진을 올려 주세요.';
    if (key === 'agreement' && snapshot && !snapshot.consentProfile.requiredKeys.every((x) => consents.has(x))) return '필수 동의를 모두 확인해 주세요.';
    if (key === 'documents') {
      const miss = requiredDocs.filter((d) => d.required && !uploaded.has('support:' + d.key));
      if (miss.length) return '필수서류가 없습니다: ' + miss.map((d) => d.label).join(' · ');
    }
    return '';
  }

  async function next() {
    const key = current[0], fail = validateStep(key);
    if (fail) { setError(fail); return; }
    setError('');
    const nextSummaryAt = key === 'summary' && !summaryAt ? Date.now() : summaryAt;
    const nextAgreementAt = key === 'agreement' && !agreementAt ? Date.now() : agreementAt;
    if (nextSummaryAt !== summaryAt) setSummaryAt(nextSummaryAt);
    if (nextAgreementAt !== agreementAt) setAgreementAt(nextAgreementAt);
    setBusy(true);
    try {
      const nextStep = Math.min(step + 1, steps.length - 1);
      await saveDraft(nextStep, nextSummaryAt, nextAgreementAt);
      await progress(key);
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function submit() {
    const fail = validateStep('documents');
    if (fail) { setError(fail); return; }
    const signature = canvasRef.current?.toDataURL('image/png') || '';
    setBusy(true); setError('');
    try {
      const payload = {
        ...form,
        signature,
        consents: [...consents],
        summaryConfirmedAt: summaryAt || Date.now(),
        agreementReadAt: agreementAt || Date.now(),
        sectionConfirmations: { agreement: agreementAt || Date.now() },
      };
      await json('/api/esign/public/' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', payload }),
      });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!view) return <div className="sg-shell"><div className="sg-loading">전자계약을 불러오는 중…</div></div>;
  if (view.error || !snapshot) return <div className="sg-shell"><div className="sg-card"><div className="sg-brand">freepass</div><div className="sg-alert warn">{view.error || '계약을 찾을 수 없습니다.'}</div></div></div>;

  if (view.session?.status === 'signed') return <div className="sg-shell"><div className="sg-brand">freepass</div><div className="sg-card"><div className="sg-head"><h1>전자계약이 완료되었습니다</h1><p>서명·승인이 끝난 봉인본입니다.</p></div><div className="sg-alert ok">계약번호 {snapshot.contractCode} · 서명완료</div><div className="sg-actions one"><a className="sg-primary" href={'/api/esign/public/' + encodeURIComponent(token) + '/document'} target="_blank" rel="noreferrer">완료 계약서 열기</a></div></div></div>;

  if (view.session?.status === 'pending_review' || view.session?.status === 'approving') return <div className="sg-shell"><div className="sg-brand">freepass</div><div className="sg-card"><div className="sg-head"><h1>제출이 완료되었습니다</h1><p>담당자가 본인확인 자료와 서류를 검토하고 있습니다. 승인되면 이 화면에서 완료 계약서를 확인할 수 있습니다.</p></div><div className="sg-alert ok">검토 대기 · 계약번호 {snapshot.contractCode}</div></div></div>;

  return <div className="sg-shell">
    <div className="sg-brand">freepass</div>
    <div className="sg-card">
      <div className="sg-progress" style={{ ['--steps' as string]: steps.length } as CSSProperties}>{steps.map((x, i) => <span key={x[0]} className={'sg-dot' + (i <= step ? ' on' : '')}/>)}</div>
      {view.session?.status === 'rejected' && <div className="sg-alert warn">보완 요청: {view.rejectReason || '제출자료를 다시 확인해 주세요.'}</div>}
      {error && <div className="sg-alert warn">{error}</div>}
      <div className="sg-head"><h1>{current[1]}</h1><p>{String(step + 1)} / {String(steps.length)} 단계 · 계약번호 {snapshot.contractCode}</p></div>

      {current[0] === 'summary' && <>
        <div className="sg-summary">
          <div className="sg-box"><dt>고객</dt><dd>{snapshot.customerName}</dd></div>
          <div className="sg-box"><dt>차량</dt><dd>{snapshot.vehicleName} · {snapshot.plate}</dd></div>
          <div className="sg-box"><dt>기간</dt><dd>{snapshot.termMonths}개월</dd></div>
          <div className="sg-box"><dt>월 대여료</dt><dd>{snapshot.rent?.toLocaleString()}원</dd></div>
          <div className="sg-box"><dt>보증금</dt><dd>{snapshot.deposit?.toLocaleString()}원</dd></div>
          <div className="sg-box"><dt>계약유형</dt><dd>{snapshot.contractKind}</dd></div>
        </div>
        <div className="sg-actions one"><button className="sg-primary" onClick={() => void next()} disabled={busy}>맞습니다. 계속하기</button></div>
      </>}

      {current[0] === 'information' && <>
        <div className="sg-grid">
          <label className="sg-field">성명 *<input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)}/></label>
          <label className="sg-field">연락처 *<input value={form.customer_phone} inputMode="tel" onChange={(e) => set('customer_phone', e.target.value)}/></label>
          {!corporate && <label className="sg-field">생년월일 *<input type="date" value={form.customer_birth} onChange={(e) => set('customer_birth', e.target.value)}/></label>}
          {!corporate && <label className="sg-field">운전면허번호 *<input value={form.driver_license_no} onChange={(e) => set('driver_license_no', e.target.value)}/></label>}
          {corporate && <label className="sg-field">서명자 성명 *<input value={form.signer_name} onChange={(e) => set('signer_name', e.target.value)}/></label>}
          {corporate && <label className="sg-field">법인과의 관계 *<select value={form.signer_role} onChange={(e) => set('signer_role', e.target.value)}><option>대표이사</option><option>위임받은 임직원</option></select></label>}
          <label className="sg-field wide">주소 *<input value={form.customer_address} onChange={(e) => set('customer_address', e.target.value)}/></label>
          {cmsRequired && <>
            <label className="sg-field">자동이체 예금주 *<input value={form.cms_holder_name} onChange={(e) => set('cms_holder_name', e.target.value)}/></label>
            <label className="sg-field">계약자와의 관계 *<input value={form.cms_holder_relation} onChange={(e) => set('cms_holder_relation', e.target.value)}/></label>
            <label className="sg-field">예금주 연락처 *<input value={form.cms_holder_phone} inputMode="tel" onChange={(e) => set('cms_holder_phone', e.target.value)}/></label>
            <label className="sg-field">은행 *<input value={form.cms_bank} onChange={(e) => set('cms_bank', e.target.value)}/></label>
            <label className="sg-field">계좌번호 *<input value={form.cms_account_no} inputMode="numeric" onChange={(e) => set('cms_account_no', e.target.value)}/></label>
            <label className="sg-field">예금주 생년월일/사업자번호 *<input value={form.cms_holder_identifier} inputMode="numeric" onChange={(e) => set('cms_holder_identifier', e.target.value)}/></label>
          </>}
          <label className="sg-field">비상연락 관계 *<input value={form.emergency_relation} onChange={(e) => set('emergency_relation', e.target.value)}/></label>
          <label className="sg-field">비상연락 성명 *<input value={form.emergency_name} onChange={(e) => set('emergency_name', e.target.value)}/></label>
          <label className="sg-field">비상연락처 *<input value={form.emergency_phone} inputMode="tel" onChange={(e) => set('emergency_phone', e.target.value)}/></label>
        </div>
        <div className="sg-actions"><button className="sg-secondary" onClick={() => setStep((n) => Math.max(0, n - 1))}>이전</button><button className="sg-primary" onClick={() => void next()} disabled={busy}>계속하기</button></div>
      </>}

      {current[0] === 'id-card' && <>
        <div className="sg-upload"><label><b>운전면허증 촬영</b><small>주민등록번호 뒷자리는 가린 사진만 올려 주세요.</small>{uploaded.has('id_card') && <span className="done"> · 등록됨</span>}<input type="file" accept="image/*" capture="environment" onChange={(e) => void upload('id_card', e.target.files?.[0] || null)}/></label></div>
        <div className="sg-actions"><button className="sg-secondary" onClick={() => setStep((n) => n - 1)}>이전</button><button className="sg-primary" onClick={() => void next()} disabled={busy}>계속하기</button></div>
      </>}

      {current[0] === 'selfie' && <>
        <div className="sg-upload"><label><b>본인 얼굴 촬영</b><small>계약자 본인 확인을 위한 사진입니다.</small>{uploaded.has('selfie') && <span className="done"> · 등록됨</span>}<input type="file" accept="image/*" capture="user" onChange={(e) => void upload('selfie', e.target.files?.[0] || null)}/></label></div>
        <div className="sg-actions"><button className="sg-secondary" onClick={() => setStep((n) => n - 1)}>이전</button><button className="sg-primary" onClick={() => void next()} disabled={busy}>계속하기</button></div>
      </>}

      {current[0] === 'agreement' && <>
        <div className="sg-terms"><h2>{AGREEMENT_TITLE}</h2>{AGREEMENT_SECTIONS.map((x) => <section key={x.t}><h3>{x.t}</h3><p>{x.b}</p></section>)}</div>
        <div className="sg-consents">
          <label className="sg-check"><input type="checkbox" checked={consents.has('rental_terms')} onChange={(e) => setConsents((prev) => { const n = new Set(prev); e.target.checked ? n.add('rental_terms') : n.delete('rental_terms'); return n; })}/><span>세부 계약과 자동차 대여약관 전체 내용을 확인했습니다.</span></label>
          {snapshot.consentProfile.atoms.map((atom) => <label className="sg-check" key={atom.key}><input type="checkbox" checked={consents.has(atom.key)} onChange={(e) => setConsents((prev) => { const n = new Set(prev); e.target.checked ? n.add(atom.key) : n.delete(atom.key); return n; })}/><span><b>{atom.label}</b><br/>{atom.purpose}</span></label>)}
        </div>
        <div className="sg-actions"><button className="sg-secondary" onClick={() => setStep((n) => n - 1)}>이전</button><button className="sg-primary" onClick={() => void next()} disabled={busy}>동의하고 계속하기</button></div>
      </>}

      {current[0] === 'documents' && <>
        <div className="sg-upload">{requiredDocs.length ? requiredDocs.map((doc) => {
          const key = 'support:' + doc.key, done = uploaded.has(key);
          return <label key={doc.key}><b>{doc.label}{doc.required ? ' *' : ''}</b><small>{doc.note}</small>{done && <span className="done"> · 등록됨</span>}<input type="file" accept="image/*,application/pdf" onChange={(e) => void upload(key, e.target.files?.[0] || null)}/></label>;
        }) : <div className="sg-alert ok">이 계약에 추가 필수서류가 없습니다.</div>}</div>
        <div className="sg-actions"><button className="sg-secondary" onClick={() => setStep((n) => n - 1)}>이전</button><button className="sg-primary" onClick={() => void next()} disabled={busy}>계속하기</button></div>
      </>}

      {current[0] === 'signature' && <>
        <p>확인한 계약·약관에 서명해 주세요.</p><SignaturePad canvasRef={canvasRef}/>
        <div className="sg-actions"><button className="sg-secondary" onClick={() => setStep((n) => n - 1)}>이전</button><button className="sg-primary" onClick={() => void submit()} disabled={busy}>{busy ? '제출 중…' : '전자서명·제출'}</button></div>
      </>}
    </div>
  </div>;
}
