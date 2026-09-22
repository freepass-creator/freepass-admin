import { EsignBoard } from './board';

export const dynamic = 'force-dynamic';

/** 전자계약 — 목업 판(계약 목록 | 계약 상세 | 서명 상태). 대표 2026-09-22 「나머지 4개 화면으로 확장」 */
export default async function EsignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <EsignBoard q={await searchParams} />;
}
