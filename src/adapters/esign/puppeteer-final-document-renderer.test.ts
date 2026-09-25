import assert from 'node:assert/strict';
import test from 'node:test';
import type { EsignPrivateSubmission, EsignSnapshot } from '../../domain/esign/types';
import { prepareFinalContractHtml, PuppeteerEsignFinalDocumentRenderer } from './puppeteer-final-document-renderer';

const png = new Uint8Array(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X1J6WQAAAABJRU5ErkJggg==',
  'base64',
));

const snapshot: EsignSnapshot = {
  contractId: 'c-render',
  contractCode: 'FP-PDF-TEST',
  customerName: '홍길동',
  customerPhone: '01012345678',
  customerType: '개인',
  vehicleName: '제네시스 GV70',
  plate: '12가3456',
  supplierCode: 'TEST',
  supplierName: '프리패스 테스트',
  contractKind: 'rent_return',
  insuranceSide: '회사포함',
  rent: 690000,
  termMonths: 36,
  deposit: 0,
  contractDate: '2026-09-25',
  templateVersion: 'pdf-test-v1',
  agreementVersion: 'agreement-test-v1',
  templateState: { co: 'auto', pd: '렌트선택형', ins: '포함', ct: '개인', car: '등록완료', tax: '개인' },
  templateFields: {
    company_name: '프리패스 테스트',
    company_ceo: '대표',
    company_phone: '02-0000-0000',
    contract_code: 'FP-PDF-TEST',
    contract_date: '2026. 09. 25.',
    customer_name: '홍길동',
    customer_phone: '010-1234-5678',
    car_model: '제네시스 GV70',
    car_number: '12가3456',
    rent_amount: '690,000',
    rent_month: '36개월',
    deposit_amount: '0',
  },
  requiredDocuments: [],
  consentProfile: {
    version: 'test',
    requiredKeys: ['privacy'],
    atoms: [],
    gpsInstalled: '미장착',
    paymentMethod: '계좌이체',
    screeningCriteria: '무심사',
    cmsRequiredBeforeHandover: false,
  },
};

const submission: EsignPrivateSubmission = {
  sessionId: 'sess-render',
  contractId: 'c-render',
  customerName: '홍길동',
  customerPhone: '01012345678',
  customerBirth: '1983-09-26',
  customerAddress: '서울특별시 테스트로 1',
  driverLicenseNo: '11-11-111111-11',
  emergencyRelation: '가족',
  emergencyName: '김가족',
  emergencyPhone: '01099998888',
  consents: ['privacy'],
  consentTimes: { privacy: 1 },
  sectionConfirmations: { agreement: 1 },
  summaryConfirmedAt: 1,
  agreementReadAt: 1,
  signaturePath: 'signatures/test.png',
  signatureSha256: 'a'.repeat(64),
  supportingDocuments: [],
  submittedAt: Date.parse('2026-09-25T05:30:00.000Z'),
};

test('final contract HTML embeds seal/signature/fonts and strips print controls', async () => {
  const sealHash = 'b'.repeat(64);
  const html = await prepareFinalContractHtml({ snapshot, submission, signatureBytes: png, sealHash });
  assert.ok(html.includes(sealHash));
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(html.includes('data:font/woff2;base64,'));
  assert.equal(html.includes('../fonts/Pretendard-'), false);
  assert.equal(/window\.print\s*\(/i.test(html), false);
  assert.equal(html.includes('class="builder"'), false);
});

test('production renderer launches Chromium and returns a real multi-page PDF', { timeout: 120_000 }, async () => {
  const renderer = new PuppeteerEsignFinalDocumentRenderer();
  const result = await renderer.render({
    snapshot,
    submission,
    signatureBytes: png,
    sealHash: 'c'.repeat(64),
  });
  const buf = Buffer.from(result.bytes);
  assert.equal(result.contentType, 'application/pdf');
  assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(buf.length > 50_000);
  assert.ok(buf.subarray(Math.max(0, buf.length - 2048)).toString('latin1').includes('%%EOF'));
  const pageObjects = (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(pageObjects >= 2);
});
