import { contractLifecycle } from '../../../../../server/contracts';
import { currentActor, requireAdmin } from '../../../../../server/require-admin';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { contractId } = await params;

  try {
    const body = await request.json() as Record<string, unknown>;
    const actor = await currentActor();
    const result = await contractLifecycle.terminate(contractId, {
      effectiveDate: String(body.effectiveDate ?? ''),
      reason: String(body.reason ?? ''),
      operationId: String(body.operationId ?? ''),
    }, actor);

    return Response.json({
      ok: true,
      terminated: result.terminated,
      effectiveDate: result.effectiveDate,
      reason: result.reason,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
