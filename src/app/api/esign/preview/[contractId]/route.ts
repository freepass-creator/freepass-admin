import { esign } from '../../../../../server/esign';
import { requireAdmin } from '../../../../../server/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const gate = await requireAdmin();
  if (gate) return new Response(gate, { status: 401 });
  const { contractId } = await params;
  try {
    const html = await esign.previewContract(contractId);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, private',
        'Content-Disposition': 'inline',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
