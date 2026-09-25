import { esign } from '../../../../../../server/esign';
import { requireAdmin } from '../../../../../../server/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string; key: string }> },
) {
  const denied = await requireAdmin();
  if (denied) {
    return new Response(denied, {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, private' },
    });
  }

  const { sessionId, key } = await params;
  try {
    const asset = await esign.adminAsset(sessionId, key);
    if (!asset) {
      return new Response('검토용 파일을 찾을 수 없습니다.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, private' },
      });
    }
    return new Response(Buffer.from(asset.bytes), {
      headers: {
        'Content-Type': asset.contentType || 'application/octet-stream',
        'Cache-Control': 'no-store, private',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return new Response((e as Error).message, {
      status: 409,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, private' },
    });
  }
}
