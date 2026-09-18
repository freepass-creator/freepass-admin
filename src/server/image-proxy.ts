import { lookup } from 'node:dns/promises';

/**
 * **외부 사진을 우리 서버를 거쳐 보인다.** erp4 `app/api/img/route.ts` · `lib/net/proxy-hosts.ts` 와 같은 규칙.
 *
 * 왜 — 드라이브 썸네일(`drive.google.com/thumbnail`)을 브라우저가 바로 부르면 대부분 깨진다
 *   (실측 2026-09-18 어드민 목록 · 드라이브 18장 중 16장 깨짐). 서버가 받아 다시 내주면 뜬다.
 * ★SSRF 차단 — 인증 없는 길이라 «정당한 사진 원본 호스트» 만 받는다. 그 밖은 403.
 *   이름을 풀어 사설·로컬 IP 로 가면 막는다. 리다이렉트도 매번 다시 검사한다.
 * ★svg 는 안 내준다 — 스크립트를 품을 수 있는 문서다.
 */
const IMG_ALLOW = /(^|\.)(googleusercontent\.com|drive\.google\.com|googleapis\.com|firebasestorage\.app|autoplus\.co\.kr|moderentcar\.co\.kr|lotterentacar\.net)$|^moren-images\.s3[a-z0-9.-]*\.amazonaws\.com$/i;

export function allowedImageHost(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return IMG_ALLOW.test(u.hostname) ? u.hostname : null;
  } catch { return null; }
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const v = ip.toLowerCase().split('%')[0];
  if (v === '::1' || v === '::' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const parts = (mapped || v).split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/**
 * 화면이 `<img src>` 에 넣을 주소. ★허용 호스트면 우리 길(/api/img)로 감싸고, 아니면 그대로.
 *   (소카·supabase 등은 바로 불러도 뜬다 — 실측. 괜히 서버를 거치게 하지 않는다)
 */
export function imgSrc(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return allowedImageHost(url) ? `/api/img?url=${encodeURIComponent(url)}` : url;
}

const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
};

export async function proxyImage(url: string | null): Promise<Response> {
  if (!url || !/^https?:\/\//i.test(url)) return new Response('bad url', { status: 400 });
  if (!allowedImageHost(url)) return new Response('host not allowed', { status: 403 });
  try {
    let current = url;
    let upstream: Response | null = null;
    for (let hop = 0; hop <= 5; hop++) {
      const host = allowedImageHost(current);
      if (!host) return new Response('redirect host not allowed', { status: 403 });
      const addrs = await lookup(host, { all: true, verbatim: true });
      if (!addrs.length || addrs.some((a) => isPrivateOrLocalIp(a.address))) return new Response('private address not allowed', { status: 403 });
      upstream = await fetch(current, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; freepass-admin/1.0)', Accept: 'image/*,*/*' },
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      });
      if (upstream.status < 300 || upstream.status >= 400) break;
      const loc = upstream.headers.get('location');
      if (!loc) return new Response('bad redirect', { status: 502 });
      current = new URL(loc, current).toString();
      upstream = null;
    }
    if (!upstream) return new Response('too many redirects', { status: 508 });
    if (!upstream.ok || !upstream.body) return new Response(`upstream ${upstream.status}`, { status: 502 });
    let type = upstream.headers.get('content-type') || '';
    if (/svg/i.test(type)) return new Response('not an image', { status: 415 });
    if (!/^image\//i.test(type)) {
      /* ★원본이 헤더를 틀리게 주는 일이 있다(모던렌트카 S3 → octet-stream). 확장자가 사진일 때만 되살린다 */
      const ext = (new URL(current).pathname.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
      const guessed = EXT_TYPES[ext];
      if (!guessed) return new Response('not an image', { status: 415 });
      type = guessed;
    }
    return new Response(upstream.body, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
