/**
 * Pretendard 를 우리 것으로 깐다 — 제3자 CDN 에 기대지 않는다.
 *
 * ① 웹 본문 글꼴 — variable dynamic-subset.
 *    규격 글꼴은 `--erp-font-family` 첫 글꼴인 "Pretendard Variable" 이다(_erp/erp-standard.css).
 *    조각은 92개지만 unicode-range 로 나뉘어 있어 브라우저가 쓰는 조각만 받는다.
 *    ★통짜 PretendardVariable.woff2 (2.0MB) 를 쓰지 않는 까닭 — 첫 화면에서 2MB 를 다 받게 된다.
 * ② 전자계약 PDF 용 static 4벌 — puppeteer 렌더러가 파일로 읽는다.
 *
 * public/fonts 는 gitignore 된다. 이 스크립트가 postinstall 로 다시 만든다.
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const pkg = path.join(root, 'node_modules', 'pretendard', 'dist', 'web');
const fonts = path.join(root, 'public', 'fonts');

/** 못 쓸 자산을 조용히 넘기지 않는다 — 빈 파일이면 글꼴이 안 뜨고 그 까닭을 찾기 어렵다 */
async function copyChecked(source, target, min) {
  const info = await stat(source);
  if (!info.isFile() || info.size < min) throw new Error(`Invalid Pretendard asset: ${source} (${info.size} bytes)`);
  await copyFile(source, target);
}

/* ① 웹 — variable dynamic-subset */
const webSrc = path.join(pkg, 'variable');
const webOut = path.join(fonts, 'pretendard');
await mkdir(path.join(webOut, 'woff2-dynamic-subset'), { recursive: true });
await copyChecked(
  path.join(webSrc, 'pretendardvariable-dynamic-subset.css'),
  path.join(webOut, 'pretendard.css'),
  10_000,
);
const shards = (await readdir(path.join(webSrc, 'woff2-dynamic-subset'))).filter((f) => f.endsWith('.woff2'));
if (shards.length < 50) throw new Error(`Pretendard subset looks incomplete: ${shards.length} shards`);
for (const shard of shards) {
  await copyChecked(
    path.join(webSrc, 'woff2-dynamic-subset', shard),
    path.join(webOut, 'woff2-dynamic-subset', shard),
    1_000,
  );
}

/* ② 전자계약 PDF — static 4벌 */
const pdfSrc = path.join(pkg, 'static', 'woff2');
await mkdir(fonts, { recursive: true });
for (const file of ['Pretendard-Regular.woff2', 'Pretendard-Medium.woff2', 'Pretendard-SemiBold.woff2', 'Pretendard-Bold.woff2']) {
  await copyChecked(path.join(pdfSrc, file), path.join(fonts, file), 10_000);
}

console.log(`fonts: web subset ${shards.length} shards + 4 static faces -> public/fonts`);
