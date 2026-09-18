import assert from 'node:assert/strict';
import { renderContractPdf } from '../src/server/esign/pdf';

process.env.AWS_LAMBDA_FUNCTION_VERSION ||= 'ci';

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face{font-family:Pretendard;src:url("/fonts/Pretendard-Regular.woff2") format("woff2");font-weight:400}
@font-face{font-family:Pretendard;src:url("/fonts/Pretendard-Bold.woff2") format("woff2");font-weight:700}
@page{size:A4;margin:18mm}body{font-family:Pretendard,sans-serif}h1{font-size:22px}p{font-size:12px;line-height:1.7}
</style></head><body><h1>프리패스 전자계약 PDF 검증</h1><p>한글 계약서 · 고객 · 차량 · 대여료 · 보증금 · 약관 · 전자서명</p></body></html>`;

const pdf = await renderContractPdf(html);
assert.equal(Buffer.from(pdf.subarray(0, 4)).toString('ascii'), '%PDF');
assert.ok(pdf.byteLength > 10_000, 'PDF is unexpectedly small');
console.log(`esign pdf smoke PASS · ${pdf.byteLength.toLocaleString()} bytes`);
