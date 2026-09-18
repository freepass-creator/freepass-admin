import { PanelHeader } from '../../_design/Primitives';
import { CreateEsignForm } from './CreateEsignForm';

export const dynamic = 'force-dynamic';

export default function NewEsignPage() {
  return <section className="workspace dz-esign-new" data-mode="esign-new" data-phone="work">
    <section className="panel work-panel">
      <PanelHeader title="새 전자계약" backHref="/esign" backLabel="계약 목록으로"/>
      <p className="dz-muted">ERP4 전자계약 엔진의 직접 계약 작성 흐름을 ERP5 계약 SSOT에 새로 세웁니다.</p>
      <CreateEsignForm/>
    </section>
  </section>;
}
