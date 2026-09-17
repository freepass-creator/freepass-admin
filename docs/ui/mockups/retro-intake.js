/* ══════════════════════════════════════════════════════════════════
   계약 접수 등록 — 고전식.

   ★대표 2026-09-17 「얼른 접수 하게 만들어줘야하는데」

   여기는 «일» 만 한다. 결·색·눈금은 classic.css 가 전부 진다 —
   이 파일에 색을 한 줄이라도 적기 시작하면 또 「흉내」 가 된다.

   ★값을 «지어내지» 않는다. 상품은 ERP5 Firestore 스냅샷에서 오고,
     접수에 적는 칸은 F04 정산원장 「접수」 탭의 실측 열 이름 그대로다.
   ══════════════════════════════════════════════════════════════════ */

/* ★admin-shell.data.js 가 이미 `$`·`esc` 를 쓰고 있다.
   같은 이름을 다시 선언하면 «파일 전체가 안 돈다» — 한 껍데기 안에 가둔다. */
(function () {
'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => (n == null ? '' : Number(n).toLocaleString('ko-KR'));
/** ★1만 아래를 「0.0만」 으로 쓰면 거짓말이 된다 — 10km 짜리가 아무 말도 안 하게 된다 */
const mile = (m) => (m == null ? '' : m === 0 ? '신차' : m < 10000 ? num(m) + 'km' : (m / 10000).toFixed(1) + '만km');

/* ── 상품 한 벌 — 목록에 세울 꼴로만 납작하게 ───────────────── */
const ITEMS = [];
for (const p of (typeof PRODUCTS !== 'undefined' ? PRODUCTS : [])) {
  const o = (p.offers || [])[0];
  if (!o) continue;
  ITEMS.push({
    id: p.id, sup: p.supplier || '', maker: p.maker || '', name: p.name || '',
    /* 「싼타페」 + 「싼타페 MX5 프레스티지」 = 겹말. 앞말을 뗀다 */
    trim: String(p.sub || '').startsWith(p.name) ? String(p.sub).slice(String(p.name).length).trim() : (p.sub || ''),
    plate: p.plate || '', year: p.year ?? null, mileage: p.mileage ?? null,
    fuel: p.fuel || '', status: p.status || '',
    term: o.term, rent: o.rent, dep: o.dep, annual: o.mile ?? null, oid: o.id,
  });
}

const SUPS = [...new Set(ITEMS.map((x) => x.sup))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));

/* ── 지금 고른 것 ───────────────────────────────────────────── */
const S = { q: '', sup: '', st: '', pick: null, saved: 0 };

/**
 * ★접수에 적는 칸 — F04 정산원장 「접수」 탭의 «실측 열» 그대로다.
 *   지어낸 이름이 하나도 없다 (scripts/f04-ssot.mts 가 읽은 것).
 *
 *   ※ 가 붙은 것은 «반드시» 채운다. 안 붙은 것은 알면 적는다 —
 *   ★모르는 것을 억지로 채우게 하면 사람이 «아무거나» 적는다. 그게 원장을 더럽힌다.
 */
const FIELDS = [
  { k: 'product', t: '상품', must: 1, opt: ['장기렌트', '구독'] },
  { k: 'rentKind', t: '렌트구분', must: 1, opt: ['신차', '중고', '재렌트'] },
  { k: 'term', t: '계약기간', must: 1, suf: '개월', from: 'term' },
  { k: 'rent', t: '월 대여료', must: 1, suf: '원', from: 'rent' },
  { k: 'deposit', t: '보증금', suf: '원', from: 'dep' },
  { k: 'payKind', t: '납입', opt: ['일시납', '2회분납', '3회분납'] },
  { k: 'contractType', t: '계약형태', must: 1, opt: ['전자약정', '종이'] },
  { k: 'channel', t: '영업채널', must: 1, opt: ['다이렉트 (본사)', '유니오토', '카링크모빌리티', '한결오토리스'] },
  { k: 'agent', t: '영업자' },
  { k: 'agentCode', t: '영업자코드', ph: 'S0000' },
  { k: 'region', t: '출고지역', ph: '서울 · 경기 · …' },
  { k: 'wantAt', t: '인도희망일', ph: 'MM-DD' },
  /* ★프로모션 — 대표 2026-09-17 「프로모션 업셀링 금액을 넣어야함」
     「영업자한테 얼마 더 줄거냐 … ★기본 100%로 세팅해주고」 */
  { k: 'promo', t: '프로모션 금액', suf: '원' },
  { k: 'promoShare', t: '영업자 지급 비율', suf: '%', def: '100' },
  { k: 'promoWhy', t: '프로모션 사유' },
  { k: 'memo', t: '남길 말' },
];

const VAL = {};
const resetVals = () => {
  for (const k of Object.keys(VAL)) delete VAL[k];
  for (const f of FIELDS) if (f.def) VAL[f.k] = f.def;
};
resetVals();

/* ── 거른다 ─────────────────────────────────────────────────── */
function filtered() {
  const q = S.q.trim().toLowerCase();
  return ITEMS.filter((x) =>
    (!S.sup || x.sup === S.sup)
    && (!S.st || x.status === S.st)
    && (!q || (x.maker + x.name + x.trim + x.plate).toLowerCase().includes(q)));
}

/* ── 자리 ② 표 ──────────────────────────────────────────────
   ★고전식 표는 «전부» 그린다. 굴리면 그만이다.
     다만 천 줄이 넘어가면 브라우저가 버거우므로 이백 줄에서 끊고 그 사실을 «적는다» —
     조용히 자르면 「없는 것」 이 되어 버린다. */
const CAP = 200;

function drawGrid() {
  const rows = filtered();
  const show = rows.slice(0, CAP);
  $('#grid').innerHTML = `<table>
    <thead><tr>
      <th style="width:150px">차량번호</th>
      <th>차량</th>
      <th style="width:96px">공급사</th>
      <th style="width:62px">연식</th>
      <th style="width:84px">주행</th>
      <th style="width:72px">연료</th>
      <th style="width:80px">상태</th>
      <th style="width:64px">기간</th>
      <th style="width:96px">보증금</th>
      <th style="width:110px">월 대여료</th>
    </tr></thead>
    <tbody>${show.map((x) => `<tr data-id="${esc(x.id)}" class="${S.pick === x.id ? 'on' : ''}">
      <td class="chabeon">${x.plate ? esc(x.plate) : '<span class="dim">미배정</span>'}</td>
      <td class="wide yeolsoe">${esc(x.maker)} ${esc(x.name)} <span class="dim">${esc(x.trim)}</span></td>
      <td>${esc(x.sup)}</td>
      <td class="num">${x.year ?? ''}</td>
      <td class="num">${mile(x.mileage)}</td>
      <td>${esc(x.fuel)}</td>
      <td>${esc(x.status) || '<span class="dim">—</span>'}</td>
      <td class="num">${x.term}</td>
      <td class="num">${x.dep ? num(x.dep) : '<span class="dim">무보증</span>'}</td>
      <td class="num">${num(x.rent)}</td>
    </tr>`).join('')}</tbody></table>`;

  $('#grid').querySelectorAll('tbody tr').forEach((tr) => {
    tr.onclick = () => { S.pick = tr.dataset.id; draw(); };
  });

  $('#cnt').innerHTML = rows.length
    ? `${num(rows.length)}건 중 <b class="num">${num(show.length)}</b>건 보는 중`
    : '조건에 맞는 상품이 없습니다';
  $('#cnote').textContent = rows.length > CAP
    ? `★뒤 ${num(rows.length - CAP)}건은 안 그렸습니다 — 조건을 좁히세요`
    : S.pick ? '아래 칸을 채우고 「접수 등록」 을 누릅니다'
      : '줄을 고르면 아래에 접수에 적을 칸이 나옵니다';
  $('#s-find').textContent = `조회 ${num(rows.length)}건`;
}

/* ── 자리 ③ 받을 것 ─────────────────────────────────────────
   ★고전식 cl-form 그대로 — 한 줄에 «두 칸». 홀수면 오른쪽을 bin 으로 닫는다.
     안 닫으면 격자가 뚫려서 표가 표로 안 보인다. */
function drawForm() {
  const it = ITEMS.find((x) => x.id === S.pick);
  $('#d-code').textContent = it ? `${it.maker} ${it.name}` : '—';
  $('#go').disabled = !it;
  $('#go').title = it ? '접수 원장에 한 줄 남깁니다' : '먼저 위에서 상품을 고르세요';

  if (!it) {
    $('#form').innerHTML = '<div class="cl-regbin">위에서 «상품» 을 고르면 여기에 채울 칸이 나옵니다.</div>';
    return;
  }

  /* 고른 상품이 «이미 아는» 값은 미리 채워 둔다. 사람이 두 번 적지 않게 */
  const auto = { term: it.term, rent: it.rent, dep: it.dep ?? '' };
  const cell = (f) => {
    const v = VAL[f.k] ?? (f.from ? auto[f.from] : '') ?? '';
    const lock = f.from ? ' title="고른 상품에서 온 값입니다 — 고칠 수 있습니다"' : '';
    const inner = f.opt
      ? `<select data-k="${f.k}"${lock}>${['', ...f.opt].map((o) =>
          `<option value="${esc(o)}"${String(v) === o ? ' selected' : ''}>${o || '—'}</option>`).join('')}</select>`
      : `<input type="text" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"${lock}>`;
    return `<th${f.must ? '' : ' class="dim"'}>${f.must ? '※ ' : ''}${f.t}${f.suf ? ` <span class="dim">(${f.suf})</span>` : ''}</th><td>${inner}</td>`;
  };

  let html = '<table class="cl-form"><tbody>';
  for (let r = 0; r < FIELDS.length; r += 2) {
    const two = FIELDS.slice(r, r + 2);
    html += '<tr>' + two.map(cell).join('')
      + (two.length < 2 ? '<th class="bin" aria-hidden="true"></th><td class="bin" aria-hidden="true"></td>' : '')
      + '</tr>';
  }
  html += '</tbody></table>';
  $('#form').innerHTML = html;

  $('#form').querySelectorAll('[data-k]').forEach((el) => {
    el.oninput = el.onchange = () => { VAL[el.dataset.k] = el.value; sayMoney(); };
  });
  sayMoney();
}

/** ★프로모션은 «영업자에게 얼마 가나» 까지 그 자리에서 말한다 —
    비율만 적어 두면 사람이 또 계산기를 켠다 */
function sayMoney() {
  const it = ITEMS.find((x) => x.id === S.pick);
  const rent = Number(VAL.rent ?? it?.rent ?? 0) || 0;
  const promo = Number(String(VAL.promo || '').replace(/[^0-9]/g, '')) || 0;
  const share = VAL.promoShare === '' || VAL.promoShare == null ? 100 : Number(VAL.promoShare);
  $('#s-rent').textContent = `월 대여료 ${num(rent)}원`;
  $('#s-pick').textContent = it ? `선택 ${it.maker} ${it.name}` : '선택 —';
  if (!promo) return;
  const ok = Number.isFinite(share) && share >= 0 && share <= 100;
  $('#say').className = ok ? 'cl-note' : 'cl-regno';
  $('#say').textContent = ok
    ? `프로모션 ${num(promo)}원 중 영업자 ${num(Math.round(promo * share / 100))}원 · 우리 ${num(promo - Math.round(promo * share / 100))}원`
    : '지급 비율은 0~100 사이만 됩니다';
}

/* ── 등록 ──────────────────────────────────────────────────── */
function submit() {
  const it = ITEMS.find((x) => x.id === S.pick);
  const miss = [];
  if (!$('#f-cust').value.trim()) miss.push('고객');
  for (const f of FIELDS) {
    if (!f.must) continue;
    const v = VAL[f.k] ?? (f.from ? (f.from === 'dep' ? it.dep : it[f.from]) : '');
    if (v === '' || v == null) miss.push(f.t);
  }
  const share = VAL.promoShare === '' || VAL.promoShare == null ? 100 : Number(VAL.promoShare);
  if (!(Number.isFinite(share) && share >= 0 && share <= 100)) miss.push('영업자 지급 비율(0~100)');

  const say = $('#say');
  if (miss.length) {
    /* ★무엇이 비었는지 «이름을 대고» 말한다. 「필수값 누락」 은 아무 말도 안 한 것이다 */
    say.className = 'cl-regno';
    say.textContent = `못 넣었습니다 — ${miss.join(' · ')} 을(를) 채우세요`;
    return;
  }
  S.saved += 1;
  const no = `A-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(S.saved).padStart(3, '0')}`;
  say.className = 'cl-regok';
  say.textContent = `${no} 로 접수했습니다 — ${$('#f-cust').value.trim()} · ${it.maker} ${it.name} · ${num(VAL.rent ?? it.rent)}원`;
}

/* ── 그린다 ────────────────────────────────────────────────── */
function draw() { drawGrid(); drawForm(); }

(function start() {
  $('#f-sup').innerHTML = '<option value="">전부</option>'
    + SUPS.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  const on = (sel, ev, fn) => { const e = $(sel); if (e) e[ev] = fn; };
  on('#f-q', 'oninput', (e) => { S.q = e.target.value; drawGrid(); });
  on('#f-sup', 'onchange', (e) => { S.sup = e.target.value; S.pick = null; draw(); });
  on('#f-st', 'onchange', (e) => { S.st = e.target.value; S.pick = null; draw(); });
  on('#f-clear', 'onclick', () => {
    S.q = ''; S.sup = ''; S.st = ''; S.pick = null;
    $('#f-q').value = ''; $('#f-sup').value = ''; $('#f-st').value = ''; draw();
  });
  on('#go', 'onclick', submit);
  on('#tb-save', 'onclick', submit);
  on('#tb-find', 'onclick', draw);
  on('#tb-new', 'onclick', () => { $('#reset').click(); ['f-cust', 'f-phone', 'f-plate'].forEach((i) => ($('#' + i).value = '')); });
  on('#reset', 'onclick', () => {
    resetVals(); S.pick = null;
    $('#say').className = 'cl-note';
    $('#say').textContent = '누르기 전에는 아무 일도 일어나지 않습니다';
    draw();
  });
  on('#tb-csv', 'onclick', () => {
    const rows = filtered();
    const head = ['차량번호', '제조사', '차량', '트림', '공급사', '연식', '주행', '연료', '상태', '기간', '보증금', '월대여료'];
    const body = rows.map((x) => [x.plate, x.maker, x.name, x.trim, x.sup, x.year ?? '', x.mileage ?? '', x.fuel, x.status, x.term, x.dep ?? '', x.rent]);
    const csv = '﻿' + [head, ...body].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `상품목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  });

  /* ★자료가 «어디서 왔는지» 를 상태줄에 적는다. 시연값을 실값인 척하지 않는다 */
  $('#s-src').textContent = window.ERP5_ON ? `DB: ERP5 (freepasserp5) · 상품 ${num(ITEMS.length)}` : 'DB: 시연값';
  const tick = () => { $('#s-now').textContent = new Date().toLocaleString('ko-KR', { hour12: false }); };
  tick(); setInterval(tick, 1000);

  draw();
})();
})();
