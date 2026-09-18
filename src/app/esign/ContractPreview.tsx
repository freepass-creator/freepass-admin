type Props = {
  code: string;
  kind?: string | null;
  customer?: string | null;
  vehicle?: string | null;
  status?: string | null;
  signedAt?: number | string | null;
};

const shown = (v?: string | null) => v && v.trim() ? v : '—';

export function ContractPreview({ code, kind, customer, vehicle, status, signedAt }: Props) {
  const signed = signedAt ? (typeof signedAt === 'number' ? new Date(signedAt).toISOString().slice(0, 10) : String(signedAt).slice(0, 10)) : '—';
  return (
    <section className="dz-contract-preview" aria-label="계약서 미리보기">
      <div className="dz-contract-paper">
        <div className="dz-contract-brand">freepass</div>
        <h3>{shown(kind)}</h3>
        <dl>
          <div><dt>계약코드</dt><dd>{code}</dd></div>
          <div><dt>고객</dt><dd>{shown(customer)}</dd></div>
          <div><dt>차량</dt><dd>{shown(vehicle)}</dd></div>
          <div><dt>상태</dt><dd>{shown(status)}</dd></div>
          <div><dt>서명일</dt><dd>{signed}</dd></div>
        </dl>
      </div>
    </section>
  );
}
