import { esign } from '../../../../../server/esign';
import { requireAdmin } from '../../../../../server/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const gate = await requireAdmin();
  if (gate) return new Response(gate, { status: 401 });
  const { sessionId } = await params;
  const doc = await esign.documentBySession(sessionId);
  if (!doc) return new Response('서명본을 찾을 수 없습니다.', { status: 404 });
  return new Response(Buffer.from(doc.bytes), {
    headers: {
      'Content-Type': doc.contentType || 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Content-Disposition': 'inline',
    },
  });
}
