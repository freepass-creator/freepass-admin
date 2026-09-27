import { settlements } from '../../../../../server/freepass-data';
import { currentAdmin, requireAdmin } from '../../../../../server/require-admin';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ intakeId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { intakeId } = await params;

  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = await currentAdmin();
    const result = await settlements.recordContractPayment(intakeId, {
      amount: Number(body.amount),
      operationId: String(body.operationId ?? ''),
      receiptId: body.receiptId === undefined || body.receiptId === null ? undefined : String(body.receiptId),
    }, admin?.name || 'freepass-admin');
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 409 });
    return Response.json({
      ok: true,
      recorded: result.recorded,
      amount: result.fact.amount,
      receivedAt: result.fact.receivedAt,
      receiptId: result.fact.receiptId,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ intakeId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });
  const { intakeId } = await params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const admin = await currentAdmin();
    const result = await settlements.recordContractPaymentDisposition(intakeId, {
      refundedAmount: Number(body.refundedAmount),
      supplierRevenueAmount: Number(body.supplierRevenueAmount),
      offsetAmount: Number(body.offsetAmount),
      reason: String(body.reason ?? ''),
      operationId: String(body.operationId ?? ''),
    }, admin?.name || 'freepass-admin');
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 409 });
    return Response.json({ ok: true, recorded: result.recorded, fact: result.fact });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
