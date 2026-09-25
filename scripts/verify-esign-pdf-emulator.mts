/**
 * Electronic-contract final PDF — end-to-end verification against the Firebase emulators.
 *
 * Exercises the real production composition (EsignService + Erp5 Firestore/Storage adapters +
 * Puppeteer/Chromium renderer): competing approvals, real PDF render, private Storage write,
 * independent read-back SHA-256, atomic signed finalization, final document retrieval, retries.
 *
 * ★Emulator only. Refuses to run unless both emulator hosts are set, so it can never write to a
 *   real ERP5 project. See docs/ESIGN-PDF-RENDERER.md for the exact command.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { getStorage } from 'firebase-admin/storage';
import { erp5, erp5App } from '../src/adapters/erp5/firestore';
import { esignRepository, esignAssets } from '../src/adapters/erp5/esign-repository';
import { esignFinalDocumentRenderer } from '../src/adapters/esign/puppeteer-final-document-renderer';
import { EsignService } from '../src/services/esign/service';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST are required (emulator only).');
  process.exit(2);
}

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function chunk(type: string, data: Buffer) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data]))); return Buffer.concat([len, Buffer.from(type), data, crc]); }
function signaturePng() {
  const w = 600, h = 180, row = w * 4 + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) { raw[y * row] = 0; for (let x = 0; x < w; x++) { const i = y * row + 1 + x * 4; raw[i] = 255; raw[i + 1] = 255; raw[i + 2] = 255; raw[i + 3] = 0; } }
  for (let y = 80; y < 96; y++) for (let x = 100; x < 500; x++) { const i = y * row + 1 + x * 4; raw[i] = 20; raw[i + 1] = 20; raw[i + 2] = 20; raw[i + 3] = 255; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const svc = new EsignService(esignRepository, esignAssets, esignFinalDocumentRenderer);
const runId = Date.now().toString(36);
const contractId = 'c-e2e-' + runId;
await erp5().collection('contract').doc(contractId).set({
  contract_code: 'FP-E2E-' + runId, contract_status: '계약대기', customer_name: '홍길동', customer_phone: '01012345678', customer_type: '개인',
  vehicle_name_snapshot: '제네시스 GV70', car_number_snapshot: '12가3456', provider_company_code: 'SONO', provider_company_name_snapshot: '손오공렌터카',
  rent_amount_snapshot: 690000, rent_month_snapshot: 36, deposit_amount_snapshot: 0, contract_date: '2026-09-25',
  esign_contract_kind: 'rent_return', esign_insurance_side: '회사포함', screening_criteria: '무심사', gps_installed: '미장착', payment_method: '계좌이체',
});
const issued = await svc.issue(contractId, 'e2e');
const session = issued.session;
const sig = await esignAssets.put('esign-private/' + session.id + '/signature.png', signaturePng(), 'image/png');
const idCard = await esignAssets.put('esign-private/' + session.id + '/id.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg');
const selfie = await esignAssets.put('esign-private/' + session.id + '/selfie.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg');
const docs = [];
for (const d of session.snapshot.requiredDocuments.filter(d => d.required)) {
  const a = await esignAssets.put('esign-private/' + session.id + '/doc-' + d.key + '.pdf', new Uint8Array(Buffer.from('%PDF-1.4\n' + d.key)), 'application/pdf');
  docs.push({ key: d.key, path: a.path, sha256: a.sha256, label: d.label });
}
const submittedAt = Date.parse('2026-09-25T05:30:00.000Z');
await esignRepository.putPrivate(session.id, {
  sessionId: session.id, contractId, customerName: '홍길동', customerPhone: '01012345678', customerBirth: '1983-09-26',
  customerAddress: '서울특별시 강남구 테헤란로 1, 101동 1001호', driverLicenseNo: '11-11-111111-11',
  emergencyRelation: '가족', emergencyName: '김가족', emergencyPhone: '01099998888',
  consents: [...session.snapshot.consentProfile.requiredKeys], consentTimes: {}, sectionConfirmations: {},
  summaryConfirmedAt: submittedAt, agreementReadAt: submittedAt, signaturePath: sig.path, signatureSha256: sig.sha256,
  supportingDocuments: docs, submittedAt,
  assets: { id_card: { ...idCard, name: 'id.jpg', contentType: 'image/jpeg' }, selfie: { ...selfie, name: 'selfie.jpg', contentType: 'image/jpeg' } },
});
await esignRepository.updateSession(session.id, { status: 'pending_review', submittedAt });

// 1) Competing approvals: exactly one claim may render/sign.
const t0 = Date.now();
const results = await Promise.allSettled([
  svc.approve(contractId, 'finalize_e2e_A_1234567890', 'admin-a'),
  svc.approve(contractId, 'finalize_e2e_B_1234567890', 'admin-b'),
]);
const winners = results.filter(r => r.status === 'fulfilled');
console.log('race:', results.map(r => r.status === 'fulfilled' ? 'signed' : 'rejected: ' + (r.reason as Error).message));
assert.equal(winners.length, 1);
const won = (winners[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof svc.approve>>>).value;
const winnerId = won.session.finalizationId;
console.log('approve ms:', Date.now() - t0);

// 2) Firestore state is signed with document evidence.
const stored = await esignRepository.getSession(session.id);
assert.equal(stored?.status, 'signed');
const path = 'esign-final/' + session.contractCode + '/' + session.id + '.pdf';
assert.equal(stored?.documentStoragePath, path);
const contract = (await erp5().collection('contract').doc(contractId).get()).data()!;
assert.equal(contract.sign_status, '서명완료');
assert.equal(contract.esign_document_sha256, stored?.documentSha256);
const approvedEvents = (await esignRepository.listEvents(contractId)).filter(e => e.type === 'approved');
assert.equal(approvedEvents.length, 1);

// 3) Independent Storage read-back: bytes, SHA-256, metadata.
const file = getStorage(erp5App()).bucket('freepasserp5.appspot.com').file(path);
const [meta] = await file.getMetadata();
const [buf] = await file.download();
assert.equal(sha(buf), stored?.documentSha256);
assert.equal(meta.contentType, 'application/pdf');
assert.equal(meta.cacheControl, 'private,no-store');
assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
const [objects] = await getStorage(erp5App()).bucket('freepasserp5.appspot.com').getFiles({ prefix: 'esign-final/' + session.contractCode + '/' });
assert.deepEqual(objects.map(o => o.name), [path]);

// 4) Authenticated retrieval path service (route adds requireAdmin).
const doc = await svc.finalDocument(session.id);
assert.ok(doc);
assert.equal(sha(doc!.bytes), stored?.documentSha256);

// 5) Same finalization retry is a no-op; a different id is refused.
const again = await svc.approve(contractId, winnerId, 'admin');
assert.equal(again.finalized, false);
await assert.rejects(() => svc.approve(contractId, winnerId === 'finalize_e2e_A_1234567890' ? 'finalize_e2e_B_1234567890' : 'finalize_e2e_A_1234567890', 'admin'), /이미 다른 승인/);
const [meta2] = await file.getMetadata();
assert.equal(meta2.generation, meta.generation, 'retry must not rewrite the signed PDF');

// 6) Re-render of the same sealed input reproduces the stored bytes.
const priv = await esignRepository.getPrivate(session.id);
const rerender = await esignFinalDocumentRenderer.render({ snapshot: session.snapshot, submission: priv!, signatureBytes: signaturePng(), sealHash: stored!.sealHash! });
assert.equal(sha(rerender.bytes), stored?.documentSha256);

// 7) Race: the contract is cancelled while the PDF is rendering (after the service-level check).
//    The in-transaction re-check must refuse to sign; the orphan PDF stays but the session is not signed.
{
  const raceId = contractId + '-race';
  await erp5().collection('contract').doc(raceId).set({
    ...(await erp5().collection('contract').doc(contractId).get()).data(),
    contract_code: 'FP-E2E-R-' + runId, contract_status: '계약대기', sign_status: '',
  });
  const cancellingRenderer = {
    async render(input: Parameters<typeof esignFinalDocumentRenderer.render>[0]) {
      const out = await esignFinalDocumentRenderer.render(input);
      await erp5().collection('contract').doc(raceId).update({ contract_status: '계약취소' });
      return out;
    },
  };
  const raceSvc = new EsignService(esignRepository, esignAssets, cancellingRenderer);
  const raceIssued = await raceSvc.issue(raceId, 'e2e');
  const rs = raceIssued.session;
  const rsig = await esignAssets.put('esign-private/' + rs.id + '/signature.png', signaturePng(), 'image/png');
  const rid = await esignAssets.put('esign-private/' + rs.id + '/id.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg');
  const rself = await esignAssets.put('esign-private/' + rs.id + '/selfie.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg');
  const rdocs = [];
  for (const d of rs.snapshot.requiredDocuments.filter(d => d.required)) {
    const a = await esignAssets.put('esign-private/' + rs.id + '/doc-' + d.key + '.pdf', new Uint8Array(Buffer.from('%PDF-1.4\n' + d.key)), 'application/pdf');
    rdocs.push({ key: d.key, path: a.path, sha256: a.sha256, label: d.label });
  }
  await esignRepository.putPrivate(rs.id, {
    sessionId: rs.id, contractId: raceId, customerName: '홍길동', customerPhone: '01012345678', customerAddress: '서울',
    emergencyRelation: '가족', emergencyName: '김가족', emergencyPhone: '01099998888',
    consents: [...rs.snapshot.consentProfile.requiredKeys], consentTimes: {}, sectionConfirmations: {},
    summaryConfirmedAt: submittedAt, agreementReadAt: submittedAt, signaturePath: rsig.path, signatureSha256: rsig.sha256,
    supportingDocuments: rdocs, submittedAt,
    assets: { id_card: { ...rid, name: 'id.jpg', contentType: 'image/jpeg' }, selfie: { ...rself, name: 'selfie.jpg', contentType: 'image/jpeg' } },
  });
  await esignRepository.updateSession(rs.id, { status: 'pending_review', submittedAt });
  await assert.rejects(() => raceSvc.approve(raceId, 'finalize_e2e_race_1234567890', 'admin'), /취소·철회된 계약/);
  const raced = await esignRepository.getSession(rs.id);
  assert.equal(raced?.status, 'pending_review');
  const raceContract = (await erp5().collection('contract').doc(raceId).get()).data()!;
  assert.equal(raceContract.contract_status, '계약취소');
  assert.notEqual(raceContract.sign_status, '서명완료');
  console.log('race: cancelled during render -> refused in transaction, session back to pending_review');
}

if (process.env.OUT_PDF) writeFileSync(process.env.OUT_PDF, buf);
console.log(JSON.stringify({ sessionId: session.id, path, size: buf.length, sha256: stored?.documentSha256, sealHash: stored?.sealHash, generation: meta.generation, winner: winnerId }, null, 1));
console.log('E2E EMULATOR OK');
process.exit(0);
