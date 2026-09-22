'use client';
/**
 * ★★**상세 사진 — 큰 사진 + 넘기기** (대표 2026-09-18 「erp4 디자인 중에서 상세페이지 … 가져올 만한 것」 → ② 선택)
 *   정본 = freepasserp4 `components/ProductDetail.tsx` 의 사진 칸 — 짜임을 그대로 옮겼다:
 *   · 큰 사진 16:10 · 양옆 ‹ › · 좌우로 밀기 · 우하단 「N / M」 · 누르면 크게(전체 화면)
 *   · 웹만 옆에 **세로 썸네일 칸** — 큰 사진 높이만큼만 쓰고 그 안에서 위아래로 구른다(쪽은 안 움직인다)
 *     ★폰은 썸네일 칸이 없다(대표 2026-08-30 「모바일에선 그거 필요 없어, 그냥 바로 눌러서 볼 거」).
 *   · 지금 보는 사진을 넘기면 썸네일 칸도 따라간다(대표 2026-08-11 — 26장짜리에서 어디쯤인지 안 보였다).
 * ⓘ 사진 주소는 서버가 `imgSrc()` 로 감싸서 준다(구글 드라이브는 바로 부르면 깨진다 — 기능 세션 실측).
 * ⚠ 사진은 «받기» 단추를 두지 않는다(erp4 대표 2026-08-30 — 사진은 파일이 아니라 링크로 보낸다).
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function PhotoGallery({ photos, alt, link }: { photos: string[]; alt: string; link?: string }) {
  const [i, setI] = useState(0);
  const [big, setBig] = useState(false);
  const [x0, setX0] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const n = photos.length;
  const go = (d: number) => { if (n > 1) setI((k) => (k + d + n) % n); };

  /* 썸네일 칸이 지금 사진을 따라간다 — 칸 안만 굴린다(scrollIntoView 는 쪽까지 움직여 화면이 튄다) */
  useEffect(() => {
    const s = strip.current;
    const el = s?.children[i] as HTMLElement | undefined;
    if (!s || !el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    s.scrollTo({ top: Math.max(0, el.offsetTop - (s.clientHeight - el.clientHeight) / 2), behavior: reduce ? 'auto' : 'smooth' });
  }, [i]);
  /* 크게 보기 — ← → 넘기기 · Esc 닫기 */
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBig(false);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  if (!n) {
    return (
      <div className="dz-gal-main empty">
        <span>사진 없음{link ? <> · <a href={link} target="_blank" rel="noreferrer">원본 사진 보기</a></> : null}</span>
      </div>
    );
  }
  const 넘김 = n > 1 && (
    <>
      <button type="button" className="dz-gal-step l" aria-label="이전 사진" onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); go(-1); }}><Icon name="chevron-left" size={20} stroke={2.5} /></button>
      <button type="button" className="dz-gal-step r" aria-label="다음 사진" onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); go(1); }}><Icon name="chevron-right" size={20} stroke={2.5} /></button>
    </>
  );
  return (
    <div className={`dz-gal${n > 1 ? ' many' : ''}`}>
      <div className="dz-gal-main"
        onPointerDown={(e) => setX0(e.clientX)}
        onPointerUp={(e) => {
          const s = x0; setX0(null);
          /* 화살표처럼 pointerdown 을 부모까지 안 올린 조작은 크게보기로 번지지 않는다. */
          if (s === null) return;
          if (Math.abs(e.clientX - s) > 40) { go(e.clientX < s ? 1 : -1); return; }
          setBig(true);
        }}
        onPointerCancel={() => setX0(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[i]} alt={alt} draggable={false} decoding="async" fetchPriority="high" />
        {넘김}
        <small>{i + 1} / {n}</small>
      </div>
      {n > 1 && (
        <div className="dz-gal-thumbs" ref={strip}>
          {photos.map((p, k) => (
            <button key={k} type="button" className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`사진 ${k + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" loading="lazy" decoding="async" draggable={false} />
            </button>
          ))}
        </div>
      )}
      {big && (
        <div className="dz-gal-big" role="dialog" aria-modal="true" aria-label="사진 크게 보기" onClick={() => setBig(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[i]} alt={alt} decoding="async" onClick={(e) => e.stopPropagation()} />
          {넘김}
          <button type="button" className="dz-gal-close" aria-label="닫기" onClick={() => setBig(false)}><Icon name="x" size={22} /></button>
          <small>{i + 1} / {n}</small>
        </div>
      )}
    </div>
  );
}
