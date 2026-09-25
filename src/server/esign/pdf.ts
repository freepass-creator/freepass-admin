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

const PDF_INFO_DATE = /\/(CreationDate|ModDate) \(D:\d{14}\+00'00'\)/g;

function pdfUtcDate(epochMs: number) {
  const iso = new Date(epochMs).toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return 'D:' + iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10)
    + iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19) + "+00'00'";
}

/**
 * Chromium(Skia) writes the wall-clock render time into the Info dictionary; everything else is
 * byte-stable for the same HTML. Pin both dates to an immutable input time so a retry of the same
 * sealed input yields the same bytes/SHA-256. Replacement is same-length, so xref offsets stay valid.
 * Fails closed when the expected Info dates are not present exactly once each.
 */
export function pinPdfInfoDates(bytes: Uint8Array, epochMs: number) {
  if (!Number.isFinite(epochMs) || epochMs <= 0) throw new Error('PDF 문서 시각 기준값이 없습니다.');
  const pinned = pdfUtcDate(epochMs);
  const source = Buffer.from(bytes).toString('latin1');
  const seen = { CreationDate: 0, ModDate: 0 } as Record<string, number>;
  const output = source.replace(PDF_INFO_DATE, (_, key: string) => {
    seen[key] += 1;
    return '/' + key + ' (' + pinned + ')';
  });
  if (seen.CreationDate !== 1 || seen.ModDate !== 1 || output.length !== source.length) {
    throw new Error('PDF 문서 시각 메타데이터 형식이 예상과 다릅니다.');
  }
  return new Uint8Array(Buffer.from(output, 'latin1'));
}
