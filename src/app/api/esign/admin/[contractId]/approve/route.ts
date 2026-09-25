import { esign } from '../../../../../../server/esign';
import { currentActor, requireAdmin } from '../../../../../../server/require-admin';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { contractId } = await params;
  try {
    const body = await request.json() as { finalizationId?: unknown };
    const finalizationId = String(body.finalizationId ?? '').trim();
    const actor = await currentActor();
    const result = await esign.approve(contractId, finalizationId, actor);
    return Response.json({
      ok: true,
      finalized: result.finalized,
      status: result.session.status,
      sessionId: result.session.id,
      documentSha256: result.session.documentSha256 || '',
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
