import { esign } from '../../../../../../server/esign';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const form = await request.formData();
    const kind = String(form.get('kind') ?? '').trim();
    const file = form.get('file');
    if (!kind || !(file instanceof File)) return Response.json({ error: '파일과 종류가 필요합니다.' }, { status: 400 });
    const asset = await esign.upload(token, kind, file.name, file.type || 'application/octet-stream', new Uint8Array(await file.arrayBuffer()));
    return Response.json({ ok: true, key: kind, sha256: asset.sha256, size: asset.size }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
}
