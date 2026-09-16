/* ══════════════════════════════════════════════════════════════════
   전자계약 — 관리자 축 다섯 · 손님 축 여덟

   정본 : freepasserp4 @595abae
     docs/ESIGN_SEND_CENTER_REDESIGN_2026-08-19.md  §2-1 단계 · §2-2 플래그
                                                    §2-3 용어 · §2-4 골격
     lib/domain/esign-progress.ts · lib/domain/esign-center.ts
   규격 : ai-core @9b96007 docs/SCREEN_DESIGN_STANDARD.md (WCAG 2.2 AA · APG)
   계약 : docs/dev/DEV-CHANGE-ESIGN-001.json

   ★★축이 «둘» 이다. 섞으면 둘 다 못 읽는다.
     ① 관리자 축 — «우리» 일이 어디까지인지 (다섯)
     ② 손님  축 — «고객» 이 서명 링크에서 어디까지 갔는지 (여덟)
     목록 뱃지 = 상단 스테퍼 = 필터 칩 = 이력 라벨 — 전부 ①의 이름이다.
   ★플래그(확인 필요·만료·해지·보완 요청됨)는 단계가 «아니다».
     버킷으로 만들면 목록 다섯 줄 중 넷이 빨개진다.
   ══════════════════════════════════════════════════════════════════ */

/** ① 관리자 축 — 각 단계에 «유일한 행동» 이 하나씩 있다 */
const EC_STAGES = [
  { k: 'draft',   t: '작성',          do: '계약서 만들기' },
  { k: 'ready',   t: '발송 전',       do: '링크 만들기' },
  { k: 'filling', t: '고객 작성 중',  do: null },          /* ★없다 — 기다린다 */
  { k: 'review',  t: '검토 대기',     do: '승인 · 보완 요청' },
  { k: 'done',    t: '완료',          do: '봉인 검증' },
];

/** ② 손님 축 — 목록의 «4/8» 이 이 값이다 */
const EC_STEPS = ['본인확인', '본인정보', '차량정보', '대여조건', '보험', '서류제출', '약관동의', '서명'];

const ecStage = e => EC_STAGES.find(s => s.k === e.stage);
const ecIdx = e => EC_STAGES.findIndex(s => s.k === e.stage);

/**
 * ★플래그는 «따로» 산다. 단계 뱃지를 대체하지 않는다.
 *   확인 필요 = 보내기 전 검사에 BLOCK 이 하나라도 있는 것
 *   만료·해지 = 링크가 죽은 것 (되살리는 길은 «링크 다시 만들기» 하나)
 *   보완 요청됨 = 우리가 되돌려 보낸 것. 몇 번째인지까지 보여야 한다
 */
const ecFlags = e => ({
  attention: e.checks.some(c => c.level === 'BLOCK'),
  expired: !!e.expired,
  revoked: !!e.revoked,
  rejected: (e.rejects || []).length > 0 && e.stage === 'filling',
});
const ecBlocked = e => e.checks.filter(c => c.level === 'BLOCK');
const ecWarned = e => e.checks.filter(c => c.level === 'WARNING');

/* ── 판 ① 계약 목록 (360) ────────────────────────────────────── */
const EC_CHIPS = [
  { k: 'all', t: '전체', f: () => true },
  ...EC_STAGES.map(s => ({ k: s.k, t: s.t, f: e => e.stage === s.k })),
  /* ★「확인 필요」 는 단계가 아니라 «플래그» 라 맨 끝에 따로 선다 */
  { k: 'flag', t: '확인 필요', f: e => ecFlags(e).attention, flag: true },
];

function paneEsignList(el) {
  const chip = EC_CHIPS.find(c => c.k === S.ecChip) || EC_CHIPS[0];
  const q = (S.ecQ || '').trim().toLowerCase();
  const list = ESIGNS.filter(chip.f)
    .filter(e => !q || (e.cust + e.veh + e.no + e.sup + (e.plate || '')).toLowerCase().includes(q));
  if (!list.some(e => e.no === S.esignNo) && list.length) S.esignNo = list[0].no;

  el.innerHTML = `
    <div class="ph"><h2>계약 목록</h2><span class="c">${list.length}건</span><span class="sp"></span>
      <button class="btn sm go" id="ecnew">+ 계약서 만들기</button></div>
    <div class="bar">${findbox('ecq', '고객 · 차량 · 계약번호', S.ecQ || '')}</div>
    <div class="bar" role="group" aria-label="단계로 거르기">
      ${EC_CHIPS.map(c => `<button class="sb${c.flag ? ' flagchip' : ''}" data-ec="${c.k}"
        aria-pressed="${c.k === chip.k}">${c.t}<span class="b">${ESIGNS.filter(c.f).length}</span></button>`).join('')}
    </div>
    <div class="pb" id="eclist"></div>
    <div class="pf">${tl('검토 대기', ESIGNS.filter(e => e.stage === 'review').length, 'warn')}${tl('확인 필요', ESIGNS.filter(e => ecFlags(e).attention).length, 'bad')}${tl('완료', ESIGNS.filter(e => e.stage === 'done').length, 'ok')}</div>`;

  /* ★상태 넷을 서로 다른 말과 서로 다른 «다음 행동» 으로 가른다 (규격: Feedback and data states) */
  const body = $('#eclist');
  if (!ESIGNS.length) {
    body.innerHTML = `<div class="empty"><b>아직 계약이 없다</b>
      <p>접수에서 넘어오거나, 여기서 새로 만든다.</p>
      <button class="btn go" id="ecempty">계약서 만들기</button></div>`;
    $('#ecempty').onclick = () => alert('계약서 만들기 — 공급사 → 차량 → 대여료 → 조건 (이번 범위 밖)');
    return wire();
  }
  if (!list.length) {
    body.innerHTML = `<div class="empty"><b>이 조건에 맞는 계약이 없다</b>
      <p>「없다」는 <b>${esc(chip.t)}</b>${q ? ` · 「${esc(S.ecQ)}」` : ''} 조건에 없다는 뜻이다. 계약이 없다는 뜻이 아니다.</p>
      <button class="btn" id="ecall">조건 지우고 전체 보기</button></div>`;
    $('#ecall').onclick = () => { S.ecChip = 'all'; S.ecQ = ''; render(); };
    return wire();
  }

  body.innerHTML = `<table class="g">
    <caption class="sr">전자계약 목록 — 고객, 단계, 고객 진행, 갱신 시각</caption>
    <thead><tr><th scope="col">고객</th><th scope="col">단계</th>
      <th scope="col" class="r">고객 진행</th><th scope="col" class="r">갱신</th></tr></thead>
    <tbody>${list.map(e => {
      const f = ecFlags(e), st = ecStage(e);
      return `<tr data-no="${e.no}" class="${e.no === S.esignNo && S.focus === 'esign' ? 'on' : ''}">
        <td><span class="nm">${esc(e.cust)}</span><br><span class="mut" style="font-size:10.5px">${esc(e.veh)}</span></td>
        <td><span class="st ${ecTone(e)}">${esc(st.t)}</span>
          ${f.attention ? '<span class="flag" title="발송 전 확인에 막힌 것이 있다">확인 필요</span>' : ''}
          ${f.rejected ? `<span class="flag w">보완 ${e.rejects.length}차</span>` : ''}
          ${f.revoked ? '<span class="flag">해지됨</span>' : f.expired ? '<span class="flag">만료</span>' : ''}</td>
        <td class="r n">${e.stage === 'draft' ? '<span class="mut">—</span>'
          : `${e.steps}/8 <span class="mut" style="font-size:10px">${esc(EC_STEPS[Math.min(e.steps, 7)])}</span>`}</td>
        <td class="r mut n">${esc(e.at)}</td></tr>`;
    }).join('')}</tbody></table>`;
  wire();

  function wire() {
    const q2 = $('#ecq');
    q2.oninput = () => { S.ecQ = q2.value; paneEsignList(el); const x = $('#ecq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
    if ($('#ecqx')) $('#ecqx').onclick = () => { S.ecQ = ''; render(); };
    $('#ecnew').onclick = () => alert('계약서 만들기 — 공급사 → 차량 → 대여료 → 조건 (이번 범위 밖)');
    el.querySelectorAll('[data-ec]').forEach(b => b.onclick = () => { S.ecChip = b.dataset.ec; render(); });
    el.querySelectorAll('tbody tr').forEach(r => r.onclick = () => { S.esignNo = r.dataset.no; S.focus = 'esign'; render(); });
  }
}

/** 단계 색 — ★색«만»으로 말하지 않는다. 이름이 늘 함께 선다 (WCAG 1.4.1) */
const ecTone = e => e.stage === 'done' ? 'ok' : e.stage === 'review' ? 'wait' : e.stage === 'draft' ? 'mut' : 'key';

/* ── 판 ②·③ 계약 진행 (넓게) ─────────────────────────────────── */
function paneEsignWork(el) {
  const e = ESIGNS.find(x => x.no === S.esignNo);
  if (!e) {
    el.innerHTML = `<div class="ph"><h2>계약 진행</h2></div>
      <div class="pb"><div class="empty"><b>고른 계약이 없다</b><p>목록에서 한 줄을 고른다.</p></div></div>`;
    return;
  }
  const st = ecStage(e), at = ecIdx(e), f = ecFlags(e);
  const blocks = ecBlocked(e), warns = ecWarned(e);

  el.innerHTML = `
    <div class="ph"><h2>계약 진행</h2><span class="c n">${esc(e.no)}</span><span class="sp"></span>
      <span class="c">${esc(e.sup)} · ${esc(e.kind)}</span></div>
    <div class="pb"><div class="dwrap">

      <ol class="ecstep" aria-label="계약 단계">
        ${EC_STAGES.map((s, i) => `<li class="${i < at ? 'dn' : i === at ? 'on' : ''}"
          ${i === at ? 'aria-current="step"' : ''}><span class="n2">${i + 1}</span>${s.t}</li>`).join('')}
      </ol>

      ${blocks.length ? `<div class="card bad" role="alert">
        <h4>발송 전 확인 — ${blocks.length}건이 막고 있다</h4>
        <ul class="ecchk">${blocks.map(c => `<li><b>${esc(c.t)}</b>
          ${c.fix ? `<button class="btn sm" data-fix="${esc(c.fix)}">${esc(c.fix)}</button>` : ''}</li>`).join('')}</ul>
        <p class="hint">★막힌 것이 하나라도 있으면 링크를 만들지 않는다. 잘못 나간 계약서는 되부르지 못한다.</p>
      </div>` : warns.length ? `<div class="card warn">
        <h4>발송 전 확인 — 짚고 넘어갈 것 ${warns.length}건</h4>
        <ul class="ecchk">${warns.map(c => `<li><b>${esc(c.t)}</b></li>`).join('')}</ul>
        <p class="hint">막지는 않는다. 알고 보내는 것과 모르고 보내는 것은 다르다.</p></div>` : ''}

      ${f.revoked || f.expired ? `<div class="card warn">
        <h4>${f.revoked ? '링크를 해지했다' : '링크가 만료됐다'}</h4>
        <p class="hint">${f.revoked ? esc(e.revokedAt) : esc(e.expiresAt)} · 고객은 더 이상 열 수 없다.
          되살리는 길은 <b>링크 다시 만들기</b> 하나다.</p></div>` : ''}

      ${f.rejected ? `<div class="card warn">
        <h4>보완 요청됨 — ${e.rejects.length}차</h4>
        ${e.rejects.map(r => `<div class="ecrej"><span class="n mut">${esc(r.at)}</span>
          <div><b>${r.items.map(esc).join(' · ')}</b><p class="hint">${esc(r.why)}</p></div></div>`).join('')}
      </div>` : ''}

      <div class="card">
        <h4>지금 단계 — ${esc(st.t)}</h4>
        ${ecStageBody(e, st, blocks)}
      </div>

      ${e.stage !== 'draft' ? `<div class="card">
        <h4>고객이 간 길 <span class="mut" style="font-weight:400">— 우리 단계와 다른 축이다</span></h4>
        <div class="ecjour" role="img" aria-label="고객 진행 ${e.steps} / 8단계">
          ${EC_STEPS.map((t, i) => `<span class="${i < e.steps ? 'dn' : i === e.steps ? 'now' : ''}">${t}</span>`).join('')}
        </div>
        <p class="hint">${e.steps}/8 · ${e.steps >= 8 ? '제출까지 마쳤다' : `지금 <b>${esc(EC_STEPS[e.steps])}</b> 에서 멈춰 있다`}</p>
      </div>` : ''}

      <div class="card">
        <h4>이력 — 덮지 않고 쌓는다</h4>
        <table class="g"><caption class="sr">계약 이력</caption>
          <tbody>${e.hist.map(x => `<tr><td class="mut n" style="width:88px">${esc(x.at)}</td>
            <td><b>${esc(x.t)}</b>${x.who ? ` <span class="mut">— ${esc(x.who)}</span>` : ''}</td></tr>`).join('')}</tbody></table>
      </div>
    </div></div>`;

  el.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => alert(b.dataset.fix + ' — 이번 범위 밖'));
  wireStageActions(e, blocks);
}

/** 단계마다 «할 수 있는 일» 이 하나다. 없으면 없다고 말한다. */
function ecStageBody(e, st, blocks) {
  if (e.stage === 'draft') return `<p class="hint">아직 저장 전이다. 공급사 · 차량 · 대여료 · 조건을 정하면 <b>계약서 만들기</b> 가 열린다.</p>
    <div class="ecact"><button class="btn go" disabled>계약서 만들기</button>
      <span class="why">조건이 다 차지 않았다</span></div>`;
  if (e.stage === 'ready') return `<p class="hint">계약서는 섰다. 고객이 열 <b>링크</b> 를 만들어 전달한다.</p>
    <div class="ecact"><button class="btn go" id="ecmk"${blocks.length ? ' disabled' : ''}>링크 만들기</button>
      ${blocks.length ? `<span class="why">발송 전 확인 ${blocks.length}건이 막고 있다</span>`
        : `<span class="why">받는 곳 ${esc(e.to)}</span>`}</div>`;
  if (e.stage === 'filling') return `<p class="hint">★우리가 할 일은 <b>없다</b>. 고객이 쓰는 중이라 기다린다.
      재촉이 필요하면 링크를 다시 전달하고, 잘못 나갔으면 해지한다.</p>
    <div class="ecact"><button class="btn" id="eccopy">링크 복사</button>
      <button class="btn" id="ecrevoke">링크 해지</button>
      <span class="why">마지막 열람 ${esc(e.seenAt || '아직')}</span></div>`;
  if (e.stage === 'review') return `<p class="hint">고객이 제출했다. 낸 것을 확인하고 <b>승인</b> 하거나 <b>보완 요청</b> 한다.</p>
    ${e.docs.length ? `<table class="g"><caption class="sr">제출 서류</caption>
      <thead><tr><th scope="col">서류</th><th scope="col">제출</th><th scope="col">해시</th></tr></thead>
      <tbody>${e.docs.map(d => `<tr><td class="nm">${esc(d.t)}</td><td class="mut n">${esc(d.at)}</td>
        <td class="mut n" style="font-size:10.5px">${esc(d.sha)}</td></tr>`).join('')}</tbody></table>
      <p class="hint">★원본 파일은 우리에게 오지 않는다 — 제출 여부와 시각 · 해시만 온다.</p>` : ''}
    <div class="ecact"><button class="btn go" id="ecok">승인</button>
      <button class="btn" id="ecfix">보완 요청</button></div>`;
  return `<p class="hint">서명까지 끝났다. 남은 것은 <b>봉인 검증</b> 과 인도일 확정이다.</p>
    <div class="ecact"><button class="btn" id="ecverify">봉인 검증</button>
      <span class="why">서명 ${esc(e.signedAt)}</span></div>`;
}

function wireStageActions(e, blocks) {
  const log = (t, who) => { e.hist.unshift({ at: '09-16 16:20', t, who: who || '박지훈' }); };
  const go = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
  go('ecmk', () => { if (blocks.length) return; e.stage = 'filling'; e.seenAt = null; e.steps = 0; log('링크 만들기'); render(); });
  go('eccopy', () => alert('링크를 복사했다 — https://freepasserp.com/sign/' + e.no));
  go('ecrevoke', () => { e.revoked = '09-16 16:20'; e.revokedAt = '09-16 16:20'; log('링크 해지'); render(); });
  go('ecok', () => { e.stage = 'done'; e.signedAt = '09-16 16:20'; e.steps = 8; log('승인'); render(); });
  go('ecfix', () => {
    e.stage = 'filling'; e.steps = 5;
    (e.rejects = e.rejects || []).push({ at: '09-16 16:20', items: ['재직증명서'], why: '발급일이 3개월을 넘었다' });
    log('보완 요청'); render();
  });
  go('ecverify', () => alert('봉인 해시 ' + e.seal + '\n검증 ' + e.verifyUrl));
}

/* ── 판 ④ 계약서·링크 (360) ──────────────────────────────────── */
function paneEsignDoc(el) {
  const e = ESIGNS.find(x => x.no === S.esignNo);
  if (!e) { el.innerHTML = `<div class="ph"><h2>계약서 · 링크</h2></div><div class="pb"></div>`; return; }
  const f = ecFlags(e), dead = f.revoked || f.expired;

  el.innerHTML = `
    <div class="ph"><h2>계약서 · 링크</h2><span class="c">${esc(e.kind)}</span></div>
    <div class="pb"><div class="dwrap">
      <div class="a4" role="img" aria-label="계약서 미리보기">
        <div class="a4h">${esc(e.kind)}</div>
        <div class="a4l"></div><div class="a4l s"></div><div class="a4l"></div>
        <div class="a4kv"><span>임대인</span><b>${esc(e.sup)}</b></div>
        <div class="a4kv"><span>임차인</span><b>${esc(e.cust)}</b></div>
        <div class="a4kv"><span>차량</span><b>${esc(e.veh)}</b></div>
        <div class="a4l"></div><div class="a4l s"></div>
        <div class="a4sign">${e.stage === 'done' ? '서명됨' : '서명란'}</div>
      </div>
      <div class="ecact col"><button class="btn" id="ecprev">A4 미리보기</button>
        <button class="btn" id="ecmob">모바일 미리보기</button></div>

      <div class="card">
        <h4>링크</h4>
        ${e.stage === 'draft'
          ? '<p class="hint">계약서를 만들면 링크를 만들 수 있다.</p>'
          : dead ? `<p class="hint">${f.revoked ? '해지됨' : '만료됨'} · ${esc(e.revokedAt || e.expiresAt)}</p>
              <div class="ecact"><button class="btn go" id="ecre">링크 다시 만들기</button></div>`
          : e.stage === 'ready' ? '<p class="hint">아직 만들지 않았다.</p>'
          : `<code class="eclink">freepasserp.com/sign/${esc(e.no)}</code>
             <dl class="kv sm"><dt>만든 때</dt><dd class="n">${esc(e.linkAt)}</dd>
               <dt>연 때</dt><dd>${e.seenAt ? `<span class="n">${esc(e.seenAt)}</span>` : '<span class="unk">아직</span>'}</dd>
               <dt>만료</dt><dd class="n">${esc(e.expiresAt)}</dd></dl>
             <div class="ecact"><button class="btn" id="ecc2">링크 복사</button>
               <button class="btn" id="ecr2">링크 해지</button></div>`}
      </div>

      ${e.stage === 'done' ? `<div class="card ok">
        <h4>봉인</h4>
        <dl class="kv sm"><dt>회차</dt><dd class="n">${e.rev}차</dd>
          <dt>문서 SHA-256</dt><dd class="n brk">${esc(e.sha256)}</dd>
          <dt>봉인 해시</dt><dd class="n brk">${esc(e.seal)}</dd></dl>
        <div class="ecact col"><button class="btn" id="ecpdf">완료 PDF 내려받기</button>
          <button class="btn" id="ecv2">검증 링크 열기</button></div>
        <p class="hint">★나중에 다툴 때 댈 근거다. 원본 서류는 우리에게 없고, 이 해시가 대신 선다.</p>
      </div>` : ''}

      <div class="card">
        <h4>신분 확인</h4>
        <p class="hint">${e.stage === 'done'
          ? '주민번호 · 면허가 <b>수집됐다</b>. 전자계약에만 들어가고 <b>관리자는 열람하지 않는다</b>.'
          : '서명할 때 고객이 직접 넣는다. 우리가 미리 받지 않는다.'}</p>
      </div>
    </div></div>`;

  const go = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
  go('ecprev', () => alert('A4 미리보기 — 이번 범위 밖'));
  go('ecmob', () => alert('모바일 미리보기 — 이번 범위 밖'));
  go('ecc2', () => alert('링크를 복사했다'));
  go('ecr2', () => { e.revoked = '09-16 16:20'; e.revokedAt = '09-16 16:20'; e.hist.unshift({ at: '09-16 16:20', t: '링크 해지', who: '박지훈' }); render(); });
  go('ecre', () => { e.revoked = null; e.revokedAt = null; e.expired = false; e.stage = 'ready'; e.hist.unshift({ at: '09-16 16:20', t: '링크 다시 만들기', who: '박지훈' }); render(); });
  go('ecpdf', () => alert('완료 PDF — 이번 범위 밖'));
  go('ecv2', () => alert(e.verifyUrl));
}
