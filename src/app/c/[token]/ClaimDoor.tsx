'use client';
/**
 * 청구 링크 화면 — 두 단계. ①사업자등록번호 → ②청구 내용 + 답(확인 · 이의).
 *   옷은 관리자와 같은 규격(§14-9): 컨트롤 40 · 주 단추 44 · 라운드 4 · 선은 판뿐 · 하단바 보조 3 : 주 7.
 *   ★여기 오는 값에는 우리 몫 · 반대 축 금액이 애초에 없다(기능 claimViewOf). 고객 이름은 이미 가려서 온다.
 *   PC · 폰 둘 다 본다(공급사 담당자).
 */
import { startTransition, useActionState, useState } from 'react';
import { Exo_2 } from 'next/font/google';
import { openClaimAction, respondClaimAction, type OpenState } from '../actions';

const 레터링 = Exo_2({ weight: ['300', '600'], subsets: ['latin'], display: 'swap' });

type 줄 = {
  code: string; receivedAt?: string; plate?: string; model?: string; customer?: string; deliveredAt?: string;
  product?: string; term?: number; rent?: number; net: number; vat: number; total: number; ratio?: number;
};
type 환수줄 = { plate?: string; at?: string; reason?: string; net: number; vat: number };
type 답 = { state: '확인' | '이의'; at: number; memo?: string };

const 원 = (n: number | undefined | null) => (n === undefined || n === null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`);
const 날 = (t: number | string | undefined) => (t === undefined ? '—' : typeof t === 'number' ? new Date(t + 9 * 3600_000).toISOString().slice(0, 10) : t);

/** 워드마크 — 공식 법인 CI(ci_center fp): 마크 없음 · Exo 2 · 「freepass」 600 #1B2A4A + 「mobility」 300 #7F93B3. 공급사에게는 법인 이름으로 선다 */
function Brand() {
  return <div className={`cl-brand ${레터링.className}`}><b>freepass</b><i>mobility</i></div>;
}

export function ClaimDoor({ token }: { token: string }) {
  const [open, openAct, opening] = useActionState<OpenState, FormData>(openClaimAction, null);
  const [biz, setBiz] = useState('');

  if (!open?.ok) {
    return (
      <main className="cl-main">
        <section className="cl-card cl-door">
          <Brand />
          <h1>청구 내용 확인</h1>
          <p className="cl-muted">받으신 링크의 청구 내용을 보려면 <b>사업자등록번호</b>를 넣어 주세요.</p>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setBiz(String(fd.get('bizNo') ?? '')); startTransition(() => openAct(fd)); }}>
            <input type="hidden" name="token" value={token} />
            <label>사업자등록번호<input name="bizNo" inputMode="numeric" autoComplete="off" placeholder="000-00-00000" required /></label>
            {open && !open.ok && <p className="cl-err">{open.error}</p>}
            <button type="submit" className="cl-primary" disabled={opening}>{opening ? '여는 중…' : '열기'}</button>
          </form>
        </section>
      </main>
    );
  }
  return <ClaimBody token={token} biz={biz} view={open.view} />;
}

function ClaimBody({ token, biz, view }: { token: string; biz: string; view: Extract<OpenState, { ok: true }>['view'] }) {
  const lines = view.lines as 줄[];
  const claws = view.clawbacks as 환수줄[];
  const 문서 = view.axis === '공급사' ? '청구서' : '지급명세';
  const [mode, setMode] = useState<'' | '이의'>('');
  const [res, resAct, sending] = useActionState<{ ok: boolean; error?: string } | null, FormData>(respondClaimAction, null);
  const 받은답: 답 | null = res?.ok ? { state: mode === '이의' ? '이의' : '확인', at: Date.now() } : (view.response as 답 | null);

  return (
    <main className="cl-main">
      <header className="cl-head">
        <Brand />
        <p className="cl-muted">{view.month} {문서} · {view.invoiceNo} · 발행 {날(view.issuedAt)}</p>
        <h1>{view.partyName} 귀하</h1>
      </header>

      <section className="cl-card cl-sum">
        <div><span>공급가</span><b>{원(view.supply)}</b></div>
        <div><span>부가세</span><b>{원(view.vat)}</b></div>
        <div className="cl-total"><span>합계</span><b>{원(view.total)}</b></div>
        {view.clawback ? <p className="cl-muted">환수 −{원(view.clawback)}(공급가)를 뺀 금액입니다.</p> : null}
      </section>

      <form id="cl-respond" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (btn?.name) fd.set(btn.name, btn.value);
        startTransition(() => resAct(fd));
      }}>
        <input type="hidden" name="token" value={token} /><input type="hidden" name="bizNo" value={biz} />
        <h2 className="cl-sub">계약 {lines.length}건</h2>
        <div className="cl-list">
          {lines.map((l) => (
            <label key={l.code} className={`cl-row${mode === '이의' ? ' pick' : ''}`}>
              {mode === '이의' && <input type="checkbox" name="codes" value={l.code} />}
              <span className="cl-row-body">
                <b>{l.plate ?? '—'} · {l.model ?? '—'}</b>
                <small>{l.customer ?? '—'} · 인도 {l.deliveredAt ?? '—'} · {l.product ?? '—'}{l.term ? ` · ${l.term}개월` : ''}{l.rent ? ` · 월 ${원(l.rent)}` : ''}</small>
                {l.ratio !== undefined && l.ratio < 1 && <em className="cl-warn">분납 끊김 · 받은 몫 {Math.round(l.ratio * 100)}%</em>}
              </span>
              <span className="cl-row-amt"><b>{원(l.total)}</b><small>공급가 {원(l.net)} · 부가세 {원(l.vat)}</small></span>
            </label>
          ))}
          {claws.map((c, i) => (
            <div key={`환수-${i}`} className="cl-row minus">
              <span className="cl-row-body"><b>환수 · {c.plate ?? '—'}</b><small>{c.reason ?? '—'} · {c.at ?? '—'}</small></span>
              <span className="cl-row-amt"><b>−{원(c.net + c.vat)}</b><small>공급가 −{원(c.net)} · 부가세 −{원(c.vat)}</small></span>
            </div>
          ))}
        </div>

        {받은답 ? (
          <p className={`cl-answer ${받은답.state === '이의' ? 'warn' : 'ok'}`}>
            {받은답.state === '확인' ? '확인하셨습니다' : '이의를 보내셨습니다'} · {날(받은답.at)}{받은답.memo ? ` — ${받은답.memo}` : ''}
          </p>
        ) : (
          <>
            {mode === '이의' && (
              <label className="cl-memo">이의 내용 *<textarea name="memo" rows={3} required placeholder="어느 줄이 어떻게 다른지 적어 주세요. 줄을 고르지 않으면 전부에 대한 이의로 받습니다." /></label>
            )}
            {res && !res.ok && <p className="cl-err">{res.error}</p>}
            {/* 하단바 — 보조 3 : 주 7(관리자와 같은 규격). 이의를 누르면 바가 [취소] [이의 보내기]로 바뀐다 */}
            <div className="cl-bar">
              {mode === '이의'
                ? <>
                    <button type="button" className="cl-sub-btn" onClick={() => setMode('')}>취소</button>
                    <button type="submit" name="kind" value="이의" className="cl-primary" disabled={sending}>{sending ? '보내는 중…' : '이의 보내기'}</button>
                  </>
                : <>
                    <button type="button" className="cl-sub-btn" onClick={() => setMode('이의')}>이의 있음</button>
                    <button type="submit" name="kind" value="확인" className="cl-primary" disabled={sending}>{sending ? '보내는 중…' : '확인했습니다'}</button>
                  </>}
            </div>
          </>
        )}
      </form>
    </main>
  );
}
