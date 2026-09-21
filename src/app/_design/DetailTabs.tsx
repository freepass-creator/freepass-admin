'use client';
/**
 * ★★**요약 · 상세정보 — 판 «안에서» 바뀐다** (대표 2026-09-18)
 *   「상세 정보를 접수 화면에서 보더라도 **거기서** 상세정보가 떠야지」
 *   ⇒ 두 내용을 서버가 다 그려 두고, 여기서는 «어느 쪽을 보이나»만 바꾼다.
 *     요약에서 고른 기간은 상세정보를 봤다 와도 그대로 남는다(안 지우고 숨기기만 한다).
 *
 * ★★**하단바는 판의 것** (대표 2026-09-18 「하단 고정 바는 동일하게 유지해 줘야지, 규격 좀 맞추고」 · §14-3)
 *   앞서 접수 덩이(기간 · 값 한 줄 · 공유 · 접수하기)가 요약 본문 끝에 붙어 있어,
 *   내용이 짧으면 판 가운데에 떠 있고(옆 판 하단바와 높이가 달랐다) 상세정보 탭으로 가면 사라졌다.
 *   ⇒ 하단바([공유] [이 상품 접수하기])를 탭 «밖», 판 바닥에 둔다 — 어느 탭에서나, 어느 판에서나 같은 줄에 선다.
 *     기간 · 값 한 줄은 본문으로 돌아갔다(요약에서 구른다). 고른 요금은 OfferPicker 가 useChosenOffer 로 알려 준다.
 */
import { useCallback, useId, useState, type ReactNode } from 'react';
import { Share } from './Share';
import { ChosenOffer } from './chosen-offer';
import { ActionBar } from './Primitives';

export function DetailTabs({ summary, info, applyBase, initialOffer }: {
  summary: ReactNode; info: ReactNode;
  /** 처음 고른 요금 — 서버가 미리 알려 준다(안 주면 화면이 뜬 뒤에야 주 단추가 서서 바가 한 번 흔들린다) */
  initialOffer?: string;
  /** 계약접수만 — 오른쪽 판을 신규 접수로 바꾸는 주소 바탕(여기에 &offer= 를 붙인다). 없으면(상품찾기) 주 단추 없음 */
  applyBase?: string;
}) {
  const [tab, setTab] = useState<'summary' | 'info'>('summary');
  const uid = useId();
  const summaryTab = `${uid}-summary-tab`, infoTab = `${uid}-info-tab`;
  const summaryPanel = `${uid}-summary-panel`, infoPanel = `${uid}-info-panel`;
  const [offer, setOffer] = useState(initialOffer ?? '');
  const 알림 = useCallback((id: string) => setOffer(id), []);
  return (
    <ChosenOffer.Provider value={알림}>
      <div className="tabs" role="tablist" aria-label="상품 상세 보기">
        <button id={summaryTab} role="tab" aria-selected={tab === 'summary'} aria-controls={summaryPanel}
          type="button" className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>요약</button>
        <button id={infoTab} role="tab" aria-selected={tab === 'info'} aria-controls={infoPanel}
          type="button" className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>상세정보</button>
      </div>
      <div className="dz-tabbody">
        <div id={summaryPanel} role="tabpanel" aria-labelledby={summaryTab} hidden={tab !== 'summary'}>{summary}</div>
        <div id={infoPanel} role="tabpanel" aria-labelledby={infoTab} hidden={tab !== 'info'}>{info}</div>
      </div>
      {/* ★하단바 — 판 바닥(§14-3): [공유 3] [이 상품 접수하기 7] */}
      <ActionBar>
        <Share />
        {applyBase && offer && (
          <a className="primary" href={`${applyBase}${applyBase.includes('?') ? '&' : '?'}offer=${encodeURIComponent(offer)}`}>이 상품 접수하기</a>
        )}
      </ActionBar>
    </ChosenOffer.Provider>
  );
}
