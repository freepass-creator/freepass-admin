/* ══════════════════════════════════════════════════════════
   자리 — 좌상 목록 · 좌하 목록 · 우 상세. 한 화면을 꽉 채우고
   각 판이 «자기 안에서» 구른다. 가운데 선은 끌어서 부피를 바꾼다.
   ══════════════════════════════════════════════════════════ */

const S = {
  screen: 'intake', split: 50,
  q: '싼타페 36개월 무보증', sel: {}, sheet: false, sheetAxis: 'term',
  pid: null, oid: null, shot: 0,
  appNo: 'A-260916-015', appQ: '', appFilter: 'todo',
  tab: 'perf', perfNo: 'S-2609-017', billSup: '대영렌터카', payCh: '카링크모빌리티',
  esignNo: 'E-2609-041',
  lw: null, rh: null,
  /** ★상세는 하나다 — 마지막에 고른 것이 무엇인지 기억해 둔다 */
  focus: 'app',
  mini: false, draft: null, saving: false, seq: 16,
  pick: null, pickQ: '',
};

const NAV = [
  { k: 'product', t: '상품찾기', i: '▤' },
  { k: 'intake', t: '계약접수', i: '≡', badge: () => APPS.filter(a => !a.cxl && !a.deliv).length },
  { k: 'settle', t: '정산관리', i: '◑', badge: () => PERFS.filter(p => p.stage < 4).length + BILLS.filter(b => b.fixed > b.got).length + PAYS.filter(p => p.fixed > p.paid).length },
  { k: 'esign', t: '전자계약', i: '✒', badge: () => ESIGNS.filter(e => e.st !== '완료').length },
];

const appStatus = a => a.cxl ? { t: '취소', c: 'mut' }
  : a.deliv ? { t: '인도완료', c: 'ok' }
  : a.contract ? (a.docs ? { t: '인도 대기', c: 'key' } : { t: '서류 대기', c: 'wait' })
  : { t: '계약서 대기', c: 'wait' };
const STAGES = ['영업자 1차 확인', '공급사 Cross Check', '관리자 최종 확정', '정산 원장 편입'];
const isClaw = p => p.kind === 'CLAWBACK';

/* ── ★판 규격 — 네 칸이고, 칸마다 «맡은 일» 이 하나다 ─────────
   .ph 38  무엇을 보는가  제목 · 딸린 수 · (오른쪽) 이 판 전체에 거는 행동
   .bar 38 무엇을 고르는가 찾는 칸 하나 + 걸린 조건 딱지. 없으면 띠도 없다
   .pb  1fr 내용
   .pf  30  무엇이 남았나  «셈» 만 — 라벨+숫자. 설명문·훈계는 안 넣는다
   ★찾기·고르기는 .bar 로, 세는 일은 .pf 로. .ph 에 섞지 않는다 */
const MG = '<span class="mg"><svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6" cy="6" r="4"></circle><path d="M9 9l3.2 3.2"></path></svg></span>';
/** 찾는 칸 하나 — 돋보기·친 말·지우기·(세부필터) 가 한 테두리 안에 산다.
 *  ★type 은 text 다. search 로 두면 브라우저가 ✕ 를 «또» 그려 두 개가 된다. */
const findbox = (id, ph, val, opt = {}) => `<div class="fd">${MG}
  <input type="text" id="${id}" value="${esc(val || '')}" placeholder="${ph}" autocomplete="off" spellcheck="false">
  ${val ? `<button class="x" id="${id}x" aria-label="지운다">&#10005;</button>` : ''}
  ${opt.filter ? `<button class="fx${opt.n ? ' on' : ''}" id="${opt.filter}">세부필터${opt.n ? `<span class="b">${opt.n}</span>` : ''}</button>` : ''}
</div>`;
/** 판 바닥의 셈 한 칸. ★0 이면 눌러 둔다 — 없는 것이 눈을 끌면 안 된다 */
const tl = (t, v, c) => `<span class="t"><i>${t}</i><b class="${v === 0 ? 'z' : (c || '')}">${v}</b></span>`;
/** ★보증금은 «비율» 이 먼저다 — 차가 물고 들어오는 조건이라 금액은 그 결과다.
 *  비율을 모르면(미확인) 금액만 쓴다. 0 을 「없음」 으로 쓰지 않는다. */
const depText = o => o.dep ? `${o.depRate != null ? o.depRate + '% · ' : ''}${man(o.dep)}원`
  : (o.depRate === 0 ? '무보증 (0%)' : '<span class="unk">미확인</span>');
/** ★대여료는 VAT «포함» 이다 (대표 2026-09-16). 안 적으면 영업이 별도로 읽는다. */
const VAT = '<span class="mut" style="font-size:10.5px">VAT 포함</span>';
/** 환수는 부호가 반대다 — 숫자 앞에 «−» 를 붙여 눈으로도 갈리게 한다 */
const won2 = n => (n < 0 ? '−' + won(-n) : won(n));
const esignSt = e => e.st === '완료' ? { t: '완료', c: 'ok' } : e.st === '서명 대기' ? { t: '서명 대기', c: 'wait' } : { t: '열람 전', c: 'bad' };

/** 사진 자리 — 한 톤의 «윤곽»만. 색을 넣으면 그림이 되고, 그림이 되면 장난감으로 읽힌다. */
function glyph() {
  return '<svg viewBox="0 0 168 78" aria-hidden="true">'
    + '<path d="M8,56 L8,45 C8,39 12,36 20,34.5 L44,31 C52,20 63,16 79,16 L108,16 C122,16 131,20 139,30 L153,36 C159,38 161,41 161,47 L161,56 Z" fill="var(--glyph)"/>'
    + '<circle cx="46" cy="56" r="11" fill="var(--glyph)"/><circle cx="129" cy="56" r="11" fill="var(--glyph)"/>'
    + '</svg>';
}
const shotBox = (has, cls) => has
  ? `<div class="${cls}">${glyph()}</div>`
  : `<div class="${cls}"><span class="none">사진 준비 중</span></div>`;

const stepper = (names, at) => `<div class="steps">${names.map((n, i) => {
  const k = i + 1 === at ? 'on' : i + 1 < at ? 'dn' : '';
  return `<span class="stp ${k}"><span class="n2">${i + 1}</span>${esc(n)}</span>`
    + (i < names.length - 1 ? '<span class="ar">&#10095;</span>' : '');
}).join('')}</div>`;

/**
 * 실행 띠 — 어느 상세든 «같은 꼴» 이다.
 *   메모가 윗줄, 버튼이 아랫줄. 버튼 줄은 «⋯ 더보기 | 보조… | (빈칸) | 주 행동».
 * ★주 행동은 하나뿐이다. 지금 단계에서 할 일이 둘이면 그건 화면이 덜 정해진 것이다.
 * ★지우거나 되돌리는 것은 색으로 겁주지 않고 «⋯ 안» 으로 뗀다.
 *   빨간 버튼을 늘 보이게 두면 매일 보는 사람은 그걸 곧 무시한다.
 */
function actBar({ memo, more = [], subs = [], main }) {
  return `<div class="dact">
    ${memo ? `<div class="memo">${memo}</div>` : ''}
    <div class="row">
      ${more.length ? `<div class="menuwrap"><button class="btn mbtn" id="moreBtn" aria-label="더보기" title="더보기">&#8943;</button>
        <div class="menu" id="moreMenu">${more.map((m, i) => m === '-' ? '<div class="sep"></div>'
          : `<button data-m="${i}"${m.danger ? ' class="danger"' : ''}>${esc(m.t)}</button>`).join('')}</div></div>` : ''}
      ${subs.map((s, i) => `<button class="btn" data-sub="${i}"${s.off ? ' disabled' : ''}>${esc(s.t)}</button>`).join('')}
      <span class="sp"></span>
      ${main ? `<button class="btn go" id="mainBtn"${main.off ? ' disabled' : ''}>${esc(main.t)}</button>` : ''}
    </div></div>`;
}

/** 띠에 손을 붙인다 — 만든 곳과 붙이는 곳을 갈라 두면 화면마다 빠뜨린다 */
function bindAct(el, { more = [], subs = [], main }) {
  const mb = el.querySelector('#moreBtn'), mm = el.querySelector('#moreMenu');
  if (mb) {
    mb.onclick = ev => { ev.stopPropagation(); mm.classList.toggle('on'); };
    document.addEventListener('click', () => mm.classList.remove('on'), { once: true });
    mm.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mm.classList.remove('on'); more[+b.dataset.m].go(); });
  }
  el.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => subs[+b.dataset.sub].go());
  const main2 = el.querySelector('#mainBtn');
  if (main2 && main && main.go) main2.onclick = main.go;
}

const kpis = items => `<div class="kpis">${items.map(([k, v, c]) =>
  `<div class="kpi"><div class="k">${esc(k)}</div><div class="v ${c || ''}">${esc(v)}</div></div>`).join('')}</div>`;

/* ══ 조건 엔진 (상품) ═══════════════════════════ */
const optOf = (ax, k) => ax.opts.find(o => o.k === k);
const axOf = k => AXES.find(a => a.k === k);

function parseQ() {
  let rest = ' ' + S.q + ' ';
  const read = [];
  for (const t of TERMS) {
    if (t.re.test(rest)) {
      if (!read.some(r => r.axis === t.axis && r.key === t.key)) read.push({ axis: t.axis, key: t.key });
      rest = rest.replace(t.re, ' ');
    }
  }
  return { read, text: rest.trim() };
}
function effSel() {
  const out = {};
  for (const [k, v] of Object.entries(S.sel)) if (v && v.length) out[k] = [...v];
  for (const r of parseQ().read) { out[r.axis] = out[r.axis] || []; if (!out[r.axis].includes(r.key)) out[r.axis].push(r.key); }
  return out;
}
const selCount = sel => Object.values(sel).reduce((n, v) => n + v.length, 0);

/** ★Offer 축은 «이 Offer 하나»가 전부 만족해야 한다. */
function offerOK(o, sel, skip) {
  for (const ax of AXES) {
    if (ax.scope !== 'offer' || ax.k === skip) continue;
    const s = sel[ax.k]; if (!s || !s.length) continue;
    if (!s.some(k => optOf(ax, k).test(o))) return false;
  }
  return true;
}
const prodOK = (p, sel, skip) => AXES.every(ax => ax.scope !== 'product' || ax.k === skip
  || !(sel[ax.k] || []).length || sel[ax.k].some(k => optOf(ax, k).test(p)));
const textOK = (p, t) => !t || (p.name + ' ' + p.sub + ' ' + p.supplier + ' ' + p.maker).toLowerCase().includes(t.toLowerCase());

function countOpt(ax, opt, sel, text) {
  return PRODUCTS.filter(p => {
    if (!textOK(p, text) || !prodOK(p, sel, ax.k) || !p.offers.some(o => offerOK(o, sel, ax.k))) return false;
    if (ax.scope === 'product') return opt.test(p);
    return p.offers.some(o => offerOK(o, sel, ax.k) && opt.test(o));
  }).length;
}
function evaluate() {
  const sel = effSel(), text = parseQ().text;
  const hits = [], drops = [];
  for (const p of PRODUCTS) {
    if (!textOK(p, text)) continue;
    const ok = p.offers.filter(o => offerOK(o, sel, null));
    const pk = prodOK(p, sel, null);
    if (pk && ok.length) hits.push({ p, ok }); else if (selCount(sel)) drops.push({ p, why: whyDropped(p, sel, pk) });
  }
  return { hits, drops, sel };
}
function whyDropped(p, sel, pk) {
  if (!pk) {
    const bad = AXES.filter(ax => ax.scope === 'product' && (sel[ax.k] || []).length && !sel[ax.k].some(k => optOf(ax, k).test(p)));
    return { kind: 'p', miss: bad.map(ax => ax.t + ' 가 다르다 (이 차는 ' + ax.val(p) + ')') };
  }
  let best = null;
  for (const o of p.offers) {
    const miss = AXES.filter(ax => ax.scope === 'offer' && (sel[ax.k] || []).length && !sel[ax.k].some(k => optOf(ax, k).test(o)));
    if (!best || miss.length < best.miss.length) best = { o, miss };
  }
  return { kind: 'o', o: best.o, miss: best.miss.map(ax => ax.t + ' ' + ax.val(best.o)) };
}
function syncProd() {
  const hits = evaluate().hits;
  if (!hits.length) { S.pid = null; S.oid = null; return; }
  let cur = hits.find(h => h.p.id === S.pid);
  if (!cur) { cur = hits[0]; S.pid = cur.p.id; S.oid = null; }
  if (!S.oid || !cur.ok.some(o => o.id === S.oid)) S.oid = cur.ok[0].id;
}
const prod = () => PRODUCTS.find(p => p.id === S.pid);
const offer = () => { const p = prod(); return p && p.offers.find(o => o.id === S.oid); };

/* ══ 판 ① 상품목록 ═════════════════════════════ */
function paneProducts(el) {
  syncProd();
  const { hits, drops, sel } = evaluate();
  const n = selCount(sel);
  /* ★「확인 필요」 는 세부트림이 안 잡힌 상품이다 — 0 이 아니라 «모른다» 다 */
  const part = hits.filter(x => x.p.match !== 'TRIM').length;
  el.innerHTML = `
    <div class="ph"><h2>상품 목록</h2><span class="c">${hits.length}건</span></div>
    <div class="bar">
      ${findbox('q', '차종 · 무보증 · 21세 · 36개월', S.q, { filter: 'cond', n })}
      ${tokens(sel)}
    </div>
    <div class="pb" id="pbA"></div>
    <div class="pf">${tl('조건 밖', drops.length)}${tl('확인 필요', part, 'warn')}</div>`;

  const q = $('#q');
  q.oninput = () => { S.q = q.value; paneProducts(el); const e = $('#q'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); };
  if ($('#qx')) $('#qx').onclick = () => { S.q = ''; render(); };
  $('#cond').onclick = () => { S.sheet = true; renderSheet(); };
  el.querySelectorAll('[data-tok]').forEach(b => b.onclick = () => {
    const [a, k] = b.dataset.tok.split('|'); S.sel[a] = (S.sel[a] || []).filter(x => x !== k); render();
  });

  $('#pbA').innerHTML = hits.length ? `<table class="g">
    <thead><tr><th style="width:52px"></th><th>차량</th><th>공급사</th><th class="r">기간</th><th class="r">월 대여료</th><th>확정도</th></tr></thead>
    <tbody>${hits.map(({ p, ok }) => {
      const lead = ok[0], part = p.match !== 'TRIM';
      return `<tr data-id="${p.id}" class="${p.id === S.pid && S.focus === 'product' ? 'on' : ''}">
        <td><span class="thumb">${p.body ? glyph() : ''}</span></td>
        <td><span class="nm">${esc(p.name)}</span> <span class="mut">${esc(p.sub)}</span></td>
        <td class="mut">${esc(p.supplier)}</td>
        <td class="r n">${lead.term}개월</td>
        <td class="r n" style="font-weight:650">${won(lead.rent)}</td>
        <td><span class="st ${part ? 'wait' : 'mut'}">${part ? '확인 필요' : '트림'}</span></td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty"><b>이 조건을 다 만족하는 상품이 없다</b>
        <p>「없다」는 <b>이 조건에 없다</b>는 뜻이다. 상품이 사라진 것이 아니다.</p>
        <button class="btn sm" id="clrq">조건 지우고 다시 보기</button></div>`;

  if (drops.length) $('#pbA').insertAdjacentHTML('beforeend', `<details class="why"${hits.length ? '' : ' open'}>
    <summary><b>${drops.length}건</b>이 조건에 걸려 빠졌다 — 왜 빠졌나</summary>
    ${drops.map(({ p, why }) => `<div class="w"><b>${esc(p.name)} · ${esc(p.sub)}</b><br>${why.kind === 'p'
      ? why.miss.map(m => `<em>${esc(m)}</em>`).join(' · ')
      : `가장 가까운 것이 <code>${esc(why.o.id)}</code> 인데 ${why.miss.map(m => `<em>${esc(m)}</em>`).join(' · ')} 라 안 맞는다. 다른 Offer 에 맞는 값이 있어도 <b>같은 Offer 하나</b>가 다 만족해야 하므로 섞지 않는다.`}</div>`).join('')}
    </details>`);

  $('#pbA').querySelectorAll('tbody tr').forEach(r => r.onclick = () => { S.pid = r.dataset.id; S.oid = null; S.shot = 0; S.focus = 'product'; render(); });
  if ($('#clrq')) $('#clrq').onclick = () => { S.q = ''; S.sel = {}; render(); };
}

function tokens(sel) {
  const read = parseQ().read, out = [];
  for (const [a, keys] of Object.entries(sel)) {
    const ax = axOf(a);
    for (const k of keys) {
      const o = optOf(ax, k), label = ax.tok ? ax.tok(o) : o.label;
      const fq = read.some(r => r.axis === a && r.key === k);
      out.push(`<span class="tok${fq ? ' q' : ''}" title="${fq ? '검색어에서 읽음' : '세부필터에서 고름'}">${esc(label)}${fq ? '' : `<button data-tok="${a}|${k}" aria-label="떼기">&#10005;</button>`}</span>`);
    }
  }
  return out.join('');
}

/* ══ 판 ② 접수목록 ═════════════════════════════ */
const AF = [
  { k: 'todo', t: '칠 것', f: a => !a.cxl && !a.deliv },
  { k: 'all', t: '전체', f: () => true },
  { k: 'done', t: '인도완료', f: a => a.deliv && !a.cxl },
  { k: 'cxl', t: '취소', f: a => a.cxl },
];
function paneApps(el) {
  const f = AF.find(x => x.k === S.appFilter) || AF[0];
  const list = APPS.filter(f.f).filter(a => !S.appQ || (a.cust + a.no + a.veh + a.ch).toLowerCase().includes(S.appQ.toLowerCase()));
  if (!list.some(a => a.no === S.appNo) && list.length) S.appNo = list[0].no;

  el.innerHTML = `
    <div class="ph"><h2>접수 목록</h2><span class="c">${list.length}건</span><span class="sp"></span>
      <button class="btn sm go" id="newapp">+ 신규접수</button></div>
    <div class="bar">
      ${findbox('aq', '고객 · 접수번호 · 차량', S.appQ)}
      ${AF.map(x => `<button class="sb" data-f="${x.k}" aria-pressed="${x.k === S.appFilter}">${x.t}<span class="b">${APPS.filter(x.f).length}</span></button>`).join('')}
    </div>
    <div class="pb" id="pbB"></div>
    <div class="pf">${tl('칠 것', APPS.filter(AF[0].f).length, 'warn')}${tl('인도완료', APPS.filter(AF[2].f).length, 'ok')}${tl('취소', APPS.filter(AF[3].f).length)}</div>`;

  const aq = $('#aq');
  aq.oninput = () => { S.appQ = aq.value; paneApps(el); const e = $('#aq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); };
  if ($('#aqx')) $('#aqx').onclick = () => { S.appQ = ''; render(); };
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.appFilter = b.dataset.f; render(); });
  $('#newapp').onclick = () => { S.screen = 'product'; S.focus = 'product'; render(); };

  $('#pbB').innerHTML = list.length ? `<table class="g">
    <thead><tr><th style="width:52px"></th><th>고객</th><th>차량번호</th><th>차량</th><th>영업채널</th><th class="r">월 대여료</th><th>상태</th><th>접수일시</th></tr></thead>
    <tbody>${list.map(a => {
      const s = appStatus(a), p = PRODUCTS.find(x => x.id === a.pid);
      return `<tr data-no="${a.no}" class="${a.no === S.appNo && S.focus === 'app' ? 'on' : ''}">
        <td><span class="thumb">${p && p.body ? glyph() : ''}</span></td>
        <td><span class="nm">${esc(a.cust)}</span> <span class="mut n">${esc(a.no)}</span></td>
        <td class="n">${esc(a.plate || '—')}</td>
        <td class="mut">${esc(a.veh)}</td><td class="mut">${esc(a.ch)}</td>
        <td class="r n" style="font-weight:650">${won(a.rent)}</td>
        <td><span class="st ${s.c}">${s.t}</span></td>
        <td class="mut n">${esc(a.at)}</td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty"><b>이 칸에 걸린 접수가 없다</b><p>다른 칸을 보시라. 접수가 사라진 것이 아니다.</p></div>`;
  $('#pbB').querySelectorAll('tbody tr').forEach(r => r.onclick = () => { S.appNo = r.dataset.no; S.focus = 'app'; render(); });
}

/* ══ 판 ③ 상세 ════════════════════════════════ */


function detailProduct(el) {
  const p = prod(), sel = effSel();
  if (!p) { el.innerHTML = `<div class="ph"><h2>상품 상세</h2></div><div class="pb"><div class="empty"><b>고른 상품이 없다</b></div></div>`; return; }
  const o = offer(), anyCond = selCount(sel) > 0;
  const fact = (k, v) => `<dt>${k}</dt><dd>${v == null ? '<span class="unk">미확인</span>' : v}</dd>`;

  el.innerHTML = `
    <div class="ph"><h2>상품 상세</h2><span class="c n">${esc(p.id)} · v${p.v}</span>
      ${stepper(['상품 선택', '상세 확인', '접수 등록'], 2)}</div>
    <div class="pb"><div class="dwrap">
      <div class="dtop">
        <div>${shotBox(!!p.body, 'shot')}
          <div class="strip">${[0, 1, 2, 3].map(i => `<span data-s="${i}" aria-current="${i === S.shot}">${p.body ? glyph() : ''}</span>`).join('')}<span class="more">+2</span></div></div>
        <div>
          <div class="dchips"><span class="tag">${esc(p.maker)}</span><span class="tag">${esc(p.supplier)}</span>
            <span class="st ${p.match === 'TRIM' ? 'mut' : 'wait'}">${esc(p.matchLabel)}</span></div>
          <h3 class="dttl">${esc(p.name)}</h3><p class="dsub">${esc(p.sub)}</p>
          <div class="amt"><div><div class="k">월 대여료 · ${o.term}개월 ${VAT}</div><div class="v">${won(o.rent)}</div></div>
            <span class="u">보증금 ${depText(o)} · ${yr(o.mile) || '약정 미확인'}</span></div>
          <dl class="kv">
            ${fact('연식', p.year ? p.year + '년형' : null)}${fact('주행거리', p.mileage != null ? km(p.mileage) : null)}
            ${fact('연료', p.fuel)}${fact('인승', p.seats ? p.seats + '인승' : null)}
            ${fact('색상', p.color)}${fact('차량번호', p.plate)}
            ${fact('선택 Offer', `<span class="n">${esc(o.id)}</span>`)}${fact('적용 정책', o.pol.length ? o.pol.join(' · ') : '없음')}
          </dl>
        </div>
      </div>
      <div class="sec"><h3>대여 조건 — 공급사가 주는 ${p.offers.length}가지${anyCond ? ` · 맞는 것 ${p.offers.filter(x => offerOK(x, sel, null)).length}` : ''}</h3>
        <table class="g"><thead><tr><th class="r">기간</th><th class="r">월 대여료</th><th class="r">보증금</th><th class="r">약정주행</th><th>정책</th><th></th></tr></thead>
        <tbody id="offs">${p.offers.map(x => {
          const pass = offerOK(x, sel, null);
          const miss = AXES.filter(ax => ax.scope === 'offer' && (sel[ax.k] || []).length && !sel[ax.k].some(k => optOf(ax, k).test(x)));
          return `<tr data-oid="${x.id}" class="${x.id === S.oid ? 'on' : ''}" style="${pass ? '' : 'opacity:.48'}">
            <td class="r n">${x.term}개월</td><td class="r n" style="font-weight:650">${won(x.rent)}</td>
            <td class="r n">${depText(x)}</td><td class="r n">${yr(x.mile) || '<span class="unk">미확인</span>'}</td>
            <td class="mut">${x.pol.join(' · ') || '—'}</td>
            <td>${pass && anyCond ? '<span class="st key">조건 충족</span>' : pass ? '' : `<span class="mut" style="font-size:11px">${miss.map(ax => esc(ax.t)).join(' · ')} 불일치</span>`}</td></tr>`;
        }).join('')}</tbody></table></div>
      <div class="note"><span class="i">&#10003;</span><div><b>접수 가능한 상품입니다</b>
        <p>고른 Offer(<span class="n">${esc(o.id)}</span>)가 그대로 접수 Snapshot 에 굳습니다. 지금 상품이 바뀌어도 받은 접수는 안 바뀝니다.</p></div></div>
    </div></div>
    ${actBar({
      memo: '<textarea placeholder="접수 시 참고할 내용 (선택)"></textarea>',
      more: [{ t: '견적서 만들기', go: () => {} }, { t: '원문(RAW) 보기', go: () => {} }, '-',
             { t: '이 상품 숨기기', danger: true, go: () => {} }],
      subs: [{ t: '공유', go: () => {} }],
      main: { t: '접수 등록', go: startNew },
    })}`;

  el.querySelectorAll('#offs tr').forEach(r => r.onclick = () => {
    const x = p.offers.find(y => y.id === r.dataset.oid);
    if (!offerOK(x, sel, null)) return; S.oid = r.dataset.oid; render();
  });
  el.querySelectorAll('.strip span[data-s]').forEach(b => b.onclick = () => { S.shot = +b.dataset.s; render(); });
  bindAct(el, { more: [{ go: () => {} }, { go: () => {} }, '-', { go: () => {} }], subs: [{ go: () => {} }], main: { go: startNew } });
}

function detailApp(el) {
  const a = APPS.find(x => x.no === S.appNo);
  if (!a) { el.innerHTML = `<div class="ph"><h2>접수 상세</h2></div><div class="pb"><div class="empty"><b>고른 접수가 없다</b></div></div>`; return; }
  const p = PRODUCTS.find(x => x.id === a.pid), drift = p && p.v !== a.pv, s = appStatus(a);
  const steps = STEPS;
  const next = a.cxl ? null : steps.find(([k]) => !a[k]);
  const at = a.cxl ? 3 : !a.contract ? 1 : !a.docs ? 2 : 3;

  el.innerHTML = `
    <div class="ph"><h2>접수 상세</h2><span class="c n">${esc(a.no)}</span>
      ${stepper(['접수 확인', '서류 확인', '인도 처리'], at)}</div>
    <div class="pb"><div class="dwrap">
      <div class="dtop">
        <div>${shotBox(!!(p && p.body), 'shot')}
          <div class="strip">${[0, 1, 2, 3].map(() => `<span>${p && p.body ? glyph() : ''}</span>`).join('')}<span class="more">+2</span></div></div>
        <div>
          <div class="dchips"><span class="tag">${esc(a.ch)}</span><span class="tag">${esc(a.sup)}</span><span class="st ${s.c}">${s.t}</span></div>
          <h3 class="dttl">${esc(a.cust)}</h3><p class="dsub">${esc(a.veh)} · ${esc(a.trim)}</p>
          <div class="amt"><div><div class="k">월 대여료 · ${a.term}개월 ${VAT}</div><div class="v">${won(a.rent)}</div></div>
            <span class="u">보증금 ${a.dep ? man(a.dep) + '원' : '무보증'} · ${yr(a.mile) || '약정 미확인'}</span></div>
          <dl class="kv">
            <dt>차량번호</dt><dd class="n">${a.plate ? esc(a.plate) : '<span class="unk">미배정</span>'}</dd>
            <dt>연락처</dt><dd>${a.phone ? esc(a.phone) : '<span class="unk">미입력</span>'}</dd>
            <dt>담당자</dt><dd>${esc(a.staff)}</dd>
            <dt>선택 Offer</dt><dd class="n">${esc(a.oid)}</dd>
            <dt>굳힌 때</dt><dd class="n">${esc(a.at)}</dd>
            <dt>상품 판</dt><dd class="n">${esc(a.pid)} v${a.pv}</dd>
            <dt>영업채널</dt><dd>${esc(a.ch)}</dd>
          </dl>
        </div>
      </div>
      <div class="sec"><h3>진행 — 셋은 서로 독립인 사실이다</h3>
        <table class="g"><thead><tr><th>단계</th><th>상태</th><th>때</th><th></th></tr></thead><tbody>
          ${steps.map(([k, t]) => `<tr><td class="nm">${t}</td>
            <td><span class="st ${a[k] ? 'ok' : 'wait'}">${a[k] ? '완료' : '대기'}</span></td>
            <td class="mut n">${a[k] ? '09-16' : '—'}</td>
            <td class="r">${a.cxl ? '' : `<button class="btn sm" data-tg="${k}">${a[k] ? '되돌리기' : '완료 처리'}</button>`}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="sec"><h3>어디까지 왔나</h3>
        <ul class="tl">
          <li class="on"><div class="t">접수</div><div class="w">${esc(a.at)} · ${esc(a.staff)}</div></li>
          ${steps.map(([k, t], i) => {
            const done = a[k], now = !a.cxl && !done && steps.slice(0, i).every(([j]) => a[j]);
            return `<li class="${done ? 'on' : now ? 'now' : ''}"><div class="t">${t}</div>
              <div class="w">${done ? '완료' : now ? '지금 할 것' : '대기'}</div></li>`;
          }).join('')}
          <li class="${a.deliv && !a.cxl ? 'on' : ''}"><div class="t">실적 후보</div>
            <div class="w">${a.deliv && !a.cxl ? '넘어감 — 정산관리에서 대조' : '인도가 찍히면'}</div></li>
        </ul></div>
      ${(a.memoAgent || a.memoProvider) ? `<div class="sec"><h3>남이 쓴 메모 — 읽기만 한다</h3>
        <table class="g"><tbody>
          ${a.memoAgent ? `<tr><td class="mut" style="width:72px">영업자</td><td>${esc(a.memoAgent)}</td></tr>` : ''}
          ${a.memoProvider ? `<tr><td class="mut">공급사</td><td>${esc(a.memoProvider)}</td></tr>` : ''}
        </tbody></table>
        <p class="dsub" style="font-size:11px;margin-top:6px">★메모가 셋인 까닭 — 쓰는 사람과 보이는 사람이 다르다.
        영업자가 고객에 대해 쓴 말이 공급사에 보이면 곤란하다. 관리자만 셋 다 본다.</p></div>` : ''}
      <div class="sec"><h3>이력 — 덮지 않고 쌓는다</h3>
        <table class="g"><tbody>
          <tr><td class="mut n" style="width:90px">${esc(a.at)}</td><td><b>접수</b> — ${esc(a.staff)}</td></tr>
          ${a.contract ? '<tr><td class="mut n">09-16 10:02</td><td><b>계약서</b> 완료</td></tr>' : ''}
          ${a.docs ? '<tr><td class="mut n">09-16 11:20</td><td><b>필수서류</b> 완료</td></tr>' : ''}
          ${a.deliv ? '<tr><td class="mut n">09-16 15:40</td><td><b>인도</b> 완료 — 실적 후보로 넘어감</td></tr>' : ''}
          ${a.cxl ? `<tr><td class="mut n">09-12 17:11</td><td><b>취소</b> — ${esc(a.cxlReason)}</td></tr>` : ''}
        </tbody></table></div>
      ${a.cxl ? `<div class="note e"><span class="i">&#10005;</span><div><b>취소된 접수입니다</b><p>${esc(a.cxlReason)} — 지우지 않고 이유와 함께 남깁니다.</p></div></div>`
        : drift ? `<div class="note w"><span class="i">!</span><div><b>지금 상품은 v${p.v}, 이 접수는 v${a.pv} 를 보고 받았습니다</b>
            <p>그 사이 상품이 바뀌었습니다. <b>접수 조건은 안 바뀝니다</b> — 위 값이 접수 당시 그대로입니다.</p></div></div>`
        : `<div class="note"><span class="i">&#10003;</span><div><b>진행할 수 있는 접수입니다</b>
            <p>계약서·서류·인도는 서로 독립입니다. 순서가 어긋나도 됩니다.</p></div></div>`}
    </div></div>
    ${actBar({
      memo: '<textarea placeholder="관리자 메모 — 영업자·공급사에게는 안 보입니다"></textarea>',
      more: a.cxl ? [] : [{ t: '전자계약 보기', go: () => { S.screen = 'esign'; const m = ESIGNS.find(e => e.app === a.no); if (m) S.esignNo = m.no; S.focus = 'esign'; render(); } },
                          { t: '접수 내용 고치기', go: () => {} }, '-',
                          /* ★환수는 접수의 «체크» 가 아니라 «실적 한 줄» 이다.
                             인도가 찍힌 뒤에만 뜬다 — 나가지도 않은 것을 되돌릴 수는 없다 */
                          { t: '환수 실적 만들기…', danger: true, go: openClawPick },
                          { t: '접수 취소', danger: true, go: () => { a.cxl = true; a.cxlReason = '관리자 취소 — 사유 입력 화면이 뜬다'; render(); } }],
      subs: a.cxl ? [] : (next ? [] : [{ t: '전자계약으로', go: () => { S.screen = 'esign'; const m = ESIGNS.find(e => e.app === a.no); if (m) S.esignNo = m.no; S.focus = 'esign'; render(); } }]),
      main: a.cxl ? { t: '취소된 건', off: true }
        : next ? { t: next[1] + ' 완료 처리', go: () => { a[next[0]] = true; render(); } }
        : { t: '계약서 발송', go: () => { S.screen = 'esign'; const m = ESIGNS.find(e => e.app === a.no); if (m) S.esignNo = m.no; S.focus = 'esign'; render(); } },
    })}`;

  el.querySelectorAll('[data-tg]').forEach(b => b.onclick = ev => { ev.stopPropagation(); a[b.dataset.tg] = !a[b.dataset.tg]; render(); });
  bindAct(el, {
    more: a.cxl ? [] : [{ go: () => { S.screen = 'esign'; const m = ESIGNS.find(e => e.app === a.no); if (m) S.esignNo = m.no; S.focus = 'esign'; render(); } },
                        { go: () => {} }, '-',
                        { go: openClawPick },
                        { go: () => { a.cxl = true; a.cxlReason = '관리자 취소 — 사유 입력 화면이 뜬다'; render(); } }],
    subs: a.cxl || next ? [] : [{ go: () => { S.screen = 'esign'; const m = ESIGNS.find(e => e.app === a.no); if (m) S.esignNo = m.no; S.focus = 'esign'; render(); } }],
    main: a.cxl ? {} : next ? { go: () => { a[next[0]] = true; render(); } }
      : { go: () => { S.screen = 'esign'; const m = ESIGNS.find(e => e.app === a.no); if (m) S.esignNo = m.no; S.focus = 'esign'; render(); } },
  });
}

/**
 * ★환수는 «아무 차나» 못 만든다 (대표 2026-09-16).
 *   「계약접수 환수 드롭다운 누르고 들어가면 차량번호가 이미 실적에 있는 것 중에 고르는 거지」
 *
 * 그래서 고르는 자리를 따로 연다 — 목록은 «정상 실적» 만이고, 열쇠는 «차량번호» 다.
 *   ★인도가 찍혀 실적이 선 건만 나온다. 나가지도 않은 것을 되돌릴 수 없다.
 *   ★이미 환수가 붙은 건은 «잠근다». 두 번 되돌리면 두 배로 빠진다.
 *   ★F04 원장의 열쇠가 차량번호라 여기서도 차량번호가 첫 칸이다.
 */
function openClawPick() { S.pick = 'claw'; S.pickQ = ''; renderPick(); }

function clawTargets() {
  const q = S.pickQ.trim().toLowerCase();
  return PERFS.filter(p => p.kind === 'NEW').map(p => {
    const app = APPS.find(x => x.no === p.app) || {};
    const done = PERFS.find(x => x.origin === p.no) || null;
    return { p, app, done };
  }).filter(({ p, app }) => !q
    || (app.plate + ' ' + app.cust + ' ' + app.veh + ' ' + app.sup + ' ' + app.ch + ' ' + p.no).toLowerCase().includes(q));
}

function renderPick() {
  const root = $('#pickroot');
  if (S.pick !== 'claw') { root.innerHTML = ''; return; }
  const rows = clawTargets();
  const open = rows.filter(r => !r.done).length;

  root.innerHTML = `<div class="pick" id="pw"><div class="pickbox">
    <div class="ph"><h2>환수 대상 고르기</h2><span class="c">인도가 찍힌 건만</span>
      <span class="sp"></span><button class="btn sm" id="pkx">닫기</button></div>
    <div class="bar">${findbox('pkq', '차량번호 · 고객 · 공급사', S.pickQ)}</div>
    <div class="body2">${rows.length ? `<table class="g">
      <thead><tr><th>차량번호</th><th>고객</th><th>차량</th><th>공급사</th><th>영업채널</th>
        <th class="r">되돌릴 금액</th><th>실적</th></tr></thead>
      <tbody>${rows.map(({ p, app, done }) => `<tr data-no="${p.no}" class="${done ? 'off' : ''}">
        <td class="nm n">${esc(app.plate || '—')}</td>
        <td>${esc(app.cust)}</td><td class="mut">${esc(app.veh)}</td>
        <td class="mut">${esc(app.sup)}</td><td class="mut">${esc(app.ch)}</td>
        <td class="r n" style="font-weight:650">${won(p.bill - p.pay)}</td>
        <td>${done ? `<span class="st bad">환수됨 ${esc(done.no)}</span>` : `<span class="st mut">${esc(p.no)}</span>`}</td>
      </tr>`).join('')}</tbody></table>`
      : `<div class="empty"><b>되돌릴 실적이 없다</b>
          <p>인도가 찍혀 실적이 선 건만 환수할 수 있다.</p></div>`}</div>
    <div class="pf">${tl('되돌릴 수 있는 것', open)}${tl('이미 환수됨', rows.length - open, 'bad')}</div>
  </div></div>`;

  $('#pw').onclick = ev => { if (ev.target.id === 'pw') { S.pick = null; renderPick(); } };
  $('#pkx').onclick = () => { S.pick = null; renderPick(); };
  const q = $('#pkq');
  q.oninput = () => { S.pickQ = q.value; renderPick(); const e = $('#pkq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); };
  if ($('#pkqx')) $('#pkqx').onclick = () => { S.pickQ = ''; renderPick(); };
  root.querySelectorAll('tbody tr').forEach(r => r.onclick = () => {
    const t = rows.find(x => x.p.no === r.dataset.no);
    if (!t || t.done) return;          /* 잠긴 줄은 안 열린다 */
    S.pick = null; renderPick();
    makeClawbackFrom(t.p);
  });
  q.focus();
}

/**
 * 환수 실적 한 줄을 세운다.
 * ★원 실적을 «고치지 않는다». 부호만 뒤집은 줄을 더하고 origin 으로 묶는다.
 *   고쳐 버리면 합계는 맞아도 「왜 줄었는지」 를 나중에 못 댄다.
 * ★이미 붙은 환수가 있으면 또 세우지 않는다 — 두 번 되돌리면 두 배로 빠진다.
 */
function makeClawbackFrom(src) {
  const had = PERFS.find(p => p.origin === src.no);
  if (had) { S.perfNo = had.no; }
  else {
    const no = 'S-2609-' + String(14 - PERFS.filter(isClaw).length).padStart(3, '0');
    PERFS.unshift({ no, kind: 'CLAWBACK', app: src.app, origin: src.no, stage: 1, issue: false,
      bill: -src.bill, pay: -src.pay, at: '09-16',
      reason: '환수 사유 입력 화면이 뜬다', note: `원 실적 ${src.no} 을 되돌린다.` });
    S.perfNo = no;
  }
  S.screen = 'settle'; S.tab = 'perf'; S.focus = 'perf'; render();
}

/* ══ 정산 ══════════════════════════════════════ */
function panePerf(el) {
  const sum = PERFS.reduce((n, p) => n + (p.bill - p.pay), 0);
  const nClaw = PERFS.filter(isClaw).length;
  el.innerHTML = `<div class="ph"><h2>실적 목록</h2><span class="c">${PERFS.length}건</span><span class="sp"></span>
      <button class="btn sm" id="newclaw">+ 환수</button></div>
    <div class="pb"><table class="g">
      <thead><tr><th style="width:56px">갈래</th><th>차량번호</th><th>고객</th><th>차량</th><th>채널</th>
        <th class="r">청구</th><th class="r">지급</th><th class="r">마진</th><th>단계</th></tr></thead>
      <tbody>${PERFS.map(p => { const a = APPS.find(x => x.no === p.app);
        const st = p.issue ? { t: '이슈', c: 'bad' } : p.stage >= 4 ? { t: '확정', c: 'ok' } : { t: STAGES[p.stage - 1], c: 'wait' };
        return `<tr data-k="${p.no}" class="${p.no === S.perfNo && S.focus === 'perf' ? 'on' : ''}">
          <td><span class="st ${isClaw(p) ? 'bad' : 'mut'}">${isClaw(p) ? '환수' : '정상'}</span></td>
          <td class="n">${esc(a.plate || '—')}</td><td class="nm">${esc(a.cust)}</td><td class="mut">${esc(a.veh)}</td><td class="mut">${esc(a.ch)}</td>
          <td class="r n"${isClaw(p) ? ' style="color:var(--bad)"' : ''}>${won2(p.bill)}</td>
          <td class="r n"${isClaw(p) ? ' style="color:var(--bad)"' : ''}>${p.pay ? won2(p.pay) : '—'}</td>
          <td class="r n" style="font-weight:650${isClaw(p) ? ';color:var(--bad)' : ''}">${won2(p.bill - p.pay)}</td>
          <td><span class="st ${st.c}">${st.t}</span></td></tr>`; }).join('')}</tbody></table></div>
    <div class="pf">${tl('정상', PERFS.length - nClaw)}${tl('환수', nClaw, 'bad')}${tl('이슈', PERFS.filter(p => p.issue).length, 'bad')}
      <span class="sp"></span><span class="t"><i>마진 합계</i><b class="${sum < 0 ? 'bad' : ''}">${won2(sum)}</b></span></div>`;
  $('#newclaw').onclick = openClawPick;
  el.querySelectorAll('tbody tr').forEach(r => r.onclick = () => { S.perfNo = r.dataset.k; S.focus = 'perf'; render(); });
}

function paneLedger(el) {
  const inv = S.tab !== 'payout';
  el.innerHTML = `<div class="ph"><h2>${inv ? '청구 원장' : '지급 원장'}</h2><span class="c">2026-09</span><span class="sp"></span>
      <button class="sb" data-t="invoice" aria-pressed="${inv}">청구</button>
      <button class="sb" data-t="payout" aria-pressed="${!inv}">지급</button></div>
    <div class="pb"><table class="g">
      <thead><tr><th>${inv ? '공급사' : '영업채널'}</th><th class="r">확정액</th><th class="r">${inv ? '수금액' : '지급액'}</th><th class="r">${inv ? '미수액' : '미지급액'}</th><th>상태</th></tr></thead>
      <tbody>${inv ? BILLS.map(b => { const d = b.fixed - b.got;
          const st = d === 0 ? { t: '수금 완료', c: 'ok' } : b.got ? { t: '부분수금', c: 'wait' } : { t: '미수', c: 'bad' };
          return `<tr data-k="${esc(b.sup)}" class="${b.sup === S.billSup && S.focus === 'bill' ? 'on' : ''}">
            <td class="nm">${esc(b.sup)}</td><td class="r n">${won(b.fixed)}</td><td class="r n">${won(b.got)}</td>
            <td class="r n" style="${d ? 'color:var(--bad);font-weight:700' : ''}">${won(d)}</td>
            <td><span class="st ${st.c}">${st.t}</span></td></tr>`; }).join('')
        : PAYS.map(p => { const l = p.fixed - p.paid;
          const st = p.hold ? { t: '보류', c: 'bad' } : l === 0 ? { t: '지급 완료', c: 'ok' } : p.paid ? { t: '부분지급', c: 'wait' } : { t: '미지급', c: 'wait' };
          return `<tr data-k="${esc(p.ch)}" class="${p.ch === S.payCh && S.focus === 'pay' ? 'on' : ''}">
            <td class="nm">${esc(p.ch)}</td><td class="r n">${won(p.fixed)}</td><td class="r n">${won(p.paid)}</td>
            <td class="r n" style="${l ? 'color:var(--bad);font-weight:700' : ''}">${won(l)}</td>
            <td><span class="st ${st.c}">${st.t}</span></td></tr>`; }).join('')}</tbody></table></div>
    <div class="pf">${inv
      ? tl('공급사', BILLS.length) + tl('미수', BILLS.filter(b => b.fixed - b.got > 0).length, 'bad')
        + `<span class="sp"></span><span class="t"><i>미수 합계</i><b class="${BILLS.some(b => b.fixed > b.got) ? 'bad' : ''}">${won(BILLS.reduce((n, b) => n + (b.fixed - b.got), 0))}</b></span>`
      : tl('영업채널', PAYS.length) + tl('미지급', PAYS.filter(p => p.fixed - p.paid > 0).length, 'warn') + tl('보류', PAYS.filter(p => p.hold).length, 'bad')
        + `<span class="sp"></span><span class="t"><i>미지급 합계</i><b>${won(PAYS.reduce((n, p) => n + (p.fixed - p.paid), 0))}</b></span>`}</div>`;
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.tab = b.dataset.t; S.focus = b.dataset.t === 'payout' ? 'pay' : 'bill'; render(); });
  el.querySelectorAll('tbody tr').forEach(r => r.onclick = () => {
    if (inv) { S.billSup = r.dataset.k; S.focus = 'bill'; } else { S.payCh = r.dataset.k; S.focus = 'pay'; } render();
  });
}

function detailPerf(el) {
  const pf = PERFS.find(x => x.no === S.perfNo) || PERFS[0];
  const a = APPS.find(x => x.no === pf.app);
  el.innerHTML = `<div class="ph"><h2>실적 상세</h2><span class="c n">${esc(pf.no)}</span>
      ${stepper(['영업자 확인', '공급사 대조', '최종 확정'], Math.min(3, pf.stage))}</div>
    <div class="pb"><div class="dwrap">
      <div class="dchips"><span class="st ${isClaw(pf) ? 'bad' : 'mut'}">${isClaw(pf) ? '환수 실적' : '정상 실적'}</span>
        <span class="tag n">${esc(a.plate || '차량번호 미배정')}</span><span class="tag">${esc(a.sup)}</span><span class="tag">${esc(a.ch)}</span><span class="tag n">접수 ${esc(a.no)}</span></div>
      <h3 class="dttl">${esc(a.cust)}</h3><p class="dsub">${esc(a.veh)} · ${a.term}개월</p>
      ${isClaw(pf) ? `<div class="note e"><span class="i">↩</span><div><b>환수 — 되돌리는 줄입니다</b>
        <p>${esc(pf.reason || '')}<br>원 실적 <b class="n">${esc(pf.origin)}</b> 은 <b>그대로 둡니다</b>.
        고치지 않고 반대 부호로 한 줄을 더 세웁니다 — 나중에 «왜 줄었는지» 를 댈 수 있어야 하기 때문입니다.</p></div></div>` : ''}
      <div class="sec"><h3>돈 — 세 값은 서로 다르다</h3>
        <table class="g"><tbody>
          <tr><td>공급사 청구액</td><td class="r n" style="font-weight:650${isClaw(pf) ? ';color:var(--bad)' : ''}">${won2(pf.bill)}</td></tr>
          <tr><td>채널 지급액</td><td class="r n"${isClaw(pf) ? ' style="color:var(--bad)"' : ''}>${pf.pay ? won2(pf.pay) : '없음'}</td></tr>
          <tr><td class="nm">우리 마진</td><td class="r n" style="font-weight:700;color:var(--${isClaw(pf) ? 'bad' : 'ok'})">${won2(pf.bill - pf.pay)}</td></tr>
        </tbody></table></div>
      ${isClaw(pf) ? `<div class="sec"><h3>되돌리는 대상</h3>
        <table class="g"><tbody><tr data-goto="${esc(pf.origin)}" style="cursor:pointer">
          <td class="nm">${esc(pf.origin)}</td><td class="mut">정상 실적</td>
          <td class="r n">${won2((PERFS.find(x => x.no === pf.origin) || {}).bill || 0)}</td>
          <td class="r"><span class="btn sm">보기</span></td></tr></tbody></table></div>`
        : (PERFS.some(x => x.origin === pf.no) ? `<div class="sec"><h3>이 실적에 붙은 환수</h3>
          <table class="g"><tbody>${PERFS.filter(x => x.origin === pf.no).map(x => `<tr data-goto="${esc(x.no)}" style="cursor:pointer">
            <td class="nm">${esc(x.no)}</td><td class="mut">${esc(x.reason || '환수')}</td>
            <td class="r n" style="color:var(--bad)">${won2(x.bill - x.pay)}</td>
            <td class="r"><span class="btn sm">보기</span></td></tr>`).join('')}</tbody></table></div>` : '')}
      <div class="sec"><h3>사슬 — 네 자리를 건너뛰지 않는다</h3>
        <table class="g"><tbody>${STAGES.map((t, i) => `<tr><td style="width:34px" class="mut n">${i + 1}</td><td>${esc(t)}</td>
          <td class="r"><span class="st ${i + 1 < pf.stage ? 'ok' : i + 1 === pf.stage ? 'key' : 'mut'}">${i + 1 < pf.stage ? '완료' : i + 1 === pf.stage ? '지금 여기' : '—'}</span></td></tr>`).join('')}</tbody></table></div>
      ${pf.issue ? `<div class="note e"><span class="i">!</span><div><b>공급사와 어긋납니다</b><p>${esc(pf.note)} — 영업자 지급액에 닿는 어긋남이라 재확인으로 돌려보냅니다. 어긋난 채로 확정하지 않습니다.</p></div></div>`
        : pf.stage >= 4 ? `<div class="note"><span class="i">&#10003;</span><div><b>정산 확정</b><p>청구 원장과 지급 원장에 각각 들어갔습니다.</p></div></div>`
        : `<div class="note"><span class="i">&#10003;</span><div><b>${esc(STAGES[pf.stage - 1])} 차례입니다</b><p>어긋난 채로 확정하지 않습니다.</p></div></div>`}
    </div></div>
    <div class="dact"><div class="grow"><textarea placeholder="대조 메모"></textarea></div>
      ${pf.issue ? '<button class="btn" id="rs">이슈 해소</button><button class="btn go" id="re">재확인 요청</button>'
        : pf.stage === 1 ? '<button class="btn" id="dis">이견 있음</button><button class="btn go" id="ok">확인</button>'
        : pf.stage === 2 ? '<button class="btn" id="raise">이슈 등록</button><button class="btn go" id="ok">공급사 확인 완료</button>'
        : pf.stage === 3 ? '<button class="btn go" id="ok">정산 확정</button>'
        : '<button class="btn go" id="toInv">청구 원장에서 보기</button>'}</div>`;
  if ($('#ok')) $('#ok').onclick = () => { pf.stage = Math.min(4, pf.stage + 1); render(); };
  if ($('#raise')) $('#raise').onclick = () => { pf.issue = true; render(); };
  if ($('#dis')) $('#dis').onclick = () => { pf.issue = true; pf.note = '영업자가 이견을 냈다 — 사유 입력 화면이 뜬다'; render(); };
  if ($('#rs')) $('#rs').onclick = () => { pf.issue = false; render(); };
  if ($('#re')) $('#re').onclick = () => { pf.issue = false; pf.stage = 1; render(); };
  if ($('#toInv')) $('#toInv').onclick = () => { S.tab = 'invoice'; S.billSup = a.sup; S.focus = 'bill'; render(); };
  el.querySelectorAll('[data-goto]').forEach(r => r.onclick = () => { S.perfNo = r.dataset.goto; S.focus = 'perf'; render(); });
}

function detailBill(el) {
  const b = BILLS.find(x => x.sup === S.billSup) || BILLS[0], due = b.fixed - b.got;
  el.innerHTML = `<div class="ph"><h2>청구 상세</h2><span class="c">${esc(b.sup)} · ${b.month}</span>
      ${stepper(['청구서', '계산서', '수금'], b.got >= b.fixed ? 3 : b.tax === '발행' ? 3 : 2)}</div>
    <div class="pb"><div class="dwrap">
      <div class="dchips"><span class="tag">확정 실적 ${b.cnt}건</span><span class="st ${b.tax === '발행' ? 'ok' : 'wait'}">계산서 ${b.tax}</span></div>
      <h3 class="dttl">${esc(b.sup)}</h3><p class="dsub">${b.month} 청구</p>
      <div class="sec"><h3>돈 — 셋을 한 칸에 합치지 않는다</h3>
        <table class="g"><tbody>
          <tr><td>청구 확정액</td><td class="r n" style="font-weight:650">${won(b.fixed)}</td></tr>
          <tr><td>실제 수금액</td><td class="r n">${won(b.got)}</td></tr>
          <tr><td class="nm">미수액</td><td class="r n" style="font-weight:700;${due ? 'color:var(--bad)' : ''}">${won(due)}</td></tr>
        </tbody></table></div>
      <div class="sec"><h3>이력 — 덮지 않고 쌓는다</h3>
        <table class="g"><tbody>${b.hist.map(x => `<tr><td class="mut n" style="width:70px">${x.t}</td><td>${esc(x.w)}</td><td class="r n">${x.a != null ? won(x.a) : ''}</td></tr>`).join('')}</tbody></table></div>
      ${b.got > 0 && due > 0 ? `<div class="note w"><span class="i">!</span><div><b>부분수금은 정상입니다</b>
        <p>확정액 ${won(b.fixed)} 은 그대로 두고 들어온 ${won(b.got)} 을 이력으로 더했습니다. 원금액을 덮어쓰지 않습니다.</p></div></div>`
        : `<div class="note"><span class="i">&#10003;</span><div><b>청구확정 · 계산서 · 수금은 서로 다른 상태입니다</b><p>계산서를 끊었다고 수금이 된 것이 아닙니다.</p></div></div>`}
    </div></div>
    <div class="dact"><div class="grow"><input id="am" class="n" value="${due}" ${due ? '' : 'disabled'}
        style="width:100%;height:36px;border:1px solid var(--line-2);border-radius:5px;padding:0 10px;background:var(--card)"></div>
      ${b.tax === '미발행' ? '<button class="btn" id="tax">계산서 처리</button>' : ''}
      ${due ? '<button class="btn go" id="got">수금 등록</button>' : '<button class="btn go" id="toPay">지급 원장으로</button>'}</div>`;
  if ($('#tax')) $('#tax').onclick = () => { b.tax = '발행'; b.hist.push({ t: '09-16', w: '계산서 처리', a: null }); render(); };
  if ($('#got')) $('#got').onclick = () => {
    const v = Math.max(0, Math.min(due, parseInt(($('#am').value || '').replace(/\D/g, ''), 10) || 0));
    if (!v) return; b.got += v; b.hist.push({ t: '09-16', w: '수금 등록 — ' + (b.got >= b.fixed ? '전액' : '부분'), a: v }); render();
  };
  if ($('#toPay')) $('#toPay').onclick = () => { S.tab = 'payout'; S.focus = 'pay'; render(); };
}

function detailPay(el) {
  const p = PAYS.find(x => x.ch === S.payCh) || PAYS[0], left = p.fixed - p.paid;
  el.innerHTML = `<div class="ph"><h2>지급 상세</h2><span class="c">${esc(p.ch)} · ${p.month}</span>
      ${stepper(['지급 확정', '지급 실행', '완료'], p.paid >= p.fixed ? 3 : p.paid ? 2 : 1)}</div>
    <div class="pb"><div class="dwrap">
      <div class="dchips"><span class="tag">확정 실적 ${p.cnt}건</span>${p.hold ? '<span class="st bad">지급 보류</span>' : ''}</div>
      <h3 class="dttl">${esc(p.ch)}</h3><p class="dsub">${p.month} 지급</p>
      <div class="sec"><h3>돈</h3><table class="g"><tbody>
        <tr><td>지급 확정액</td><td class="r n" style="font-weight:650">${won(p.fixed)}</td></tr>
        <tr><td>실제 지급액</td><td class="r n">${won(p.paid)}</td></tr>
        <tr><td class="nm">미지급액</td><td class="r n" style="font-weight:700;${left ? 'color:var(--bad)' : ''}">${won(left)}</td></tr>
      </tbody></table></div>
      <div class="sec"><h3>이력</h3><table class="g"><tbody>${p.hist.map(x => `<tr><td class="mut n" style="width:70px">${x.t}</td><td>${esc(x.w)}</td><td class="r n">${x.a != null ? won(x.a) : ''}</td></tr>`).join('')}</tbody></table></div>
      ${p.hold ? `<div class="note e"><span class="i">!</span><div><b>지급 보류 — 결정 필요</b>
          <p>${esc(p.holdWhy)}<br>「공급사 수금 전에 채널에 줘도 되나」는 <b>아직 정해지지 않은 정책</b>이라 화면이 임의로 밀지 않습니다.</p></div></div>`
        : `<div class="note"><span class="i">&#10003;</span><div><b>청구 원장과 지급 원장은 따로 섭니다</b><p>받을 돈이 덜 들어왔다고 줄 돈이 저절로 줄지 않습니다.</p></div></div>`}
    </div></div>
    <div class="dact"><div class="grow"><input id="pa" class="n" value="${left}" ${p.hold || !left ? 'disabled' : ''}
        style="width:100%;height:36px;border:1px solid var(--line-2);border-radius:5px;padding:0 10px;background:var(--card)"></div>
      ${p.hold ? '<button class="btn go" id="unhold">보류 풀기</button>'
        : left ? '<button class="btn red" id="hold">지급 보류</button><button class="btn go" id="pay">지급 등록</button>'
        : '<button class="btn" disabled>지급 완료</button>'}</div>`;
  if ($('#pay')) $('#pay').onclick = () => {
    const v = Math.max(0, Math.min(left, parseInt(($('#pa').value || '').replace(/\D/g, ''), 10) || 0));
    if (!v) return; p.paid += v; p.hist.push({ t: '09-16', w: '지급 등록 — ' + (p.paid >= p.fixed ? '전액' : '부분'), a: v }); render();
  };
  if ($('#hold')) $('#hold').onclick = () => { p.hold = true; p.holdWhy = '관리자 보류 — 사유 입력 화면이 뜬다'; p.hist.push({ t: '09-16', w: '지급 보류', a: null }); render(); };
  if ($('#unhold')) $('#unhold').onclick = () => { p.hold = false; p.hist.push({ t: '09-16', w: '보류 해제', a: null }); render(); };
}

/* ══ 전자계약 ══════════════════════════════════ */
function paneEsign(el) {
  el.innerHTML = `<div class="ph"><h2>계약 목록</h2><span class="c">${ESIGNS.length}건</span></div>
    <div class="pb"><table class="g">
      <thead><tr><th>고객</th><th>차량</th><th>받는 곳</th><th>발송</th><th>열람</th><th>서명</th><th>상태</th></tr></thead>
      <tbody>${ESIGNS.map(e => { const s = esignSt(e);
        return `<tr data-no="${e.no}" class="${e.no === S.esignNo && S.focus === 'esign' ? 'on' : ''}">
          <td class="nm">${esc(e.cust)}</td><td class="mut">${esc(e.veh)}</td>
          <td class="mut n">${e.to ? esc(e.to) : '<span class="unk">없음</span>'}</td>
          <td class="mut n">${esc(e.sent)}</td><td class="mut n">${e.seen ? esc(e.seen) : '—'}</td>
          <td class="mut n">${e.signed ? esc(e.signed) : '—'}</td>
          <td><span class="st ${s.c}">${s.t}</span></td></tr>`; }).join('')}</tbody></table></div>
    <div class="pf">${tl('서명 완료', ESIGNS.filter(e => e.signed).length, 'ok')}${tl('고객 작성 중', ESIGNS.filter(e => e.seen && !e.signed).length, 'warn')}${tl('발송 전', ESIGNS.filter(e => !e.seen).length)}${tl('확인 필요', ESIGNS.filter(e => !e.to).length, 'bad')}</div>`;
  el.querySelectorAll('tbody tr').forEach(r => r.onclick = () => { S.esignNo = r.dataset.no; S.focus = 'esign'; render(); });
}

function detailEsign(el) {
  const e = ESIGNS.find(x => x.no === S.esignNo) || ESIGNS[0];
  const blocked = !e.to, at = e.signed ? 3 : e.seen ? 2 : 1;
  el.innerHTML = `<div class="ph"><h2>계약 상세</h2><span class="c n">${esc(e.no)}</span>
      ${stepper(['발송', '열람', '서명'], at)}</div>
    <div class="pb"><div class="dwrap">
      <div class="dtop"><div>${shotBox(true, 'shot')}</div>
        <div><div class="dchips"><span class="tag n">접수 ${esc(e.app)}</span><span class="st ${esignSt(e).c}">${esignSt(e).t}</span></div>
          <h3 class="dttl">${esc(e.cust)}</h3><p class="dsub">${esc(e.veh)} · ${esc(e.doc)}</p>
          <dl class="kv">
            <dt>받는 곳</dt><dd>${e.to ? esc(e.to) : '<span class="unk">연락처 없음</span>'}</dd>
            <dt>발송</dt><dd class="n">${esc(e.sent)}</dd>
            <dt>열람</dt><dd>${e.seen ? `<span class="n">${esc(e.seen)}</span>` : '<span class="unk">아직 안 봤습니다</span>'}</dd>
            <dt>서명</dt><dd>${e.signed ? `<span class="n">${esc(e.signed)}</span>` : '<span class="unk">아직</span>'}</dd>
            <dt>신분 확인</dt><dd>${e.signed
              ? '<span class="st ok">수집됨</span> <span class="mut" style="font-size:11px">주민번호·면허 — 관리자는 열람하지 않습니다</span>'
              : '<span class="mut">서명 시 수집</span>'}</dd>
          </dl></div></div>
      ${blocked ? `<div class="note e"><span class="i">!</span><div><b>보낼 곳이 없습니다</b>
          <p>접수에서 전화번호를 강제하지 않았기 때문입니다. 가짜 번호를 미리 받는 것보다 <b>여기서 받아</b> 보내는 편이 낫습니다.</p></div></div>`
        : e.signed ? `<div class="note"><span class="i">&#10003;</span><div><b>서명 완료</b><p>서명된 계약서의 판까지 남겼습니다 — 나중에 다툴 때 댈 근거가 됩니다.</p></div></div>`
        : `<div class="note"><span class="i">&#10003;</span><div><b>보냈나 · 봤나 · 서명했나는 서로 다른 사실입니다</b><p>하나의 「진행 중」으로 뭉치면 어디서 멈췄는지 못 봅니다.</p></div></div>`}
    </div></div>
    <div class="dact"><div class="grow">${blocked
        ? `<input id="eph" placeholder="받는 연락처 010-0000-0000" style="width:100%;height:36px;border:1px solid var(--line-2);border-radius:5px;padding:0 10px;background:var(--card)">`
        : `<textarea placeholder="함께 보낼 말 (선택)"></textarea>`}</div>
      <button class="btn">미리보기</button>
      ${e.signed ? '<button class="btn" disabled>완료됨</button>' : `<button class="btn go" id="send"${blocked ? ' disabled' : ''}>${e.seen ? '재발송' : '계약서 발송'}</button>`}</div>`;
  const ph = $('#eph'); if (ph) ph.oninput = () => { $('#send').disabled = ph.value.trim().length < 9; };
  if ($('#send')) $('#send').onclick = () => {
    if (blocked) e.to = $('#eph').value.trim();
    e.sent = '09-16 15:40'; e.st = e.seen ? '서명 대기' : '열람 전'; render();
  };
}

/* ══ 세부필터 시트 ═════════════════════════════ */
function renderSheet() {
  if (!S.sheet) { $('#sheetroot').innerHTML = ''; return; }
  const sel = effSel(), text = parseQ().text, read = parseQ().read;
  const live = AXES.map(ax => ({ ax, opts: ax.opts.map(o => ({ o, c: countOpt(ax, o, sel, text) })).filter(x => x.c > 0) })).filter(x => x.opts.length);
  if (!live.some(x => x.ax.k === S.sheetAxis)) S.sheetAxis = live.length ? live[0].ax.k : null;
  const cur = live.find(x => x.ax.k === S.sheetAxis);
  const picked = Object.keys(S.sel).some(k => (S.sel[k] || []).length);

  $('#sheetroot').innerHTML = `<div class="sheet" id="sw"><div class="sbox">
    <div class="sh"><b>세부필터</b><span class="sp"></span>${picked ? '<button id="sclr">초기화</button>' : ''}
      <button id="sx" aria-label="닫기">&#10005; 닫기</button></div>
    <div class="sbd">
      <nav class="smap">${live.map(({ ax }) => {
        const n = (S.sel[ax.k] || []).length + read.filter(r => r.axis === ax.k).length;
        return `<button data-a="${ax.k}" aria-current="${ax.k === S.sheetAxis}">${esc(ax.t)}${n ? `<span class="b">${n}</span>` : ''}</button>`;
      }).join('')}</nav>
      <div class="svl"><h4>${cur ? esc(cur.ax.t) : ''}</h4>
        <div class="hint">${cur && cur.ax.scope === 'offer' ? '같은 Offer 안에서 잽니다 — 다른 Offer 의 값을 섞지 않습니다' : '차 자체에 대는 잣대입니다'}</div>
        ${cur ? cur.opts.map(({ o, c }) => {
          const on = (sel[cur.ax.k] || []).includes(o.k);
          const fq = read.some(r => r.axis === cur.ax.k && r.key === o.k);
          return `<button class="opt" data-k="${o.k}" aria-pressed="${on}"${fq ? ' disabled title="검색어에서 읽은 조건 — 검색창에서 지웁니다"' : ''}>
            <span class="bx">&#10003;</span><span class="t">${esc(o.label)}${fq ? ' <span style="color:var(--ink-3);font-size:11px">· 검색어</span>' : ''}</span>
            <span class="c">${c}</span></button>`;
        }).join('') : ''}</div></div>
    <div class="sft"><button class="btn go" id="sdone">${evaluate().hits.length}건 보기</button></div>
  </div></div>`;

  $('#sw').onclick = ev => { if (ev.target.id === 'sw') { S.sheet = false; renderSheet(); } };
  $('#sx').onclick = $('#sdone').onclick = () => { S.sheet = false; renderSheet(); };
  if ($('#sclr')) $('#sclr').onclick = () => { S.sel = {}; render(); };
  $('#sheetroot').querySelectorAll('.smap button').forEach(b => b.onclick = () => { S.sheetAxis = b.dataset.a; renderSheet(); });
  $('#sheetroot').querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const k = b.dataset.k, a = S.sheetAxis;
    S.sel[a] = S.sel[a] || [];
    S.sel[a] = S.sel[a].includes(k) ? S.sel[a].filter(x => x !== k) : [...S.sel[a], k];
    render(); renderSheet();   /* 적용 단추가 없다 — 고르는 즉시 바뀐다 */
  });
}

/* ══ 껍데기 ════════════════════════════════════ */
const HEAD = {
  product: ['상품 찾기', '조건에 맞는 상품을 찾고, 그 조건 그대로 접수로 넘깁니다.'],
  intake: ['계약 접수', '접수 건을 고르고 계약서 · 필수서류 · 인도를 처리합니다.'],
  settle: ['정산 관리', '실적을 대조해 확정하고, 청구 · 수금 · 지급을 따로 관리합니다.'],
  esign: ['전자계약', '계약서를 보내고 열람 · 서명을 확인합니다.'],
};

function renderNav() {
  $('#nav').innerHTML = '<div class="gl">업무</div>' + NAV.map(n => {
    const b = n.badge ? n.badge() : 0;
    return `<button data-k="${n.k}" data-t="${esc(n.t)}" aria-current="${n.k === S.screen}" title="${esc(n.t)}">
      <span class="gi">${n.i}</span><span class="lb">${n.t}</span>${b ? `<span class="bd">${b}</span>` : ''}</button>`;
  }).join('');
  $('#nav').querySelectorAll('button').forEach(b => b.onclick = () => {
    S.screen = b.dataset.k; S.sheet = false;
    S.focus = { product: 'product', intake: 'app', settle: 'perf', esign: 'esign' }[S.screen];
    if (S.screen === 'settle') S.tab = 'invoice';
    render();
  });
}

/** ★폰이면 «다른 화면» 을 그린다. 자료와 규칙은 같고 동선만 다르다. */
function render() {
  if (window.isMobile && window.isMobile()) { window.renderMobile(); return; }
  renderNav();
  const [t, p] = HEAD[S.screen];
  const K = {
    product: () => [['판매 가능', PRODUCTS.length + '건'], ['부분 매칭', PRODUCTS.filter(x => x.match !== 'TRIM').length + '건', 'hot'], ['조건 결과', evaluate().hits.length + '건']],
    intake: () => [['칠 것', APPS.filter(a => !a.cxl && !a.deliv).length + '건', 'hot'], ['진행 중', APPS.filter(a => a.contract && !a.deliv && !a.cxl).length + '건'], ['인도완료', APPS.filter(a => a.deliv && !a.cxl).length + '건', 'ok']],
    settle: () => [['대조 중', PERFS.filter(x => x.stage < 4).length + '건', 'hot'], ['미수', man(BILLS.reduce((n, b) => n + b.fixed - b.got, 0)) + '원'], ['미지급', man(PAYS.reduce((n, x) => n + x.fixed - x.paid, 0)) + '원']],
    esign: () => [['서명 대기', ESIGNS.filter(x => x.st === '서명 대기').length + '건', 'hot'], ['열람 전', ESIGNS.filter(x => x.st === '열람 전').length + '건'], ['완료', ESIGNS.filter(x => x.st === '완료').length + '건', 'ok']],
  }[S.screen]();
  $('#phead').innerHTML = `<h1>${esc(t)}</h1><span class="sub">${esc(p)}</span>${kpis(K)}`;

  /* 목록 둘은 왼쪽에 위아래로, 상세는 «하나» 가 오른쪽에 세로로 선다.
     상세는 마지막에 고른 줄을 그린다 — 목록을 오가도 자리는 그대로다. */
  const P1 = $('#p1'), P2 = $('#p2'), D = $('#d1');
  if (S.screen === 'settle') { panePerf(P1); paneLedger(P2); }
  else if (S.screen === 'esign') { paneEsign(P1); paneApps(P2); }
  else { paneProducts(P1); paneApps(P2); }
  paneDetail(D);
  mountSplit();
  renderPick();
}

/* 좌측 두 판의 부피 — 가운데 선을 끌어서 바꾼다 */
/**
 * 가르는 선 둘 — 좌우(목록 대 상세)와 위아래(상품 줄 대 접수 줄).
 * ★기본은 «목록 1 : 상세 2» 다. master-detail 의 통상 비율이고,
 *   목록이 표 예닐곱 칸을 안 자르는 최소 폭이기도 하다.
 *   하루 종일 보는 사람마다 눈이 다르니 끌어서 바꿀 수 있게 둔다. 두 번 누르면 기본.
 */
function mountSplit() {
  const work = document.querySelector('.work');
  const vs = work.querySelector('.vs'), hs = work.querySelector('.hs');
  const apply = () => {
    work.style.gridTemplateColumns = S.lw ? `${S.lw}px 7px minmax(360px,1fr)` : '';
    work.style.gridTemplateRows = S.rh ? `${S.rh}fr 7px ${100 - S.rh}fr` : '';
  };
  if (!vs.dataset.on) {
    vs.dataset.on = '1';
    vs.addEventListener('pointerdown', ev => {
      ev.preventDefault(); vs.setPointerCapture(ev.pointerId);
      const box = work.getBoundingClientRect();
      const move = m => { S.lw = Math.max(420, Math.min(box.width - 380, m.clientX - box.left)); apply(); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    vs.addEventListener('dblclick', () => { S.lw = null; apply(); });
    hs.addEventListener('pointerdown', ev => {
      ev.preventDefault(); hs.setPointerCapture(ev.pointerId);
      const box = work.getBoundingClientRect();
      const move = m => { S.rh = Math.max(20, Math.min(80, ((m.clientY - box.top) / box.height) * 100)); apply(); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    hs.addEventListener('dblclick', () => { S.rh = null; apply(); });
  }
  apply();
}

/**
 * 신규접수 — 상품 상세에서 「접수 등록」을 누르면 «상세 자리» 만 폼으로 바뀐다.
 * ★왼쪽 목록은 그대로다. 접수 중에 다른 상품을 구경해도 «접수 대상» 은 안 따라 바뀐다 —
 *   바꾸려면 「접수 상품 바꾸기」를 눌러야 한다. 조용히 바뀌면 직원은 자기가 본 조건으로
 *   받은 줄 알고 고객에게는 다른 값을 말하게 된다.
 */
function startNew() {
  const p = prod(), o = offer();
  if (!p || !o) return;
  S.draft = { p, o, name: '', phone: '', ch: CHANNELS[1], staff: STAFF[0] };
  S.saving = false;
  S.focus = 'new';
  render();
}

function detailNew(el) {
  const d = S.draft;
  if (!d) { S.focus = 'product'; return detailProduct(el); }
  const ok = !!d.name.trim();

  el.innerHTML = `<div class="ph"><h2>신규접수</h2><span class="c">필수 4</span>
      ${stepper(['상품 선택', '상세 확인', '접수 등록'], 3)}</div>
    <div class="pb"><div class="dwrap"><div class="form">
      <div class="lock"><div class="k">접수 대상 — 고른 그대로</div>
        <div class="v">${esc(d.p.name)} · ${esc(d.p.sub)}</div>
        <div class="v2">${d.o.term}개월 · ${won(d.o.rent)}/월 · 보증금 ${dep(d.o.dep)} · ${yr(d.o.mile) || '약정 미확인'}</div>
        <div class="v2" style="color:var(--ink-3)">${esc(d.p.id)} v${d.p.v} · Offer ${esc(d.o.id)}</div></div>
      <div class="fld"><label for="f-ch">영업채널 <em>*</em></label>
        <select id="f-ch">${CHANNELS.map(c => `<option${c === d.ch ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <div class="hint">최근에 쓴 값을 미리 채웠습니다.</div></div>
      <div class="fld"><label for="f-st">담당자 <em>*</em></label>
        <select id="f-st">${STAFF.map(s => `<option${s === d.staff ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <div class="hint">로그인한 사람으로 채웠습니다.</div></div>
      <div class="fld"><label for="f-nm">고객명 <em>*</em></label>
        <input id="f-nm" value="${esc(d.name)}" placeholder="예: 김서연" autocomplete="off"></div>
      <div class="fld"><label for="f-ph">연락처</label>
        <input id="f-ph" value="${esc(d.phone)}" placeholder="아직 몰라도 됩니다" autocomplete="off">
        <div class="hint">★필수가 아닙니다. 강제하면 010-0000-0000 이 원장에 쌓입니다.</div></div>
      <div class="note"><span class="i">&#10003;</span><div><b>저장하면 이 조건이 «굳습니다»</b>
        <p>상품이 나중에 바뀌어도 이 접수의 계약조건은 안 바뀝니다. 같은 건을 두 번 눌러도 한 건만 만들어집니다.</p></div></div>
    </div></div></div>
    ${actBar({
      more: [{ t: '접수 상품 바꾸기', go: () => { S.draft = null; S.focus = 'product'; render(); } }],
      subs: [{ t: '그만두기', go: () => { S.draft = null; S.focus = 'product'; render(); } }],
      main: { t: S.saving ? '저장 중…' : '접수 저장', off: !ok || S.saving, go: saveNew },
    })}`;

  const nm = el.querySelector('#f-nm');
  nm.oninput = () => {
    d.name = nm.value;
    const mb = el.querySelector('#mainBtn');
    if (mb) mb.disabled = !d.name.trim() || S.saving;
  };
  el.querySelector('#f-ph').oninput = e => { d.phone = e.target.value; };
  el.querySelector('#f-ch').onchange = e => { d.ch = e.target.value; };
  el.querySelector('#f-st').onchange = e => { d.staff = e.target.value; };
  bindAct(el, {
    more: [{ go: () => { S.draft = null; S.focus = 'product'; render(); } }],
    subs: [{ go: () => { S.draft = null; S.focus = 'product'; render(); } }],
    main: { go: saveNew },
  });
  nm.focus(); nm.setSelectionRange(nm.value.length, nm.value.length);
}

/** ★한 번 누르면 잠근다. 서버는 submissionId 로 다시 막는다 — 화면은 거들 뿐이다. */
function saveNew() {
  const d = S.draft;
  if (!d || !d.name.trim() || S.saving) return;
  S.saving = true;
  const no = 'A-260916-' + String(S.seq++).padStart(3, '0');
  APPS.unshift({
    no, cust: d.name.trim(), phone: d.phone.trim(), veh: d.p.name, trim: d.p.sub,
    pid: d.p.id, pv: d.p.v, sup: d.p.supplier, oid: d.o.id, term: d.o.term,
    rent: d.o.rent, dep: d.o.dep, mile: d.o.mile, ch: d.ch, staff: d.staff.split(' · ')[0],
    at: '09-16 ' + new Date().toTimeString().slice(0, 5),
    contract: false, docs: false, deliv: false, cxl: false,
  });
  S.draft = null; S.saving = false;
  S.screen = 'intake'; S.appFilter = 'todo'; S.appNo = no; S.focus = 'app';
  render();
}

function paneDetail(el) {
  if (S.focus === 'new') return detailNew(el);
  if (S.focus === 'product') return detailProduct(el);
  if (S.focus === 'perf') return detailPerf(el);
  if (S.focus === 'bill') return detailBill(el);
  if (S.focus === 'pay') return detailPay(el);
  if (S.focus === 'esign') return detailEsign(el);
  return detailApp(el);
}

function _unusedSplit() {
  const col = document.querySelector('.lcol');
  col.style.gridTemplateRows = `${S.split}fr 6px ${100 - S.split}fr`;
  let bar = col.querySelector('.split');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'split';
    bar.title = '끌어서 위아래 부피를 바꿉니다';
    col.insertBefore(bar, col.children[1]);
    bar.addEventListener('pointerdown', ev => {
      ev.preventDefault(); bar.setPointerCapture(ev.pointerId);
      const box = col.getBoundingClientRect();
      const move = m => {
        const pct = ((m.clientY - box.top) / box.height) * 100;
        S.split = Math.max(18, Math.min(82, pct));
        col.style.gridTemplateRows = `${S.split}fr 6px ${100 - S.split}fr`;
      };
      const up = () => { bar.releasePointerCapture(ev.pointerId); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
  } else if (col.children[1] !== bar) {
    col.insertBefore(bar, col.children[1]);
  }
}

/* ★결은 «표에 한 줄 + CSS 한 장» 이다 (teamjpkwork docs/테마-규격.md).
   자리와 차례는 그대로 두고 색·선·입체감·모서리·글꼴만 바뀐다. */
const SKINS = [
  { k: '', t: '트렌디', d: '굳은 선 · 그림자 · 둥근 모서리' },
  { k: 'rt', t: '레트로', d: '볼록한 단추 · 파인 창 · 촘촘한 격자' },
];
let skin = 0;
$('#theme').onclick = () => {
  skin = (skin + 1) % SKINS.length;
  document.documentElement.className = SKINS[skin].k;
  $('#theme').textContent = '결: ' + SKINS[skin].t;
  $('#theme').title = SKINS[skin].d;
};

/* 사이드바 — 접으면 아이콘만 남는다. 자리는 그대로라 손이 안 헤맨다 */
$('#railtoggle').onclick = () => {
  S.mini = !S.mini;
  document.querySelector('.app').classList.toggle('mini', S.mini);
  $('#railtoggle').innerHTML = S.mini ? '&#10095;' : '&#10094;';
  $('#railtoggle').title = S.mini ? '사이드바 펼치기' : '사이드바 접기';
};

/* 폰 ↔ 데스크가 갈리는 목만 다시 그린다 — 듣개는 «하나» 다 */
let _w = innerWidth;
addEventListener('resize', () => {
  if ((innerWidth <= 1100) !== (_w <= 1100)) { _w = innerWidth; render(); }
  _w = innerWidth;
});

document.addEventListener('keydown', ev => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); $('#gq').focus(); return; }
  if (ev.key === 'Escape') {
    if (S.pick) { S.pick = null; renderPick(); }
    else if (S.sheet) { S.sheet = false; renderSheet(); }
    else if (typing) ev.target.blur();
    return;
  }
  if (typing) return;
  if (ev.key === '/' && $('#q')) { ev.preventDefault(); $('#q').focus(); }
  if (ev.key === '[') { $('#railtoggle').click(); }
});

render();
