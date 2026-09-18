import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stripDetachedEsignAppendices } from '../../domain/esign/document-boundary';
import { AGREEMENT_SECTIONS, AGREEMENT_TITLE, AGREEMENT_VERSION } from '../../domain/esign/agreement';
import type { EsignPrivateSubmission, EsignSnapshot } from '../../domain/esign/types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]!));
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');

export async function buildContractHtml(snapshot: EsignSnapshot, options: {
  submission?: EsignPrivateSubmission | null;
  signatureDataUrl?: string;
  sealHash?: string;
  printButton?: boolean;
} = {}) {
  const templatePath = path.join(process.cwd(), 'public', 'contract-template', 'rental-contract.html');
  let html = stripDetachedEsignAppendices(await readFile(templatePath, 'utf8'));
  const fields = { ...snapshot.templateFields };
  if (options.submission) {
    Object.assign(fields, {
      customer_name: options.submission.customerName,
      customer_phone: options.submission.customerPhone,
      customer_birth: options.submission.customerBirth ?? '',
      customer_address: options.submission.customerAddress,
      driver_license_no: options.submission.driverLicenseNo ?? '',
      signer_name: options.submission.signerName ?? '',
      signer_role: options.submission.signerRole ?? '',
      emergency_contact: [options.submission.emergencyRelation, options.submission.emergencyName, options.submission.emergencyPhone].filter(Boolean).join(' · '),
      esign_signed_at: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(options.submission.submittedAt)),
      esign_consent_status: String(options.submission.consents.length) + '건 필수 동의 완료',
      esign_consent_summary: options.submission.consents.join(' · '),
      esign_seal_hash: options.sealHash ? options.sealHash.slice(0, 16) + '…' : '',
      esign_verify_path: options.sealHash ? '프리패스 ERP 봉인 검증' : '',
    });
  }
  const sealed = {
    state: snapshot.templateState,
    fields,
    signature: options.signatureDataUrl ?? '',
    sealHash: options.sealHash ?? '',
  };
  html = html.replace('</head>', '<script>window.__SEALED__=' + safeJson(sealed) + ';</script></head>');
  if (options.printButton !== false) {
    html = html.replace(/<body([^>]*)>/i, '<body$1><button class="fp-pdf-button" type="button" onclick="window.print()">A4 PDF 저장</button>');
    html = html.replace('</style>', '.fp-pdf-button{position:fixed;right:18px;top:18px;z-index:9999;border:0;border-radius:4px;padding:10px 14px;background:#1B2A4A;color:#fff;font:700 13px Pretendard,system-ui,sans-serif;cursor:pointer}@media print{.fp-pdf-button{display:none!important}}</style>');
  }
  return html;
}

export function fallbackContractHtml(snapshot: EsignSnapshot, submission?: EsignPrivateSubmission | null, sealHash = '') {
  const terms = AGREEMENT_SECTIONS.map((x) => '<section><h3>' + esc(x.t) + '</h3><p>' + esc(x.b) + '</p></section>').join('');
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(snapshot.contractCode) + '</title><style>'
    + 'body{font-family:Arial,"Noto Sans KR",sans-serif;color:#18212b;margin:0;background:#eef1f4}main{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:18mm;box-sizing:border-box}'
    + 'h1{font-size:22px}h2{font-size:16px;margin-top:28px}h3{font-size:13px;margin:18px 0 6px}p,dt,dd{font-size:11px;line-height:1.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.box{background:#f4f6f8;padding:10px;border-radius:4px}dt{color:#6b7580}dd{margin:2px 0 0;font-weight:700}.seal{margin-top:22px;padding:12px;border-top:1px solid #dfe4e9;color:#6b7580}@media print{body{background:#fff}main{margin:0}}'
    + '</style></head><body><main><h1>자동차 장기대여 계약서</h1><div class="grid">'
    + '<div class="box"><dt>계약번호</dt><dd>' + esc(snapshot.contractCode) + '</dd></div>'
    + '<div class="box"><dt>고객</dt><dd>' + esc(submission?.customerName ?? snapshot.customerName) + '</dd></div>'
    + '<div class="box"><dt>차량</dt><dd>' + esc(snapshot.vehicleName) + ' · ' + esc(snapshot.plate) + '</dd></div>'
    + '<div class="box"><dt>기간 / 월 대여료</dt><dd>' + esc(snapshot.termMonths) + '개월 · ' + esc(snapshot.rent?.toLocaleString()) + '원</dd></div>'
    + '</div><h2>' + esc(AGREEMENT_TITLE) + ' <small>' + esc(AGREEMENT_VERSION) + '</small></h2>' + terms
    + '<div class="seal">봉인 해시 ' + esc(sealHash) + '</div></main></body></html>';
}
