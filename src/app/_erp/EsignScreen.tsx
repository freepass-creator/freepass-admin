/**
 * PC 전자계약 — 판 둘: 전자계약목록 | 전자계약상세 (§5-4, 대표 2026-09-24 「최종 확정된 규격 말고
 *   페이지 전체 나오거나 했던 것들 … 없애야지」) — §4 PageHeader·두 칸 카드 골격·CardHead·Props 를 걷어내고
 *   계약접수 · 정산관리와 같은 erp-panel 로 다시 짰다. ★업무 흐름(상품 · 접수 · 실적 · 정산)과 따로
 *   다루는 문이다(대표 2026-09-23) — 메뉴에서도 떼어 두었다. 입력 판은 없다 — 전자계약은 erp4/서명
 *   흐름이 만들고 관리자가 새로 작성하지 않는다.
 *   데이터는 기능 쪽 그대로(contracts.list). 서명창 · 서명본은 ERP5 가 준 주소를 새 창으로 연다.
 */
import type { ReactNode } from 'react';
import { contracts } from '../../server/erp5';
import { sp, txt, when } from '../_fn/fmt';
import {
  Badge, hrefWith, Panel, PanelBody, PanelFoot, PanelHead, QuickFilter, RowCard, RowCards, Screen, SearchBar, Steps, manWon, won0, type Facet, type Tone,
} from './parts';
import { AutoSelect } from './AutoSelect';

type Q = Record<string, string | string[] | undefined>;
type 계약 = Awaited<ReturnType<typeof contracts.list>>[number];
const SIGN = ['발행', '열람', '진행중', '서명완료'] as const;
const SIGN_TONE: Record<string, Tone> = { 발행: 'info', 열람: 'warn', 진행중: 'info', 서명완료: 'ok' };
const STATUS_TONE: Record<string, Tone> = { 계약요청: 'info', 계약대기: 'warn', 계약발송: 'warn', 계약완료: 'ok', 계약취소: 'err', 계약철회: 'err' };
const signOf = (c: 계약) => c.signStatus || '미연결';
/** 목록 카드 썸네일 — §5-4 규격대로 상태 아이콘 + 짧은 두 글자(다른 목록과 같은 결). */
const SIGN_SHORT: Record<string, string> = { 발행: '발행', 열람: '열람', 진행중: '진행', 서명완료: '완료', 미연결: '미연' };
const SIGN_ICON_PATH: Record<string, ReactNode> = {
  발행: <><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></>,
  열람: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  진행중: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  서명완료: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  미연결: <><circle cx="12" cy="12" r="10" /><path d="M9 15l6-6" /></>,
};
function SignIcon({ s }: { s: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{SIGN_ICON_PATH[s]}</svg>;
}

export async function EsignScreen({ q, base = '/esign' }: { q: Q; base?: string }) {
  let all: 계약[];
  try { all = await contracts.list(); }
  catch (e) {
    return (
      <Screen name="esign-workspace">
        <Panel compact><PanelHead kind="목록" title="전자계약" count="오류" />
          <PanelBody><p className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></PanelBody></Panel>
      </Screen>
    );
  }

  const text = sp(q.q).trim().toLowerCase();
  const status = sp(q.status), sign = sp(q.sign), agent = sp(q.agent);
  const statuses = [...new Set(all.map((c) => c.status).filter(Boolean))].sort();
  /* 검색창 옆 필터 버튼 — 담당 축(§5-1). 계약상태는 이미 위 드롭다운이 다루니 겹치지 않는 축을 쓴다. */
  const pass = (c: 계약, skip?: 'agent') =>
    (!status || c.status === status)
    && (!text || [c.code, c.plate, c.vehicle, c.customer, c.agent].join(' ').toLowerCase().includes(text))
    && (skip === 'agent' || !agent || c.agent === agent);
  const searched = all.filter((c) => pass(c, 'agent'));
  const shown = searched.filter((c) => (!sign || signOf(c) === sign) && (!agent || c.agent === agent))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const n = (s: string) => searched.filter((c) => (!agent || c.agent === agent) && signOf(c) === s).length;
  const sel = all.find((c) => c.id === sp(q.id));
  const agentFacet: Facet = {
    key: 'agent', title: '영업 담당',
    options: [...new Set(all.map((c) => c.agent).filter(Boolean))].sort()
      .map((v) => ({ value: v as string, count: all.filter((c) => pass(c) && c.agent === v).length })),
  };
  const step = sel ? SIGN.indexOf(sel.signStatus as (typeof SIGN)[number]) : -1;

  return (
    <Screen name="esign-workspace">
    <div className="erp-workspace">
      <Panel compact>
        <PanelHead kind="목록" title="전자계약목록" count={`전체 ${searched.filter((c) => !agent || c.agent === agent).length}건`} />
        <SearchBar base={base} q={q} placeholder="고객 · 차번 · 계약코드 · 담당" facets={[agentFacet]} keep={['sign']}
          dropdown={<AutoSelect name="status" value={status} label="계약상태" options={[['', '계약상태 전체'], ...statuses.map((v) => [v, v] as [string, string])]} />} />
        {/* 전자서명 QuickFilter 업무 항목은 미확정. 전체 + 대표 예시 1개만 둔다. */}
        <QuickFilter label="전자서명" items={[
          { key: 'all', label: `전체 ${searched.filter((c) => !agent || c.agent === agent).length}`, href: hrefWith(base, q, { sign: null }), on: !sign },
          { key: 'progress', label: `진행중 ${n('진행중')}`, href: hrefWith(base, q, { sign: '진행중' }), on: sign === '진행중' },
        ]} />
        <PanelBody>
          <RowCards label="전자계약 목록">
            {shown.map((c) => {
              const at = c.signStatus === '서명완료' ? SIGN.length : SIGN.indexOf(c.signStatus as (typeof SIGN)[number]);
              const s = signOf(c);
              return (
                <RowCard key={c.id} href={hrefWith(base, q, { id: c.id })} current={sel?.id === c.id}
                  tone={SIGN_TONE[c.signStatus] ?? 'neutral'} thumb={<><SignIcon s={s} /><span>{SIGN_SHORT[s]}</span></>} thumbStatus
                  title={txt(c.customer)} badge={<Badge tone={SIGN_TONE[c.signStatus] ?? 'neutral'}>{s}</Badge>}
                  subId={txt(c.plate)} sub={txt(c.vehicle)}
                  meta={`${c.term ? `${c.term}개월` : '—'} · ${txt(c.status)}`}
                  steps={{ labels: [...SIGN], at }}
                  facts={[
                    ['계약상태', c.status ? <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge> : '—'],
                    ['기간', c.term ? `${c.term}개월` : '—'],
                  ]}
                  amount={`월 ${manWon(c.rent)} 원`} unit="" />
              );
            })}
          </RowCards>
        </PanelBody>
      </Panel>

      <Panel>
        {sel ? (
          <>
            <PanelHead kind="상세내용" title={`${txt(sel.customer)} · ${txt(sel.code)}`} count={sel.status ?? '—'} />
            <PanelBody>
              <div className="erp-detail-body">
                <div className="erp-tile">
                  <h3 className="erp-tile-title">전자서명 진행</h3>
                  <Steps current={sel.signStatus === '서명완료' ? SIGN.length : step} items={SIGN.map((s) => ({ label: s }))} />
                </div>
                <div className="erp-info-card erp-tile">
                  <h3 className="erp-tile-title">계약 정보</h3>
                  <dl>
                    <div><dt>차량</dt><dd>{txt(sel.vehicle)}</dd></div>
                    <div><dt>차량번호</dt><dd>{txt(sel.plate)}</dd></div>
                    <div><dt>영업담당</dt><dd>{txt(sel.agent)}</dd></div>
                    <div><dt>기간 · 월 대여료</dt><dd data-type="money">{sel.term ?? '—'}개월 · {won0(sel.rent)}원</dd></div>
                    <div><dt>양식</dt><dd>{txt(sel.kind)}</dd></div>
                    <div><dt>보험</dt><dd>{txt(sel.insurance)}</dd></div>
                    <div><dt>계약일</dt><dd>{txt(sel.contractDate)}</dd></div>
                    <div><dt>생성일</dt><dd>{when(sel.createdAt)}</dd></div>
                    <div><dt>발송일</dt><dd>{when(sel.signSentAt)}</dd></div>
                    <div><dt>서명일</dt><dd>{when(sel.signedAt)}</dd></div>
                  </dl>
                </div>
              </div>
            </PanelBody>
            <PanelFoot>
              {sel.signUrl ? <a className="erp-btn erp-btn--ghost" href={sel.signUrl} target="_blank" rel="noreferrer">서명창 열기</a> : null}
              {sel.signedPdfUrl
                ? <a className="erp-btn erp-btn--primary" href={sel.signedPdfUrl} target="_blank" rel="noreferrer">서명본 열기</a>
                : <span className="erp-btn erp-btn--primary" aria-disabled="true" title="서명이 끝나면 서명본을 열 수 있습니다">서명본 열기</span>}
            </PanelFoot>
          </>
        ) : (
          <>
            <PanelHead kind="상세내용" title="전자계약상세" count="고른 계약" />
            <PanelBody><p className="erp-muted">왼쪽에서 계약을 고르세요.</p></PanelBody>
          </>
        )}
      </Panel>
    </div>
    </Screen>
  );
}
