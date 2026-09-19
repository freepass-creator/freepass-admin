import { erp5 } from './firestore';
import { strOf as S, numOrNull as N } from './atom';

/**
 * **전자계약 — ERP5 `contract` 읽기.**
 *
 * ★지금은 «읽기만» 한다. 발행·서명은 erp4 전자계약(템플릿 `rental-contract.html`)이 한다.
 *   여기서 새로 발행하는 길은 따로 양식을 열고 만든다 (DECISION REQUIRED — 템플릿 운영값 미확정).
 * ⚠ `_deleted` · 시험 계약(`is_test` · `test_only`)은 목록에 세우지 않는다 — 세면 건수가 거짓이 된다.
 */
export interface ContractSummary {
  id: string;
  code: string;
  status: string;          // 계약요청 · 계약완료 · 계약취소 · 계약철회 · 계약대기
  signStatus: string;      // 발행 · 열람 · 진행중 · 서명완료 · (빈 값 = 전자계약 아님)
  kind: string;            // rent_return · sub_return …
  insurance: string;       // 보험 포함/별도
  plate: string;
  vehicle: string;
  customer: string;
  agent: string;
  supplierCode: string;
  rent: number | null;
  term: number | null;
  contractDate: string;
  createdAt: number | null;
  signSentAt: number | null;
  signedAt: number | null;
  signUrl: string;
  signedPdfUrl: string;
  settlementRowId: string;
}

const T = (v: unknown) => v === true || v === 'true' || v === 'TRUE';

export class Erp5ContractRepository {
  private summary(id: string, c: Record<string, unknown>): ContractSummary {
    return {
      id,
      code: S(c.contract_code) || id,
      status: S(c.contract_status),
      signStatus: S(c.sign_status),
      kind: S(c.esign_contract_kind) || S(c.contract_kind),
      insurance: S(c.esign_insurance_side),
      plate: S(c.car_number_snapshot) || S(c.car_number),
      vehicle: [S(c.maker_snapshot), S(c.model_snapshot), S(c.sub_model_snapshot)].filter(Boolean).join(' ')
        || S(c.vehicle_name_snapshot),
      customer: S(c.customer_name),
      agent: S(c.agent_name),
      supplierCode: S(c.provider_company_code),
      rent: N(c.rent_amount_snapshot),
      term: N(c.rent_month_snapshot),
      contractDate: S(c.contract_date),
      createdAt: N(c.created_at),
      signSentAt: N(c.sign_sent_at),
      signedAt: N(c.sign_signed_at),
      signUrl: S(c.esign_sign_url),
      signedPdfUrl: S(c.signed_pdf_url),
      settlementRowId: S(c.settlement_row_id),
    };
  }

  async getBySettlementRowId(settlementRowId: string): Promise<ContractSummary | null> {
    if (!settlementRowId.trim()) return null;
    const snap = await erp5().collection('contract').where('settlement_row_id', '==', settlementRowId.trim()).get();
    const rows = snap.docs
      .map((d) => ({ d, c: d.data() }))
      .filter(({ c }) => !T(c._deleted) && !T(c.is_test) && !T(c.test_only))
      .map(({ d, c }) => this.summary(d.id, c))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return rows[0] ?? null;
  }

  async list(): Promise<ContractSummary[]> {
    const snap = await erp5().collection('contract').get();
    const out: ContractSummary[] = [];
    for (const d of snap.docs) {
      const c = d.data();
      if (T(c._deleted) || T(c.is_test) || T(c.test_only)) continue;
      out.push(this.summary(d.id, c));
    }
    return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
}
