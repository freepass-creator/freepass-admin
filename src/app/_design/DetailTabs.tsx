'use client';
/**
 * ★★**요약 · 상세정보 — 판 «안에서» 바뀐다** (대표 2026-09-18)
 *   「상세 정보를 접수 화면에서 보더라도 **거기서** 상세정보가 떠야지」
 *   ⚠ 앞서 「상세정보」는 다른 쪽(/products/[id])으로 넘어가는 링크였다 — 접수하다가 화면을 떠나야 했다.
 *   ⇒ 두 내용을 서버가 다 그려 두고, 여기서는 «어느 쪽을 보이나»만 바꾼다.
 *     요약에서 고른 기간은 상세정보를 봤다 와도 그대로 남는다(안 지우고 숨기기만 한다).
 */
import { useState, type ReactNode } from 'react';

export function DetailTabs({ summary, info }: { summary: ReactNode; info: ReactNode }) {
  const [tab, setTab] = useState<'summary' | 'info'>('summary');
  return (
    <>
      <div className="tabs">
        <button type="button" className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>요약</button>
        <button type="button" className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>상세정보</button>
      </div>
      <div hidden={tab !== 'summary'}>{summary}</div>
      <div hidden={tab !== 'info'}>{info}</div>
    </>
  );
}
