import { esign } from '../../../../../server/esign';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store, private' },
});

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const peek = new URL(request.url).searchParams.get('peek') === '1';
  try {
    return json(await esign.publicView(token, peek));
  } catch (e) {
    return json({ error: (e as Error).message }, 409);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    if (action === 'draft') return json(await esign.saveDraft(token, body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : {}));
    if (action === 'progress') return json(await esign.progress(token, String(body.step ?? '')));
    if (action === 'submit') return json(await esign.submit(token, body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : {}));
    return json({ error: '모르는 전자계약 요청입니다.' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 409);
  }
}
