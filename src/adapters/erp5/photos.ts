/**
 * **ERP5 상품 원자 → 사진 주소.**  대표 2026-09-18 「상품목록 카드에 사진 썸네일 들어가야지」
 *
 * ★화이트라벨이 손님에게 내보내는 차례와 «같다» (erp4 `lib/domain/public-catalog.ts` `sanitizeProductForGuest`).
 *   같은 차가 어드민과 손님 화면에서 다른 사진을 보이면 안 된다.
 *
 *   ① 직접 이미지 배열 — `image_urls` · `images` · `photos` (배열 또는 JSON 글자)
 *   ② 없으면 «미리 풀어 둔» 캐시 `photo_cache.urls` — 단, 출처가 지금 `photo_link` 와 «같을 때만».
 *      공급사가 링크를 바꿨는데 옛 캐시를 쓰면 「바뀐 링크 · 옛 사진」 이 굳는다.
 *   ③ 그래도 없으면 `photo_link` 안의 «직접 이미지 주소» (쉼표로 여럿 들어 있다 — 롯데·소카 등)
 *
 * ⚠ 실측(2026-09-18 · 목록에 서는 694대) — `photo_link` 370 중 드라이브 «폴더» 172 · 공급사 «상세페이지» 다수.
 *   그건 사진이 아니라 사진이 있는 «곳» 이다. 사진으로 내보내지 않고 `photoLink` 로 따로 든다.
 * ★없으면 비운다. 지어내지 않는다 — 회색 칸은 화면이 「사진 준비 중」 으로 말한다.
 */
import { strOf as S } from './atom';
const IMAGE_FILE_RE = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|$|&)/i;
const DRIVE_THUMB_RE = /^https:\/\/drive\.google\.com\/thumbnail\?/i;

const isHttp = (u: string) => /^https?:\/\//i.test(u);
export const isDirectImage = (u: string) => isHttp(u) && (IMAGE_FILE_RE.test(u) || DRIVE_THUMB_RE.test(u));

function collect(value: unknown, out: string[]) {
  if (value == null) return;
  if (Array.isArray(value)) { for (const v of value) collect(v, out); return; }
  if (typeof value === 'object') return;           // 배열 밖의 맵은 사진 목록이 아니다
  const raw = S(value);
  if (!raw) return;
  if (raw.startsWith('[')) { try { collect(JSON.parse(raw), out); return; } catch { /* 글자로 본다 */ } }
  out.push(raw);
}

/** `photo_link` 를 쉼표·줄바꿈으로 가른다 (erp4 `firstPhotoLink` 와 같은 가름). */
const linkTokens = (v: unknown) => S(v).split(/\s*[\n,]\s*/).map((x) => x.trim()).filter(Boolean);

export function photosOf(d: Record<string, unknown>): { photos: string[]; photoLink?: string } {
  const tokens = linkTokens(d.photo_link);
  /** 사진이 있는 «곳» — 이미지가 아닌 첫 링크 (드라이브 폴더 · 공급사 상세) */
  const place = tokens.find((u) => isHttp(u) && !isDirectImage(u));

  const direct: string[] = [];
  for (const src of [d.image_urls, d.images, d.photos]) collect(src, direct);
  let photos = direct.filter(isHttp);

  if (!photos.length) {
    const cache = (d.photo_cache ?? {}) as { urls?: unknown; src?: unknown };
    const cached: string[] = [];
    collect(cache.urls, cached);
    /* ★캐시는 출처가 같을 때만 — erp4 는 `scrapableSources(p)[0]` 와 견준다. 여기서는 «이미지 아닌 첫 링크» 가 그것이다 */
    if (cached.length && place && S(cache.src) === place) photos = cached.filter(isHttp);
  }
  if (!photos.length) photos = tokens.filter(isDirectImage);

  return { photos: [...new Set(photos)], ...(place ? { photoLink: place } : {}) };
}
