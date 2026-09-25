import { esign } from '../../../../../../server/esign';
import { requireAdmin } from '../../../../../../server/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return new Response(denied, { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { sessionId } = await params;
  try {
    const doc = await esign.finalDocument(sessionId);
    if (!doc) return new Response('완료된 전자계약 문서를 찾을 수 없습니다.', { status: 404 });
    return new Response(Buffer.from(doc.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store, private',
        'Content-Disposition': 'inline',
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
