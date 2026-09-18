import type { NextRequest } from 'next/server';
import { proxyImage } from '../../../server/image-proxy';

/** 사진 길 — 규칙은 전부 src/server/image-proxy.ts 에 있다. 여기는 넘기기만. */
export async function GET(req: NextRequest) {
  return proxyImage(req.nextUrl.searchParams.get('url'));
}
