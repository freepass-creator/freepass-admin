import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { writeEnabled, settlements, today } from '../../server/erp5';
import { adminBlockLabel, adminWorkflowPhaseOf, blockOf } from '../../domain/settlement/types';
import { claimAmountOf, payAmountOf } from '../../domain/settlement/ledgers';
import { txt, when, won } from '../_fn/fmt';
import Progress from './[code]/Progress';
import { Tag, 신원 } from '../_design/Badges';
import { ActionBar, EmptyState, Notice, PanelHeader, SummaryGrid, SummaryItem } from '../_design/Primitives';
import { ClawbackForm, FeeForm, MoneyForm } from './MoneyForm';
import { LifeForm, SideStep } from '../settlement/LifeForms';
import { cashRemainingOf, type Axis } from '../../domain/settlement/lifecycle';
import { PaidRounds } from './PaidRounds';
import { billingMonth, nextInstallmentDate, roundsOf, stageOf } from '../../domain/settlement/stage';
import { Sections } from '../_design/Sections';
import { settlementSections } from '../../domain/catalog/sections';
import { progressFormId } from './progress-form-id';
import { intakeNextAction } from './next-action';
import { settlementPrimaryAction } from '../settlement/primary-action';

/** 오른쪽 판 — 접수 상세(진행 체크 · 접수 · 정산 읽기 · 고친 이력). */
export async function IntakeDetailPanel({ code, created, exists, back, newHref, life }: {
  code: string; created?: boolean; exists?: boolean; back: string;
  /** 없으면(정산관리) 하단바는 [목록] 하나 */
  newHref?: string;
  /**
   * 정산관리에서 열 때 — 그 목록의 축(청구 = 공급사 · 지급 = 영업채널)으로 «정산 걸음»을 세우고,
   * 하단바를 그 줄의 다음 걸음으로 바꾼다(§14-3). mode 'correct' = 정정 요청 쓰는 중. link(mode) = 같은 판 주소.
   */
  life?: { axis: Axis; mode: string; link: (mode: string) => string; nextHref?: string; nextGroupHref?: string; invoiceBiz?: string };
}) {
  /* ★하단바 — 접수 상세에서는 [목록] [+ 신규 접수] (대표 2026-09-18 「버튼들이 상황에 맞게 움직여야지」) */
  let 바 = (
    <ActionBar>
      <Link className="dz-bar-sub" href={back}>목록</Link>
      {newHref && <Link className="primary" href={newHref}>+ 신규 접수</Link>}
    </ActionBar>
  );
  const hit = await settlements.get(code);
  if (!hit) {
    return (
      <>
        <PanelHeader title="접수 상세" backHref={back} backLabel="목록으로" />
        <EmptyState>이 접수를 못 찾았습니다 — {code}</EmptyState>
        {바}
      </>
    );
  }
  const { row: r, raw, warnings } = hit;
  const canWrite = writeEnabled();
  const 다음블록 = blockOf(r);
  const 업무흐름 = adminWorkflowPhaseOf(r);
  /* ★청구·지급 «금액»은 한 곳에서 센다 — (수수료 + 프로모션) × 비율 + 가감 (기능 ledgers) */
  const 청구 = claimAmountOf(r);
  const 지급 = payAmountOf(r);
  const 청구월 = billingMonth(r);
  const 다음회차일 = nextInstallmentDate(r);
  const 분납회차 = roundsOf(r.payKind);
  const 실적상태 = stageOf(r);
  const 구역 = settlementSections(raw);

  /* ── 정산 걸음(정산관리에서만) — 두 축 중 이 목록의 축. 주 걸음은 하단바, 곁 걸음은 본문 ── */
  let 걸음: React.ReactNode = null;
  let 막힘안내: React.ReactNode = null;
  if (life) {
    const 청구축 = life.axis === '공급사';
    const stage = 청구축 ? r.claimStage : r.payStage;
    const 길 = 청구축 ? ['접수', '청구', '확인', '계산서', '수금'] : ['접수', '통보', '확인', '지급'];
    const 현재걸음 = 청구축 && stage === '확인'
      ? (r.progress.invoiceIssued ? '수금' : '계산서')
      : stage;
    const 현재순번 = 길.indexOf(현재걸음);
    const fid = `life-${r.id}`;
    const 끝말 = 청구축 ? '수금' : '지급';
    const 누적현금 = 청구축 ? (r.progress.collectedAmt ?? 0) : (r.progress.paidAmt ?? 0);
    const 남은현금 = cashRemainingOf(life.axis, r);
    const 정정중 = life.mode === 'correct' && stage !== '접수';
    const primary = settlementPrimaryAction(r, life.axis);
    let 주: { label: string; form: React.ReactNode } | null = null;
    let 보조: React.ReactNode = <Link className="dz-bar-sub" href={back}>목록</Link>;
    if (정정중) {
      주 = { label: '정정 저장', form: <LifeForm id={fid} code={r.id} kind="correct" axis={life.axis} need="correct" disabled={!canWrite} /> };
      보조 = <Link className="dz-bar-sub" href={life.link('')}>취소</Link>;
    } else if (primary === 'confirm') {
      주 = { label: `${life.axis} 확인`, form: <LifeForm id={fid} code={r.id} kind="confirm" axis={life.axis} need="none" disabled={!canWrite} /> };
      보조 = <Link className="dz-bar-sub" href={life.link('correct')}>정정 요청</Link>;
    } else if (primary === 'uncorrect') {
      주 = { label: '정정 풂', form: <LifeForm id={fid} code={r.id} kind="uncorrect" axis={life.axis} need="none" disabled={!canWrite} /> };
    } else if (primary === 'invoice') {
      주 = {
        label: '계산서 끊기',
        form: <SideStep id={fid} code={r.id} kind="invoice" label="계산서" on={false} day={today()} biz={life.invoiceBiz} externalSubmit disabled={!canWrite} />,
      };
      보조 = <Link className="dz-bar-sub" href={life.link('correct')}>정정 요청</Link>;
    } else if (primary === 'cash') {
      주 = {
        label: 누적현금 > 0 ? `${끝말} 추가` : `${끝말} 찍기`,
        form: <LifeForm id={fid} code={r.id} kind={청구축 ? 'collected' : 'paid'} axis={life.axis} need="money"
          amount={남은현금 ?? 0} day={today()} operationId={randomUUID()} disabled={!canWrite} />,
      };
      보조 = <Link className="dz-bar-sub" href={life.link('correct')}>정정 요청</Link>;
    }
    걸음 = (
      <>
        <h3 className="dz-sub">정산 걸음 · {life.axis}</h3>
        {/* 걸음 길 — 지금 자리는 남색 면, 정정은 붉은 면(곁길) */}
        <ol className="dz-path">
          {길.map((x) => <li key={x} className={x === 현재걸음 ? 'on' : 현재순번 >= 0 && 길.indexOf(x) < 현재순번 ? 'done' : ''}>{x}</li>)}
          {stage === '정정' && <li className="warn">정정</li>}
        </ol>
        {stage === '접수' && <EmptyState>{청구축 ? '청구서' : '지급명세'}는 가운데 판(묶음) 하단바에서 냅니다 — 나가면 여기 다음 걸음이 섭니다.</EmptyState>}
        {(stage === '수금' || stage === '지급') && <Notice tone="ok">{끝말}까지 끝난 줄입니다.</Notice>}
        {stage === '확인' && 누적현금 > 0 && 남은현금 !== null && <Notice tone="warn">부분{끝말} {won(누적현금)}원 처리 · 남은 금액 {won(남은현금)}원</Notice>}
        {주?.form}
        <div className="dz-side-steps">
          {청구축 && !r.progress.billed && <SideStep code={r.id} kind="hold" label={r.progress.billHold ? '청구 보류 중' : '청구 보류'} on={r.progress.billHold} disabled={!canWrite} />}
          {!r.progress.billed && r.progress.delivered && <SideStep code={r.id} kind="billMonth" label="청구월" month={r.progress.billMonth ?? today().slice(0, 7)} disabled={!canWrite} />}
          {청구축 && r.progress.billed && primary !== 'invoice' && <SideStep code={r.id} kind="invoice" label={r.progress.invoiceIssued ? '계산서 끊음' : '계산서'} on={r.progress.invoiceIssued} day={today()} biz={life.invoiceBiz} disabled={!canWrite} />}
        </div>
      </>
    );
    const 완료 = primary === 'done';
    바 = (
      <ActionBar>
        {보조}
        {주 && <button type="submit" form={fid} className="primary" disabled={!canWrite}
          aria-describedby={!canWrite ? 'write-disabled-reason' : undefined}>{주.label}</button>}
        {!주 && 완료 && life.nextHref && <Link className="primary" href={life.nextHref}>다음 할 일</Link>}
        {!주 && 완료 && !life.nextHref && life.nextGroupHref && <Link className="primary" href={life.nextGroupHref}>다음 거래처</Link>}
      </ActionBar>
    );
  }
  if (!life && newHref) {
    const nextAction = intakeNextAction(다음블록, r.progress.cancelled, r.progress.delivered);
    let 주액션: React.ReactNode;
    if (nextAction.kind === 'new') {
      주액션 = <Link className="primary" href={newHref}>+ 신규 접수</Link>;
    } else if (nextAction.kind === 'paper') {
      주액션 = <button type="submit" form={progressFormId(r.id, 'paper')} name="on" value="1" className="primary"
        disabled={!canWrite} aria-describedby={!canWrite ? 'write-disabled-reason' : undefined}>계약서 받음</button>;
    } else if (nextAction.kind === 'plate') {
      주액션 = <button type="submit" form={progressFormId(r.id, 'plate')} className="primary"
        disabled={!canWrite} aria-describedby={!canWrite ? 'write-disabled-reason' : undefined}>차량번호 저장</button>;
    } else if (nextAction.kind === 'delivered') {
      주액션 = <button type="submit" form={progressFormId(r.id, 'delivered')} name="on" value="1" className="primary"
        disabled={!canWrite} aria-describedby={!canWrite ? 'write-disabled-reason' : undefined}>인도 완료</button>;
    } else if (nextAction.kind === 'settlement') {
      주액션 = <Link className="primary" href={`/settlement?tab=${nextAction.tab}&focus=${encodeURIComponent(r.id)}`}>정산관리</Link>;
    } else {
      막힘안내 = <Notice tone="warn">현재 「{nextAction.label}」 문제를 먼저 해결해야 다음 단계로 진행할 수 있습니다.</Notice>;
      주액션 = <button type="button" className="primary" disabled aria-describedby="intake-block-reason">다음 · {nextAction.label}</button>;
    }
    바 = (
      <ActionBar>
        <Link className="dz-bar-sub" href={back}>목록</Link>
        {주액션}
      </ActionBar>
    );
  }

  const events = await settlements.events(
    r.plate, r.receivedAt, r.catalogRef?.productId, raw.intakeRequestId, raw.intakeIdentityMode,
  );
  const 다음 = 다음블록 ? adminBlockLabel(다음블록) : (r.progress.cancelled ? '취소됨' : '끝');
  return (
    <>
      {/* 폰 — 목록(intake) 또는 실적(settlement)으로 뒤로. back 은 부르는 쪽이 정한다 */}
      <PanelHeader title="접수 상세" backHref={back} backLabel="목록으로" />
      {created && <Notice tone="ok">새 접수를 저장했습니다.</Notice>}
      {exists && <Notice tone="warn">같은 차량번호 + 접수일이 원장에 이미 있어 새로 만들지 않았습니다. 있던 줄입니다.</Notice>}
      <div className="vehicle-title">
        <div><h2>{txt(r.customer)}</h2><p>{txt(r.plate)} · {txt(r.model)} · 접수 {txt(r.receivedAt)}</p><p className="dz-note">업무 흐름 · {업무흐름}</p></div>
        <Tag {...신원(다음 === '끝' || 다음 === '취소됨' ? 다음 : '다음')} tone={다음 === '끝' || 다음 === '취소됨' ? 'plain' : 'act'}>{다음 === '끝' || 다음 === '취소됨' ? 다음 : `다음 · ${다음}`}</Tag>
      </div>

      <section className="dz-work-focus" aria-label="현재 업무">
        <span>현재 업무</span>
        <strong>{life ? `${life.axis} 정산` : (다음 === '끝' || 다음 === '취소됨' ? 다음 : 다음)}</strong>
        <small>{life ? '정산 단계와 다음 실행을 확인합니다.' : (다음 === '끝' ? '접수 진행이 끝났습니다.' : 다음 === '취소됨' ? '취소된 접수입니다.' : `다음 실행 · ${다음}`)}</small>
      </section>

      {/* 정산관리에서 열면 «정산 걸음»이 맨 위 — 이 판에서 하는 일이 그것이다 */}
      {걸음}

      <h3 className="dz-sub">접수 정보</h3>
      <SummaryGrid>
        <SummaryItem label="고객">{txt(r.customer)}</SummaryItem>
        <SummaryItem label="차량">{r.plate ? `${txt(r.model)} · ${txt(r.plate)}` : txt(r.model)}</SummaryItem>
        <SummaryItem label="공급사">{txt(r.supplier)}</SummaryItem>
        <SummaryItem label="영업채널">{txt(r.channel)}</SummaryItem>
        <SummaryItem label="영업담당자">{txt(r.agent)}</SummaryItem>
        <SummaryItem label="현재 업무">{업무흐름}</SummaryItem>
      </SummaryGrid>

      <h3 className="dz-sub">계약 · 실적 기준</h3>
      <SummaryGrid>
        <SummaryItem label="분납여부">{txt(r.payKind)}</SummaryItem>
        <SummaryItem label="계약서">{r.progress.paper ? '완료' : '미완료'}</SummaryItem>
        <SummaryItem label="인도완료">{r.progress.delivered ? '완료' : '대기'}</SummaryItem>
        <SummaryItem label="인도일">{txt(r.progress.deliveredAt)}</SummaryItem>
        <SummaryItem label="납입회차">{분납회차 >= 2 ? (r.paidRounds ? `${r.paidRounds}/${분납회차}` : r.progress.delivered ? `1/${분납회차} (인도 시 1회차)` : `0/${분납회차}`) : '해당 없음'}</SummaryItem>
        <SummaryItem label="다음회차일">{다음회차일 ?? (분납회차 >= 2 ? '완납/미정' : '해당 없음')}</SummaryItem>
        <SummaryItem label="청구월">{청구월 ?? '인도 후 계산'}</SummaryItem>
        <SummaryItem label="실적 상태">{실적상태}</SummaryItem>
        <SummaryItem label="청구 상태">{r.claimStage}</SummaryItem>
        <SummaryItem label="지급 상태">{r.payStage}</SummaryItem>
      </SummaryGrid>

      <h3 className="dz-sub">진행</h3>
      {!canWrite && <div id="write-disabled-reason"><Notice tone="warn">현재 조회 전용이라 변경사항을 저장할 수 없습니다.</Notice></div>}
      <Progress code={r.id} plate={r.plate ?? ''} paper={r.progress.paper} delivered={r.progress.delivered}
        deliveredAt={r.progress.deliveredAt ?? ''} cancelled={r.progress.cancelled} today={today()} disabled={!canWrite} />
      {/* 받은 회차 — 분납 · 인도된 줄에서만(기능 세션 2026-09-18) */}
      {roundsOf(r.payKind) >= 2 && r.progress.delivered && (
        <PaidRounds code={r.id} rounds={roundsOf(r.payKind)} paid={r.paidRounds} disabled={r.progress.cancelled || !canWrite} />
      )}

      {warnings.length > 0 && <section className="dz-attention">
        <h3 className="dz-sub">확인 필요</h3>
        <ul className="dz-list-plain">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      </section>}

      {/* 돈 — 한 곳에서 센 금액((수수료 + 프로모션) × 비율 + 가감). 나머지 원자는 아래 «성격별 구역» 이 다 싣는다 */}
      <h3 className="dz-sub">핵심 금액</h3>
      <SummaryGrid>
        <SummaryItem label="청구금액">{won(청구)}</SummaryItem>
        <SummaryItem label="지급액">{won(지급)}</SummaryItem>
        <SummaryItem label="남는 것">{청구 === null ? '—' : won(청구 - (지급 ?? 0))}</SummaryItem>
        <SummaryItem label="청구월">{청구월 ?? '—'}</SummaryItem>
        <SummaryItem label="셈 근거">{txt(r.settleNote)}</SummaryItem>
        <SummaryItem label="청구 · 지급 단계">{r.claimStage} · {r.payStage}</SummaryItem>
      </SummaryGrid>

      {/* ★정산 진행 — 늘 보일 칸(pinned · 기능 쪽이 정함): 청구 축 · 지급 축의 발자국과 정정요청(«멈춘 자리»).
            「상태」 구역이 접혀도 이 칸들은 여기 선다 — 숨으면 멈춘 줄을 아무도 못 찾는다(기능 세션 2026-09-18). */}
      <Sections sections={[{ key: '진행', title: '정산 진행', hint: '청구: 접수 → 청구 → 확인 → 수금 · 지급: 접수 → 통보 → 확인 → 지급',
        items: 구역.flatMap((x) => x.items.filter((it) => it.pinned)) }]} />

      {/* 돈 고치기 — 수수료 · 프로모션 · 가감(하는 일은 기능 쪽 feeAction · moneyAction) */}
      <h3 className="dz-sub">금액 조정 — 수수료 · 프로모션 · 가감</h3>
      <FeeForm code={r.id} claim={r.money.claim} pay={r.money.pay} disabled={r.progress.cancelled || !canWrite} />
      <MoneyForm code={r.id}
        promoAmount={r.money.claimIncentive} promoSharePct={r.money.promoShare === null ? null : Math.round(r.money.promoShare * 100)}
        promoReason={r.money.promoReason} claimAdjust={r.money.claimAdjust} payAdjust={r.money.payAdjust}
        adjustReason={r.money.adjustReason} disabled={r.progress.cancelled || !canWrite} />
      {/* 환수 — 인도된 줄(완납 · 분납실적)에서만 연다 */}
      {!r.progress.cancelled && r.progress.delivered && <ClawbackForm code={r.id} today={today()} disabled={!canWrite} />}

      <details className="dz-support-section">
        <summary>세부 원자 · 진단</summary>
        <p>정체 · 상대 · 조건 · 요율 · 날짜 · 정산축 · 상태 · 출처 원문을 확인합니다.</p>
        <Sections sections={구역} />
      </details>

      <details className="dz-support-section">
        <summary>변경 이력 <small>{events.length}</small></summary>
        {events.length === 0 ? <EmptyState>남은 이력이 없습니다.</EmptyState> : (
          <div className="list">
            {events.map((e, i) => (
              <div key={i} className="dz-event">
                <b>{e.field}</b><span>{txt(e.from)} → {txt(e.to)}</span><small>{when(e.at)}</small>
              </div>
            ))}
          </div>
        )}
      </details>
      {막힘안내 ? <div id="intake-block-reason">{막힘안내}</div> : null}
      {바}
    </>
  );
}
