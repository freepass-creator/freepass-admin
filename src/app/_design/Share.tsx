'use client';
import { useState } from 'react';

/**
 * 공유 — 지금 보는 차의 주소를 건넨다. 폰은 기기 공유창(navigator.share), 웹은 주소 복사.
 * ★주소에 고른 차·기간이 다 들어 있다(`?id=&offer=`) — 받은 사람이 같은 자리를 연다.
 */
export function Share() {
  const [done, setDone] = useState(false);
  const go = async () => {
    const url = window.location.href;
    try {
      if (navigator.share && window.matchMedia('(max-width: 900px)').matches) { await navigator.share({ url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true); setTimeout(() => setDone(false), 1500);
    } catch { /* 닫았거나 막혔다 — 아무 일 없다 */ }
  };
  return <button type="button" className="dz-bar-sub" onClick={go}>{done ? '복사됨' : '공유'}</button>;
}

