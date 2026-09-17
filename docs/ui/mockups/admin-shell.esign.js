/* ══════════════════════════════════════════════════════════════════
   전자계약 — «목록을 갖지 않는다». 접수 원장을 거른 보기다.

   ★대표 2026-09-16
     「전자계약을 날릴수 있게끔 가능성 열어두고」
     「기존처럼 뭐 4탭 이렇게 하지말고」
     (고른 안) 메뉴는 넷 그대로 두고, 전자계약은 «보기» 로 둔다

   그래서 이렇게 굳혔다 —

   ① 전자계약은 **원장을 소유하지 않는다.**
      좌상 판은 «접수 원장을 「계약」 으로 거른 것» 이다. 같은 줄, 같은 번호.
      두 원장이 아니라 한 원장이라 어긋날 자리가 없다.

   ② 계약 «상세» 라는 화면도 없다. 접수 상세의 「계약서」 줄이 «그 자리에서» 펼쳐진다.
      새 화면으로 가지 않으므로 이력·진행·금액을 나란히 두고 볼 수 있다.

   ③ ★접수가 전자계약을 아는 곳은 `blocked()` 의 «한 줄» 뿐이다.
      전자계약을 날리면 그 줄이 그냥 「계약서」 라고 답하고,
      펼침이 사라지고 [완료 처리] 체크 한 칸으로 돌아간다.
      메뉴·목록·상세 골격은 아무것도 안 바뀐다.

   기능 정본 : freepasserp4 @595abae  (docs/ui/ESIGN-AS-IS.md)
   화면 규격 : docs/ui/UI-SPEC.md §5 · 구성 : docs/ui/IA-PROPOSAL.md
   ══════════════════════════════════════════════════════════════════ */

/** ① 관리자 축 — 각 단계에 «유일한 행동» 이 하나씩. 그 하나가 실행 띠의 주 단추다 */
const EC_STAGES = [
  { k: 'draft',   t: '작성' },
  { k: 'ready',   t: '발송 전' },
  { k: 'filling', t: '고객 작성 중' },   /* ★행동이 없다 — 기다린다 */
  { k: 'review',  t: '검토 대기' },
  { k: 'done',    t: '완료' },
];
/** ② 손님 축 — «다른 축» 이다. n/8 로만 말하고 ①과 안 섞는다 */
const EC_STEPS = ['본인확인', '본인정보', '차량정보', '대여조건', '보험', '서류제출', '약관동의', '서명'];

/** ★접수 한 건에 붙은 전자계약. 없으면 null — 그게 «정상» 이다 (종이 계약) */
const ecOf = a => a && ESIGNS.find(x => x.app === a.no) || null;
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
/** ★색«만»으로 말하지 않는다 — 이름이 늘 함께 선다 (WCAG 1.4.1) */
const ecTone = e => e.stage === 'done' ? 'ok' : e.stage === 'review' ? 'wait' : e.stage === 'draft' ? 'mut' : 'key';
const ecLog = (e, t) => e.hist.unshift({ at: '09-16 16:20', t, who: '박지훈' });
/** ★플래그는 단계 «옆» 에 붙지 단계를 대체하지 않는다 */
const ecFlagTags = (f, e) => (f.attention ? '<span class="flag">확인 필요</span>' : '')
  + (f.rejected ? `<span class="flag w">보완 ${e.rejects.length}차</span>` : '')
  + (f.revoked ? '<span class="flag">해지됨</span>' : f.expired ? '<span class="flag">만료</span>' : '');
const ecNew = () => alert('계약서 만들기 — 공급사 → 차량 → 대여료 → 조건 (이번 범위 밖)');

/* ══ 좌상 판 — 접수 원장을 «거른 보기» ═════════════════════════
   ★갈래도 «막힌 칸» 이다. 계약이 지금 어디서 멈췄는지로 가른다.  */
const EC_VIEW = [
  { k: 'mk',   t: '링크 만들기', f: e => e.stage === 'ready' },
  { k: 'rev',  t: '검토 대기',   f: e => e.stage === 'review' },
  { k: 'wait', t: '기다리는 중', f: e => e.stage === 'filling' },
  { k: 'fix',  t: '링크 다시',   f: e => !!e.revoked || !!e.expired },
  { k: 'all',  t: '전체',        f: () => true },
];

function paneEsign(el) {
  const g = EC_VIEW.find(x => x.k === S.ecTab) || EC_VIEW[0];
  const q = (S.ecQ || '').trim().toLowerCase();
  /* ★ESIGNS 를 도는 게 아니라 «접수» 를 돈다. 전자계약은 그 줄에 붙은 것일 뿐 */
  const rows = APPS.map(a => ({ a, e: ecOf(a) })).filter(r => r.e)
    .filter(r => g.f(r.e))
    .filter(r => !q || (r.a.cust + r.a.veh + r.a.no + r.e.no + (r.a.plate || '')).toLowerCase().includes(q));
  if (!rows.some(r => r.a.no === S.appNo) && rows.length) S.appNo = rows[0].a.no;

  el.innerHTML = `
    <div class="ph"><h2>계약 — 접수 원장 보기</h2><span class="c">${rows.length}건</span><span class="sp"></span>
      <button class="btn sm go" id="ecnew">+ 계약서 만들기</button></div>
    <div class="bar">
      ${findbox('ecq', '고객 · 차량 · 접수번호', S.ecQ || '')}
      ${EC_VIEW.map(x => `<button class="sb" data-ec="${x.k}" aria-pressed="${x.k === g.k}">${x.t}<span class="b">${APPS.map(ecOf).filter(e => e && x.f(e)).length}</span></button>`).join('')}
    </div>
    <div class="pb" id="eclist"></div>
    <div class="pf">${tl('링크 만들기', APPS.map(ecOf).filter(e => e && e.stage === 'ready').length, 'warn')}${tl('검토 대기', APPS.map(ecOf).filter(e => e && e.stage === 'review').length, 'warn')}${tl('확인 필요', APPS.map(ecOf).filter(e => e && ecFlags(e).attention).length, 'bad')}
      <span class="sp"></span><span class="t"><i>같은 원장이다</i><b>접수 ${APPS.length}건 중</b></span></div>`;

  const body = $('#eclist');
  if (!rows.length) {
    body.innerHTML = `<div class="empty"><b>이 갈래에 계약이 없다</b>
      <p>「없다」는 <b>${esc(g.t)}</b>${q ? ` · 「${esc(S.ecQ)}」` : ''} 에 없다는 뜻이다. 계약이 없다는 뜻이 아니다.</p>
      <button class="btn" id="ecall">전체 보기</button></div>`;
    $('#ecall').onclick = () => { S.ecTab = 'all'; S.ecQ = ''; render(); };
  } else {
    body.innerHTML = `<table class="g">
      <caption class="sr">접수 원장의 계약 보기 — 고객, 차량, 공급사, 할 일, 고객 진행</caption>
      <thead><tr><th scope="col">고객</th><th scope="col">차량번호</th><th scope="col">차량</th>
        <th scope="col">공급사</th><th scope="col">할 일</th>
        <th scope="col" class="r">고객 진행</th><th scope="col">갱신</th></tr></thead>
      <tbody>${rows.map(({ a, e }) => `<tr data-no="${a.no}" class="${a.no === S.appNo && S.focus === 'esign' ? 'on' : ''}">
        <td><span class="nm">${esc(a.cust)}</span> <span class="mut n">${esc(a.no)}</span></td>
        <td class="n">${a.plate ? esc(a.plate) : '—'}</td>
        <td class="mut">${esc(a.veh)}</td><td class="mut">${esc(e.sup)}</td>
        <td><span class="st ${ecTone(e)}">${esc(ecStage(e).t)}</span>${ecFlagTags(ecFlags(e), e)}</td>
        <td class="r n">${e.stage === 'draft' ? '<span class="mut">—</span>'
          : `${e.steps}/8 <span class="mut" style="font-size:10px">${esc(EC_STEPS[Math.min(e.steps, 7)])}</span>`}</td>
        <td class="mut n">${esc(e.at)}</td></tr>`).join('')}</tbody></table>`;
    el.querySelectorAll('tbody tr').forEach(r => r.onclick = () => {
      S.appNo = r.dataset.no; S.focus = 'esign'; S.ecOpen = true; render();
    });
  }

  const q2 = $('#ecq');
  q2.oninput = () => { S.ecQ = q2.value; paneEsign(el); const x = $('#ecq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
  if ($('#ecqx')) $('#ecqx').onclick = () => { S.ecQ = ''; render(); };
  $('#ecnew').onclick = ecNew;
  el.querySelectorAll('[data-ec]').forEach(b => b.onclick = () => { S.ecTab = b.dataset.ec; render(); });
}

/* ══ 「계약서」 줄이 «그 자리에서» 펼쳐지는 덩어리 ════════════════
   ★새 화면이 아니다. 접수 상세 안이라 이력·금액과 나란히 본다.      */
function ecSection(e) {
  const f = ecFlags(e), blocks = ecBlocked(e), warns = ecWarned(e), dead = f.revoked || f.expired;
  return `<div class="ecbox">
    ${stepper(EC_STAGES.map(s => s.t), ecIdx(e))}

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

    ${e.stage === 'filling' ? `<div class="note"><span class="i">${ic('check')}</span><div>
      <b>지금은 «기다리는» 단계다</b>
      <p>고객이 쓰는 중이라 우리가 할 일은 없다. 재촉하려면 링크를 다시 전달하고, 잘못 나갔으면 해지한다.</p></div></div>` : ''}

    <div class="ecgrid">
      <div>${ecPaper(e)}</div>
      <dl class="kv sm">
        <dt>서식</dt><dd>${esc(e.kind)}</dd>
        <dt>공급사</dt><dd>${esc(e.sup)}</dd>
        <dt>받는 곳</dt><dd>${e.to ? esc(e.to) : '<span class="unk">없음</span>'}</dd>
        <dt>링크 만든 때</dt><dd>${e.linkAt ? `<span class="n">${esc(e.linkAt)}</span>` : '<span class="unk">아직</span>'}</dd>
        <dt>고객이 연 때</dt><dd>${e.seenAt ? `<span class="n">${esc(e.seenAt)}</span>` : '<span class="unk">아직</span>'}</dd>
        <dt>만료</dt><dd class="n">${e.expiresAt ? esc(e.expiresAt) : '—'}</dd>
        <dt>신분 확인</dt><dd>${e.stage === 'done'
          ? '<span class="st ok">수집됨</span> <span class="mut" style="font-size:10.5px">관리자는 열람하지 않습니다</span>'
          : '<span class="mut">서명할 때 고객이 직접 넣습니다</span>'}</dd>
      </dl>
    </div>

    ${e.stage !== 'draft' ? `<h5>고객이 간 길 — 우리 단계와 «다른 축» 이다</h5>
      <div class="ecjour" role="img" aria-label="고객 진행 ${e.steps} / 8단계">
        ${EC_STEPS.map((t, i) => `<span class="${i < e.steps ? 'dn' : i === e.steps ? 'now' : ''}">${t}</span>`).join('')}</div>
      <p class="ecnote">${e.steps}/8 · ${e.steps >= 8 ? '제출까지 마쳤다' : `지금 <b>${esc(EC_STEPS[e.steps])}</b> 에서 멈춰 있다`}</p>` : ''}

    ${e.docs.length ? `<h5>낸 서류</h5>
      <table class="g"><caption class="sr">제출 서류</caption>
        <thead><tr><th scope="col">서류</th><th scope="col">제출</th><th scope="col">해시</th></tr></thead>
        <tbody>${e.docs.map(d => `<tr><td class="nm">${esc(d.t)}</td><td class="mut n">${esc(d.at)}</td>
          <td class="mut n" style="font-size:10.5px">${esc(d.sha)}</td></tr>`).join('')}</tbody></table>
      <p class="ecnote">★원본 파일은 우리에게 오지 않는다 — 제출 여부와 시각 · 해시만 온다.</p>` : ''}

    ${e.linkAt && !dead ? `<h5>링크</h5><code class="eclink">freepasserp.com/sign/${esc(e.no)}</code>` : ''}

    ${e.stage === 'done' ? `<h5>봉인 — 나중에 다툴 때 댈 근거</h5>
      <dl class="kv sm"><dt>회차</dt><dd class="n">${e.rev}차</dd>
        <dt>문서 SHA-256</dt><dd class="n brk">${esc(e.sha256)}</dd>
        <dt>봉인 해시</dt><dd class="n brk">${esc(e.seal)}</dd>
        <dt>검증</dt><dd class="n brk">${esc(e.verifyUrl)}</dd></dl>` : ''}

    <h5>계약 이력</h5>
    <table class="g"><caption class="sr">계약 이력</caption>
      <tbody>${e.hist.map(x => `<tr><td class="mut n" style="width:90px">${esc(x.at)}</td>
        <td><b>${esc(x.t)}</b>${x.who ? ` <span class="mut">— ${esc(x.who)}</span>` : ''}</td></tr>`).join('')}</tbody></table>
  </div>`;
}

/**
 * ★접수 상세의 실행 띠가 «막힌 칸의 행동» 을 든다.
 *   계약서에서 막혔고 전자계약이 붙어 있으면, 그 단계의 유일한 행동이 주 단추가 된다.
 *   전자계약을 날리면 이 함수가 안 불리고 접수의 「완료 처리」 가 그대로 선다.
 */
function ecActions(a, e) {
  const f = ecFlags(e), blocks = ecBlocked(e), dead = f.revoked || f.expired;
  const more = [], subs = [];
  if (e.linkAt) more.push({ t: 'A4 미리보기', go: () => alert('A4 미리보기 — 이번 범위 밖') },
                          { t: '모바일 미리보기', go: () => alert('모바일 미리보기 — 이번 범위 밖') }, '-');
  if (e.stage === 'done') more.push({ t: '완료 PDF 내려받기', go: () => alert('완료 PDF — 이번 범위 밖') },
                                    { t: '봉인 검증', go: () => alert('봉인 해시 ' + e.seal + '\n검증 ' + e.verifyUrl) }, '-');
  more.push({ t: '전자계약 없이 «완료 처리»', go: () => { a.contract = true; render(); } });
  if (e.linkAt && !dead && e.stage !== 'done')
    more.push({ t: '링크 해지', danger: true, go: () => { e.revoked = e.revokedAt = '09-16 16:20'; ecLog(e, '링크 해지'); render(); } });

  if (e.linkAt && !dead) subs.push({ t: '링크 복사', go: () => alert('링크를 복사했다 — freepasserp.com/sign/' + e.no) });
  if (e.stage === 'review') subs.push({ t: '보완 요청', go: () => {
    e.stage = 'filling'; e.steps = 5;
    (e.rejects = e.rejects || []).push({ at: '09-16 16:20', items: ['재직증명서'], why: '발급일이 3개월을 넘었다' });
    ecLog(e, '보완 요청'); render();
  } });

  let main = null, why = '';
  if (dead) main = { t: '링크 다시 만들기', go: () => {
    e.revoked = e.revokedAt = null; e.expired = false; e.stage = 'ready'; ecLog(e, '링크 다시 만들기'); render(); } };
  else if (e.stage === 'draft') { main = { t: '계약서 만들기', off: true }; why = '공급사 · 차량 · 대여료 · 조건이 다 차야 열린다'; }
  else if (e.stage === 'ready') {
    main = blocks.length ? { t: '링크 만들기', off: true }
      : { t: '링크 만들기', go: () => { e.stage = 'filling'; e.steps = 0; e.linkAt = '09-16 16:20'; ecLog(e, '링크 만들기'); render(); } };
    if (blocks.length) why = `발송 전 확인 ${blocks.length}건이 막고 있다`;
  }
  else if (e.stage === 'review') main = { t: '승인', go: () => {
    e.stage = 'done'; e.signedAt = '09-16 16:20'; e.steps = 8; a.contract = true; ecLog(e, '승인 — 완료'); render(); } };
  else if (e.stage === 'filling') why = '고객이 쓰는 중이다 — 우리가 할 일은 없다';
  /* ★고객 작성 중에는 주 단추가 «없다» */
  return { memo: why ? `<p class="whyoff">${esc(why)}</p>` : null, more, subs, main };
}

/** 계약서 — «사진 자리» 와 같은 부피. 읽는 자리가 아니라 무슨 서식인지 알아보는 자리다 */
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
