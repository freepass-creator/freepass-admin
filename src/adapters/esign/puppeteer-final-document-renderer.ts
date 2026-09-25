import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { EsignFinalDocumentRenderer } from '../../ports/esign/repositories';
import type { EsignPrivateSubmission, EsignSnapshot } from '../../domain/esign/types';
import { buildContractHtml } from '../../server/esign/document';
import { isCompletePdfBytes, pinPdfInfoDates } from '../../server/esign/pdf';

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

type PageReadiness = {
  fontReady: boolean;
  visibleBrokenImages: number;
  brokenImageSources: string[];
  pages: number;
  nonA4Pages: number;
  clippedPages: number;
  overflowingRegions: string[];
  overflowingRegionCount: number;
  visibleCustomerSignatures: number;
  hasSealEvidence: boolean;
  hasPrintControl: boolean;
};

const PAGE_UNCLOAKED_EXPRESSION = '!document.body.classList.contains("cloak")';

const PAGE_STRIP_CONTROLS_AND_WAIT_FONTS_EXPRESSION = `(async () => {
  document.querySelectorAll('.builder,.toolbar,.fp-pdf-button').forEach(node => node.remove());
  await document.fonts.ready;
  // Every image must settle (load or error) and its handlers must run before readiness is judged.
  await Promise.all(Array.from(document.images).map(img => img.complete ? null : new Promise(done => {
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  })));
  await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => null)));
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  return true;
})()`;

function pageReadinessExpression(sealPrefix: string) {
  return `(() => {
  const sealPrefix = ${JSON.stringify(sealPrefix)};
  const isVisible = node => {
    const style = getComputedStyle(node);
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || '1') !== 0
      && node.getClientRects().length > 0;
  };
  const brokenImages = Array.from(document.images)
    .filter(img => isVisible(img) && (!img.complete || img.naturalWidth === 0));
  const visibleBrokenImages = brokenImages.length;
  const brokenImageSources = brokenImages
    .map(img => img.getAttribute('src') || '')
    .filter(src => src && !src.startsWith('data:'))
    .map(src => src.slice(0, 120))
    .slice(0, 5);
  const renderedPages = Array.from(document.querySelectorAll('body > .page')).filter(isVisible);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;width:210mm;height:297mm;';
  document.body.appendChild(probe);
  const expectedA4 = probe.getBoundingClientRect();
  probe.remove();
  const pageMetrics = renderedPages.map(pageNode => {
    const rect = pageNode.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      clipped: pageNode.scrollHeight > pageNode.clientHeight + 2
        || pageNode.scrollWidth > pageNode.clientWidth + 2,
    };
  });
  // Pages are fixed A4 boxes whose inner regions (.pbody, cards, special terms) use overflow:hidden.
  // Content that does not fit is silently hidden there, never on the page box itself, so every
  // clipping container inside a page is checked. Only class names are reported (no contract text).
  const clipsOverflow = value => value === 'hidden' || value === 'clip';
  const overflowingRegions = [];
  for (const pageNode of renderedPages) {
    for (const node of pageNode.querySelectorAll('*')) {
      if (!isVisible(node)) continue;
      const style = getComputedStyle(node);
      const clipY = clipsOverflow(style.overflowY) && node.scrollHeight > node.clientHeight + 2;
      const clipX = clipsOverflow(style.overflowX) && node.scrollWidth > node.clientWidth + 2;
      if (clipY || clipX) overflowingRegions.push((node.tagName.toLowerCase() + '.' + String(node.className || '').trim().split(/\s+/).join('.')).slice(0, 80));
    }
  }
  const nonA4Pages = pageMetrics.filter(metric =>
    Math.abs(metric.width - expectedA4.width) > 2 || Math.abs(metric.height - expectedA4.height) > 2).length;
  const clippedPages = pageMetrics.filter(metric => metric.clipped).length;
  const visibleCustomerSignatures = Array.from(
    document.querySelectorAll('.esign-pad[data-sign="customer"] img[src^="data:image/"]'),
  ).filter(img => isVisible(img) && img.complete && img.naturalWidth > 0).length;
  return {
    fontReady: document.fonts.status === 'loaded'
      && document.fonts.check('12px Pretendard', '전자계약 한글 검증'),
    visibleBrokenImages,
    brokenImageSources,
    pages: renderedPages.length,
    nonA4Pages,
    clippedPages,
    overflowingRegions: overflowingRegions.slice(0, 5),
    overflowingRegionCount: overflowingRegions.length,
    visibleCustomerSignatures,
    hasSealEvidence: document.body.innerText.includes(sealPrefix),
    hasPrintControl: Boolean(document.querySelector('[onclick*="window.print"],.fp-pdf-button,.builder')),
  };
})()`;
}

let bundledExecutablePath: Promise<string> | undefined;

async function resolveChromiumExecutablePath(timeoutMs: number) {
  const explicit = process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (explicit) return explicit;
  if (!bundledExecutablePath) {
    bundledExecutablePath = deadline(
      chromium.executablePath(),
      timeoutMs,
      'PDF 브라우저 준비 시간이 초과되었습니다.',
    ).catch((error) => {
      bundledExecutablePath = undefined;
      throw error;
    });
  }
  return bundledExecutablePath;
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

const TEMPLATE_ASSET_REF = /\bassets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:png|webp|jpe?g)\b/g;
const TEMPLATE_ASSET_MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/**
 * The template resolves supplier logos relative to its public URL (`assets/…`), including from its
 * own script. The final PDF is rendered from about:blank with the network blocked, so every
 * referenced asset that ships with the template is inlined as a data URL.
 * An asset that does not ship resolves to '' — the template then deterministically takes its
 * documented no-logo path (logo hidden, company name shown) instead of racing its onerror handler.
 */
export async function inlineContractTemplateAssets(
  html: string,
  templateDir = path.join(process.cwd(), 'public', 'contract-template'),
) {
  let output = html;
  for (const relative of new Set(html.match(TEMPLATE_ASSET_REF) ?? [])) {
    let bytes: Buffer | undefined;
    try {
      bytes = await readFile(path.join(templateDir, relative));
    } catch {
      bytes = undefined;
    }
    if (!bytes || bytes.byteLength === 0) {
      output = output.replaceAll(relative, '');
      continue;
    }
    const ext = relative.slice(relative.lastIndexOf('.') + 1).toLowerCase();
    output = output.replaceAll(relative, 'data:' + TEMPLATE_ASSET_MIME[ext] + ';base64,' + bytes.toString('base64'));
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
}, options: { templateAssetDir?: string } = {}) {
  const mime = signatureContentType(input.signatureBytes);
  const signatureDataUrl = 'data:' + mime + ';base64,' + Buffer.from(input.signatureBytes).toString('base64');
  const source = await buildContractHtml(input.snapshot, {
    submission: input.submission,
    signatureDataUrl,
    sealHash: input.sealHash,
    printButton: false,
  });
  const withoutHarness = stripInteractivePrintHarness(source);
  const html = await inlineContractTemplateAssets(await inlineContractPdfFonts(withoutHarness), options.templateAssetDir);
  if (!html.includes(input.sealHash) || !html.includes(signatureDataUrl)) {
    throw new Error('전자계약 봉인값 또는 서명이 최종 HTML에 반영되지 않았습니다.');
  }
  return html;
}

async function closeQuietly(browser: Browser | undefined) {
  if (!browser) return;
  try {
    await deadline(browser.close(), 5_000, 'PDF 브라우저 종료 시간이 초과되었습니다.');
  } catch {
    try {
      browser.process()?.kill('SIGKILL');
    } catch {
      // Serverless runtime will reclaim the process; never mask the render result with cleanup failure.
    }
  }
}

export class PuppeteerEsignFinalDocumentRenderer implements EsignFinalDocumentRenderer {
  constructor(private readonly options: { templateAssetDir?: string } = {}) {}

  async render(input: {
    snapshot: EsignSnapshot;
    submission: EsignPrivateSubmission;
    signatureBytes: Uint8Array;
    sealHash: string;
  }) {
    const renderTimeout = positiveMs(process.env.ESIGN_PDF_RENDER_TIMEOUT_MS, DEFAULT_RENDER_TIMEOUT_MS);
    const launchTimeout = positiveMs(process.env.ESIGN_PDF_LAUNCH_TIMEOUT_MS, DEFAULT_LAUNCH_TIMEOUT_MS);
    const html = await prepareFinalContractHtml(input, this.options);
    let browser: Browser | undefined;

    try {
      const executablePath = await resolveChromiumExecutablePath(launchTimeout);

      browser = await puppeteer.launch({
        args: [...chromium.args, '--lang=ko-KR'],
        executablePath,
        headless: 'shell',
        timeout: launchTimeout,
        defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      });

      const page = await browser.newPage();
      page.setDefaultTimeout(renderTimeout);
      page.setDefaultNavigationTimeout(renderTimeout);

      // Pin environment-dependent formatting so local, CI and serverless runtimes render identically.
      await page.emulateTimezone('Asia/Seoul');
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = request.url();
        if (url.startsWith('data:') || url.startsWith('about:')) void request.continue();
        else void request.abort('blockedbyclient');
      });

      await page.setContent(html, { waitUntil: 'load', timeout: renderTimeout });
      await page.emulateMediaType('print');

      // Browser-side code is passed as source strings: transpilers (tsx/esbuild keepNames, Next/SWC)
      // may inject helpers such as __name into serialized functions, which do not exist in the page.
      await page.waitForFunction(PAGE_UNCLOAKED_EXPRESSION, { timeout: renderTimeout });
      // page.evaluate has no timeout of its own; a never-settling font/image must not hang the request.
      await deadline(
        page.evaluate(PAGE_STRIP_CONTROLS_AND_WAIT_FONTS_EXPRESSION),
        renderTimeout,
        '전자계약 PDF 글꼴·이미지 준비 시간이 초과되었습니다.',
      );
      const readiness = await deadline(
        page.evaluate(pageReadinessExpression(input.sealHash.slice(0, 16))) as Promise<PageReadiness>,
        renderTimeout,
        '전자계약 PDF 렌더링 점검 시간이 초과되었습니다.',
      );

      if (!readiness.fontReady) throw new Error('전자계약 PDF 한글 폰트 로딩에 실패했습니다.');
      if (readiness.visibleBrokenImages > 0) {
        const sources = readiness.brokenImageSources.length ? ': ' + readiness.brokenImageSources.join(', ') : '';
        throw new Error('전자계약 PDF에 로딩되지 않은 이미지가 있습니다' + sources);
      }
      if (readiness.pages < 1) throw new Error('전자계약 PDF A4 페이지를 찾을 수 없습니다.');
      if (readiness.nonA4Pages > 0) throw new Error('전자계약 PDF 페이지 크기가 A4 규격과 다릅니다.');
      if (readiness.clippedPages > 0) throw new Error('전자계약 PDF 페이지에 잘리는 콘텐츠가 있습니다.');
      if (readiness.overflowingRegionCount > 0) {
        throw new Error('전자계약 PDF에 영역을 넘쳐 잘리는 내용이 있습니다: ' + readiness.overflowingRegions.join(', '));
      }
      if (readiness.visibleCustomerSignatures < 1) throw new Error('전자계약 PDF에 고객 서명이 렌더링되지 않았습니다.');
      if (!readiness.hasSealEvidence) throw new Error('전자계약 PDF에 봉인 해시 증거가 렌더링되지 않았습니다.');
      if (readiness.hasPrintControl) throw new Error('최종 전자계약에 인쇄용 조작 UI가 남아 있습니다.');

      const printed = new Uint8Array(await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        timeout: renderTimeout,
        waitForFonts: true,
      }));

      if (!isCompletePdfBytes(printed)) throw new Error('최종 PDF 생성 결과가 유효하지 않습니다.');
      // Same sealed input -> same bytes: the render clock is replaced by the customer's submission time.
      const bytes = pinPdfInfoDates(printed, Number(input.submission.submittedAt));
      if (!isCompletePdfBytes(bytes)) throw new Error('최종 PDF 생성 결과가 유효하지 않습니다.');
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
