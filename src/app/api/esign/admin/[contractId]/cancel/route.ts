import { esign } from '../../../../../../server/esign';
import { currentAdmin, requireAdmin } from '../../../../../../server/require-admin';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { contractId } = await params;
  try {
    const body = await request.json() as { reason?: unknown };
    const reason = String(body.reason ?? '').trim();
    const admin = await currentAdmin();
    const result = await esign.cancelSignedContract(contractId, reason, admin?.name || 'freepass-admin');
    return Response.json({
      ok: true,
      cancelled: result.cancelled,
      needsClawback: result.needsClawback,
      sessionId: result.session.id,
      signedDocumentPreserved: result.session.status === 'signed',
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
