import { contractLifecycle } from '../../../../../server/contracts';
import { currentAdmin, requireAdmin } from '../../../../../server/require-admin';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { contractId } = await params;

  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = await currentAdmin();
    const result = await contractLifecycle.cancel(contractId, {
      reason: String(body.reason ?? ''),
      operationId: String(body.operationId ?? ''),
    }, admin?.name || 'freepass-admin');

    return Response.json({
      ok: true,
      cancelled: result.cancelled,
      reason: result.reason,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
