import Link from 'next/link';
import { notFound } from 'next/navigation';
import { productById } from '../../../server/erp5';
import type { PolicyValue } from '../../../domain/product/types';
import { num, sp, txt, won } from '../../_fn/fmt';
import { vehicleName } from '../../_fn/product';
import { OfferPicker } from '../../_design/OfferPicker';
import { 매칭, 정책이름표, 정책값글 } from '../../_design/words';

export const dynamic = 'force-dynamic';

const policyText = (p: PolicyValue) =>
  p.type === 'BOOLEAN' ? (p.value ? '예' : '아니오')
    : p.type === 'MONEY' ? `${won(p.value)}원`
      : p.type === 'PERCENTAGE' ? `${+(p.value * 100).toFixed(2)}%`   /* ★parseRate 는 비율(0.2)로 담는다 */
        : Array.isArray(p.value) ? p.value.join(', ') : String(p.value);

export default async function ProductDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const picked = sp((await searchParams).offer);
  const p = await productById(decodeURIComponent(id));
  if (!p) notFound();

  return (
    <>
      <p><Link href="/products">← 상품찾기</Link></p>
      <h1>{vehicleName(p) || p.id} · {txt(p.registration?.vehicleNumber)}</h1>
      <div className="fn-grid fn-box">
        <dl><dt>출고상태</dt><dd>{txt(p.status)}</dd></dl>
        <dl><dt>공급사</dt><dd>{p.supplierName ?? '(이름 없음)'} · {p.supplierId}</dd></dl>
        <dl><dt>상품코드</dt><dd>{p.id}</dd></dl>
        <dl><dt>차종 확정 깊이</dt><dd>{매칭(p.vehicle.matchLevel)}</dd></dl>
        <dl><dt>연식</dt><dd>{p.specs.modelYear ?? "—"}</dd></dl>
        <dl><dt>주행거리</dt><dd>{num(p.specs.mileageKm, 'km')}</dd></dl>
        <dl><dt>연료</dt><dd>{txt(p.specs.fuel)}</dd></dl>
        <dl><dt>배기량</dt><dd>{num(p.specs.displacementCc, 'cc')}</dd></dl>
        <dl><dt>인승</dt><dd>{num(p.specs.seats)}</dd></dl>
        <dl><dt>구동</dt><dd>{txt(p.specs.drivetrain)}</dd></dl>
        <dl><dt>최초등록일</dt><dd>{txt(p.registration?.firstRegistrationDate)}</dd></dl>
        <dl><dt>차대번호</dt><dd>{txt(p.registration?.vin)}</dd></dl>
      </div>

      <h2>요금 (Offer) — 고른 요금으로 접수합니다</h2>
      {/* ★기간은 단추로 고른다 — 확정 목업 그대로(디자인 부품 `_design/OfferPicker`, 접수 주소는 앞과 같다) */}
      <OfferPicker productId={p.id} offers={p.offers} initial={picked}
        supplier={p.supplierName ?? p.supplierId} match={매칭(p.vehicle.matchLevel)} />

      <h2>정책 ({p.productPolicies.length})</h2>
      {p.productPolicies.length === 0
        ? <p className="fn-muted">붙은 정책이 없습니다 — 「없다」가 아니라 ERP5 에 policy_code 가 안 걸렸거나 못 찾은 것입니다.</p>
        : <table><tbody>{p.productPolicies.map((v, i) => <tr key={i}><th>{정책이름표(v.policyId)}</th><td>{정책값글(v)}</td></tr>)}</tbody></table>}
    </>
  );
}
