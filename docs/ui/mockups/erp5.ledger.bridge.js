/* ══════════════════════════════════════════════════════════════════
   ERP5 실적 461줄 → 정산 화면.

   ★대표 2026-09-17 「9월거 준비 현재 접수 내역 집중」 · 「일단 로컬에서 보여주라」

   원자는 `erp5.ledger.js` 가 들고 있고, 그건 `scripts/erp5-ledger.mts` 가
   ERP5 Firestore 에서 «읽어» 만든 것이다. 손으로 고치지 않는다.
   ★아직 Firestore 에 «쓰지 않았다» — 보여주기만 한다.

   ?data=sample 을 붙이면 표본으로 되돌아간다.
   ══════════════════════════════════════════════════════════════════ */

/** ★갈래는 «막힌 칸» 이다 — 「무엇이 있나」가 아니라 「무엇을 하나」 */
const STL_BLOCKS = ['계약서', '인도', '청구금액 모름', '청구', '계산서', '수금', '지급'];
/** 열쇠가 없는 것은 «따로» 센다 — 정산에 못 들어간다 */
const STL_BROKEN = ['차량번호 없음', '공급사 없음'];

const stlLive = () => STL.rows.filter(r => !r.progress.cancelled);
const stlOpen = () => STL.rows.filter(r => !r.progress.delivered && !r.progress.cancelled);
/** ★청구를 모르면 마진도 모른다 — 0 으로 세지 않는다 */
const stlMargin = r => r.money.claim === null ? null : r.money.claim - (r.money.pay ?? 0);

/** 수수료 한 줄 — ★비율과 정액을 «다르게» 읽는다 */
function stlFee(f) {
  if (!f) return '—';
  if (f.mode === 'RATE') return (f.rate * 100).toFixed(2).replace(/\.?0+$/, '') + '%';
  if (f.mode === 'FLAT') return man(f.amount) + '원 <span class="mut" style="font-size:10px">정액</span>';
  return '<span class="unk">모름</span>';
}

/** 달 고르기 — 청구월이 잡힌 달만 낸다 */
function stlMonths() {
  const s = new Set();
  for (const r of STL.rows) if (r.progress.billMonth) s.add(r.progress.billMonth);
  return [...s].sort().reverse();
}

(function mountLedger() {
  const wantSample = new URLSearchParams(location.search).get('data') === 'sample';
  if (wantSample || typeof STL === 'undefined' || !STL.rows?.length) { window.STL_ON = false; return; }
  window.STL_ON = true;
  window.STL_REPORT = STL.report;

  /* ── 실적 목록 판 — 461줄 ─────────────────────────────── */
  const TABS = [
    { k: 'open', t: '현재 접수', f: r => !r.progress.delivered && !r.progress.cancelled },
    ...STL_BLOCKS.map(b => ({ k: b, t: b, f: r => r.block === b && !r.progress.cancelled })),
    { k: 'broken', t: '열쇠 없음', f: r => STL_BROKEN.includes(r.block), bad: true },
    { k: 'all', t: '전체', f: r => !r.progress.cancelled },
    { k: 'cxl', t: '취소', f: r => r.progress.cancelled },
  ];

  window.panePerf = function panePerf(el) {
    const tab = TABS.find(x => x.k === S.stlTab) || TABS[0];
    const q = (S.stlQ || '').trim().toLowerCase();
    const mon = S.stlMonth || '';
    let rows = STL.rows.filter(tab.f);
    if (mon) rows = rows.filter(r => r.progress.billMonth === mon);
    if (q) rows = rows.filter(r => ((r.plate || '') + (r.customer || '') + (r.supplier || '')
      + (r.channel || '') + (r.agent || '') + (r.model || '')).toLowerCase().includes(q));
    if (!rows.some(r => r.id === S.perfNo) && rows.length) S.perfNo = rows[0].id;

    const claim = rows.reduce((n, r) => n + (r.money.claim ?? 0), 0);
    const pay = rows.reduce((n, r) => n + (r.money.pay ?? 0), 0);
    const unknown = rows.filter(r => r.money.claim === null).length;

    el.innerHTML = `
      <div class="ph"><h2>실적 원장</h2><span class="c">${rows.length}건</span><span class="sp"></span>
        <span class="c n">ERP5 ${STL.report.read}줄에서</span></div>
      <div class="bar">
        ${findbox('stlq', '차량번호 · 고객 · 공급사 · 영업자', S.stlQ || '')}
        <select id="stlmon" class="sel">
          <option value="">청구월 전체</option>
          ${stlMonths().map(m => `<option value="${m}"${m === mon ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="bar" role="group" aria-label="막힌 칸으로 거르기">
        ${TABS.map(x => `<button class="sb${x.bad ? ' flagchip' : ''}" data-stl="${x.k}"
          aria-pressed="${x.k === tab.k}">${x.t}<span class="b">${STL.rows.filter(x.f).length}</span></button>`).join('')}
      </div>
      <div class="pb" id="stllist"></div>
      <div class="pf">${tl('청구', won2(claim))}${tl('지급', won2(pay))}${tl('모름', unknown, unknown ? 'warn' : '')}
        <span class="sp"></span><span class="t"><i>남는 것</i><b>${won2(claim - pay)}</b></span></div>`;

    const body = $('#stllist');
    if (!rows.length) {
      body.innerHTML = `<div class="empty"><b>이 갈래에 줄이 없다</b>
        <p>「없다」는 <b>${esc(tab.t)}</b>${mon ? ` · ${mon}` : ''}${q ? ` · 「${esc(S.stlQ)}」` : ''} 에 없다는 뜻이다.</p>
        <button class="btn" id="stlall">조건 지우고 전체 보기</button></div>`;
      $('#stlall').onclick = () => { S.stlTab = 'all'; S.stlQ = ''; S.stlMonth = ''; render(); };
    } else {
      body.innerHTML = `<table class="g">
        <caption class="sr">실적 원장 — 차량번호, 고객, 공급사, 영업채널, 할 일, 청구, 지급</caption>
        <thead><tr><th scope="col">차량번호</th><th scope="col">고객</th><th scope="col">모델</th>
          <th scope="col">공급사</th><th scope="col">영업채널</th><th scope="col">할 일</th>
          <th scope="col" class="r">청구</th><th scope="col" class="r">지급</th><th scope="col" class="r">남는 것</th></tr></thead>
        <tbody>${rows.slice(0, 300).map(r => {
          const m = stlMargin(r);
          const bad = STL_BROKEN.includes(r.block);
          return `<tr data-k="${esc(r.id)}" class="${r.id === S.perfNo && S.focus === 'perf' ? 'on' : ''}">
            <td class="n">${r.plate ? esc(r.plate) : '<span class="unk">없음</span>'}</td>
            <td class="nm">${esc(r.customer || '—')}</td>
            <td class="mut">${esc(r.model || '—')}</td>
            <td class="mut">${r.supplier ? esc(r.supplier) : '<span class="unk">없음</span>'}</td>
            <td class="mut">${esc(r.channel || '—')}</td>
            <td>${r.block ? `<span class="st ${bad ? 'bad' : r.block === '계약서' || r.block === '인도' ? 'key' : 'wait'}">${esc(r.block)}</span>` : '<span class="st ok">끝</span>'}
              ${r.progress.cancelled ? '<span class="flag">취소</span>' : ''}</td>
            <td class="r n">${r.money.claim === null ? '<span class="unk">모름</span>' : won2(r.money.claim)}</td>
            <td class="r n">${r.money.pay === null ? '—' : won2(r.money.pay)}</td>
            <td class="r n" style="font-weight:650${m !== null && m < 0 ? ';color:var(--bad)' : ''}">${m === null ? '<span class="unk">모름</span>' : won2(m)}</td>
          </tr>`; }).join('')}</tbody></table>
        ${rows.length > 300 ? `<div class="empty" style="padding:12px"><p class="mut">앞 300줄만 그렸다 — ${rows.length}줄 중</p></div>` : ''}`;
      el.querySelectorAll('tbody tr').forEach(t => t.onclick = () => { S.perfNo = t.dataset.k; S.focus = 'perf'; render(); });
    }

    const qq = $('#stlq');
    qq.oninput = () => { S.stlQ = qq.value; panePerf(el); const x = $('#stlq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
    if ($('#stlqx')) $('#stlqx').onclick = () => { S.stlQ = ''; render(); };
    $('#stlmon').onchange = e => { S.stlMonth = e.target.value; render(); };
    el.querySelectorAll('[data-stl]').forEach(b => b.onclick = () => { S.stlTab = b.dataset.stl; render(); });
  };

  /* ── 원장 판 — 공급사별 청구 · 채널별 지급 ───────────────── */
  window.paneLedger = function paneLedger(el) {
    const inv = S.tab !== 'payout';
    const mon = S.stlMonth || '';
    let rows = stlLive();
    if (mon) rows = rows.filter(r => r.progress.billMonth === mon);

    const g = new Map();
    for (const r of rows) {
      const k = (inv ? r.supplier : r.channel) || '(없음)';
      const v = g.get(k) || { n: 0, amt: 0, unknown: 0, ok: 0, done: 0 };
      v.n++;
      const a = inv ? r.money.claim : r.money.pay;
      if (a === null) v.unknown++; else v.amt += a;
      if (inv ? r.progress.supplierOk : r.progress.channelOk) v.ok++;
      if (inv ? r.progress.collected : r.progress.paid) v.done++;
      g.set(k, v);
    }
    const list = [...g].sort((a, b) => b[1].amt - a[1].amt);
    const total = list.reduce((n, [, v]) => n + v.amt, 0);

    el.innerHTML = `<div class="ph"><h2>${inv ? '청구 원장' : '지급 원장'}</h2>
        <span class="c">${mon || '전체'}</span><span class="sp"></span>
        <button class="sb" data-t="invoice" aria-pressed="${inv}">청구</button>
        <button class="sb" data-t="payout" aria-pressed="${!inv}">지급</button></div>
      <div class="pb"><table class="g">
        <caption class="sr">${inv ? '공급사별 청구' : '영업채널별 지급'}</caption>
        <thead><tr><th scope="col">${inv ? '공급사' : '영업채널'}</th><th scope="col" class="r">건</th>
          <th scope="col" class="r">${inv ? '청구액' : '지급액'}</th><th scope="col" class="r">모름</th>
          <th scope="col">확인</th><th scope="col">${inv ? '수금' : '지급'}</th></tr></thead>
        <tbody>${list.map(([k, v]) => `<tr data-k="${esc(k)}" class="${k === (inv ? S.billSup : S.payCh) && S.focus === (inv ? 'bill' : 'pay') ? 'on' : ''}">
          <td class="nm">${esc(k)}</td><td class="r n">${v.n}</td>
          <td class="r n" style="font-weight:650">${won2(v.amt)}</td>
          <td class="r n">${v.unknown ? `<span class="unk">${v.unknown}</span>` : '—'}</td>
          <td>${v.ok ? `<span class="st ok">${v.ok}</span>` : '<span class="st mut">아직 안 씀</span>'}</td>
          <td>${v.done ? `<span class="st ok">${v.done}</span>` : '<span class="st mut">아직 안 씀</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
      <div class="pf">${tl(inv ? '공급사' : '영업채널', list.length)}${tl('줄', rows.length)}
        <span class="sp"></span><span class="t"><i>${inv ? '청구 합' : '지급 합'}</i><b>${won2(total)}</b></span></div>`;

    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      S.tab = b.dataset.t; S.focus = b.dataset.t === 'payout' ? 'pay' : 'bill'; render();
    });
    el.querySelectorAll('tbody tr').forEach(t => t.onclick = () => {
      if (inv) { S.billSup = t.dataset.k; S.focus = 'bill'; } else { S.payCh = t.dataset.k; S.focus = 'pay'; }
      render();
    });
  };

  /* ── 실적 상세 ────────────────────────────────────────── */
  window.detailPerf = function detailPerf(el) {
    const r = STL.rows.find(x => x.id === S.perfNo) || STL.rows[0];
    if (!r) { el.innerHTML = `<div class="ph"><h2>실적 상세</h2></div><div class="pb"><div class="empty"><b>고른 줄이 없다</b></div></div>`; return; }
    const m = stlMargin(r);
    const at = r.progress.collected ? 4 : r.progress.invoiceIssued ? 3 : r.progress.billed ? 2 : 1;
    const kv = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    const na = '<span class="unk">모름</span>';

    el.innerHTML = `
      <div class="ph"><h2>실적 상세</h2><span class="c n">${esc(r.id)}</span></div>
      <div class="pb"><div class="dwrap">
        ${stepper(['인도', '청구', '계산서', '수금'], at)}
        <div class="dchips">
          ${r.block ? `<span class="st ${STL_BROKEN.includes(r.block) ? 'bad' : 'wait'}">${esc(r.block)}</span>` : '<span class="st ok">끝</span>'}
          ${r.progress.cancelled ? '<span class="flag">취소</span>' : ''}
          <span class="tag">${esc(r.supplier || '공급사 없음')}</span><span class="tag">${esc(r.channel || '채널 없음')}</span>
          ${r.rentKind ? `<span class="tag">${esc(r.rentKind)}</span>` : ''}
          ${r.money.vatIncluded ? '<span class="flag w">부가세 포함</span>' : ''}</div>
        <h3 class="dttl">${esc(r.customer || '고객 미상')}</h3>
        <p class="dsub">${esc(r.model || '')} ${r.plate ? '· ' + esc(r.plate) : ''}</p>

        <div class="amt"><div><div class="k">남는 것</div>
          <div class="v">${m === null ? na : won(m)}</div></div>
          <span class="u">청구 ${r.money.claim === null ? '모름' : won(r.money.claim)} · 지급 ${r.money.pay === null ? '—' : won(r.money.pay)}</span></div>

        ${r.warnings?.length ? `<div class="note w"><span class="i">!</span><div><b>짚을 것 ${r.warnings.length}</b>
          <p>${r.warnings.map(esc).join('<br>')}</p></div></div>` : ''}

        <div class="sec"><h3>★수수료 — 비율과 정액을 갈라 담았다</h3>
          <dl class="kv">
            ${kv('공급사', stlFee(r.supplierFee))}
            ${kv('영업채널', stlFee(r.channelFee))}
            ${kv('정산대상', esc(r.settleTarget))}
            ${kv('정산비율', r.settleRatio + (r.settleRatio !== 1 ? ` <span class="mut">${esc(r.settleNote || '까닭 없음')}</span>` : ''))}
          </dl></div>

        <div class="sec"><h3>조건</h3>
          <dl class="kv">
            ${kv('접수일', r.receivedAt ? `<span class="n">${esc(r.receivedAt)}</span>` : na)}
            ${kv('상품구분', esc(r.product || '—'))}
            ${kv('계약기간', r.term ? r.term + '개월' : na)}
            ${kv('렌탈료', r.rent ? won(r.rent) : na)}
            ${kv('보증금', r.deposit === null ? na : r.deposit === 0 ? '무보증' : won(r.deposit))}
            ${kv('차량가액', r.price === null ? '<span class="mut">신차만 값이 있다</span>' : won(r.price))}
            ${kv('분납', esc(r.payKind || '—'))}
            ${kv('계약형태', esc(r.contractType || '—'))}
            ${kv('영업담당자', esc(r.agent || '—') + (r.agentCode ? ` <span class="mut n">${esc(r.agentCode)}</span>` : ''))}
          </dl></div>

        <div class="sec"><h3>진행 — 서로 독립인 사실이다</h3>
          <table class="g"><caption class="sr">진행</caption>
            <tbody>
              ${[['계약서', r.progress.paper, null],
                 ['인도', r.progress.delivered, r.progress.deliveredAt],
                 ['청구', r.progress.billed, r.progress.billMonth],
                 ['계산서', r.progress.invoiceIssued, r.progress.invoiceAt],
                 ['수금', r.progress.collected, null],
                 ['지급', r.progress.paid, null],
                 ['공급사 확인', r.progress.supplierOk, null],
                 ['채널 확인', r.progress.channelOk, null]].map(([t, on, when]) =>
                `<tr><td class="nm" style="width:88px">${t}</td>
                 <td><span class="st ${on ? 'ok' : 'mut'}">${on ? '완료' : '아직 안 씀'}</span></td>
                 <td class="mut n">${when ? esc(when) : '—'}</td></tr>`).join('')}
            </tbody></table>
          <p class="dsub" style="font-size:11px;margin-top:6px">★「아직 안 씀」은 「0건」이 아니다.
            수금·지급·공급사 확인은 461줄 중 켜진 것이 «0» 이다 — 칸은 있고 아무도 안 채웠다.</p></div>

        ${(r.note || r.settleNote || r.money.carryNote) ? `<div class="sec"><h3>글 — 뜻이 안 굳은 말</h3>
          <table class="g"><tbody>
            ${r.note ? `<tr><td class="mut" style="width:64px">비고</td><td>${esc(r.note)}</td></tr>` : ''}
            ${r.settleNote ? `<tr><td class="mut">정산</td><td>${esc(r.settleNote)}</td></tr>` : ''}
            ${r.money.carryNote ? `<tr><td class="mut">이월</td><td>${esc(r.money.carryNote)}</td></tr>` : ''}
          </tbody></table></div>` : ''}

        <div class="sec"><h3>어디서 왔나</h3>
          <dl class="kv">${kv('시트', esc(r.source.sheet || '—'))}${kv('탭', esc(r.source.tab || '—'))}${kv('줄', r.source.rowNo ?? '—')}</dl>
          <p class="dsub" style="font-size:11px;margin-top:6px">★옮기는 동안만 쓴다. 대조가 끝나면 뗀다.</p></div>
      </div></div>`;
  };
})();
