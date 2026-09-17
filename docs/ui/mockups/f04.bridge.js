/* ══════════════════════════════════════════════════════════════════
   F04 시트 SSOT → 정산 화면.

   ★대표 2026-09-17 「시트에 있는 모든 내용을 일단 ssot화 하자」 · 「로컬에서 띄워줘봐」

   원자는 `f04.ssot.js` 가 들고 있고, 그건 `scripts/f04-ssot.mts` 가
   F04 시트 23탭에서 «읽어» 만든 것이다. 손으로 고치지 않는다.
   ★아직 아무 데도 «쓰지 않았다» — 보여주기만 한다.

   ?data=sample 로 표본, ?data=erp5 로 ERP5 거울(8일 묵음)로 되돌아간다.
   ══════════════════════════════════════════════════════════════════ */

/* ── ★수수료표에서 그 줄에 걸리는 규칙을 찾는다 ───────────────
   열쇠 = 공급사 + 갈래(렌트구분) + 형태 + 계약기간.
   못 찾으면 «못 찾았다» 고 말한다 — 아무 규칙이나 갖다 붙이지 않는다. */
/**
 * ★말이 다르다 — 실적 줄은 「신차렌트」 인데 수수료표는 「신차」 다.
 *   실측 73줄이 이것 때문에 규칙을 못 찾았다.
 *   사전(수수료표)이 «정본» 이고 별칭은 «들어오는 문» 일 뿐이다 —
 *   그래서 문을 여기 두고, 사전 쪽 말을 바꾸지 않는다.
 */
const F04_KIND_ALIAS = {
  '신차렌트': '신차', '신차': '신차',
  '재렌트': '재렌트', '월렌트': '재렌트',
  '구독': '구독',
};
function f04Rule(r) {
  const T = F04.feeTable.filter(f => f.supplier === r.supplier);
  if (!T.length) return { rule: null, why: `수수료표에 「${r.supplier || '공급사 없음'}」 가 없다` };
  const kind = F04_KIND_ALIAS[r.rentKind] || r.rentKind || '';
  const byKind = T.filter(f => f.kind === kind);
  if (!byKind.length) return { rule: null, why: `「${r.supplier}」 표에 갈래 「${kind || '빈칸'}」 가 없다` };
  const term = String(r.term ?? '');
  /* 기간이 맞는 것 → 「기간 무관」 → 하나뿐이면 그것 */
  const exact = byKind.filter(f => String(f.term ?? '') === term);
  const any = byKind.filter(f => /무관/.test(String(f.term ?? '')));
  const pick = exact.length ? exact : any.length ? any : byKind;
  if (pick.length > 1) {
    /* 형태로 더 좁힌다 */
    const byForm = pick.filter(f => f.form && r.product && String(r.product).includes(f.form));
    if (byForm.length === 1) return { rule: byForm[0], why: null };
    return { rule: null, why: `규칙이 ${pick.length}개라 하나로 못 좁혔다 (형태: ${pick.map(f => f.form || '빈칸').join(' · ')})` };
  }
  return { rule: pick[0], why: null };
}

/** ★표대로 세어 본다. 「사람이 정한다」면 «세지 않는다» — 그게 규칙이다 */
function f04Calc(r, rule, side /* 'claim' | 'pay' */) {
  if (!rule) return { v: null, why: '규칙을 못 찾았다' };
  if (!rule.byMachine) return { v: null, why: '★사람이 정한다', human: true };
  const rate = side === 'claim' ? rule.claimRate : rule.payRate;
  if (rate === null) return { v: null, why: '요율을 수로 못 읽었다' };
  switch (rule.method) {
    case '대여료×기간':
      if (r.rent === null || r.term === null) return { v: null, why: '대여료나 기간이 없다' };
      return { v: Math.round(r.rent * r.term * rate), why: `${man(r.rent)}원 × ${r.term}개월 × ${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%` };
    case '정액':
      return { v: rate, why: '표에 적힌 정액' };
    case '차량가액':
      if (r.price === null) return { v: null, why: '차량가액이 없다 — 신차만 값이 있다' };
      return { v: Math.round(r.price * rate), why: `${man(r.price)}원 × ${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%` };
    case '한달렌탈료':
      if (r.rent === null) return { v: null, why: '대여료가 없다' };
      return { v: Math.round(r.rent * rate), why: `${man(r.rent)}원 × ${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%` };
    default:
      return { v: null, why: `셈법 「${rule.method}」 는 기계가 안 센다`, human: true };
  }
}

/** ★막힌 칸 — 「무엇이 있나」가 아니라 「무엇을 하나」 */
function f04Block(r) {
  if (r.cancelled) return null;
  if (!r.supplier) return '공급사 없음';
  if (!r.paper) return '계약서';
  if (!r.delivered) return '인도';
  if (!r.billMonth) return '청구월 없음';
  if (r.claim === null || r.claim === 0) return '청구금액 0';
  if (!r.billed) return '청구';
  if (!r.collected) return '수금';
  return null;
}

const f04Margin = r => r.claim === null ? null : r.claim - (r.pay ?? 0);

(function mountF04() {
  const mode = new URLSearchParams(location.search).get('data');
  if (mode === 'sample' || mode === 'erp5' || typeof F04 === 'undefined' || !F04.rows?.length) return;
  window.F04_ON = true;
  window.F04_REPORT = F04.report;

  /* 막힌 칸을 미리 한 번만 센다 */
  for (const r of F04.rows) r.block = f04Block(r);

  const live = () => F04.rows.filter(r => !r.cancelled);
  const months = [...new Set(F04.rows.map(r => r.billMonth).filter(Boolean))].sort().reverse();

  const TABS = [
    { k: 'open', t: '현재 접수', f: r => !r.delivered && !r.cancelled },
    { k: '청구월 없음', t: '청구월 없음', f: r => r.block === '청구월 없음' },
    { k: '청구금액 0', t: '청구금액 0', f: r => r.block === '청구금액 0', bad: true },
    { k: '청구', t: '청구', f: r => r.block === '청구' },
    { k: '수금', t: '수금', f: r => r.block === '수금' },
    { k: '공급사 없음', t: '공급사 없음', f: r => r.block === '공급사 없음', bad: true },
    { k: 'all', t: '전체', f: r => !r.cancelled },
    { k: 'cxl', t: '취소', f: r => r.cancelled },
  ];

  window.panePerf = function panePerf(el) {
    const tab = TABS.find(x => x.k === S.stlTab) || TABS[0];
    const q = (S.stlQ || '').trim().toLowerCase();
    const mon = S.stlMonth || '';
    let rows = F04.rows.filter(tab.f);
    if (mon) rows = rows.filter(r => r.billMonth === mon);
    if (q) rows = rows.filter(r => ((r.plate || '') + (r.customer || '') + (r.supplier || '')
      + (r.channel || '') + (r.agent || '') + (r.model || '')).toLowerCase().includes(q));
    if (!rows.some(r => r.plate + r.receivedAt === S.perfNo) && rows.length) S.perfNo = rows[0].plate + rows[0].receivedAt;

    const claim = rows.reduce((n, r) => n + (r.claim ?? 0), 0);
    const pay = rows.reduce((n, r) => n + (r.pay ?? 0), 0);

    el.innerHTML = `
      <div class="ph"><h2>실적 원장</h2><span class="c">${rows.length}건</span><span class="sp"></span>
        <span class="c n">F04 시트 ${F04.report.perf.loaded}줄</span></div>
      <div class="bar">
        ${findbox('stlq', '차량번호 · 고객 · 공급사 · 영업자', S.stlQ || '')}
        <select id="stlmon" class="sel"><option value="">청구월 전체</option>
          ${months.map(m => `<option value="${m}"${m === mon ? ' selected' : ''}>${m}</option>`).join('')}</select>
      </div>
      <div class="bar" role="group" aria-label="막힌 칸으로 거르기">
        ${TABS.map(x => `<button class="sb${x.bad ? ' flagchip' : ''}" data-stl="${x.k}"
          aria-pressed="${x.k === tab.k}">${x.t}<span class="b">${F04.rows.filter(x.f).length}</span></button>`).join('')}
      </div>
      <div class="pb" id="stllist"></div>
      <div class="pf">${tl('청구', won2(claim))}${tl('지급', won2(pay))}
        <span class="sp"></span><span class="t"><i>남는 것</i><b>${won2(claim - pay)}</b></span></div>`;

    const body = $('#stllist');
    if (!rows.length) {
      body.innerHTML = `<div class="empty"><b>이 갈래에 줄이 없다</b>
        <p>「없다」는 <b>${esc(tab.t)}</b>${mon ? ` · ${mon}` : ''} 에 없다는 뜻이다.</p>
        <button class="btn" id="stlall">조건 지우고 전체 보기</button></div>`;
      $('#stlall').onclick = () => { S.stlTab = 'all'; S.stlQ = ''; S.stlMonth = ''; render(); };
    } else {
      body.innerHTML = `<table class="g">
        <caption class="sr">실적 원장</caption>
        <thead><tr><th scope="col">차량번호</th><th scope="col">고객</th><th scope="col">공급사</th>
          <th scope="col">영업채널</th><th scope="col">갈래</th><th scope="col">청구월</th>
          <th scope="col">할 일</th><th scope="col" class="r">청구</th><th scope="col" class="r">지급</th></tr></thead>
        <tbody>${rows.slice(0, 300).map(r => `<tr data-k="${esc(r.plate + r.receivedAt)}"
            class="${(r.plate + r.receivedAt) === S.perfNo && S.focus === 'perf' ? 'on' : ''}">
          <td class="n">${esc(r.plate)}</td><td class="nm">${esc(r.customer || '—')}</td>
          <td class="mut">${r.supplier ? esc(r.supplier) : '<span class="unk">없음</span>'}</td>
          <td class="mut">${esc(r.channel || '—')}</td>
          <td class="mut">${esc(r.rentKind || '—')}</td>
          <td class="n">${r.billMonth ? esc(r.billMonth) : '<span class="unk">없음</span>'}</td>
          <td>${r.block ? `<span class="st ${/없음|0/.test(r.block) ? 'bad' : 'wait'}">${esc(r.block)}</span>`
                        : '<span class="st ok">끝</span>'}${r.cancelled ? '<span class="flag">취소</span>' : ''}</td>
          <td class="r n">${r.claim === null ? '<span class="unk">모름</span>' : won2(r.claim)}</td>
          <td class="r n">${r.pay === null ? '—' : won2(r.pay)}</td>
        </tr>`).join('')}</tbody></table>
        ${rows.length > 300 ? `<div class="empty" style="padding:12px"><p class="mut">앞 300줄 — ${rows.length}줄 중</p></div>` : ''}`;
      el.querySelectorAll('tbody tr').forEach(t => t.onclick = () => { S.perfNo = t.dataset.k; S.focus = 'perf'; render(); });
    }
    const qq = $('#stlq');
    qq.oninput = () => { S.stlQ = qq.value; panePerf(el); const x = $('#stlq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
    if ($('#stlqx')) $('#stlqx').onclick = () => { S.stlQ = ''; render(); };
    $('#stlmon').onchange = e => { S.stlMonth = e.target.value; render(); };
    el.querySelectorAll('[data-stl]').forEach(b => b.onclick = () => { S.stlTab = b.dataset.stl; render(); });
  };

  /* ── 좌하 — ★수수료표 / 원장을 갈아 본다 ─────────────────── */
  window.paneLedger = function paneLedger(el) {
    const view = S.tab === 'fee' ? 'fee' : S.tab === 'payout' ? 'pay' : 'bill';
    const mon = S.stlMonth || '';
    let rows = live(); if (mon) rows = rows.filter(r => r.billMonth === mon);

    const head = `<div class="ph"><h2>${view === 'fee' ? '수수료표 — 셈법의 정본' : view === 'bill' ? '청구 원장' : '지급 원장'}</h2>
        <span class="c">${view === 'fee' ? F04.feeTable.length + '줄' : (mon || '전체')}</span><span class="sp"></span>
        <button class="sb" data-t="invoice" aria-pressed="${view === 'bill'}">청구</button>
        <button class="sb" data-t="payout" aria-pressed="${view === 'pay'}">지급</button>
        <button class="sb" data-t="fee" aria-pressed="${view === 'fee'}">수수료표</button></div>`;

    if (view === 'fee') {
      const q = (S.feeQ || '').trim().toLowerCase();
      const T = F04.feeTable.filter(f => !q || (f.supplier + (f.kind || '') + (f.method || '')).toLowerCase().includes(q));
      el.innerHTML = head
        + `<div class="bar">${findbox('feeq', '공급사 · 갈래 · 셈법', S.feeQ || '')}</div>
        <div class="pb"><table class="g"><caption class="sr">수수료표</caption>
          <thead><tr><th scope="col">공급사</th><th scope="col">갈래</th><th scope="col">형태</th>
            <th scope="col">기간</th><th scope="col">셈법</th><th scope="col" class="r">받을 것</th>
            <th scope="col" class="r">줄 것</th><th scope="col">누가 내나</th></tr></thead>
          <tbody>${T.map(f => `<tr>
            <td class="nm">${esc(f.supplier)}</td><td>${esc(f.kind || '—')}</td>
            <td class="mut">${esc(f.form || '—')}</td><td class="mut n">${esc(f.term || '—')}</td>
            <td><span class="st ${f.byMachine ? 'mut' : 'wait'}">${esc(f.method)}</span></td>
            <td class="r n">${esc(f.claimRaw || '—')}</td><td class="r n">${esc(f.payRaw || '—')}</td>
            <td>${f.byMachine ? '<span class="st ok">기계</span>' : '<span class="st wait">★사람</span>'}</td>
          </tr>`).join('')}</tbody></table>
          <div class="sec" style="padding:0 var(--sp2) var(--sp2)"><h3>청구·지급 «시점» — 요율과 따로 도는 규칙</h3>
            <table class="g"><tbody>${F04.timingRules.map(t => `<tr>
              <td class="nm" style="width:100px">${esc(t.who || '')}</td><td class="mut" style="width:90px">${esc(t.what || '')}</td>
              <td>${esc(t.how || '')}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="pf">${tl('기계가 낸다', F04.feeTable.filter(f => f.byMachine).length, 'ok')}${tl('★사람이 정한다', F04.feeTable.filter(f => !f.byMachine).length, 'warn')}
          <span class="sp"></span><span class="t"><i>공급사</i><b>${new Set(F04.feeTable.map(f => f.supplier)).size}</b></span></div>`;
      const fq = $('#feeq');
      fq.oninput = () => { S.feeQ = fq.value; paneLedger(el); const x = $('#feeq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
      if ($('#feeqx')) $('#feeqx').onclick = () => { S.feeQ = ''; render(); };
    } else {
      const inv = view === 'bill';
      const g = new Map();
      for (const r of rows) {
        const k = (inv ? r.supplier : r.channel) || '(없음)';
        const v = g.get(k) || { n: 0, amt: 0, zero: 0, done: 0 };
        v.n++; const a = inv ? r.claim : r.pay;
        if (!a) v.zero++; else v.amt += a;
        if (inv ? r.collected : r.billed) v.done++;
        g.set(k, v);
      }
      const list = [...g].sort((a, b) => b[1].amt - a[1].amt);
      const total = list.reduce((n, [, v]) => n + v.amt, 0);
      el.innerHTML = head + `<div class="pb"><table class="g">
        <caption class="sr">${inv ? '공급사별 청구' : '영업채널별 지급'}</caption>
        <thead><tr><th scope="col">${inv ? '공급사' : '영업채널'}</th><th scope="col" class="r">건</th>
          <th scope="col" class="r">${inv ? '청구액' : '지급액'}</th><th scope="col" class="r">0원</th>
          <th scope="col">${inv ? '수금' : '청구'}</th></tr></thead>
        <tbody>${list.map(([k, v]) => `<tr data-k="${esc(k)}" class="${k === (inv ? S.billSup : S.payCh) && S.focus === (inv ? 'bill' : 'pay') ? 'on' : ''}">
          <td class="nm">${esc(k)}</td><td class="r n">${v.n}</td>
          <td class="r n" style="font-weight:650">${won2(v.amt)}</td>
          <td class="r n">${v.zero ? `<span class="unk">${v.zero}</span>` : '—'}</td>
          <td>${v.done ? `<span class="st ok">${v.done}</span>` : '<span class="st mut">아직 안 씀</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
        <div class="pf">${tl(inv ? '공급사' : '영업채널', list.length)}${tl('줄', rows.length)}
          <span class="sp"></span><span class="t"><i>합</i><b>${won2(total)}</b></span></div>`;
      el.querySelectorAll('tbody tr').forEach(t => t.onclick = () => {
        if (inv) { S.billSup = t.dataset.k; S.focus = 'bill'; } else { S.payCh = t.dataset.k; S.focus = 'pay'; } render();
      });
    }
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      S.tab = b.dataset.t; if (b.dataset.t !== 'fee') S.focus = b.dataset.t === 'payout' ? 'pay' : 'bill'; render();
    });
  };

  /* ── 우 — ★표대로 센 값과 적힌 값을 «나란히» ────────────── */
  window.detailPerf = function detailPerf(el) {
    const r = F04.rows.find(x => (x.plate + x.receivedAt) === S.perfNo) || F04.rows[0];
    if (!r) { el.innerHTML = `<div class="ph"><h2>실적 상세</h2></div><div class="pb"><div class="empty"><b>고른 줄이 없다</b></div></div>`; return; }
    const { rule, why } = f04Rule(r);
    const c = f04Calc(r, rule, 'claim'), p = f04Calc(r, rule, 'pay');
    const gap = (calc, real) => calc.v === null || real === null ? null : calc.v - real;
    const gc = gap(c, r.claim), gp = gap(p, r.pay);
    const na = '<span class="unk">모름</span>';
    const kv = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    const at = r.collected ? 4 : r.billed ? 3 : r.delivered ? 2 : 1;

    el.innerHTML = `
      <div class="ph"><h2>실적 상세</h2><span class="c n">${esc(r.plate)}</span><span class="sp"></span>
        <span class="c">${esc(r.fromTab)}</span></div>
      <div class="pb"><div class="dwrap">
        ${stepper(['접수', '인도', '청구', '수금'], at)}
        <div class="dchips">
          ${r.block ? `<span class="st ${/없음|0/.test(r.block) ? 'bad' : 'wait'}">${esc(r.block)}</span>` : '<span class="st ok">끝</span>'}
          ${r.cancelled ? '<span class="flag">취소</span>' : ''}${r.clawback ? '<span class="flag">환수</span>' : ''}
          <span class="tag">${esc(r.supplier || '공급사 없음')}</span><span class="tag">${esc(r.channel || '—')}</span>
          ${r.rentKind ? `<span class="tag">${esc(r.rentKind)}</span>` : ''}</div>
        <h3 class="dttl">${esc(r.customer || '고객 미상')}</h3>
        <p class="dsub">${esc(r.model || '')} · 접수 ${esc(r.receivedAt || '모름')} · 청구월 ${r.billMonth ? esc(r.billMonth) : '없음'}</p>

        <div class="sec"><h3>★표대로 vs 적힌 값</h3>
          ${rule ? `<p class="dsub" style="font-size:11px;margin:0 0 6px">
            수수료표 「${esc(rule.supplier)} · ${esc(rule.kind || '')} ${esc(rule.form || '')} · ${esc(rule.term || '')}」 —
            셈법 <b>${esc(rule.method)}</b> · ${rule.byMachine ? '기계가 낸다' : '<b>★사람이 정한다</b>'}</p>`
            : `<div class="note w"><span class="i">!</span><div><b>규칙을 못 찾았다</b><p>${esc(why || '')}</p>
                <p>★아무 규칙이나 갖다 붙이지 않는다.</p></div></div>`}
          <table class="g"><caption class="sr">표대로 vs 적힌 값</caption>
            <thead><tr><th scope="col"></th><th scope="col" class="r">표대로</th><th scope="col" class="r">적힌 값</th><th scope="col" class="r">차이</th></tr></thead>
            <tbody>
              <tr><td class="nm">청구</td>
                <td class="r n">${c.v === null ? `<span class="${c.human ? 'unk' : 'mut'}">${esc(c.why)}</span>` : won(c.v)}</td>
                <td class="r n">${r.claim === null ? na : won(r.claim)}</td>
                <td class="r n" style="${gc ? 'color:var(--bad);font-weight:700' : ''}">${gc === null ? '—' : gc === 0 ? '맞는다' : won(gc)}</td></tr>
              <tr><td class="nm">지급</td>
                <td class="r n">${p.v === null ? `<span class="${p.human ? 'unk' : 'mut'}">${esc(p.why)}</span>` : won(p.v)}</td>
                <td class="r n">${r.pay === null ? na : won(r.pay)}</td>
                <td class="r n" style="${gp ? 'color:var(--bad);font-weight:700' : ''}">${gp === null ? '—' : gp === 0 ? '맞는다' : won(gp)}</td></tr>
            </tbody></table>
          ${c.v !== null ? `<p class="dsub" style="font-size:11px;margin-top:6px">셈 — ${esc(c.why)}</p>` : ''}
          ${c.human ? `<div class="note"><span class="i">&#10003;</span><div><b>표가 「사람이 정한다」 고 적었다</b>
            <p>기계가 세면 틀린다. 비어 있는 게 «빠뜨린 것» 이 아니라 <b>아직 사람이 안 정한 것</b>일 수 있다.</p></div></div>` : ''}
        </div>

        <div class="sec"><h3>조건</h3><dl class="kv">
          ${kv('상품구분', esc(r.product || '—'))}${kv('렌트구분', esc(r.rentKind || '—'))}
          ${kv('계약기간', r.term ? r.term + '개월' : na)}${kv('렌탈료', r.rent === null ? na : won(r.rent))}
          ${kv('보증금', r.deposit === null ? na : r.deposit === 0 ? '무보증' : won(r.deposit))}
          ${kv('차량가액', r.price === null ? '<span class="mut">신차만 값이 있다</span>' : won(r.price))}
          ${kv('분납', esc(r.payKind || '—') + (r.rounds ? ` · ${r.rounds}회차` : ''))}
          ${kv('계약형태', esc(r.contractType || '—'))}
          ${kv('영업담당자', esc(r.agent || '—') + (r.agentCode ? ` <span class="mut n">${esc(r.agentCode)}</span>` : ''))}
        </dl></div>

        <div class="sec"><h3>진행 — 서로 독립인 사실이다</h3>
          <table class="g"><tbody>${[
            ['계약서', r.paper, null], ['인도', r.delivered, r.deliveredAt],
            ['청구', r.billed, r.billMonth], ['수금', r.collected, null],
            ['취소', r.cancelled, null], ['환수', r.clawback, r.clawbackAt],
          ].map(([t, on, when]) => `<tr><td class="nm" style="width:70px">${t}</td>
            <td><span class="st ${on ? 'ok' : 'mut'}">${on ? '완료' : '아직 안 씀'}</span></td>
            <td class="mut n">${when ? esc(when) : '—'}</td></tr>`).join('')}</tbody></table></div>

        ${(r.note || r.special || r.adjustReason) ? `<div class="sec"><h3>글 — 뜻이 안 굳은 말</h3>
          <table class="g"><tbody>
            ${r.note ? `<tr><td class="mut" style="width:64px">비고</td><td>${esc(r.note)}</td></tr>` : ''}
            ${r.special ? `<tr><td class="mut">특이사항</td><td>${esc(r.special)}</td></tr>` : ''}
            ${r.adjustReason ? `<tr><td class="mut">가감사유</td><td>${esc(r.adjustReason)}</td></tr>` : ''}
          </tbody></table></div>` : ''}

        <div class="sec"><h3>어디서 왔나</h3><dl class="kv">
          ${kv('탭', esc(r.fromTab))}${kv('줄', r.sourceRow)}
          ${kv('청구년/월 원문', `<span class="n">${esc(String(r.billYearRaw ?? '—'))} / ${esc(String(r.billMonthRaw ?? '—'))}</span>`)}
        </dl>
        <p class="dsub" style="font-size:11px;margin-top:6px">★청구월은 «두 칸» 에서 세운다. 시트가 「2026-09」를 날짜로 바꿔 놓기도 한다.</p></div>
      </div></div>`;
  };
})();
