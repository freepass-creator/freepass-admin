'use client';
/**
 * 고른 접수 하나의 처리 판. ★기존 저장 경로가 있는 것만 고칠 수 있다:
 *   계약서 · 차량번호 · 인도/인도일 · 취소 → progressAction
 *   청구월 → lifecycleAction(billMonth)
 *   청구액 · 지급액 → feeAction (사유 필수 — 감사 이력에 남는다)
 * 나머지(고객·공급사·조건 …)는 아직 고치는 경로가 없어 보기만 한다. 가짜로 고친 척하지 않는다.
 */
import { useState } from 'react';
import { feeAction, lifecycleAction, progressAction } from '../intake/actions';
import { parseWon, STEPS, stepsOf, toneOf, won, type LedgerRow } from './model';
import type { Run } from './LedgerBoard';

export function DetailPanel({ row: r, canWrite, today, run, onClose, onNew }: {
  row: LedgerRow; canWrite: boolean; today: string; run: Run; onClose: () => void; onNew: () => void;
}) {
  const who = r.plate || r.customer || '접수';
  const off = !canWrite || r.cancelled;
  const [plate, setPlate] = useState(r.plate);
  const [deliveredAt, setDeliveredAt] = useState(r.deliveredAt || today);
  const [month, setMonth] = useState(r.billMonth || r.expectedMonth);
  const [claim, setClaim] = useState(won(r.claim));
  const [pay, setPay] = useState(won(r.pay));
  const [feeReason, setFeeReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [askCancel, setAskCancel] = useState(false);
  const [moneyError, setMoneyError] = useState('');

  const progress = (label: string, fields: Record<string, string>) => run(`${who} ${label}`, progressAction, { code: r.code, ...fields });

  async function saveMoney() {
    const c = parseWon(claim), p = parseWon(pay);
    if (Number.isNaN(c) || Number.isNaN(p)) { setMoneyError('숫자만 넣어 주세요'); return; }
    const fields: Record<string, string> = { code: r.code, feeReason: feeReason.trim() };
    if (c !== null && c !== r.claim) fields.feeClaim = String(c);
    if (p !== null && p !== r.pay) fields.feePay = String(p);
    if (!fields.feeClaim && !fields.feePay) { setMoneyError('바뀐 금액이 없습니다'); return; }
    if (!fields.feeReason) { setMoneyError('고치는 사유를 넣어 주세요 — 변경 이력에 남습니다'); return; }
    setMoneyError('');
    if (await run(`${who} 금액`, feeAction, fields)) setFeeReason('');
  }

  async function cancel() {
    if (!cancelReason.trim()) return;
    if (await progress(r.cancelled ? '취소 해제' : '취소', { kind: 'cancelled', on: r.cancelled ? '0' : '1', reason: cancelReason.trim() })) {
      setAskCancel(false); setCancelReason('');
    }
  }

  const steps = stepsOf(r);
  const tone = toneOf(r);
  const moneyDirty = claim !== won(r.claim) || pay !== won(r.pay);

  return (
    <div className="ledger-pane">
      <header className="ledger-pane-head">
        <div>
          <h2>{r.customer || '고객 미정'} <span>{r.plate || '차번 미정'}</span></h2>
          <p>{[r.model, r.supplier, r.receivedAt].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="ledger-close" onClick={onClose} aria-label="닫기">✕</button>
      </header>

      <div className="ledger-pane-body">
        <div className="ledger-state">
          <span className={`ledger-badge tone-${tone}`}>{r.cancelled ? '취소된 접수' : r.block ? `다음: ${r.block}` : '완료'}</span>
          <span className="ledger-steps big">{steps.map((s, i) => <i key={i} className={`step-${s}`}>{STEPS[i]}</i>)}</span>
        </div>

        <section className="ledger-sec">
          <h3>진행</h3>
          <div className="ledger-line">
            <label className="ledger-tick"><input type="checkbox" checked={r.paper} disabled={off}
              onChange={(e) => void progress('계약서', { kind: 'paper', on: e.target.checked ? '1' : '0' })} />계약서 받음</label>
          </div>
          <div className="ledger-line">
            <span className="ledger-lbl">차량번호</span>
            <input className="ledger-input" value={plate} onChange={(e) => setPlate(e.target.value)} disabled={off} placeholder="예: 12가3456" />
            <button type="button" className="ledger-btn" disabled={off || plate.trim() === r.plate}
              onClick={() => void progress('차량번호', { kind: 'plate', plate: plate.trim() })}>저장</button>
          </div>
          <div className="ledger-line">
            <label className="ledger-tick"><input type="checkbox" checked={r.delivered} disabled={off}
              onChange={(e) => void progress('인도', { kind: 'delivered', on: e.target.checked ? '1' : '0', deliveredAt })} />인도 완료</label>
            <input className="ledger-input" type="date" value={deliveredAt} max={today} onChange={(e) => setDeliveredAt(e.target.value)} disabled={off} aria-label="인도일" />
            {r.delivered && <button type="button" className="ledger-btn" disabled={off || !deliveredAt || deliveredAt === r.deliveredAt}
              onClick={() => void progress('인도일', { kind: 'delivered', on: '1', deliveredAt })}>날짜 저장</button>}
          </div>
          <div className="ledger-line">
            <span className="ledger-lbl">청구월</span>
            <input className="ledger-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={off || !r.delivered} aria-label="청구월" />
            <button type="button" className="ledger-btn" disabled={off || !r.delivered || !month || month === r.billMonth}
              onClick={() => void run(`${who} 청구월`, lifecycleAction, { code: r.code, kind: 'billMonth', month })}>저장</button>
          </div>
          {!r.delivered && !r.cancelled && <p className="ledger-hint">청구월은 인도 완료 뒤에 정합니다.</p>}
        </section>

        <section className="ledger-sec">
          <h3>금액 <small>공급가액 · 부가세 별도</small></h3>
          <div className="ledger-money">
            <label><span>청구액 (공급사에서 받을 돈)</span>
              <input className="ledger-input num" inputMode="numeric" value={claim} onChange={(e) => setClaim(e.target.value)} disabled={off} placeholder="미확정" /></label>
            <label><span>지급액 (영업채널에 줄 돈)</span>
              <input className="ledger-input num" inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} disabled={off} placeholder="미확정" /></label>
          </div>
          {moneyDirty && <div className="ledger-line">
            <input className="ledger-input" value={feeReason} onChange={(e) => setFeeReason(e.target.value)} disabled={off} placeholder="고치는 사유 (필수)" aria-label="금액 수정 사유" />
            <button type="button" className="ledger-btn primary" disabled={off} onClick={() => void saveMoney()}>금액 저장</button>
          </div>}
          {moneyError && <p className="ledger-hint err" role="alert">{moneyError}</p>}
        </section>

        <section className="ledger-sec">
          <h3>접수 내용</h3>
          <dl className="ledger-facts">
            <div><dt>접수일</dt><dd>{r.receivedAt}</dd></div>
            <div><dt>상품구분</dt><dd>{r.product || '—'}</dd></div>
            <div><dt>공급사</dt><dd>{r.supplier || '—'}</dd></div>
            <div><dt>모델</dt><dd>{r.model || '—'}</dd></div>
            <div><dt>계약기간</dt><dd>{r.term ? `${r.term}개월` : '—'}</dd></div>
            <div><dt>렌탈료</dt><dd>{won(r.rent) || '—'}</dd></div>
            <div><dt>보증금</dt><dd>{won(r.deposit) || '—'}</dd></div>
            <div><dt>차량가액</dt><dd>{won(r.price) || '—'}</dd></div>
            <div><dt>분납</dt><dd>{r.payKind || '—'}</dd></div>
            <div><dt>영업채널</dt><dd>{r.channel || '—'}</dd></div>
            <div><dt>담당자</dt><dd>{r.agent || '—'}</dd></div>
            <div className="wide"><dt>메모</dt><dd>{r.note || '—'}</dd></div>
          </dl>
        </section>
      </div>

      <footer className="ledger-pane-foot">
        {askCancel ? (
          <>
            <input className="ledger-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus
              placeholder={r.cancelled ? '취소를 푸는 사유 (필수)' : '취소 사유 (필수)'} aria-label="취소 사유" />
            <button type="button" className="ledger-btn danger" disabled={!canWrite || !cancelReason.trim()} onClick={() => void cancel()}>{r.cancelled ? '취소 해제' : '취소 확정'}</button>
            <button type="button" className="ledger-btn" onClick={() => setAskCancel(false)}>그만두기</button>
          </>
        ) : (
          <>
            {/* 취소 기준(FUNCTION-AUTHORITY): 인도 후에는 접수취소가 아니라 계약해지+환수 검토 — 버튼 대신 길을 알려 준다 */}
            {r.delivered && !r.cancelled
              ? <span className="ledger-hint">인도된 건은 취소 대신 정산관리에서 계약해지로 처리합니다</span>
              : <button type="button" className="ledger-btn ghost-danger" disabled={!canWrite} onClick={() => setAskCancel(true)}>{r.cancelled ? '취소 해제…' : '접수 취소…'}</button>}
            <button type="button" className="ledger-btn primary" onClick={onNew}>+ 새 접수</button>
          </>
        )}
      </footer>
    </div>
  );
}
