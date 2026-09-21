/* ══════════════════════════════════════════════════════════════════
   아이콘 한 벌.

   ★대표 2026-09-17 「아이콘을 쓸거면 아이콘을 쓰던가」 · 「확실하게 잡아줘야하는데」

   전에는 «텍스트 글리프»(❮ ❯ ⋯ ✕ ✓ ▤ ≡ ◑ ✒ ↗)와 SVG 가 섞여 있었다.
   글리프는 폰트가 그리는 것이라 —
     ① 굵기가 제각각이다 (✒ 은 두껍고 ❮ 는 얇다)
     ② 글자 기준선에 앉아 «위아래로 어긋난다»
     ③ 크기가 font-size 를 따라 들쭉날쭉하다
     ④ 폰트가 없으면 네모(□)가 뜬다
   그래서 「버튼도 가지각색」 으로 보였다.

   ★여기 것은 전부 —
     · 16 격자 · stroke 1.6 · round cap/join · fill 없음
     · 색은 currentColor — 글자색을 그대로 따른다
     · aria-hidden — 뜻은 옆의 글자나 aria-label 이 진다
   ══════════════════════════════════════════════════════════════════ */

const ICON_SIZE = 16;

/** 한 벌의 몸통. d 만 갈아 끼운다 — 굵기·격자·마감이 절대 안 갈린다 */
function ic(name, size = ICON_SIZE) {
  const d = ICONS[name];
  if (!d) return '';
  return `<svg class="ic" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${d}</svg>`;
}

const ICONS = {
  /* ── 길 ─────────────────────────────────────────── */
  left:  '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
  right: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  down:  '<path d="M3.5 6 8 10.5 12.5 6"/>',

  /* ── 손 ─────────────────────────────────────────── */
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 13.5 13.5"/>',
  close:  '<path d="M4 4l8 8M12 4l-8 8"/>',
  check:  '<path d="M3.2 8.4 6.4 11.6 12.8 4.8"/>',
  more:   '<circle cx="3.2" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="12.8" cy="8" r=".9" fill="currentColor" stroke="none"/>',
  filter: '<path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"/>',
  share:  '<path d="M8 10.5V2.5M5.2 5.3 8 2.5l2.8 2.8"/><path d="M3 9.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3"/>',
  copy:   '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5h-7a1 1 0 0 0-1 1v7"/>',
  plus:   '<path d="M8 3.5v9M3.5 8h9"/>',
  alert:  '<path d="M8 2.6 14.4 13.4H1.6z"/><path d="M8 6.6v3M8 11.6v.01"/>',

  /* ── 업무 — 넷은 «서로 안 닮게» 그린다. 곁눈으로도 갈려야 한다 ── */
  car:    '<path d="M2 10.5h12M3.2 10.5V8l1.6-3.2a1 1 0 0 1 .9-.55h4.6a1 1 0 0 1 .9.55L12.8 8v2.5"/><circle cx="5" cy="11.8" r="1.2"/><circle cx="11" cy="11.8" r="1.2"/>',
  doc:    '<path d="M4 2.5h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z"/><path d="M9 2.5v3h3M5.5 9h5M5.5 11.5h3"/>',
  coin:   '<ellipse cx="8" cy="4.5" rx="5" ry="2"/><path d="M3 4.5v7c0 1.1 2.2 2 5 2s5-.9 5-2v-7"/><path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2"/>',
  sign:   '<path d="M2.5 12.5c2-.4 3-1.6 3.6-3.2.7-1.9 1.4-4.3 2.6-4.3 1 0 1 1.3.4 2.4-.7 1.3-1.7 1.9-2.6 1.9"/><path d="M8.5 9.3c1.3 0 2-.5 2.6-1.1M11.5 12.5h2"/>',
  gear:   '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6"/>',
  bell:   '<path d="M8 2.2a3.8 3.8 0 0 0-3.8 3.8c0 3-1.2 4-1.2 4h10s-1.2-1-1.2-4A3.8 3.8 0 0 0 8 2.2z"/><path d="M6.6 12.4a1.6 1.6 0 0 0 2.8 0"/>',
};

/* ★레일·탭의 아이콘 이름 — 뜻이 바뀌면 여기만 고친다 */
const NAV_ICON = { product: 'car', intake: 'doc', settle: 'coin', esign: 'sign' };
