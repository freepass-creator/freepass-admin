import { esign } from '../../../../../../server/esign';
import { requireAdmin } from '../../../../../../server/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string; key: string }> }) {
  const gate = await requireAdmin();
  if (gate) return new Response(gate, { status: 401 });
  const { sessionId, key } = await params;
  const asset = await esign.adminAsset(sessionId, key);
  if (!asset) return new Response('자료를 찾을 수 없습니다.', { status: 404 });
  return new Response(Buffer.from(asset.bytes), {
    headers: {
      'Content-Type': asset.contentType || 'application/octet-stream',
      'Cache-Control': 'no-store, private',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
