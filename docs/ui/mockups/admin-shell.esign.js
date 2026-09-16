/* ══════════════════════════════════════════════════════════════════
   전자계약 — 기능은 freepasserp4, 화면은 «우리 판 규격»

   ★대표 2026-09-16: 「전자계약도 ui ux는 이제 여기에 맞춰서 바꿔야지
     기능만 쓰면 되고 모바일은 그대로 쓸거고」

   그래서 fp4 에서 «가져오는 것» 과 «안 가져오는 것» 을 갈랐다.

     가져온다 — 단계 다섯 · 손님 축 여덟 · 플래그 셋 · 발송 전 검사 · 용어표
     안 가져온다 — 4칸 골격. 우리 판 문법(목록/목록 | 상세 하나)을 쓴다.
       「계약 진행」과 「계약서·링크」는 «상세 한 판» 의 구역 둘이 된다.
       ★상세는 하나다 (대표 2026-09-16: 「상품상세는 1개인데 … 1개야」)

   판 규격 : docs/ui/UI-SPEC.md §5 (.ph 38 · .bar 38 · .pb · .pf 30)
   단계 정본 : docs/ui/ESIGN-AS-IS.md  ·  계약 : docs/dev/DEV-CHANGE-ESIGN-001.json

   ★★축이 «둘» 이다. 섞으면 둘 다 못 읽는다.
     ① 관리자 축 — «우리» 일이 어디까지인지 (다섯) → 뱃지·스테퍼·칩·이력 라벨
     ② 손님  축 — «고객» 이 어디까지 갔는지 (여덟) → n/8 로만 말한다
   ★플래그(확인 필요·만료/해지·보완 요청됨)는 단계가 «아니다».
     버킷으로 만들면 목록 다섯 줄 중 넷이 빨개진다.
   ══════════════════════════════════════════════════════════════════ */

/** ① 관리자 축 — 각 단계에 «유일한 행동» 이 하나씩 있다.
 *  ★그 하나가 곧 실행 띠의 «주 단추» 다 (UI-SPEC §6 「주 행동은 하나」).
 *    두 규격이 같은 말을 하고 있어서 4칸 없이도 그대로 선다. */
const EC_STAGES = [
  { k: 'draft',   t: '작성',         main: null },
  { k: 'ready',   t: '발송 전',      main: '링크 만들기' },
  { k: 'filling', t: '고객 작성 중', main: null },   /* ★없다 — 기다린다 */
  { k: 'review',  t: '검토 대기',    main: '승인' },
  { k: 'done',    t: '완료',         main: null },
];
/** ② 손님 축 — 목록의 «4/8» 이 이 값이다 */
const EC_STEPS = ['본인확인', '본인정보', '차량정보', '대여조건', '보험', '서류제출', '약관동의', '서명'];

const ecStage = e => EC_STAGES.find(s => s.k === e.stage);
const ecIdx = e => EC_STAGES.findIndex(s => s.k === e.stage) + 1;
const ecFlags = e => ({
  attention: e.checks.some(c => c.level === 'BLOCK'),
  expired: !!e.expired,
  revoked: !!e.revoked,
  rejected: (e.rejects || []).length > 0 && e.stage === 'filling',
});
const ecBlocked = e => e.checks.filter(c => c.level === 'BLOCK');
const ecWarned = e => e.checks.filter(c => c.level === 'WARNING');
/** 단계 색 — ★색«만»으로 말하지 않는다. 이름이 늘 함께 선다 (WCAG 1.4.1) */
const ecTone = e => e.stage === 'done' ? 'ok' : e.stage === 'review' ? 'wait' : e.stage === 'draft' ? 'mut' : 'key';
const ecLog = (e, t) => e.hist.unshift({ at: '09-16 16:20', t, who: '박지훈' });

/* ══ 판 ① 계약 목록 — 다른 목록 판과 «같은 꼴» ══════════════════
   .ph 제목·수·주 도구 / .bar 찾는 칸 + 갈래 / .pb 표 / .pf 셈      */
const EC_TABS = [
  { k: 'todo', t: '칠 것', f: e => e.stage === 'ready' || e.stage === 'review' },
  { k: 'all', t: '전체', f: () => true },
  { k: 'wait', t: '고객 작성 중', f: e => e.stage === 'filling' },
  { k: 'done', t: '완료', f: e => e.stage === 'done' },
];

function paneEsign(el) {
  const tab = EC_TABS.find(c => c.k === S.ecTab) || EC_TABS[0];
  const q = (S.ecQ || '').trim().toLowerCase();
  const list = ESIGNS.filter(tab.f)
    .filter(e => !q || (e.cust + e.veh + e.no + e.sup + (e.plate || '')).toLowerCase().includes(q));
  if (!list.some(e => e.no === S.esignNo) && list.length) S.esignNo = list[0].no;

  el.innerHTML = `
    <div class="ph"><h2>계약 목록</h2><span class="c">${list.length}건</span><span class="sp"></span>
      <button class="btn sm go" id="ecnew">+ 계약서 만들기</button></div>
    <div class="bar">
      ${findbox('ecq', '고객 · 차량 · 계약번호', S.ecQ || '')}
      ${EC_TABS.map(c => `<button class="sb" data-ec="${c.k}"
        aria-pressed="${c.k === tab.k}">${c.t}<span class="b">${ESIGNS.filter(c.f).length}</span></button>`).join('')}
    </div>
    <div class="pb" id="eclist"></div>
    <div class="pf">${tl('검토 대기', ESIGNS.filter(e => e.stage === 'review').length, 'warn')}${tl('확인 필요', ESIGNS.filter(e => ecFlags(e).attention).length, 'bad')}${tl('완료', ESIGNS.filter(e => e.stage === 'done').length, 'ok')}</div>`;

  /* ★상태 넷을 서로 다른 말과 서로 다른 «다음 행동» 으로 가른다 */
  const body = $('#eclist');
  if (!ESIGNS.length) {
    body.innerHTML = `<div class="empty"><b>아직 계약이 없다</b>
      <p>접수에서 넘어오거나, 여기서 새로 만든다.</p>
      <button class="btn go" id="ecempty">계약서 만들기</button></div>`;
    $('#ecempty').onclick = ecNew;
  } else if (!list.length) {
    body.innerHTML = `<div class="empty"><b>이 조건에 맞는 계약이 없다</b>
      <p>「없다」는 <b>${esc(tab.t)}</b>${q ? ` · 「${esc(S.ecQ)}」` : ''} 조건에 없다는 뜻이다. 계약이 없다는 뜻이 아니다.</p>
      <button class="btn" id="ecall">조건 지우고 전체 보기</button></div>`;
    $('#ecall').onclick = () => { S.ecTab = 'all'; S.ecQ = ''; render(); };
  } else {
    body.innerHTML = `<table class="g">
      <caption class="sr">전자계약 목록 — 고객, 차량, 공급사, 단계, 고객 진행, 갱신</caption>
      <thead><tr><th scope="col">고객</th><th scope="col">차량번호</th><th scope="col">차량</th>
        <th scope="col">공급사</th><th scope="col">단계</th>
        <th scope="col" class="r">고객 진행</th><th scope="col">갱신</th></tr></thead>
      <tbody>${list.map(e => {
        const f = ecFlags(e);
        return `<tr data-no="${e.no}" class="${e.no === S.esignNo && S.focus === 'esign' ? 'on' : ''}">
          <td><span class="nm">${esc(e.cust)}</span> <span class="mut n">${esc(e.no)}</span></td>
          <td class="n">${e.plate ? esc(e.plate) : '—'}</td>
          <td class="mut">${esc(e.veh)}</td><td class="mut">${esc(e.sup)}</td>
          <td><span class="st ${ecTone(e)}">${esc(ecStage(e).t)}</span>${ecFlagTags(f, e)}</td>
          <td class="r n">${e.stage === 'draft' ? '<span class="mut">—</span>'
            : `${e.steps}/8 <span class="mut" style="font-size:10px">${esc(EC_STEPS[Math.min(e.steps, 7)])}</span>`}</td>
          <td class="mut n">${esc(e.at)}</td></tr>`;
      }).join('')}</tbody></table>`;
    el.querySelectorAll('tbody tr').forEach(r => r.onclick = () => { S.esignNo = r.dataset.no; S.focus = 'esign'; render(); });
  }

  const q2 = $('#ecq');
  q2.oninput = () => { S.ecQ = q2.value; paneEsign(el); const x = $('#ecq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
  if ($('#ecqx')) $('#ecqx').onclick = () => { S.ecQ = ''; render(); };
  $('#ecnew').onclick = ecNew;
  el.querySelectorAll('[data-ec]').forEach(b => b.onclick = () => { S.ecTab = b.dataset.ec; render(); });
}

/** ★플래그는 단계 뱃지 «옆» 에 붙지 뱃지를 대체하지 않는다 */
const ecFlagTags = (f, e) => (f.attention ? '<span class="flag">확인 필요</span>' : '')
  + (f.rejected ? `<span class="flag w">보완 ${e.rejects.length}차</span>` : '')
  + (f.revoked ? '<span class="flag">해지됨</span>' : f.expired ? '<span class="flag">만료</span>' : '');

const ecNew = () => alert('계약서 만들기 — 공급사 → 차량 → 대여료 → 조건 (이번 범위 밖)');

/* ══ 상세 «하나» — 계약 진행과 계약서·링크가 구역 둘로 산다 ══════ */
function detailEsign(el) {
  const e = ESIGNS.find(x => x.no === S.esignNo);
  if (!e) { el.innerHTML = `<div class="ph"><h2>계약 상세</h2></div>
    <div class="pb"><div class="empty"><b>고른 계약이 없다</b><p>목록에서 한 줄을 고른다.</p></div></div>`; return; }

  const st = ecStage(e), at = ecIdx(e), f = ecFlags(e);
  const blocks = ecBlocked(e), warns = ecWarned(e), dead = f.revoked || f.expired;

  el.innerHTML = `
    <div class="ph"><h2>계약 상세</h2><span class="c n">${esc(e.no)}</span><span class="sp"></span>
      <span class="c">${esc(e.sup)}</span></div>
    <div class="pb"><div class="dwrap">
      ${stepper(EC_STAGES.map(s => s.t), at)}
      <div class="dtop">
        <div>${ecPaper(e)}</div>
        <div>
          <div class="dchips"><span class="st ${ecTone(e)}">${esc(st.t)}</span>
            <span class="tag">${esc(e.sup)}</span><span class="tag">${esc(e.kind)}</span>
            ${e.app ? `<span class="tag n">접수 ${esc(e.app)}</span>` : ''}</div>
          <h3 class="dttl">${esc(e.cust)}</h3><p class="dsub">${esc(e.veh)}${e.plate ? ' · ' + esc(e.plate) : ''}</p>
          <dl class="kv">
            <dt>받는 곳</dt><dd>${e.to ? esc(e.to) : '<span class="unk">없음</span>'}</dd>
            <dt>링크 만든 때</dt><dd>${e.linkAt ? `<span class="n">${esc(e.linkAt)}</span>` : '<span class="unk">아직</span>'}</dd>
            <dt>고객이 연 때</dt><dd>${e.seenAt ? `<span class="n">${esc(e.seenAt)}</span>` : '<span class="unk">아직</span>'}</dd>
            <dt>만료</dt><dd class="n">${e.expiresAt ? esc(e.expiresAt) : '—'}</dd>
            <dt>서명</dt><dd>${e.signedAt ? `<span class="n">${esc(e.signedAt)}</span>` : '<span class="unk">아직</span>'}</dd>
            <dt>신분 확인</dt><dd>${e.stage === 'done'
              ? '<span class="st ok">수집됨</span> <span class="mut" style="font-size:11px">주민번호 · 면허 — 관리자는 열람하지 않습니다</span>'
              : '<span class="mut">서명할 때 고객이 직접 넣습니다</span>'}</dd>
          </dl>
        </div>
      </div>

      ${blocks.length ? `<div class="note e" role="alert"><span class="i">!</span><div>
        <b>발송 전 확인 — ${blocks.length}건이 막고 있다</b>
        <p>${blocks.map(c => esc(c.t)).join('<br>')}</p>
        ${blocks.filter(c => c.fix).map(c => `<button class="btn sm" data-fix="${esc(c.fix)}">${esc(c.fix)}</button>`).join(' ')}
        <p>★막힌 것이 하나라도 있으면 링크를 만들지 않는다. 잘못 나간 계약서는 되부르지 못한다.</p>
      </div></div>` : warns.length ? `<div class="note w"><span class="i">!</span><div>
        <b>짚고 넘어갈 것 ${warns.length}건</b><p>${warns.map(c => esc(c.t)).join('<br>')}</p>
        <p>막지는 않는다. 알고 보내는 것과 모르고 보내는 것은 다르다.</p></div></div>` : ''}

      ${dead ? `<div class="note w"><span class="i">!</span><div>
        <b>${f.revoked ? '링크를 해지했다' : '링크가 만료됐다'} — ${esc(e.revokedAt || e.expiresAt)}</b>
        <p>고객은 더 이상 열 수 없다. 되살리는 길은 <b>링크 다시 만들기</b> 하나다.</p></div></div>` : ''}

      ${f.rejected ? `<div class="note w"><span class="i">!</span><div>
        <b>보완 요청됨 — ${e.rejects.length}차</b>
        <p>${e.rejects.map(r => `${esc(r.at)} · <b>${r.items.map(esc).join(' · ')}</b> — ${esc(r.why)}`).join('<br>')}</p></div></div>` : ''}

      ${e.stage === 'filling' ? `<div class="note"><span class="i">&#10003;</span><div>
        <b>지금은 «기다리는» 단계다</b>
        <p>고객이 쓰는 중이라 우리가 할 일은 없다. 재촉이 필요하면 링크를 다시 전달하고, 잘못 나갔으면 해지한다.</p></div></div>` : ''}

      ${e.stage !== 'draft' ? `<div class="sec"><h3>고객이 간 길 — 우리 단계와 «다른 축» 이다</h3>
        <div class="ecjour" role="img" aria-label="고객 진행 ${e.steps} / 8단계">
          ${EC_STEPS.map((t, i) => `<span class="${i < e.steps ? 'dn' : i === e.steps ? 'now' : ''}">${t}</span>`).join('')}</div>
        <p class="dsub" style="font-size:11px;margin-top:6px">${e.steps}/8 ·
          ${e.steps >= 8 ? '제출까지 마쳤다' : `지금 <b>${esc(EC_STEPS[e.steps])}</b> 에서 멈춰 있다`}</p></div>` : ''}

      ${e.stage === 'review' && e.docs.length ? `<div class="sec"><h3>낸 서류 — 확인하고 승인한다</h3>
        <table class="g"><caption class="sr">제출 서류</caption>
          <thead><tr><th scope="col">서류</th><th scope="col">제출</th><th scope="col">해시</th></tr></thead>
          <tbody>${e.docs.map(d => `<tr><td class="nm">${esc(d.t)}</td><td class="mut n">${esc(d.at)}</td>
            <td class="mut n" style="font-size:10.5px">${esc(d.sha)}</td></tr>`).join('')}</tbody></table>
        <p class="dsub" style="font-size:11px;margin-top:6px">★원본 파일은 우리에게 오지 않는다 — 제출 여부와 시각 · 해시만 온다.</p></div>` : ''}

      ${e.linkAt && !dead ? `<div class="sec"><h3>링크</h3>
        <code class="eclink">freepasserp.com/sign/${esc(e.no)}</code></div>` : ''}

      ${e.stage === 'done' ? `<div class="sec"><h3>봉인 — 나중에 다툴 때 댈 근거</h3>
        <dl class="kv"><dt>회차</dt><dd class="n">${e.rev}차</dd>
          <dt>문서 SHA-256</dt><dd class="n brk">${esc(e.sha256)}</dd>
          <dt>봉인 해시</dt><dd class="n brk">${esc(e.seal)}</dd>
          <dt>검증</dt><dd class="n brk">${esc(e.verifyUrl)}</dd></dl></div>` : ''}

      <div class="sec"><h3>이력 — 덮지 않고 쌓는다</h3>
        <table class="g"><caption class="sr">계약 이력</caption>
          <tbody>${e.hist.map(x => `<tr><td class="mut n" style="width:90px">${esc(x.at)}</td>
            <td><b>${esc(x.t)}</b>${x.who ? ` <span class="mut">— ${esc(x.who)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
    </div></div>
    ${actBar(ecActions(e, st, blocks, dead))}`;

  el.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => alert(b.dataset.fix + ' — 이번 범위 밖'));
  bindAct(el, ecActions(e, st, blocks, dead));
}

/**
 * ★단계의 «유일한 행동» 이 곧 주 단추다.
 *   「고객 작성 중」에는 주 단추가 «없다» — 화면이 기다린다고 말한다.
 *   위험한 것(해지)은 색이 아니라 «자리» 로 뗀다 — ⋯ 안에만 둔다 (UI-SPEC §6).
 */
function ecActions(e, st, blocks, dead) {
  const more = [];
  if (e.linkAt) more.push({ t: 'A4 미리보기', go: () => alert('A4 미리보기 — 이번 범위 밖') },
                           { t: '모바일 미리보기', go: () => alert('모바일 미리보기 — 이번 범위 밖') }, '-');
  if (e.stage === 'done') more.push({ t: '완료 PDF 내려받기', go: () => alert('완료 PDF — 이번 범위 밖') },
                                     { t: '봉인 검증', go: () => alert('봉인 해시 ' + e.seal + '\n검증 ' + e.verifyUrl) });
  if (e.linkAt && !dead && e.stage !== 'done')
    more.push({ t: '링크 해지', danger: true, go: () => { e.revoked = e.revokedAt = '09-16 16:20'; ecLog(e, '링크 해지'); render(); } });

  const subs = [];
  if (e.linkAt && !dead) subs.push({ t: '링크 복사', go: () => alert('링크를 복사했다 — freepasserp.com/sign/' + e.no) });
  if (e.stage === 'review') subs.push({ t: '보완 요청', go: () => {
    e.stage = 'filling'; e.steps = 5;
    (e.rejects = e.rejects || []).push({ at: '09-16 16:20', items: ['재직증명서'], why: '발급일이 3개월을 넘었다' });
    ecLog(e, '보완 요청'); render();
  } });

  let main = null;
  if (dead) main = { t: '링크 다시 만들기', go: () => {
    e.revoked = e.revokedAt = null; e.expired = false; e.stage = 'ready';
    ecLog(e, '링크 다시 만들기'); render(); } };
  else if (e.stage === 'draft') main = { t: '계약서 만들기', off: true };
  else if (e.stage === 'ready') main = blocks.length
    ? { t: '링크 만들기', off: true }
    : { t: '링크 만들기', go: () => { e.stage = 'filling'; e.steps = 0; e.linkAt = '09-16 16:20'; ecLog(e, '링크 만들기'); render(); } };
  else if (e.stage === 'review') main = { t: '승인', go: () => {
    e.stage = 'done'; e.signedAt = '09-16 16:20'; e.steps = 8; ecLog(e, '승인 — 완료'); render(); } };
  else if (e.stage === 'done') main = { t: '완료됨', off: true };
  /* filling → main 없음. ★기다리는 단계에 주 단추를 두지 않는다 */

  /* 비활성 단추는 «까닭을 곁에» 둔다 (AI Core §Button) */
  const why = e.stage === 'draft' ? '공급사 · 차량 · 대여료 · 조건이 다 차야 열린다'
    : blocks.length && e.stage === 'ready' ? `발송 전 확인 ${blocks.length}건이 막고 있다`
    : e.stage === 'filling' ? '고객이 쓰는 중이다 — 우리가 할 일은 없다'
    : e.stage === 'done' ? `서명 ${e.signedAt}` : '';
  return { memo: why ? `<p class="whyoff">${esc(why)}</p>` : null, more, subs, main };
}

/** 계약서 — 사진 자리에 «종이» 가 선다. 한 톤의 윤곽만. */
function ecPaper(e) {
  return `<div class="a4" role="img" aria-label="계약서 미리보기">
    <div class="a4h">${esc(e.kind)}</div>
    <div class="a4kv"><span>임대인</span><b>${esc(e.sup)}</b></div>
    <div class="a4kv"><span>임차인</span><b>${esc(e.cust)}</b></div>
    <div class="a4kv"><span>차량</span><b>${esc(e.veh)}</b></div>
    <div class="a4l"></div><div class="a4l s"></div>
    <div class="a4sign">${e.stage === 'done' ? '서명됨' : '서명란'}</div>
  </div>`;
}
