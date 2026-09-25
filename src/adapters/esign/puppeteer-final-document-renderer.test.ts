import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { EsignPrivateSubmission, EsignSnapshot } from '../../domain/esign/types';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inlineContractTemplateAssets, prepareFinalContractHtml, PuppeteerEsignFinalDocumentRenderer } from './puppeteer-final-document-renderer';

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

function latin1(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('latin1');
}

test('production renderer launches Chromium and returns a deterministic multi-page A4 PDF', { timeout: 180_000 }, async () => {
  const renderer = new PuppeteerEsignFinalDocumentRenderer();
  const input = { snapshot, submission, signatureBytes: png, sealHash: 'c'.repeat(64) };
  const result = await renderer.render(input);
  const buf = Buffer.from(result.bytes);
  const raw = latin1(result.bytes);
  assert.equal(result.contentType, 'application/pdf');
  assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(buf.length > 50_000);
  assert.ok(buf.subarray(Math.max(0, buf.length - 2048)).toString('latin1').includes('%%EOF'));

  const pageObjects = (raw.match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(pageObjects >= 2, 'contract conditions and terms span multiple pages');
  const mediaBoxes = raw.match(/\/MediaBox\s*\[[^\]]*\]/g) || [];
  assert.equal(mediaBoxes.length, pageObjects);
  for (const box of mediaBoxes) {
    const [, , w, h] = box.replace(/.*\[/, '').replace(']', '').trim().split(/\s+/).map(Number);
    assert.ok(Math.abs(w - 595.28) < 1 && Math.abs(h - 841.89) < 1, 'A4 page: ' + box);
  }

  // Korean glyphs come from the embedded Pretendard subsets only (no system-font fallback).
  const fontNames = new Set(raw.match(/\/FontName\s*\/[A-Z]{6}\+[A-Za-z-]+/g) || []);
  assert.ok(fontNames.size >= 1);
  for (const name of fontNames) assert.match(name, /\+Pretendard-/);

  // No browser header/footer or render clock leaks into the sealed document.
  assert.ok(raw.includes("/CreationDate (D:20260925053000+00'00')"));
  assert.ok(raw.includes("/ModDate (D:20260925053000+00'00')"));
  assert.equal(raw.includes('about:blank'), false);

  const again = await renderer.render(input);
  assert.equal(
    createHash('sha256').update(again.bytes).digest('hex'),
    createHash('sha256').update(result.bytes).digest('hex'),
    'same sealed input must yield identical PDF bytes',
  );

  const otherSeal = await renderer.render({ ...input, sealHash: 'd'.repeat(64) });
  assert.notEqual(
    createHash('sha256').update(otherSeal.bytes).digest('hex'),
    createHash('sha256').update(result.bytes).digest('hex'),
  );
});

test('production renderer rejects an unknown signature image format before launching Chromium', async () => {
  const renderer = new PuppeteerEsignFinalDocumentRenderer();
  await assert.rejects(
    () => renderer.render({ snapshot, submission, signatureBytes: new Uint8Array(Buffer.from('<svg/>')), sealHash: 'c'.repeat(64) }),
    /서명 이미지 형식/,
  );
});

test('production renderer fails closed when Chromium cannot launch', { timeout: 60_000 }, async () => {
  const previous = process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH;
  process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH = '/nonexistent/chromium-for-esign-test';
  try {
    await assert.rejects(
      () => new PuppeteerEsignFinalDocumentRenderer().render({ snapshot, submission, signatureBytes: png, sealHash: 'c'.repeat(64) }),
      (error: Error) => error.message === '전자계약 최종 PDF 생성에 실패했습니다.' && error.cause instanceof Error,
    );
  } finally {
    if (previous === undefined) delete process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH;
    else process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH = previous;
  }
});

async function withTemplateAssetDir(files: Record<string, Uint8Array>, run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'esign-template-assets-'));
  try {
    await mkdir(path.join(dir, 'assets'));
    for (const [name, bytes] of Object.entries(files)) await writeFile(path.join(dir, 'assets', name), bytes);
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('template-relative logo assets are inlined wherever the template references them', async () => {
  await withTemplateAssetDir({ 'logo-a.png': png }, async (dir) => {
    const html = '<img src="assets/logo-a.png"><script>var c={logo:\'assets/logo-a.png\'};var m=\'assets/missing.webp\';</script>';
    const out = await inlineContractTemplateAssets(html, dir);
    assert.equal(out.includes('assets/logo-a.png'), false);
    assert.equal(out.split('data:image/png;base64,').length - 1, 2);
    assert.equal(out.includes('assets/missing.webp'), false);
    assert.ok(out.includes("var m='';"), 'assets that do not ship resolve to the template no-logo path');
    assert.equal(await inlineContractTemplateAssets('<img src="assets/../../etc/passwd.png">', dir), '<img src="assets/../../etc/passwd.png">');
  });
});

const sonogong: EsignSnapshot = {
  ...snapshot,
  supplierName: '주식회사 손오공렌터카',
  templateFields: { ...snapshot.templateFields, company_name: '주식회사 손오공렌터카' },
};

test('production renderer deterministically takes the no-logo path when a supplier logo does not ship', { timeout: 120_000 }, async () => {
  await withTemplateAssetDir({}, async (dir) => {
    const renderer = new PuppeteerEsignFinalDocumentRenderer({ templateAssetDir: dir });
    const input = { snapshot: sonogong, submission, signatureBytes: png, sealHash: 'c'.repeat(64) };
    const html = await prepareFinalContractHtml(input, { templateAssetDir: dir });
    assert.equal(html.includes('assets/logo-sonogong.webp'), false);
    const first = await renderer.render(input);
    const second = await renderer.render(input);
    assert.equal(createHash('sha256').update(first.bytes).digest('hex'), createHash('sha256').update(second.bytes).digest('hex'));
  });
});

test('production renderer embeds a shipped supplier logo without network access', { timeout: 120_000 }, async () => {
  await withTemplateAssetDir({ 'logo-sonogong.webp': png }, async (dir) => {
    const input = { snapshot: sonogong, submission, signatureBytes: png, sealHash: 'c'.repeat(64) };
    const withLogo = await new PuppeteerEsignFinalDocumentRenderer({ templateAssetDir: dir }).render(input);
    assert.equal(Buffer.from(withLogo.bytes).subarray(0, 5).toString('ascii'), '%PDF-');
    await withTemplateAssetDir({}, async (emptyDir) => {
      const withoutLogo = await new PuppeteerEsignFinalDocumentRenderer({ templateAssetDir: emptyDir }).render(input);
      const images = (bytes: Uint8Array) => (latin1(bytes).match(/\/Subtype\s*\/Image\b/g) || []).length;
      assert.ok(images(withLogo.bytes) > images(withoutLogo.bytes), 'shipped logo is drawn into the PDF');
    });
  });
});

test('production renderer refuses to seal a signature image the browser cannot decode', { timeout: 120_000 }, async () => {
  const corrupt = new Uint8Array(png);
  corrupt[29] ^= 0xff; // PNG magic intact, IHDR CRC broken -> undecodable
  await assert.rejects(
    () => new PuppeteerEsignFinalDocumentRenderer().render({ snapshot, submission, signatureBytes: corrupt, sealHash: 'c'.repeat(64) }),
    /로딩되지 않은 이미지|고객 서명이 렌더링되지/,
  );
});

const longClause = '임차인은 차량을 선량한 관리자의 주의로 사용하며, 회사의 사전 서면 동의 없이 제3자에게 전대할 수 없다. ';

test('production renderer refuses to seal special terms that overflow their fixed A4 region', { timeout: 120_000 }, async () => {
  const overflowing = { ...snapshot, templateFields: { ...snapshot.templateFields, special_terms: longClause.repeat(120) } };
  await assert.rejects(
    () => new PuppeteerEsignFinalDocumentRenderer().render({ snapshot: overflowing, submission, signatureBytes: png, sealHash: 'c'.repeat(64) }),
    /영역을 넘쳐 잘리는 내용/,
  );
});

test('production renderer refuses to seal when a long field pushes another clause out of its page', { timeout: 120_000 }, async () => {
  // Before region checks, this silently dropped the "초과주행 정산" clause at the bottom of page 2.
  const options = '파노라마 선루프, 헤드업 디스플레이, 어라운드뷰 모니터, '.repeat(10);
  const pushed = { ...snapshot, templateFields: { ...snapshot.templateFields, options } };
  await assert.rejects(
    () => new PuppeteerEsignFinalDocumentRenderer().render({ snapshot: pushed, submission, signatureBytes: png, sealHash: 'c'.repeat(64) }),
    /영역을 넘쳐 잘리는 내용/,
  );
});

test('production renderer seals realistic long inputs without false overflow', { timeout: 120_000 }, async () => {
  const realistic = { ...snapshot, templateFields: { ...snapshot.templateFields, special_terms: longClause.repeat(20), options: '파노라마 선루프, 헤드업 디스플레이' } };
  const sub = { ...submission, customerName: '남궁제갈선우', customerAddress: '경기도 성남시 분당구 판교역로 235, 에이치스퀘어 엔동 7층 701호(삼평동, 판교테크노밸리)' };
  const result = await new PuppeteerEsignFinalDocumentRenderer().render({ snapshot: realistic, submission: sub, signatureBytes: png, sealHash: 'c'.repeat(64) });
  assert.equal(Buffer.from(result.bytes).subarray(0, 5).toString('ascii'), '%PDF-');
});
