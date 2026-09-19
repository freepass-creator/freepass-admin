import { PanelHeader, Notice } from '../../_design/Primitives';
import { CreateEsignForm, type EsignFormDefaults } from './CreateEsignForm';
import { settlements, today } from '../../../server/erp5';

export const dynamic = 'force-dynamic';

export default async function NewEsignPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const intakeId = one(q.intake);
  let defaults: EsignFormDefaults = { contractDate: today() };
  let cancelHref = '/esign';
  let intakeNote = '';

  if (intakeId) {
    const hit = await settlements.get(intakeId);
    if (hit) {
      const row = hit.row;
      cancelHref = '/intake?ic=' + encodeURIComponent(row.id) + '&v=work';
      defaults = {
        settlementRowId: row.id,
        returnTo: cancelHref,
        customerName: row.customer ?? '',
        customerPhone: '',
        customerType: '개인',
        contractDate: today(),
        vehicleName: row.model ?? '',
        plate: row.plate ?? '',
        supplierCode: row.supplierCode ?? '',
        supplierName: row.supplier ?? '',
        termMonths: row.term === null ? '' : String(row.term),
        rent: row.rent === null ? '' : String(row.rent),
        deposit: row.deposit === null ? '' : String(row.deposit),
        contractKind: /구독/.test(row.rentKind ?? '') ? 'sub_return' : 'rent_return',
        insuranceSide: '회사포함',
      };
      intakeNote = '접수 정보에서 계약값을 가져왔습니다. 접수 원장에 없는 연락처 등만 확인해 주세요.';
    }
  }

  return <section className="workspace dz-esign-new" data-mode="esign-new" data-phone="work">
    <section className="panel work-panel">
      <PanelHeader title="새 계약" backHref={cancelHref} backLabel={intakeId ? '접수 상세로' : '계약 목록으로'}/>
      {intakeNote && <Notice tone="ok">{intakeNote}</Notice>}
      <CreateEsignForm defaults={defaults} cancelHref={cancelHref}/>
    </section>
  </section>;
}
