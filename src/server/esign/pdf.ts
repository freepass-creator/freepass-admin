const FONT_FILES = [
  'Pretendard-Regular.woff2',
  'Pretendard-Medium.woff2',
  'Pretendard-SemiBold.woff2',
  'Pretendard-Bold.woff2',
  'Pretendard-ExtraBold.woff2',
] as const;

const FONT_BASE = (process.env.ESIGN_FONT_BASE_URL
  || 'https://raw.githubusercontent.com/freepass-creator/freepasserp4/main/public/fonts').replace(/\/$/, '');

let fontCache: Promise<Map<string,string>> | null = null;

async function fontDataUrls() {
  if (fontCache) return fontCache;
  fontCache = Promise.all(FONT_FILES.map(async (file) => {
    const r = await fetch(FONT_BASE + '/' + file, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error('전자계약 PDF 폰트를 읽지 못했습니다: ' + file);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length < 10_000) throw new Error('전자계약 PDF 폰트가 비정상입니다: ' + file);
    return [file, 'data:font/woff2;base64,' + bytes.toString('base64')] as const;
  })).then((rows) => new Map(rows));
  return fontCache;
}

export async function inlinePdfFonts(source: string) {
  const fonts = await fontDataUrls();
  let html = source;
  for (const [file, data] of fonts) {
    html = html.replaceAll('../fonts/' + file, data).replaceAll('/fonts/' + file, data);
  }
  return html;
}

function localChromeExecutable() {
  const configured = String(process.env.CHROME_EXECUTABLE_PATH || '').trim();
  return configured || undefined;
}

async function launchOptions() {
  const local = localChromeExecutable();
  if (local) return { executablePath: local, args: [] as string[] };
  const serverlessLinux = process.platform === 'linux'
    && (process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_VERSION);
  if (!serverlessLinux) {
    throw new Error('서버 PDF용 Chrome 경로가 없습니다. 개발에서는 CHROME_EXECUTABLE_PATH를 설정해 주세요.');
  }
  process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs20.x';
  const { default: chromium } = await import('@sparticuz/chromium');
  chromium.setGraphicsMode = false;
  return { executablePath: await chromium.executablePath(), args: chromium.args };
}

export async function renderContractPdf(html: string): Promise<Uint8Array> {
  const { chromium } = await import('playwright-core');
  const printable = await inlinePdfFonts(html);
  const opts = await launchOptions();
  const browser = await chromium.launch({
    headless: true,
    executablePath: opts.executablePath,
    args: opts.args,
    timeout: 30_000,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(printable, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      (window as Window & { __rebuildTerms?: () => void }).__rebuildTerms?.();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    if (pdf.byteLength < 10_000) throw new Error('생성된 전자계약 PDF가 비정상적으로 작습니다.');
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
