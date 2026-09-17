/* ══════════════════════════════════════════════════════════
   폰 — 판을 쌓지 않는다. «페이지가 바뀐다».
     목록 → 상세 → 접수폼 → (저장) → 접수목록
   한 화면에 한 가지. 위에 뒤로, 아래에 탭.
   ★데스크톱의 3판을 «압축» 하면 폰에서는 아무것도 제대로 안 보인다.
     같은 자료를 쓰되 동선을 다시 짠다 (WORK-INBOX §3).
   ══════════════════════════════════════════════════════════ */

const M = { tab: 'product', view: 'list', hist: [] };

const MTABS = [
  { k: 'product', t: '상품', i: '▤' },
  { k: 'intake', t: '접수', i: '≡', badge: () => APPS.filter(a => !a.cxl && !a.deliv).length },
  { k: 'perf', t: '실적', i: '◑', badge: () => PERFS.filter(p => p.stage < 4).length },
  { k: 'settings', t: '설정', i: '⚙' },
];

const isMobile = () => window.matchMedia('(max-width:1100px)').matches;

function mGo(view) { M.hist.push(M.view); M.view = view; renderMobile(); }
function mBack() { M.view = M.hist.pop() || 'list'; renderMobile(); }

/* ── 앱바 ─────────────────────────────────────── */
function mbar(title, sub, opts = {}) {
  const back = M.view !== 'list';
  return `<header class="mbar">
    ${back ? `<button class="mb-ic" id="mback" aria-label="이전">${ic('left')}</button>` : '<span class="mb-sp"></span>'}
    <div class="mb-t"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
    ${opts.right || '<span class="mb-sp"></span>'}
  </header>`;
}

/* ── 탭바 ─────────────────────────────────────── */
function mtabs() {
  return `<nav class="mtabs">${MTABS.map(t => {
    const b = t.badge ? t.badge() : 0;
    return `<button data-k="${t.k}" aria-current="${t.k === M.tab}">
      <span class="i">${t.i}${b ? `<em>${b}</em>` : ''}</span><span class="l">${t.t}</span></button>`;
  }).join('')}</nav>`;
}

/* ══ 상품 ══════════════════════════════════════ */
function mProducts() {
  syncProd();
  const { hits, drops, sel } = evaluate();
  const n = selCount(sel);
  return mbar('상품 찾기', `${hits.length}건`) + `<div class="mbody">
    <div class="msearch">${findbox('mq', '차종 · 무보증 · 21세 · 36개월', S.q, { filter: 'mcond', n })}</div>
    ${n ? `<div class="mtoks">${tokens(sel)}</div>` : ''}
    <div class="mlist">${hits.length ? hits.map(({ p, ok }) => {
      const lead = ok[0], part = p.match !== 'TRIM';
      return `<button class="mrow" data-id="${p.id}">
        <span class="mth">${p.body ? glyph() : ''}</span>
        <span class="mtx"><span class="m1">${esc(p.name)} <i>${esc(p.sub)}</i></span>
          <span class="m2">${esc(p.supplier)} · ${lead.term}개월${part ? ' · <span class="st wait">확인 필요</span>' : ''}</span></span>
        <span class="mr"><b class="n">${won(lead.rent)}</b></span><span class="mcv">${ic('right')}</span></button>`;
    }).join('') : `<div class="mempty"><b>이 조건에 맞는 상품이 없다</b><p>「없다」는 이 조건에 없다는 뜻이다.</p></div>`}</div>
    ${drops.length ? `<details class="why"><summary><b>${drops.length}건</b>이 조건에 걸려 빠졌다 — 왜 빠졌나</summary>
      ${drops.map(({ p, why }) => `<div class="w"><b>${esc(p.name)}</b><br>${why.kind === 'p'
        ? why.miss.map(m => `<em>${esc(m)}</em>`).join(' · ')
        : `<code>${esc(why.o.id)}</code> 이 ${why.miss.map(m => `<em>${esc(m)}</em>`).join(' · ')} 라 안 맞는다.`}</div>`).join('')}</details>` : ''}
  </div>` + mtabs();
}

function mProductDetail() {
  const p = prod(), o = offer(), sel = effSel();
  if (!p) { M.view = 'list'; return mProducts(); }
  const fact = (k, v) => `<dt>${k}</dt><dd>${v == null ? '<span class="unk">미확인</span>' : v}</dd>`;
  return mbar(p.name, p.sub, { right: `<button class="mb-ic" id="mshare" aria-label="공유">${ic('share')}</button>` })
    + `<div class="mbody pad">
      ${shotBox(!!p.body, 'shot')}
      <div class="strip">${[0, 1, 2, 3].map(i => `<span>${p.body ? glyph() : ''}</span>`).join('')}<span class="more">+2</span></div>
      <div class="dchips" style="margin-top:12px"><span class="tag">${esc(p.maker)}</span><span class="tag">${esc(p.supplier)}</span>
        <span class="st ${p.match === 'TRIM' ? 'mut' : 'wait'}">${esc(p.matchLabel)}</span></div>
      <div class="amt"><div><div class="k">월 대여료 · ${o.term}개월</div><div class="v">${won(o.rent)}</div></div>
        <span class="u">보증금 ${depText(o)} · VAT 포함</span></div>
      <div class="sec"><h3>대여 조건 — 고른 것 하나가 접수로 간다</h3>
        <div class="mopts" id="mopts">${p.offers.map(x => {
          const pass = offerOK(x, sel, null);
          return `<button class="mopt${x.id === S.oid ? ' on' : ''}" data-oid="${x.id}"${pass ? '' : ' disabled'}>
            <span class="o1"><b class="n">${x.term}개월</b><b class="n price">${won(x.rent)}</b></span>
            <span class="o2">보증금 ${depText(x)} · ${yr(x.mile) || '약정 미확인'}</span>
            <span class="o3">${x.pol.join(' · ') || '정책 없음'}</span></button>`;
        }).join('')}</div></div>
      <div class="sec"><h3>차량 정보</h3><dl class="kv">
        ${fact('연식', p.year ? p.year + '년형' : null)}${fact('주행거리', p.mileage != null ? km(p.mileage) : null)}
        ${fact('연료', p.fuel)}${fact('인승', p.seats ? p.seats + '인승' : null)}
        ${fact('색상', p.color)}${fact('차량번호', p.plate)}</dl></div>
    </div>
    <div class="mact"><button class="btn" id="mshare2">공유</button>
      <button class="btn go" id="mapply">이 조건으로 접수</button></div>` + mtabs();
}

/* ══ 접수 ══════════════════════════════════════ */
function mApps() {
  const f = AF.find(x => x.k === S.appFilter) || AF[0];
  const list = APPS.filter(f.f);
  if (!list.some(a => a.no === S.appNo) && list.length) S.appNo = list[0].no;
  return mbar('계약 접수', `${list.length}건`) + `<div class="mbody">
    <div class="mchips">${AF.map(x => `<button class="sb" data-f="${x.k}" aria-pressed="${x.k === S.appFilter}">${x.t}<span class="b">${APPS.filter(x.f).length}</span></button>`).join('')}</div>
    <div class="mlist">${list.length ? list.map(a => {
      const s = appStatus(a), p = PRODUCTS.find(x => x.id === a.pid);
      return `<button class="mrow" data-no="${a.no}">
        <span class="mth">${p && p.body ? glyph() : ''}</span>
        <span class="mtx"><span class="m1">${esc(a.cust)} <i>${esc(a.no)}</i></span>
          <span class="m2">${esc(a.veh)} · ${esc(a.ch)} · <span class="st ${s.c}">${s.t}</span></span></span>
        <span class="mr"><b class="n">${won(a.rent)}</b></span><span class="mcv">${ic('right')}</span></button>`;
    }).join('') : '<div class="mempty"><b>이 칸에 걸린 접수가 없다</b></div>'}</div>
  </div>` + mtabs();
}

function mAppDetail() {
  const a = APPS.find(x => x.no === S.appNo);
  if (!a) { M.view = 'list'; return mApps(); }
  const p = PRODUCTS.find(x => x.id === a.pid), drift = p && p.v !== a.pv, s = appStatus(a);
  const steps = STEPS;
  const next = a.cxl ? null : steps.find(([k]) => !a[k]);
  return mbar(a.cust, a.no, { right: `<button class="mb-ic" id="mmore" aria-label="더보기">${ic('more')}</button>` })
    + `<div class="mbody pad">
      <div class="dchips"><span class="tag">${esc(a.ch)}</span><span class="tag">${esc(a.sup)}</span><span class="st ${s.c}">${s.t}</span></div>
      <div class="amt"><div><div class="k">월 대여료 · ${a.term}개월</div><div class="v">${won(a.rent)}</div></div>
        <span class="u">보증금 ${a.dep ? man(a.dep)+'원' : '무보증'} · VAT 포함</span></div>
      ${drift ? `<div class="note w"><span class="i">!</span><div><b>지금 상품은 v${p.v}, 이 접수는 v${a.pv}</b>
        <p>그 사이 상품이 바뀌었습니다. 접수 조건은 안 바뀝니다.</p></div></div>` : ''}
      ${a.cxl ? `<div class="note e"><span class="i">${ic('close')}</span><div><b>취소된 접수</b><p>${esc(a.cxlReason)}</p></div></div>` : ''}
      <div class="sec"><h3>어디까지 왔나</h3>
        <ul class="tl"><li class="on"><div class="t">접수</div><div class="w">${esc(a.at)} · ${esc(a.staff)}</div></li>
        ${steps.map(([k, t], i) => {
          const done = a[k], now = !a.cxl && !done && steps.slice(0, i).every(([j]) => a[j]);
          return `<li class="${done ? 'on' : now ? 'now' : ''}"><div class="t">${t}</div><div class="w">${done ? '완료' : now ? '지금 할 것' : '대기'}</div></li>`;
        }).join('')}
        <li class="${a.deliv && !a.cxl ? 'on' : ''}"><div class="t">실적 후보</div>
          <div class="w">${a.deliv && !a.cxl ? '넘어감' : '인도가 찍히면'}</div></li></ul></div>
      <div class="sec"><h3>접수 내용</h3><dl class="kv">
        <dt>차량</dt><dd>${esc(a.veh)} ${esc(a.trim)}</dd>
        <dt>연락처</dt><dd>${a.phone ? esc(a.phone) : '<span class="unk">미입력</span>'}</dd>
        <dt>담당자</dt><dd>${esc(a.staff)}</dd>
        <dt>선택 Offer</dt><dd class="n">${esc(a.oid)}</dd>
        <dt>상품 판</dt><dd class="n">${esc(a.pid)} v${a.pv}</dd></dl></div>
    </div>
    <div class="mact">${a.cxl ? '<button class="btn" disabled>취소된 건</button>'
      : next ? `<button class="btn" id="mcxl">취소</button><button class="btn go" id="mnext">${next[1]} 완료</button>`
      : '<button class="btn go" id="mnext" disabled>모두 완료</button>'}</div>` + mtabs();
}

/* ══ 신규접수 ══════════════════════════════════ */
function mNew() {
  const d = S.draft;
  if (!d) { M.view = 'detail'; return mProductDetail(); }
  return mbar('신규접수', '필수 4') + `<div class="mbody pad">
    <div class="lock"><div class="k">접수 대상</div>
      <div class="v">${esc(d.p.name)} · ${esc(d.p.sub)}</div>
      <div class="v2">${d.o.term}개월 · ${won(d.o.rent)}/월 (VAT 포함) · 보증금 ${depText(d.o)}</div></div>
    <div class="form" style="margin-top:12px">
      <div class="fld"><label>영업채널 *</label><select id="f-ch">${CHANNELS.map(c => `<option${c === d.ch ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="fld"><label>담당자 *</label><select id="f-st">${STAFF.map(s => `<option${s === d.staff ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="fld"><label>고객명 *</label><input id="f-nm" value="${esc(d.name)}" placeholder="예: 김서연"></div>
      <div class="fld"><label>연락처</label><input id="f-ph" value="${esc(d.phone)}" placeholder="아직 몰라도 됩니다">
        <div class="hint">★필수가 아닙니다. 강제하면 가짜 번호가 쌓입니다.</div></div>
    </div></div>
    <div class="mact"><button class="btn" id="mcancel">그만두기</button>
      <button class="btn go" id="msave"${d.name.trim() ? '' : ' disabled'}>접수 저장</button></div>` + mtabs();
}

/* ══ 실적 ══════════════════════════════════════ */
function mPerfs() {
  return mbar('실적', `${PERFS.length}건`) + `<div class="mbody"><div class="mlist">${PERFS.map(p => {
    const a = APPS.find(x => x.no === p.app);
    const st = p.issue ? { t: '이슈', c: 'bad' } : p.stage >= 4 ? { t: '확정', c: 'ok' } : { t: STAGES[p.stage - 1], c: 'wait' };
    return `<button class="mrow" data-k="${p.no}">
      <span class="mtx"><span class="m1">${esc(a.cust)} <i>${esc(p.no)}</i></span>
        <span class="m2"><span class="st ${isClaw(p) ? 'bad' : 'mut'}">${isClaw(p) ? '환수' : '정상'}</span>
          ${esc(a.veh)} · <span class="st ${st.c}">${st.t}</span></span></span>
      <span class="mr"><b class="n"${isClaw(p) ? ' style="color:var(--bad)"' : ''}>${won2(p.bill - p.pay)}</b></span>
      <span class="mcv">${ic('right')}</span></button>`;
  }).join('')}</div></div>` + mtabs();
}

function mPerfDetail() {
  const pf = PERFS.find(x => x.no === S.perfNo) || PERFS[0];
  const a = APPS.find(x => x.no === pf.app);
  return mbar(a.cust, pf.no) + `<div class="mbody pad">
    <div class="dchips"><span class="tag">${esc(a.sup)}</span><span class="tag">${esc(a.ch)}</span></div>
    ${isClaw(pf) ? `<div class="note e"><span class="i">↩</span><div><b>환수 — 되돌리는 줄</b>
      <p>${esc(pf.reason || '')}<br>원 실적 <b class="n">${esc(pf.origin)}</b> 은 그대로 둡니다.</p></div></div>` : ''}
    <div class="sec"><h3>돈 — 세 값은 서로 다르다</h3><dl class="kv">
      <dt>공급사 청구액</dt><dd class="n">${won2(pf.bill)}</dd>
      <dt>채널 지급액</dt><dd class="n">${pf.pay ? won2(pf.pay) : '없음'}</dd>
      <dt>우리 마진</dt><dd class="n" style="color:var(--${isClaw(pf) ? 'bad' : 'ok'});font-weight:700">${won2(pf.bill - pf.pay)}</dd></dl></div>
    <div class="sec"><h3>사슬</h3><ul class="tl">${STAGES.map((t, i) => `<li class="${i + 1 < pf.stage ? 'on' : i + 1 === pf.stage ? 'now' : ''}">
      <div class="t">${esc(t)}</div><div class="w">${i + 1 < pf.stage ? '완료' : i + 1 === pf.stage ? '지금 여기' : '대기'}</div></li>`).join('')}</ul></div>
    ${pf.issue ? `<div class="note e"><span class="i">!</span><div><b>공급사와 어긋납니다</b><p>${esc(pf.note)}</p></div></div>` : ''}
  </div>
  <div class="mact">${pf.stage >= 4 ? '<button class="btn" disabled>확정됨</button>'
    : `<button class="btn" id="mp-no">이견</button><button class="btn go" id="mp-ok">${pf.stage === 3 ? '정산 확정' : '확인'}</button>`}</div>` + mtabs();
}

/* ══ 설정 ══════════════════════════════════════ */
function mSettings() {
  return mbar('설정', '박지훈 매니저') + `<div class="mbody">
    <div class="mlist">
      <button class="mrow" id="m-skin"><span class="mtx"><span class="m1">결</span><span class="m2">${esc(SKINS[skin].d)}</span></span>
        <span class="mr">${SKINS[skin].t}</span><span class="mcv">${ic('right')}</span></button>
      <button class="mrow" id="m-light"><span class="mtx"><span class="m1">밝기</span><span class="m2">${esc(LIGHTS[light].d)}</span></span>
        <span class="mr">${LIGHTS[light].t}</span><span class="mcv">${ic('right')}</span></button>
      <button class="mrow"><span class="mtx"><span class="m1">정산관리</span><span class="m2">청구 · 수금 · 지급</span></span><span class="mcv">${ic('right')}</span></button>
      <button class="mrow"><span class="mtx"><span class="m1">전자계약</span><span class="m2">발송 · 열람 · 서명</span></span>
        <span class="mr">${ESIGNS.filter(e => e.st !== '완료').length}</span><span class="mcv">${ic('right')}</span></button>
      <button class="mrow"><span class="mtx"><span class="m1">내 정보</span><span class="m2">박지훈 · 운영지원팀</span></span><span class="mcv">${ic('right')}</span></button>
    </div>
    <p class="mfoot">폰에서는 «한 화면에 한 가지» 다. 목록에서 누르면 상세로 가고, 아래 탭으로 업무를 바꾼다.</p>
  </div>` + mtabs();
}

/* ══ 그리기 ════════════════════════════════════ */
function renderMobile() {
  const root = document.getElementById('mapp');
  let html = '';
  if (M.tab === 'product') html = M.view === 'detail' ? mProductDetail() : M.view === 'new' ? mNew() : mProducts();
  else if (M.tab === 'intake') html = M.view === 'detail' ? mAppDetail() : mApps();
  else if (M.tab === 'perf') html = M.view === 'detail' ? mPerfDetail() : mPerfs();
  else html = mSettings();
  root.innerHTML = html;
  const V = M.view;   /* ★그린 «뒤» 에 읽는다 — 되돌아간 화면이면 위에서 이미 고쳐 놨다 */
  const q1 = sel => root.querySelector(sel);

  root.querySelectorAll('.mtabs button').forEach(b => b.onclick = () => {
    M.tab = b.dataset.k; M.view = 'list'; M.hist = []; renderMobile();
  });
  const back = root.querySelector('#mback'); if (back) back.onclick = mBack;
  if (q1('#m-skin')) q1('#m-skin').onclick = () => { skin = (skin + 1) % SKINS.length; applyTheme(); renderMobile(); };
  if (q1('#m-light')) q1('#m-light').onclick = () => { light = (light + 1) % LIGHTS.length; applyTheme(); renderMobile(); };

  if (M.tab === 'product' && V === 'list' && q1('#mq')) {
    const q = q1('#mq');
    q.oninput = () => { S.q = q.value; renderMobile(); const e = q1('#mq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); };
    q1('#mcond').onclick = () => { S.sheet = !S.sheet; renderSheet(); };
    if (q1('#mqx')) q1('#mqx').onclick = () => { S.q = ''; renderMobile(); };
    root.querySelectorAll('.mrow[data-id]').forEach(r => r.onclick = () => {
      S.pid = r.dataset.id; S.oid = null; S.shot = 0; syncProd(); mGo('detail');
    });
    root.querySelectorAll('[data-tok]').forEach(b => b.onclick = () => {
      const [a, k] = b.dataset.tok.split('|'); S.sel[a] = (S.sel[a] || []).filter(x => x !== k); renderMobile();
    });
  }
  if (M.tab === 'product' && V === 'detail' && q1('#mapply')) {
    const sel = effSel();
    root.querySelectorAll('.mopt').forEach(b => b.onclick = () => { S.oid = b.dataset.oid; renderMobile(); });
    q1('#mapply').onclick = () => { startNew(); M.view = 'list'; M.hist = ['list']; M.view = 'new'; renderMobile(); };
  }
  if (M.tab === 'product' && V === 'new' && q1('#f-nm')) {
    const d = S.draft;
    const nm = q1('#f-nm');
    nm.oninput = () => { d.name = nm.value; q1('#msave').disabled = !d.name.trim(); };
    q1('#f-ph').oninput = e => { d.phone = e.target.value; };
    q1('#f-ch').onchange = e => { d.ch = e.target.value; };
    q1('#f-st').onchange = e => { d.staff = e.target.value; };
    q1('#mcancel').onclick = () => { S.draft = null; M.view = 'detail'; renderMobile(); };
    /* ★저장하면 «접수목록» 으로 간다 — 방금 받은 건이 목록 맨 위에 있다.
       자리를 «먼저» 옮긴다. saveNew 가 스스로 다시 그리므로, 나중에 옮기면
       그린 화면과 붙이는 손이 어긋나 저장이 중간에 끊긴다. */
    q1('#msave').onclick = () => { M.tab = 'intake'; M.view = 'list'; M.hist = []; saveNew(); };
  }
  if (M.tab === 'intake' && V === 'list') {
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.appFilter = b.dataset.f; renderMobile(); });
    root.querySelectorAll('.mrow[data-no]').forEach(r => r.onclick = () => { S.appNo = r.dataset.no; mGo('detail'); });
  }
  if (M.tab === 'intake' && V === 'detail') {
    const a = APPS.find(x => x.no === S.appNo);
    const steps = STEPS;
    const next = a && !a.cxl && steps.find(([k]) => !a[k]);
    const nb = root.querySelector('#mnext'); if (nb && next) nb.onclick = () => { a[next[0]] = true; renderMobile(); };
    const cb = root.querySelector('#mcxl'); if (cb) cb.onclick = () => { a.cxl = true; a.cxlReason = '관리자 취소 — 사유 입력 화면이 뜬다'; renderMobile(); };
  }
  if (M.tab === 'perf' && V === 'list') {
    root.querySelectorAll('.mrow[data-k]').forEach(r => r.onclick = () => { S.perfNo = r.dataset.k; mGo('detail'); });
  }
  if (M.tab === 'perf' && V === 'detail') {
    const pf = PERFS.find(x => x.no === S.perfNo);
    const ok = root.querySelector('#mp-ok'); if (ok) ok.onclick = () => { pf.stage = Math.min(4, pf.stage + 1); renderMobile(); };
    const no = root.querySelector('#mp-no'); if (no) no.onclick = () => { pf.issue = true; renderMobile(); };
  }
  if (M.tab === 'settings') {
    root.querySelectorAll('.mrow')[0].onclick = () => { document.getElementById('theme').click(); renderMobile(); };
  }
}
window.renderMobile = renderMobile;
window.isMobile = isMobile;

/* app.js 가 먼저 돌고 이 파일이 나중에 실린다 — 폰이면 여기서 다시 그린다 */
if (isMobile()) renderMobile();
