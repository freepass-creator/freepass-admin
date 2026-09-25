import { esign } from '../../../../../../server/esign';
import { currentActor, requireAdmin } from '../../../../../../server/require-admin';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { contractId } = await params;
  try {
    const body = await request.json() as { reason?: unknown };
    const reason = String(body.reason ?? '').trim();
    const actor = await currentActor();
    const result = await esign.cancelContract(contractId, reason, actor);
    return Response.json({
      ok: true,
      cancelled: result.cancelled,
      sessionId: result.session?.id ?? null,
      signedDocumentPreserved: result.signedDocumentPreserved,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
