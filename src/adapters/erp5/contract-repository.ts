import { erp5 } from './firestore';
import { strOf as S, numOrNull as N } from './atom';
import { createHash } from 'node:crypto';
import { WriteDisabledError, writeEnabled } from './settlement-repository';
import { intakeEventDocId } from '../../domain/settlement/code';
import { planContractTermination, type ContractTerminationInput } from '../../domain/contracts/termination';
import type { ContractLifecycleRepository } from '../../ports/contracts/repositories';

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
  status: string;          // 계약요청 · 계약완료 · 계약취소 · 계약해지 · 계약철회 · 계약대기
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
  terminationDate: string;
  terminationReason: string;
  terminatedAt: number | null;
  signUrl: string;
  signedPdfUrl: string;
}

const T = (v: unknown) => v === true || v === 'true' || v === 'TRUE';

export class Erp5ContractRepository implements ContractLifecycleRepository {
  async terminateContract(
    contractId: string,
    input: ContractTerminationInput,
    actor: string,
  ): Promise<{ terminated: boolean; effectiveDate: string; reason: string }> {
    if (!writeEnabled()) throw new WriteDisabledError();
    const db=erp5();
    const contractRef=db.collection('contract').doc(contractId);

    return db.runTransaction(async tx=>{
      const contractDoc=await tx.get(contractRef);
      if(!contractDoc.exists)throw new Error('계약을 찾을 수 없습니다.');
      const contract=contractDoc.data() as Record<string,unknown>;
      const intakeId=S(contract.source_intake_id);
      if(!intakeId)throw new Error('계약의 원본 접수 연결이 없습니다.');

      const intakeRef=db.collection('settlement_rows').doc(intakeId);
      const intakeDoc=await tx.get(intakeRef);
      if(!intakeDoc.exists)throw new Error('계약의 원본 접수를 찾을 수 없습니다.');
      const intake=intakeDoc.data() as Record<string,unknown>;

      const now=Date.now();
      const plan=planContractTermination(contract,intake,input,now);
      if(!plan.ok)throw new Error(plan.error);
      if(plan.idempotent){
        return {
          terminated:false,
          effectiveDate:S(intake.contractTerminationDate),
          reason:S(intake.contractTerminationReason),
        };
      }

      tx.update(contractRef,plan.patch);
      tx.update(intakeRef,{...plan.intakePatch,contractTerminationContractId:contractId});

      const eventRef=db.collection('settlement_events').doc(
        intakeEventDocId(
          intake.plate,intake.sourceProductId,intake.receivedAt,
          intake.intakeRequestId,intake.intakeIdentityMode,
        ),
      );
      const eventKey='aud_contract_terminate_'+createHash('sha256')
        .update(contractId+'|'+input.operationId).digest('hex').slice(0,16);
      tx.set(eventRef,{[eventKey]:{
        at:now,by:actor,operationId:input.operationId,
        field:'계약해지',from:S(contract.contract_status),to:'계약해지',
        effectiveDate:input.effectiveDate,reason:input.reason.trim(),contractId,
      }},{merge:true});

      return {terminated:true,effectiveDate:input.effectiveDate,reason:input.reason.trim()};
    });
  }

  async list(): Promise<ContractSummary[]> {
    const snap = await erp5().collection('contract').get();
    const out: ContractSummary[] = [];
    for (const d of snap.docs) {
      const c = d.data();
      if (T(c._deleted) || T(c.is_test) || T(c.test_only)) continue;
      out.push({
        id: d.id,
        code: S(c.contract_code) || d.id,
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
        terminationDate: S(c.contract_termination_date),
        terminationReason: S(c.contract_termination_reason),
        terminatedAt: N(c.contract_terminated_at),
        signUrl: S(c.esign_sign_url),
        signedPdfUrl: S(c.signed_pdf_url),
      });
    }
    return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
}
