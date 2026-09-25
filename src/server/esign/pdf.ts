import { Buffer } from 'node:buffer';

const MIN_FINAL_PDF_BYTES = 1_024;
const PDF_TAIL_SCAN_BYTES = 4_096;

export function isCompletePdfBytes(bytes: Uint8Array) {
  if (bytes.byteLength < MIN_FINAL_PDF_BYTES) return false;
  if (Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') return false;
  const tail = Buffer.from(
    bytes.subarray(Math.max(0, bytes.byteLength - PDF_TAIL_SCAN_BYTES)),
  ).toString('latin1');
  return /%%EOF(?:\s|$)/.test(tail);
}
