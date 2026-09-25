import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { EsignFinalDocumentRenderer } from '../../ports/esign/repositories';
import type { EsignPrivateSubmission, EsignSnapshot } from '../../domain/esign/types';
import { buildContractHtml } from '../../server/esign/document';

const FONT_FILES = [
  'Pretendard-Regular.woff2',
  'Pretendard-Medium.woff2',
  'Pretendard-SemiBold.woff2',
  'Pretendard-Bold.woff2',
] as const;

const DEFAULT_RENDER_TIMEOUT_MS = 45_000;
const DEFAULT_LAUNCH_TIMEOUT_MS = 30_000;

function positiveMs(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1_000 && value <= 120_000 ? Math.floor(value) : fallback;
}

function signatureContentType(bytes: Uint8Array) {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12
    && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF'
    && Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP') return 'image/webp';
  throw new Error('전자서명 이미지 형식을 확인할 수 없습니다.');
}

async function deadline<T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function inlineContractPdfFonts(html: string) {
  let output = html;
  for (const file of FONT_FILES) {
    const assetPath = path.join(process.cwd(), 'public', 'fonts', file);
    let bytes: Buffer;
    try {
      bytes = await readFile(assetPath);
    } catch {
      throw new Error('전자계약 PDF용 한글 폰트가 배포물에 없습니다.');
    }
    if (bytes.byteLength < 10_000) throw new Error('전자계약 PDF용 한글 폰트 파일이 유효하지 않습니다.');
    const relative = '../fonts/' + file;
    if (!output.includes(relative)) throw new Error('전자계약 템플릿의 한글 폰트 참조가 예상과 다릅니다.');
    output = output.replaceAll(relative, 'data:font/woff2;base64,' + bytes.toString('base64'));
  }
  if (/\.\.\/fonts\/Pretendard-[^)"']+/i.test(output)) {
    throw new Error('전자계약 PDF에 인라인되지 않은 폰트 참조가 남아 있습니다.');
  }
  return output;
}

function stripInteractivePrintHarness(html: string) {
  let output = html.replace(/<aside\s+class=["']builder["'][\s\S]*?<\/aside>/i, '');
  output = output.replace(/<button\s+class=["']fp-pdf-button["'][\s\S]*?<\/button>/gi, '');
  if (/window\.print\s*\(/i.test(output)) {
    throw new Error('최종 전자계약 HTML에 인쇄용 조작 버튼이 남아 있습니다.');
  }
  return output;
}

export async function prepareFinalContractHtml(input: {
  snapshot: EsignSnapshot;
  submission: EsignPrivateSubmission;
  signatureBytes: Uint8Array;
  sealHash: string;
}) {
  const mime = signatureContentType(input.signatureBytes);
  const signatureDataUrl = 'data:' + mime + ';base64,' + Buffer.from(input.signatureBytes).toString('base64');
  const source = await buildContractHtml(input.snapshot, {
    submission: input.submission,
    signatureDataUrl,
    sealHash: input.sealHash,
    printButton: false,
  });
  const withoutHarness = stripInteractivePrintHarness(source);
  const html = await inlineContractPdfFonts(withoutHarness);
  if (!html.includes(input.sealHash) || !html.includes(signatureDataUrl)) {
    throw new Error('전자계약 봉인값 또는 서명이 최종 HTML에 반영되지 않았습니다.');
  }
  return html;
}

function pdfLooksComplete(bytes: Uint8Array) {
  if (bytes.byteLength < 1_024) return false;
  if (Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') return false;
  return Buffer.from(bytes.subarray(Math.max(0, bytes.byteLength - 2_048))).toString('latin1').includes('%%EOF');
}

async function closeQuietly(browser: Browser | undefined) {
  if (!browser) return;
  await deadline(browser.close(), 5_000, 'PDF 브라우저 종료 시간이 초과되었습니다.').catch(() => undefined);
}

export class PuppeteerEsignFinalDocumentRenderer implements EsignFinalDocumentRenderer {
  async render(input: {
    snapshot: EsignSnapshot;
    submission: EsignPrivateSubmission;
    signatureBytes: Uint8Array;
    sealHash: string;
  }) {
    const renderTimeout = positiveMs(process.env.ESIGN_PDF_RENDER_TIMEOUT_MS, DEFAULT_RENDER_TIMEOUT_MS);
    const launchTimeout = positiveMs(process.env.ESIGN_PDF_LAUNCH_TIMEOUT_MS, DEFAULT_LAUNCH_TIMEOUT_MS);
    const html = await prepareFinalContractHtml(input);
    let browser: Browser | undefined;

    try {
      const executablePath = process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH?.trim()
        || await deadline(chromium.executablePath(), launchTimeout, 'PDF 브라우저 준비 시간이 초과되었습니다.');

      browser = await deadline(puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: 'shell',
        timeout: launchTimeout,
        defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      }), launchTimeout, 'PDF 브라우저 실행 시간이 초과되었습니다.');

      const page = await browser.newPage();
      page.setDefaultTimeout(renderTimeout);
      page.setDefaultNavigationTimeout(renderTimeout);

      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = request.url();
        if (url.startsWith('data:') || url.startsWith('about:')) void request.continue();
        else void request.abort('blockedbyclient');
      });

      await page.setContent(html, { waitUntil: 'load', timeout: renderTimeout });
      await page.emulateMediaType('print');

      await page.waitForFunction(() => !document.body.classList.contains('cloak'), { timeout: renderTimeout });
      await page.evaluate(async () => {
        document.querySelectorAll('.builder,.toolbar,.fp-pdf-button').forEach(node => node.remove());
        await document.fonts.ready;
      });

      const readiness = await page.evaluate(() => {
        const visibleBrokenImages = Array.from(document.images).filter(img => {
          const style = getComputedStyle(img);
          const visible = style.display !== 'none'
            && style.visibility !== 'hidden'
            && Number(style.opacity || '1') !== 0
            && img.getClientRects().length > 0;
          return visible && (!img.complete || img.naturalWidth === 0);
        }).length;
        return {
          fontReady: document.fonts.status === 'loaded'
            && document.fonts.check('12px Pretendard', '전자계약 한글 검증'),
          visibleBrokenImages,
          pages: document.querySelectorAll('body > .page').length,
          hasPrintControl: Boolean(document.querySelector('[onclick*="window.print"],.fp-pdf-button,.builder')),
        };
      });

      if (!readiness.fontReady) throw new Error('전자계약 PDF 한글 폰트 로딩에 실패했습니다.');
      if (readiness.visibleBrokenImages > 0) throw new Error('전자계약 PDF에 로딩되지 않은 이미지가 있습니다.');
      if (readiness.pages < 1) throw new Error('전자계약 PDF A4 페이지를 찾을 수 없습니다.');
      if (readiness.hasPrintControl) throw new Error('최종 전자계약에 인쇄용 조작 UI가 남아 있습니다.');

      const bytes = new Uint8Array(await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        timeout: renderTimeout,
        waitForFonts: true,
      }));

      if (!pdfLooksComplete(bytes)) throw new Error('최종 PDF 생성 결과가 유효하지 않습니다.');
      return { bytes, contentType: 'application/pdf' as const };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('전자계약')) throw error;
      throw new Error('전자계약 최종 PDF 생성에 실패했습니다.', { cause: error });
    } finally {
      await closeQuietly(browser);
    }
  }
}

export const esignFinalDocumentRenderer = new PuppeteerEsignFinalDocumentRenderer();
