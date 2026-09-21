import Link from 'next/link';
import { settlements, today } from '../../server/erp5';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import { blockOf } from '../../domain/settlement/types';
import { claimAmountOf, payAmountOf } from '../../domain/settlement/ledgers';
import { txt, when, won } from '../_fn/fmt';
import Progress from './[code]/Progress';
import { Tag, 신원 } from '../_design/Badges';
import { ActionBar, EmptyState, Notice, PanelHeader, SummaryGrid, SummaryItem } from '../_design/Primitives';
import { ClawbackForm, FeeForm, MoneyForm } from './MoneyForm';
import { LifeForm, SideStep } from '../settlement/LifeForms';
import { invoiceMoneyOf, type Axis } from '../../domain/settlement/lifecycle';
import { PaidRounds } from './PaidRounds';
import { roundsOf } from '../../domain/settlement/stage';
import { Sections } from '../_design/Sections';
import { settlementSections } from '../../domain/catalog/sections';

/** 오른쪽 판 — 접수 상세(진행 체크 · 접수 · 정산 읽기 · 고친 이력). */
export async function IntakeDetailPanel({ code, created, exists, back, newHref, life }: {
  code: string; created?: boolean; exists?: boolean; back: string;
  /** 없으면(정산관리) 하단바는 [목록] 하나 */
  newHref?: string;
  /**
   * 정산관리에서 열 때 — 그 목록의 축(청구 = 공급사 · 지급 = 영업채널)으로 «정산 걸음»을 세우고,
   * 하단바를 그 줄의 다음 걸음으로 바꾼다(§14-3). mode 'correct' = 정정 요청 쓰는 중. link(mode) = 같은 판 주소.
   */
  life?: { axis: Axis; mode: string; link: (mode: string) => string };
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
  /* ★청구·지급 «금액»은 한 곳에서 센다 — (수수료 + 프로모션) × 비율 + 가감 (기능 ledgers) */
  const 청구 = claimAmountOf(r);
  const 지급 = payAmountOf(r);
  const 구역 = settlementSections(raw);

  /* ── 정산 걸음(정산관리에서만) — 두 축 중 이 목록의 축. 주 걸음은 하단바, 곁 걸음은 본문 ── */
  let 걸음: React.ReactNode = null;
  if (life) {
    const 청구축 = life.axis === '공급사';
    const stage = 청구축 ? r.claimStage : r.payStage;
    const 길 = 청구축 ? ['접수', '청구', '확인', '수금'] : ['접수', '통보', '확인', '지급'];
    const fid = `life-${r.id}`;
    const 끝말 = 청구축 ? '수금' : '지급';
    const 정정중 = life.mode === 'correct' && stage !== '접수';
    let 주: { label: string; form: React.ReactNode } | null = null;
    let 보조: React.ReactNode = <Link className="dz-bar-sub" href={back}>목록</Link>;
    if (정정중) {
      주 = { label: '정정 저장', form: <LifeForm id={fid} code={r.id} kind="correct" axis={life.axis} need="correct" /> };
      보조 = <Link className="dz-bar-sub" href={life.link('')}>취소</Link>;
    } else if (stage === '청구' || stage === '통보') {
      주 = { label: `${life.axis} 확인`, form: <LifeForm id={fid} code={r.id} kind="confirm" axis={life.axis} need="none" /> };
      보조 = <Link className="dz-bar-sub" href={life.link('correct')}>정정 요청</Link>;
    } else if (stage === '정정') {
      주 = { label: '정정 풂', form: <LifeForm id={fid} code={r.id} kind="uncorrect" axis={life.axis} need="none" /> };
    } else if (stage === '확인') {
      주 = {
        label: `${끝말} 찍기`,
        form: <LifeForm id={fid} code={r.id} kind={청구축 ? 'collected' : 'paid'} axis={life.axis} need="money"
          /* ★기본값 = 통장에 오가는 돈 = 계산서 합계(부가세 포함). claimAmountOf/payAmountOf 는 공급가라 그대로 두면 매번 고쳐야 했다(기능 세션) */
          amount={invoiceMoneyOf((청구축 ? 청구 : 지급) ?? 0, r.money.vatIncluded).total} day={today()} />,
      };
      보조 = <Link className="dz-bar-sub" href={life.link('correct')}>정정 요청</Link>;
    }
    걸음 = (
      <>
        <h3 className="dz-sub">정산 걸음 · {life.axis}</h3>
        {/* 걸음 길 — 지금 자리는 남색 면, 정정은 붉은 면(곁길) */}
        <ol className="dz-path">
          {길.map((x) => <li key={x} className={x === stage ? 'on' : 길.indexOf(x) < 길.indexOf(stage) ? 'done' : ''}>{x}</li>)}
          {stage === '정정' && <li className="warn">정정</li>}
        </ol>
        {stage === '접수' && <EmptyState>{청구축 ? '청구서' : '지급명세'}는 가운데 판(묶음) 하단바에서 냅니다 — 나가면 여기 다음 걸음이 섭니다.</EmptyState>}
        {(stage === '수금' || stage === '지급') && <Notice tone="ok">{끝말}까지 끝난 줄입니다.</Notice>}
        {주?.form}
        <div className="dz-side-steps">
          {청구축 && !r.progress.billed && <SideStep code={r.id} kind="hold" label={r.progress.billHold ? '청구 보류 중' : '청구 보류'} on={r.progress.billHold} />}
          {!r.progress.billed && r.progress.delivered && <SideStep code={r.id} kind="billMonth" label="청구월" month={r.progress.billMonth ?? today().slice(0, 7)} />}
          {청구축 && r.progress.billed && <SideStep code={r.id} kind="invoice" label={r.progress.invoiceIssued ? '계산서 끊음' : '계산서'} on={r.progress.invoiceIssued} day={today()} />}
        </div>
      </>
    );
    바 = (
      <ActionBar>
        {보조}
        {주 && <button type="submit" form={fid} className="primary">{주.label}</button>}
      </ActionBar>
    );
  }
  const events = await settlements.events(r.plate, r.receivedAt, r.catalogRef?.productId);
  const 다음 = blockOf(r) ?? (r.progress.cancelled ? '취소됨' : '끝');
  return (
    <>
      {/* 폰 — 목록(intake) 또는 실적(settlement)으로 뒤로. back 은 부르는 쪽이 정한다 */}
      <PanelHeader title="접수 상세" backHref={back} backLabel="목록으로" />
      {created && <Notice tone="ok">ERP5 에 새 접수를 세웠습니다.</Notice>}
      {exists && <Notice tone="warn">같은 차량번호 + 접수일이 원장에 이미 있어 새로 만들지 않았습니다. 있던 줄입니다.</Notice>}
      <div className="vehicle-title">
        <div><h2>{txt(r.customer)}</h2><p>{txt(r.plate)} · {txt(r.model)} · 접수 {txt(r.receivedAt)}</p></div>
        <Tag {...신원(다음 === '끝' || 다음 === '취소됨' ? 다음 : '다음')} tone={다음 === '끝' || 다음 === '취소됨' ? 'plain' : 'act'}>{다음 === '끝' || 다음 === '취소됨' ? 다음 : `다음 · ${다음}`}</Tag>
      </div>

      {/* 정산관리에서 열면 «정산 걸음»이 맨 위 — 이 판에서 하는 일이 그것이다 */}
      {걸음}

      <h3 className="dz-sub">진행</h3>
      {!writeEnabled() && <Notice tone="warn">ERP5 쓰기가 꺼져 있어 눌러도 저장되지 않습니다.</Notice>}
      <Progress code={r.id} plate={r.plate ?? ''} paper={r.progress.paper} delivered={r.progress.delivered}
        deliveredAt={r.progress.deliveredAt ?? ''} cancelled={r.progress.cancelled} today={today()} />
      {/* 받은 회차 — 분납 · 인도된 줄에서만(기능 세션 2026-09-18) */}
      {roundsOf(r.payKind) >= 2 && r.progress.delivered && (
        <PaidRounds code={r.id} rounds={roundsOf(r.payKind)} paid={r.paidRounds} disabled={r.progress.cancelled} />
      )}

      {/* 돈 — 한 곳에서 센 금액((수수료 + 프로모션) × 비율 + 가감). 나머지 원자는 아래 «성격별 구역» 이 다 싣는다 */}
      <h3 className="dz-sub">금액</h3>
      <SummaryGrid>
        <SummaryItem label="청구금액">{won(청구)}</SummaryItem>
        <SummaryItem label="지급액">{won(지급)}</SummaryItem>
        <SummaryItem label="남는 것">{청구 === null ? '—' : won(청구 - (지급 ?? 0))}</SummaryItem>
        <SummaryItem label="청구월">{txt(r.progress.billMonth)}</SummaryItem>
        <SummaryItem label="셈 근거">{txt(r.settleNote)}</SummaryItem>
        <SummaryItem label="청구 · 지급 단계">{r.claimStage} · {r.payStage}</SummaryItem>
      </SummaryGrid>

      {/* ★정산 진행 — 늘 보일 칸(pinned · 기능 쪽이 정함): 청구 축 · 지급 축의 발자국과 정정요청(«멈춘 자리»).
            「상태」 구역이 접혀도 이 칸들은 여기 선다 — 숨으면 멈춘 줄을 아무도 못 찾는다(기능 세션 2026-09-18). */}
      <Sections sections={[{ key: '진행', title: '정산 진행', hint: '청구: 접수 → 청구 → 확인 → 수금 · 지급: 접수 → 통보 → 확인 → 지급',
        items: 구역.flatMap((x) => x.items.filter((it) => it.pinned)) }]} />

      {/* 돈 고치기 — 수수료 · 프로모션 · 가감(하는 일은 기능 쪽 feeAction · moneyAction) */}
      <h3 className="dz-sub">돈 고치기 — 수수료 · 프로모션 · 가감</h3>
      <FeeForm code={r.id} claim={r.money.claim} pay={r.money.pay} disabled={r.progress.cancelled} />
      {!writeEnabled() && <Notice tone="warn">ERP5 쓰기가 꺼져 있어 저장되지 않습니다.</Notice>}
      <MoneyForm code={r.id}
        promoAmount={r.money.claimIncentive} promoSharePct={r.money.promoShare === null ? null : Math.round(r.money.promoShare * 100)}
        promoReason={r.money.promoReason} claimAdjust={r.money.claimAdjust} payAdjust={r.money.payAdjust}
        adjustReason={r.money.adjustReason} disabled={r.progress.cancelled} />
      {/* ★정산 줄 원자 전부 — erp4 settlement-atom 묶음 그대로(정체 · 상대 · 조건 · 요율·돈 · 날 · 정산 축 · 상태 · 이월 · 출처) */}
      <h3 className="dz-sub">원자 전부</h3>
      <Sections sections={구역} />
      {/* 환수 — 인도된 줄(완납 · 분납실적)에서만 연다 */}
      {!r.progress.cancelled && r.progress.delivered && <ClawbackForm code={r.id} today={today()} />}
      {warnings.length > 0 && <><h3 className="dz-sub">살필 것</h3><ul className="dz-list-plain">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></>}

      <h3 className="dz-sub">고친 이력 {events.length}</h3>
      {events.length === 0 ? <EmptyState>남은 이력이 없습니다.</EmptyState> : (
        <div className="list">
          {events.map((e, i) => (
            <div key={i} className="dz-event">
              <b>{e.field}</b><span>{txt(e.from)} → {txt(e.to)}</span><small>{when(e.at)}</small>
            </div>
          ))}
        </div>
      )}
      {바}
    </>
  );
}
