import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bizChecksumOk, checkOpen, failPatch, maskName, newToken, snapshotOf, tokenHash, MAX_FAILS } from '../claim-link.js';
import { claimLedger } from '../ledgers.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

/** 검증번호가 맞는 사업자번호를 만든다(시험용) */
function validBiz(head9: string): string {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let s = 0; for (let i = 0; i < 9; i += 1) s += Number(head9[i]) * w[i];
  s += Math.floor((Number(head9[8]) * 5) / 10);
  return head9 + String((10 - (s % 10)) % 10);
}
const BIZ = validBiz('123456789');

describe('토큰 — ERP5 에는 해시만', () => {
  it('추측 못 할 길이 · 같은 토큰은 같은 해시', () => {
    const t = newToken();
    assert.ok(t.length >= 43);
    assert.equal(tokenHash(t), tokenHash(t));
    assert.notEqual(tokenHash(t), tokenHash(newToken()));
  });
});

describe('사업자등록번호', () => {
  it('검증번호 셈 · 하이픈 무시', () => {
    assert.ok(bizChecksumOk(`${BIZ.slice(0, 3)}-${BIZ.slice(3, 5)}-${BIZ.slice(5)}`));
    assert.ok(!bizChecksumOk(BIZ.slice(0, 9) + String((Number(BIZ[9]) + 1) % 10)));
    assert.ok(!bizChecksumOk('12345'));
  });
});

describe('문 열기 — 거둠 · 잠금 · 번호', () => {
  const s = { linkHash: 'h', partyBizNo: BIZ, failCount: 0 };
  it('맞으면 연다 · 틀리면 셈한다 · 10번째에 잠근다', () => {
    assert.equal(checkOpen(s, BIZ, 0).ok, true);
    const wrong = validBiz('987654321');
    const r = checkOpen(s, wrong, 0);
    assert.equal(!r.ok && r.reason, 'WRONG');
    assert.deepEqual(failPatch({ failCount: 3 }, 0), { failCount: 4 });
    assert.deepEqual(failPatch({ failCount: MAX_FAILS - 1 }, 1000), { failCount: 0, lockedUntil: 1000 + 30 * 60_000 });
  });
  it('오타(검증번호 틀림)는 횟수를 안 깎는다 · 잠김 · 거둠 · 번호 없음', () => {
    assert.equal((checkOpen(s, '1234567890', 0) as { reason: string }).reason === 'BAD_FORMAT' || bizChecksumOk('1234567890'), true);
    assert.equal((checkOpen({ ...s, lockedUntil: 10 }, BIZ, 5) as { reason: string }).reason, 'LOCKED');
    assert.equal((checkOpen({ ...s, linkRevokedAt: 1 }, BIZ, 5) as { reason: string }).reason, 'REVOKED');
    assert.equal((checkOpen({ linkHash: 'h' }, BIZ, 5) as { reason: string }).reason, 'NO_BIZ');
  });
});

describe('굳힌 사본 — ★그 축 금액만 · 손님 이름 가림', () => {
  const row = toSettlementRow({ code: 'a', plate: '12가3456', receivedAt: '2026-09-01', supplier: 'A', channel: 'X', customer: '홍길동',
    paper: true, delivered: true, deliveredAt: '2026-09-03', claimWritten: 1_000_000, payWritten: 800_000, payKind: '일시납' }, 'a').row;
  const g = claimLedger([row], '2026-09', [], new Date(2026, 8, 18))[0];
  it('공급사 사본에는 청구액만 — 지급액(800,000)·우리 몫은 없다', () => {
    const snap = snapshotOf('공급사', 'A', '2026-09', g.lines, []);
    const line = snap.lines[0];
    assert.equal(line.net, 1_000_000);
    assert.equal(line.customer, '홍○동');
    assert.ok(!JSON.stringify(snap).includes('800000'));
  });
  it('이름 가리기 — 법인은 그대로', () => {
    assert.equal(maskName('김철'), '김○');
    assert.equal(maskName('주식회사 한라'), '주식회사 한라');
  });
});
