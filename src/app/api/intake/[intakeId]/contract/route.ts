import { esign } from '../../../../../server/esign';
import { currentAdmin, requireAdmin } from '../../../../../server/require-admin';

export const runtime = 'nodejs';

const S = (v: unknown) => String(v ?? '').trim();

export async function POST(request: Request, { params }: { params: Promise<{ intakeId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return Response.json({ ok: false, error: denied }, { status: 401 });

  const { intakeId } = await params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const customerType = S(body.customerType);
    const insuranceSide = S(body.insuranceSide);
    if (!['개인', '개인사업자', '법인'].includes(customerType)) {
      return Response.json({ ok: false, error: '고객 유형을 확인해 주세요.' }, { status: 400 });
    }
    if (!['회사포함', '고객직접'].includes(insuranceSide)) {
      return Response.json({ ok: false, error: '보험 주체를 확인해 주세요.' }, { status: 400 });
    }

    const admin = await currentAdmin();
    const result = await esign.createContractFromIntake({
      intakeId,
      customerPhone: S(body.customerPhone),
      customerType: customerType as '개인' | '개인사업자' | '법인',
      contractDate: S(body.contractDate),
      contractKind: S(body.contractKind),
      insuranceSide: insuranceSide as '회사포함' | '고객직접',
    }, admin?.name || 'freepass-admin');

    return Response.json({
      ok: true,
      created: result.created,
      contractId: result.id,
      contractCode: result.code,
      sourceDigest: result.sourceDigest,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}
