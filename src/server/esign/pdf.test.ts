import assert from 'node:assert/strict';
import test from 'node:test';
import { isCompletePdfBytes, pinPdfInfoDates } from './pdf';

function pdfWithDates(creation: string, mod: string) {
  return new Uint8Array(Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<</Creator (Chromium)\n/Producer (Skia/PDF m147)\n'
      + "/CreationDate (D:" + creation + "+00'00')\n/ModDate (D:" + mod + "+00'00')>>\nendobj\n"),
    Buffer.alloc(2_048, 0x20),
    Buffer.from('\n%%EOF\n'),
  ]));
}

test('pinPdfInfoDates replaces render clock with the immutable input time, same length', () => {
  const a = pdfWithDates('20260925083100', '20260925083100');
  const b = pdfWithDates('20261231235959', '20261231235959');
  const at = Date.parse('2026-09-25T05:30:00.000Z');
  const pa = pinPdfInfoDates(a, at), pb = pinPdfInfoDates(b, at);
  assert.equal(pa.byteLength, a.byteLength);
  assert.deepEqual(pa, pb);
  const text = Buffer.from(pa).toString('latin1');
  assert.ok(text.includes("/CreationDate (D:20260925053000+00'00')"));
  assert.ok(text.includes("/ModDate (D:20260925053000+00'00')"));
  assert.ok(isCompletePdfBytes(pa));
});

test('pinPdfInfoDates fails closed on unexpected metadata or missing time', () => {
  const noDates = new Uint8Array(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2_048, 0x20), Buffer.from('%%EOF\n')]));
  assert.throws(() => pinPdfInfoDates(noDates, Date.now()), /형식/);
  assert.throws(() => pinPdfInfoDates(pdfWithDates('20260925083100', '20260925083100'), 0), /기준값/);
  const twice = Buffer.concat([Buffer.from(pdfWithDates('20260925083100', '20260925083100')), Buffer.from("/CreationDate (D:20260925083100+00'00')")]);
  assert.throws(() => pinPdfInfoDates(new Uint8Array(twice), Date.now()), /형식/);
});

test('isCompletePdfBytes rejects empty, non-PDF and truncated bytes', () => {
  assert.equal(isCompletePdfBytes(new Uint8Array()), false);
  assert.equal(isCompletePdfBytes(new Uint8Array(Buffer.from('<html>'.padEnd(4_000, ' ') + '%%EOF'))), false);
  assert.equal(isCompletePdfBytes(new Uint8Array(Buffer.from('%PDF-1.4\n'.padEnd(4_000, ' ')))), false);
});
