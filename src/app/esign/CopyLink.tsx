'use client';

import { useState } from 'react';

/** 서명 링크 복사 — 고객에게 다시 보낼 때. 복사되면 2초간 「복사됨」 */
export function CopyLink({ url, className = 'secondary' }: { url: string; className?: string }) {
  const [됨, set됨] = useState(false);
  return (
    <button type="button" className={className} aria-live="polite"
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); set됨(true); setTimeout(() => set됨(false), 2000); }
        catch { window.prompt('서명 링크', url); }
      }}>
      {됨 ? '복사됨' : '링크 복사'}
    </button>
  );
}
