import { esign } from '../../../../../../server/esign';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '../../../../../../domain/esign/upload-limits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // 본문을 다 읽기 전에 크기부터 본다(사진은 폰에서 줄여 오므로 정상 업로드는 한도 안이다).
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > UPLOAD_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: '파일이 너무 큽니다 — ' + UPLOAD_MAX_LABEL + ' 이하로 올려 주세요.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }
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
