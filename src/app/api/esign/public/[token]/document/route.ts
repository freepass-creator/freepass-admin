import { esign } from '../../../../../../server/esign';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const doc = await esign.publicDocument(token);
    if (!doc) return new Response('문서를 찾을 수 없습니다.', { status: 404 });
    return new Response(Buffer.from(doc.bytes), {
      headers: {
        'Content-Type': doc.contentType || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, private',
        'Content-Disposition': 'inline',
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
