import { randomBytes } from 'node:crypto';
import { buildConsentProfile } from '../../domain/esign/consents';
import { FINALIZE_CLAIM_TTL, SUBMIT_CLAIM_TTL } from '../../domain/esign/claim-ttl';
import { allowsInsuranceSide, findContractKind, type InsuranceSide } from '../../domain/esign/contract-kind';
import {
  CUSTOMER_INSURANCE_CERTIFICATE, DOCUMENT_PRESETS, applySignerRole, mergeRequiredDocuments, normalizeRequiredDocuments,
} from '../../domain/esign/required-documents';
import { adminStage, esignStage } from '../../domain/esign/progress';
import { sha256, signedSnapshot, stableJson } from '../../domain/esign/snapshot';
import { templateFieldsFromContract } from '../../domain/esign/template-fields';
import type {
  EsignAdminState, EsignPrivateSubmission, EsignSession, EsignSnapshot,
} from '../../domain/esign/types';
import type { EsignAssetStore, EsignFinalDocumentRenderer, EsignRepository } from '../../ports/esign/repositories';
import { validateSubmission, type PublicSubmissionPayload } from '../../server/esign/submission';
import { buildContractHtml, fallbackContractHtml } from '../../server/esign/document';
import { isCompletePdfBytes } from '../../server/esign/pdf';

const S = (v: unknown) => String(v ?? '').trim();
const N = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const B = (v: unknown) => v === true || v === 'true' || v === 'TRUE';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TTL = 7 * 24 * 60 * 60_000;

function uploadMagicOk(type: string, bytes: Uint8Array) {
  if (type === 'application/pdf') return bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-';
  if (type === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;
  if (type === 'image/webp') return bytes.length >= 12
    && Buffer.from(bytes.subarray(0,4)).toString('ascii')==='RIFF'
    && Buffer.from(bytes.subarray(8,12)).toString('ascii')==='WEBP';
  return false;
}

export type CreateContractFromIntakeInput = {
  intakeId: string;
  customerPhone: string;
  customerType: '개인' | '개인사업자' | '법인';
  contractDate: string;
  contractKind: string;
  insuranceSide: '회사포함' | '고객직접';
};

export type CreateContractInput = {
  customerName: string;
  customerPhone: string;
  customerType: '개인' | '개인사업자' | '법인';
  vehicleName: string;
  plate: string;
  supplierCode: string;
  supplierName: string;
  rent: number;
  termMonths: number;
  deposit: number;
  contractDate: string;
  contractKind: string;
  insuranceSide: '회사포함' | '고객직접';
};

export class EsignService {
  constructor(private repo: EsignRepository, private assets: EsignAssetStore, private finalRenderer?: EsignFinalDocumentRenderer) {}

  finalizationReadiness() {
    return {
      rendererConnected: Boolean(this.finalRenderer),
      ready: Boolean(this.finalRenderer),
    };
  }

  private publicBase() {
    const raw = (process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
      return u.toString().replace(/\/$/, '');
    } catch {
      throw new Error('전자계약 공개 주소(PUBLIC_BASE_URL)가 없습니다 — 링크를 발행하지 않았습니다.');
    }
  }
  private token() { return randomBytes(32).toString('base64url'); }
  private tokenHash(token: string) { return sha256(token); }
  private sessionId(hash: string) { return 'esg_' + hash.slice(0, 24); }

  async createContractFromIntake(input: CreateContractFromIntakeInput, actor = 'freepass-admin') {
    const source = await this.repo.getIntakeContractSource(input.intakeId);
    if (!source) throw new Error('접수를 찾을 수 없습니다.');
    if (!source.customerName) throw new Error('접수 고객명이 없습니다.');
    if (!source.vehicleName) throw new Error('접수 차량명이 없습니다.');
    if (!source.supplierCode) throw new Error('접수 공급사 코드가 없습니다.');
    if (source.rent === null || source.termMonths === null || source.deposit === null) {
      throw new Error('접수의 기간·대여료·보증금이 확정되지 않았습니다.');
    }
    const phone = input.customerPhone.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 11) throw new Error('고객 연락처를 확인해 주세요.');
    if (!DAY.test(input.contractDate)) throw new Error('계약일은 YYYY-MM-DD 입니다.');
    const spec = findContractKind(input.contractKind);
    if (!spec) throw new Error('계약 유형을 확인해 주세요.');
    if (!allowsInsuranceSide(spec, input.insuranceSide)) throw new Error('계약 유형과 보험 주체가 맞지 않습니다.');

    const now = Date.now();
    const id = 'ctr_intake_' + sha256(source.intakeId).slice(0, 20);
    const code = 'FP-' + input.contractDate.replace(/-/g, '') + '-' + sha256(source.intakeId).slice(0, 6).toUpperCase();
    const result = await this.repo.createContractFromIntake(source, id, {
      contract_code: code,
      contract_status: '계약대기',
      sign_status: '',
      contract_date: input.contractDate,
      customer_name: source.customerName,
      customer_phone: phone,
      customer_type: input.customerType,
      vehicle_name_snapshot: source.vehicleName,
      car_number_snapshot: source.plate || '미정',
      provider_company_code: source.supplierCode,
      provider_company_name_snapshot: source.supplierName || source.supplierCode,
      rent_amount_snapshot: Math.round(source.rent),
      rent_month_snapshot: Math.round(source.termMonths),
      deposit_amount_snapshot: Math.round(source.deposit),
      esign_contract_kind: input.contractKind,
      esign_insurance_side: input.insuranceSide,
      source_intake_id: source.intakeId,
      source_product_id: source.sourceProductId,
      source_product_version: source.sourceProductVersion,
      source_offer_id: source.sourceOfferId,
      source_snapshot_id: source.sourceSnapshotId,
      contract_source_digest: source.sourceDigest,
      contract_source_snapshot: source,
      created_at: now,
      created_by: actor,
      updated_at: now,
      from_admin: true,
    });
    return {
      id,
      code: S(result.contract.contract_code) || code,
      created: result.created,
      sourceDigest: S(result.contract.contract_source_digest) || source.sourceDigest,
    };
  }

  async createContract(input: CreateContractInput, actor = 'freepass-admin') {
    if (!input.customerName.trim()) throw new Error('고객명이 없습니다.');
    const phone = input.customerPhone.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 11) throw new Error('고객 연락처를 확인해 주세요.');
    if (!input.vehicleName.trim()) throw new Error('차명이 없습니다.');
    if (!input.plate.trim()) throw new Error('차량번호는 실차번호 또는 신차면 「미정」을 넣어 주세요.');
    if (!input.supplierCode.trim()) throw new Error('공급사 코드가 없습니다.');
    if (!Number.isFinite(input.rent) || input.rent < 0
      || !Number.isFinite(input.termMonths) || input.termMonths < 1
      || !Number.isFinite(input.deposit) || input.deposit < 0) {
      throw new Error('기간·대여료·보증금을 확인해 주세요.');
    }
    if (!DAY.test(input.contractDate)) throw new Error('계약일은 YYYY-MM-DD 입니다.');
    const spec = findContractKind(input.contractKind);
    if (!spec) throw new Error('계약 유형을 확인해 주세요.');
    if (!allowsInsuranceSide(spec, input.insuranceSide)) throw new Error('계약 유형과 보험 주체가 맞지 않습니다.');

    const now = Date.now();
    const code = 'FP-' + input.contractDate.replace(/-/g, '') + '-' + randomBytes(3).toString('hex').toUpperCase();
    const id = 'ctr_' + sha256(code).slice(0, 20);
    await this.repo.createContract(id, {
      contract_code: code,
      contract_status: '계약대기',
      sign_status: '',
      contract_date: input.contractDate,
      customer_name: input.customerName.trim(),
      customer_phone: phone,
      customer_type: input.customerType,
      vehicle_name_snapshot: input.vehicleName.trim(),
      car_number_snapshot: input.plate.trim(),
      provider_company_code: input.supplierCode.trim(),
      provider_company_name_snapshot: input.supplierName.trim(),
      rent_amount_snapshot: Math.round(input.rent),
      rent_month_snapshot: Math.round(input.termMonths),
      deposit_amount_snapshot: Math.round(input.deposit),
      esign_contract_kind: input.contractKind,
      esign_insurance_side: input.insuranceSide,
      created_at: now,
      created_by: actor,
      updated_at: now,
      from_admin: true,
    });
    return { id, code };
  }

  private async snapshot(contractId: string): Promise<EsignSnapshot> {
    const c = await this.repo.getContract(contractId);
    if (!c) throw new Error('계약을 찾을 수 없습니다.');
    if (B(c._deleted) || B(c.is_test) || B(c.test_only)) throw new Error('삭제/시험 계약은 발행할 수 없습니다.');
    if (/취소|철회|해지/.test(S(c.contract_status))) throw new Error('취소·철회·해지 계약은 전자계약을 발행할 수 없습니다.');

    const kind = S(c.esign_contract_kind || c.contract_kind) || 'rent_return';
    const spec = findContractKind(kind);
    if (!spec) throw new Error('전자계약 유형이 없습니다.');
    const insurance = (S(c.esign_insurance_side) || '회사포함') as InsuranceSide;
    if (!allowsInsuranceSide(spec, insurance)) throw new Error('계약유형과 보험 주체가 맞지 않습니다.');

    const customerName = S(c.customer_name);
    const phone = S(c.customer_phone).replace(/\D/g, '');
    const vehicleName = [S(c.maker_snapshot), S(c.model_snapshot), S(c.sub_model_snapshot)].filter(Boolean).join(' ')
      || S(c.vehicle_name_snapshot);
    const plate = S(c.car_number_snapshot || c.car_number);
    const supplierCode = S(c.provider_company_code);
    const supplierName = S(c.provider_company_name_snapshot || c.provider_company_name || c.provider_name);
    const rent = N(c.rent_amount_snapshot);
    const term = N(c.rent_month_snapshot);
    const deposit = N(c.deposit_amount_snapshot);
    const missing: string[] = [];
    if (!customerName) missing.push('고객명');
    if (phone.length < 10) missing.push('고객 연락처');
    if (!vehicleName) missing.push('차명');
    if (!plate) missing.push('차량번호/미정');
    if (!supplierCode) missing.push('공급사');
    if (rent === null) missing.push('월 대여료');
    if (term === null) missing.push('대여기간');
    if (deposit === null) missing.push('보증금');
    if (missing.length) throw new Error('발행 전 필수값: ' + missing.join(' · '));

    const rawCustomerType = S(c.customer_type);
    const customerType = (['개인', '개인사업자', '법인'].includes(rawCustomerType) ? rawCustomerType : '개인') as EsignSnapshot['customerType'];
    const preset = customerType === '법인' ? DOCUMENT_PRESETS.corporate
      : customerType === '개인사업자' ? DOCUMENT_PRESETS.business : DOCUMENT_PRESETS.personal;
    const rawDocs = normalizeRequiredDocuments(c.esign_required_documents);
    const requiredDocuments = mergeRequiredDocuments(
      insurance === '고객직접' ? [CUSTOMER_INSURANCE_CERTIFICATE] : [],
      preset,
      rawDocs,
    );
    const consentProfile = buildConsentProfile({
      customerType,
      gpsInstalled: S(c.gps_installed_snapshot || c.gps_installed) || '미장착',
      paymentMethod: S(c.payment_method_snapshot || c.payment_method) || '계좌이체',
      screeningCriteria: S(c.screening_criteria_snapshot || c.screening_criteria) || '무심사',
      requiredDocuments,
    });

    const contractDate = S(c.contract_date) || new Date().toISOString().slice(0, 10);
    const pd = spec.kind === '구독'
      ? (spec.maturity === '인수형' ? '구독인수형' : '구독선택형')
      : (spec.maturity === '인수형' ? '렌트인수형' : '렌트선택형');

    return {
      contractId,
      contractCode: S(c.contract_code) || contractId,
      customerName,
      customerPhone: phone,
      customerType,
      vehicleName,
      plate,
      supplierCode,
      supplierName,
      contractKind: kind,
      insuranceSide: insurance,
      rent,
      termMonths: term,
      deposit,
      contractDate,
      templateVersion: 'freepass-rental-contract-erp4-2026-08',
      agreementVersion: 'rental-v19-2026-08-13',
      templateState: {
        co: 'auto',
        pd,
        ins: insurance === '고객직접' ? '별도' : '포함',
        ct: customerType === '법인' ? '법인' : '개인',
        car: plate === '미정' ? '신차' : '등록완료',
        tax: customerType === '개인사업자' ? '사업자' : '개인',
      },
      templateFields: {
        ...templateFieldsFromContract(c),
        contract_code: S(c.contract_code) || contractId,
        contract_date: contractDate,
        customer_name: customerName,
        customer_phone: phone,
        vehicle_name: vehicleName,
        car_number: plate,
        rent_amount: String(rent ?? ''),
        rent_month: String(term ?? ''),
        deposit_amount: String(deposit ?? ''),
        company_name: supplierName || supplierCode,
        payment_method: S(c.payment_method_snapshot || c.payment_method) || '계좌이체',
      },
      requiredDocuments,
      consentProfile,
    };
  }

  async adminState(contractId: string): Promise<EsignAdminState> {
    const [session, events] = await Promise.all([this.repo.getCurrentSession(contractId), this.repo.listEvents(contractId)]);
    const priv = session ? await this.repo.getPrivate(session.id) : null;
    const attention: string[] = [];
    if (session) {
      const stage = esignStage(session);
      if (['반려', '만료', '철회'].includes(stage.state)) attention.push(stage.label);
      if (session.status === 'pending_review') attention.push('승인 필요');
    }
    const assetMap = (priv?.assets && typeof priv.assets === 'object' ? priv.assets : {}) as Record<string, Record<string, unknown>>;
    const review = session && priv && Number(priv.submittedAt || 0) ? {
      submittedAt: Number(priv.submittedAt || 0),
      customerName: S(priv.customerName),
      customerPhone: S(priv.customerPhone),
      customerBirth: S(priv.customerBirth),
      customerAddress: S(priv.customerAddress),
      driverLicenseNo: S(priv.driverLicenseNo),
      signerName: S(priv.signerName),
      signerRole: S(priv.signerRole),
      emergency: [S(priv.emergencyRelation), S(priv.emergencyName), S(priv.emergencyPhone)].filter(Boolean).join(' · '),
      cms: priv.cms && typeof priv.cms === 'object'
        ? [S((priv.cms as Record<string, unknown>).bank), S((priv.cms as Record<string, unknown>).holderName), (() => { const a=S((priv.cms as Record<string, unknown>).accountNo).replace(/\D/g,''); return a ? '••••'+a.slice(-4) : ''; })()].filter(Boolean).join(' · ')
        : '',
      assets: Object.entries(assetMap).map(([key, value]) => ({
        key,
        label: key === 'id_card' ? '운전면허증' : key === 'selfie' ? '본인 얼굴' : session.snapshot.requiredDocuments.find((d) => 'support:' + d.key === key)?.label || key,
        name: S(value.name),
        contentType: S(value.contentType),
        url: '/api/esign/asset/' + encodeURIComponent(session.id) + '/' + encodeURIComponent(key),
      })),
    } : undefined;
    return { session, publicUrl: S(priv?.publicUrl), stage: adminStage(session), attention, events, ...(review ? { review } : {}) };
  }

  async adminAsset(sessionId: string, key: string) {
    const priv = await this.repo.getPrivate(sessionId);
    const assets = (priv?.assets && typeof priv.assets === 'object' ? priv.assets : {}) as Record<string, Record<string, unknown>>;
    const asset = assets[key];
    if (!asset) return null;
    const path = S(asset.path), sha = S(asset.sha256);
    if (!path || !sha) return null;
    return this.assets.get(path, sha);
  }

  async issue(contractId: string, actor = 'admin') {
    const [current, raw] = await Promise.all([this.repo.getCurrentSession(contractId), this.repo.getContract(contractId)]);
    if (current?.status === 'signed') throw new Error('이미 서명완료된 계약입니다. 수정하려면 새 계약을 만들어야 합니다.');
    if (!current && raw) {
      const legacyStatus = S(raw.sign_status);
      const legacyLink = S(raw.esign_sign_url || raw.sign_url);
      if (legacyStatus === '서명완료') throw new Error('기존 ERP4에서 서명완료된 계약입니다. 완료본은 읽기 전용이며 수정하려면 새 계약을 만듭니다.');
      if (legacyLink && ['발행','열람','진행중','검토대기','반려'].includes(legacyStatus)) {
        throw new Error('기존 ERP4 전자계약 링크가 아직 활성입니다. 기존 링크를 마무리하거나 철회한 뒤 새 ERP5 전자계약을 발행해 주세요.');
      }
    }
    const snapshot = await this.snapshot(contractId);
    const token = this.token();
    const hash = this.tokenHash(token);
    const id = this.sessionId(hash);
    const now = Date.now();
    const revision = (current?.revision ?? 0) + 1;
    const publicUrl = this.publicBase() + '/sign/' + token;
    const session: EsignSession = {
      id,
      contractId,
      contractCode: snapshot.contractCode,
      tokenHash: hash,
      status: 'sent',
      revision,
      issuedAt: now,
      issuedBy: actor,
      expiresAt: now + TTL,
      progress: {},
      snapshot,
    };
    await this.repo.issueSession(session, publicUrl, {
      esign_id: id,
      sign_status: '발행',
      sign_sent_at: now,
      sign_expires_at: session.expiresAt,
      sign_revoked_at: null,
      sign_rejected_at: null,
      sign_reject_reason: null,
      esign_template_version: snapshot.templateVersion,
      sign_consent_version: snapshot.agreementVersion,
      signed_pdf_url: '',
    }, actor);
    return { session, publicUrl };
  }

  private async byToken(token: string) {
    const session = await this.repo.findSessionByTokenHash(this.tokenHash(token));
    if (!session) throw new Error('전자계약 링크를 찾을 수 없습니다.');
    return session;
  }

  async publicView(token: string, peek = false) {
    const session = await this.byToken(token);
    const now = Date.now();
    if (session.status === 'revoked') throw new Error('철회된 전자계약 링크입니다.');
    if (session.status === 'submitting' && Number(session.submittingAt || 0) <= now - SUBMIT_CLAIM_TTL) {
      if (await this.repo.transitionSession(session.id, ['submitting'], { status: 'in_progress', submittingAt: 0 })) {
        session.status = 'in_progress'; session.submittingAt = 0;
      }
    }
    if (session.expiresAt < now && !['pending_review', 'approving', 'signed'].includes(session.status)) {
      throw new Error('만료된 전자계약 링크입니다.');
    }
    if (!peek && session.status === 'sent') {
      const opened = await this.repo.transitionSession(session.id, ['sent'], { status: 'opened', openedAt: now });
      if (!opened) throw new Error('전자계약 상태가 바뀌었습니다 — 링크를 다시 열어 주세요.');
      await this.repo.updateContract(session.contractId, { sign_status: '열람', esign_opened_at: now });
      await this.repo.appendEvent(session.contractId, session.id, 'opened', 'customer');
      session.status = 'opened';
      session.openedAt = now;
    }
    const priv = await this.repo.getPrivate(session.id);
    const assetKeys = Object.keys((priv?.assets as Record<string, unknown>) || {});
    return {
      session: { ...session, tokenHash: '' },
      stage: esignStage(session),
      rejectReason: session.rejectReason ?? '',
      supplementItems: session.supplementItems ?? [],
      uploadedKeys: assetKeys,
      draft: priv?.draft && typeof priv.draft === 'object' ? priv.draft : null,
    };
  }

  async saveDraft(token: string, payload: Record<string, unknown>) {
    const session = await this.byToken(token);
    if (!['sent', 'opened', 'in_progress', 'rejected'].includes(session.status)) {
      throw new Error('현재 링크에서는 작성내용을 저장할 수 없습니다.');
    }
    const max = (key: string, n: number) => S(payload[key]).slice(0, n);
    const stepRaw = Number(payload.step);
    const consentRaw = Array.isArray(payload.consents) ? payload.consents.map(S).filter((x) => session.snapshot.consentProfile.requiredKeys.includes(x)) : [];
    const draft = {
      customer_name: max('customer_name', 40),
      customer_phone: max('customer_phone', 30),
      customer_birth: max('customer_birth', 10),
      customer_address: max('customer_address', 200),
      driver_license_no: max('driver_license_no', 30),
      signer_name: max('signer_name', 40),
      signer_role: max('signer_role', 30),
      emergency_relation: max('emergency_relation', 30),
      emergency_name: max('emergency_name', 40),
      emergency_phone: max('emergency_phone', 30),
      cms_holder_name: max('cms_holder_name', 80),
      cms_holder_relation: max('cms_holder_relation', 40),
      cms_holder_phone: max('cms_holder_phone', 30),
      cms_bank: max('cms_bank', 40),
      cms_account_no: max('cms_account_no', 30),
      cms_holder_identifier: max('cms_holder_identifier', 20),
      consents: [...new Set(consentRaw)],
      summaryConfirmedAt: Number(payload.summaryConfirmedAt || 0) || 0,
      agreementReadAt: Number(payload.agreementReadAt || 0) || 0,
      step: Number.isInteger(stepRaw) ? Math.max(0, Math.min(8, stepRaw)) : 0,
      savedAt: Date.now(),
    };
    await this.repo.putPrivate(session.id, { draft });
    return { ok: true, savedAt: draft.savedAt };
  }

  async progress(token: string, step: string) {
    const allowed = new Set(['summary', 'information', 'identity', 'agreement', 'documents', 'document']);
    if (!allowed.has(step)) throw new Error('모르는 전자계약 단계입니다.');
    const session = await this.byToken(token);
    const now = Date.now();
    if (['revoked', 'signed', 'pending_review', 'approving', 'submitting'].includes(session.status)) {
      throw new Error('현재 링크에서는 진행상태를 바꿀 수 없습니다.');
    }
    const progress = { ...(session.progress || {}), [step]: now };
    const moved = await this.repo.transitionSession(
      session.id,
      ['sent', 'opened', 'in_progress', 'rejected'],
      { status: 'in_progress', progress },
    );
    if (!moved) throw new Error('전자계약 상태가 바뀌었습니다 — 다시 열어 주세요.');
    await this.repo.updateContract(session.contractId, { sign_status: '진행중', esign_progress: Object.keys(progress).length });
    return { ok: true };
  }

  async upload(token: string, kind: string, name: string, contentType: string, bytes: Uint8Array) {
    const session = await this.byToken(token);
    if (['revoked', 'signed', 'pending_review', 'approving', 'submitting'].includes(session.status)) throw new Error('지금은 파일을 올릴 수 없습니다.');
    if (bytes.byteLength <= 0 || bytes.byteLength > 10 * 1024 * 1024) throw new Error('파일은 10MB 이하만 올릴 수 있습니다.');
    if (!/^image\/(jpeg|png|webp)$/.test(contentType) && contentType !== 'application/pdf') throw new Error('JPG·PNG·WEBP·PDF만 올릴 수 있습니다.');
    if (!uploadMagicOk(contentType, bytes)) throw new Error('파일 형식과 실제 내용이 맞지 않습니다.');
    const safe = kind.replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 80);
    const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] || 'bin';
    const asset = await this.assets.put(
      'esign-private/' + session.contractCode + '/' + session.id + '/' + safe + '-' + randomBytes(4).toString('hex') + '.' + ext,
      bytes,
      contentType,
    );
    const priv = await this.repo.getPrivate(session.id);
    const assets = { ...((priv?.assets as Record<string, unknown>) || {}), [kind]: { ...asset, name, contentType, uploadedAt: Date.now() } };
    await this.repo.putPrivate(session.id, { assets });
    return asset;
  }

  async submit(token: string, payload: PublicSubmissionPayload) {
    const session = await this.byToken(token);
    const now = Date.now();
    const staleSubmitting = session.status === 'submitting' && Number(session.submittingAt || 0) <= now - SUBMIT_CLAIM_TTL;
    const allowed = staleSubmitting ? ['submitting'] as EsignSession['status'][]
      : ['sent', 'opened', 'in_progress', 'rejected'] as EsignSession['status'][];
    if (session.expiresAt < now) throw new Error('만료된 전자계약 링크입니다.');
    const claimed = await this.repo.transitionSession(session.id, allowed, { status: 'submitting', submittingAt: now });
    if (!claimed) throw new Error('이미 제출 처리 중이거나 사용할 수 없는 링크입니다.');

    try {
      if (!Number(session.progress?.document || 0)) throw new Error('서명 전에 작성된 계약서를 열어 확인해 주세요.');
      const priv0 = await this.repo.getPrivate(session.id);
      const assets = (priv0?.assets as Record<string, Record<string, unknown>>) || {};
      const uploadedDocs = Object.keys(assets).filter((k) => k.startsWith('support:')).map((k) => k.slice('support:'.length));
      const result = validateSubmission({ ...payload, uploaded_documents: uploadedDocs }, session.snapshot);
      if (session.snapshot.customerType !== '법인') {
        if (!assets.id_card) throw new Error('운전면허증 사진을 올려 주세요.');
        if (!assets.selfie) throw new Error('본인 얼굴 사진을 올려 주세요.');
      }
      const signatureBytes = Buffer.from(result.signature.replace(/^data:image\/png;base64,/, ''), 'base64');
      const signatureAsset = await this.assets.put(
        'esign-private/' + session.contractCode + '/' + session.id + '/signature.png',
        signatureBytes,
        'image/png',
      );
      const supportingDocuments = uploadedDocs.map((key) => {
        const a = assets['support:' + key] || {};
        return {
          key,
          path: S(a.path),
          sha256: S(a.sha256),
          label: session.snapshot.requiredDocuments.find((d) => d.key === key)?.label || key,
        };
      });
      const consentTimes = Object.fromEntries(result.consents.map((key) => [key, now]));
      const submission: EsignPrivateSubmission = {
        sessionId: session.id,
        contractId: session.contractId,
        customerName: result.name,
        customerPhone: result.phone,
        customerBirth: result.birth || undefined,
        customerAddress: result.address,
        driverLicenseNo: result.license || undefined,
        signerName: result.signerName || undefined,
        signerRole: result.signerRole || undefined,
        emergencyRelation: result.emergencyRelation,
        emergencyName: result.emergencyName,
        emergencyPhone: result.emergencyPhone,
        consents: result.consents,
        consentTimes,
        sectionConfirmations: (payload.sectionConfirmations && typeof payload.sectionConfirmations === 'object'
          ? payload.sectionConfirmations : {}) as Record<string, number>,
        summaryConfirmedAt: Number(payload.summaryConfirmedAt || now),
        agreementReadAt: Number(payload.agreementReadAt || now),
        signaturePath: signatureAsset.path,
        signatureSha256: signatureAsset.sha256,
        supportingDocuments,
        submittedAt: now,
      };
      await this.repo.putPrivate(session.id, { ...submission, assets });
      const committed = await this.repo.transitionSession(session.id, ['submitting'], {
        status: 'pending_review',
        submittingAt: 0,
        submittedAt: now,
        progress: { ...(session.progress || {}), signed: now },
      });
      if (!committed) throw new Error('제출 상태가 바뀌어 저장을 마치지 못했습니다.');
      await this.repo.updateContract(session.contractId, { sign_status: '검토대기', sign_submitted_at: now, esign_progress: 6 });
      await this.repo.appendEvent(session.contractId, session.id, 'submitted', 'customer', { documents: supportingDocuments.map((d) => d.key) });
      return { ok: true, status: '검토대기' as const };
    } catch (e) {
      await this.repo.transitionSession(session.id, ['submitting'], {
        status: session.status === 'rejected' ? 'rejected' : 'in_progress',
        submittingAt: 0,
      }).catch(() => false);
      throw e;
    }
  }

  async approve(contractId: string, finalizationId: string, actor = 'admin') {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(finalizationId)) {
      throw new Error('승인 요청 식별자가 없습니다 — 화면을 새로 열어 다시 승인해 주세요.');
    }
    if (!this.finalRenderer) {
      throw new Error('최종 PDF 생성기가 연결되지 않았습니다 — 계약을 완료 처리하지 않았습니다.');
    }

    let session = await this.repo.getCurrentSession(contractId);
    if (!session) throw new Error('전자계약 세션이 없습니다.');
    if (session.status === 'signed') {
      if (session.finalizationId !== finalizationId) throw new Error('이미 다른 승인 요청으로 완료된 계약입니다.');
      return { ok: true as const, finalized: false, session };
    }

    const now = Date.now();
    if (session.status === 'approving') {
      const stale = Number(session.approvingAt || 0) <= now - FINALIZE_CLAIM_TTL;
      if (!stale) {
        if (session.finalizationId === finalizationId) {
          throw new Error('같은 승인 요청이 처리 중입니다 — 잠시 후 같은 요청 식별자로 다시 확인해 주세요.');
        }
        throw new Error('다른 승인 요청이 처리 중입니다.');
      }
      if (stale) {
        const released = await this.repo.transitionSession(session.id, ['approving'], {
          status: 'pending_review', approvingAt: 0, finalizationId: '',
        });
        if (!released) throw new Error('승인 상태가 바뀌었습니다 — 다시 확인해 주세요.');
        session = { ...session, status: 'pending_review', approvingAt: 0, finalizationId: '' };
      }
    }

    if (session.status === 'pending_review') {
      const claimed = await this.repo.transitionSession(session.id, ['pending_review'], {
        status: 'approving', approvingAt: now, finalizationId,
      });
      if (!claimed) throw new Error('이미 승인·보완 처리가 시작된 계약입니다.');
      session = { ...session, status: 'approving', approvingAt: now, finalizationId };
    } else if (session.status !== 'approving' || session.finalizationId !== finalizationId) {
      throw new Error('검토 대기 상태의 계약만 승인할 수 있습니다.');
    }

    try {
      const priv = await this.repo.getPrivate(session.id);
      if (!priv || Number(priv.submittedAt || 0) <= 0) throw new Error('고객 제출 자료를 찾을 수 없습니다.');

      const missingConsents = session.snapshot.consentProfile.requiredKeys
        .filter((key) => !priv.consents?.includes(key));
      if (missingConsents.length) throw new Error('필수 동의가 누락되었습니다: ' + missingConsents.join(' · '));

      const requiredDocs = applySignerRole(session.snapshot.requiredDocuments, priv.signerRole)
        .filter((d) => d.required);
      const supporting = new Map((priv.supportingDocuments || []).map((d) => [d.key, d]));
      const missingDocs = requiredDocs.filter((d) => !supporting.has(d.key));
      if (missingDocs.length) throw new Error('필수 서류가 누락되었습니다: ' + missingDocs.map((d) => d.label).join(' · '));

      const privateAssets = (priv.assets && typeof priv.assets === 'object' ? priv.assets : {}) as Record<string, Record<string, unknown>>;
      if (session.snapshot.customerType !== '법인') {
        for (const [key, label] of [['id_card', '운전면허증'], ['selfie', '본인 얼굴']] as const) {
          const asset = privateAssets[key];
          const path = S(asset?.path), hash = S(asset?.sha256);
          if (!path || !hash || !(await this.assets.get(path, hash))) throw new Error(label + ' 원본 검증에 실패했습니다.');
        }
      }
      for (const doc of requiredDocs) {
        const asset = supporting.get(doc.key);
        if (!asset?.path || !asset.sha256 || !(await this.assets.get(asset.path, asset.sha256))) {
          throw new Error(doc.label + ' 원본 검증에 실패했습니다.');
        }
      }

      if (!priv.signaturePath || !priv.signatureSha256) throw new Error('고객 서명 원본이 없습니다.');
      const signature = await this.assets.get(priv.signaturePath, priv.signatureSha256);
      if (!signature || !signature.contentType.startsWith('image/')) throw new Error('고객 서명 원본 검증에 실패했습니다.');

      const sealedSnapshot = signedSnapshot(session.snapshot, priv);
      const sealHash = sha256(stableJson({
        sessionId: session.id,
        revision: session.revision,
        snapshot: sealedSnapshot,
        signatureSha256: priv.signatureSha256,
        consents: [...(priv.consents || [])].sort(),
        documents: [...(priv.supportingDocuments || [])]
          .map((d) => ({ key: d.key, sha256: d.sha256 }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      }));

      const rendered = await this.finalRenderer.render({
        snapshot: session.snapshot,
        submission: priv,
        signatureBytes: signature.bytes,
        sealHash,
      });
      if (rendered.contentType !== 'application/pdf' || !isCompletePdfBytes(rendered.bytes)) {
        throw new Error('최종 문서 생성기가 완전한 PDF가 아닌 결과를 반환했습니다.');
      }

      const documentSha256 = sha256(rendered.bytes);
      const documentStoragePath = 'esign-final/' + session.contractCode + '/' + session.id + '.pdf';
      const stored = await this.assets.put(documentStoragePath, rendered.bytes, 'application/pdf');
      if (stored.sha256 !== documentSha256) throw new Error('최종 PDF 저장 검증에 실패했습니다.');
      const persisted = await this.assets.get(stored.path, documentSha256);
      if (!persisted || persisted.contentType !== 'application/pdf') {
        throw new Error('최종 PDF 저장 후 재조회 검증에 실패했습니다.');
      }

      const approvedAt = Date.now();
      const result = await this.repo.finalizeSigned(
        session.id,
        finalizationId,
        {
          approvedAt,
          approvedBy: actor,
          approvingAt: 0,
          signedSnapshot: sealedSnapshot,
          sealHash,
          documentSha256,
          documentStoragePath,
          documentContentType: 'application/pdf',
        },
        {
          sign_status: '서명완료',
          contract_status: '계약완료',
          sign_signed_at: approvedAt,
          signed_pdf_url: '/api/esign/final/' + encodeURIComponent(session.id),
          esign_seal_hash: sealHash,
          esign_document_sha256: documentSha256,
          esign_document_storage_path: documentStoragePath,
          esign_template_version: session.snapshot.templateVersion,
          sign_consent_version: session.snapshot.agreementVersion,
        },
        actor,
        {
          finalizationId,
          sealHash,
          documentSha256,
          documentStoragePath,
          templateVersion: session.snapshot.templateVersion,
          agreementVersion: session.snapshot.agreementVersion,
        },
      );
      return { ok: true as const, finalized: result.finalized, session: result.session };
    } catch (error) {
      await this.repo.transitionSession(session.id, ['approving'], {
        status: 'pending_review', approvingAt: 0, finalizationId: '',
      }).catch(() => false);
      throw error;
    }
  }

  async cancelContract(contractId: string, reason: string, actor = 'admin') {
    const result = await this.repo.cancelContract(contractId, reason, actor);
    return { ok: true as const, ...result };
  }

  async reject(contractId: string, reason: string, items: string[], actor = 'admin') {
    const session = await this.repo.getCurrentSession(contractId);
    if (!session) throw new Error('전자계약 세션이 없습니다.');
    if (!reason.trim()) throw new Error('보완 사유를 적어 주세요.');
    const now = Date.now();
    const claimed = await this.repo.transitionSession(session.id, ['pending_review'], {
      status: 'rejected',
      rejectedAt: now,
      rejectReason: reason.trim(),
      supplementItems: items,
      expiresAt: now + TTL,
    });
    if (!claimed) throw new Error('이미 승인·보완 처리가 시작된 계약입니다.');
    await this.repo.updateContract(contractId, {
      sign_status: '반려',
      sign_rejected_at: now,
      sign_reject_reason: reason.trim(),
    });
    await this.repo.appendEvent(contractId, session.id, 'rejected', actor, { reason: reason.trim(), items });
  }

  async revoke(contractId: string, actor = 'admin') {
    const session = await this.repo.getCurrentSession(contractId);
    if (!session) return;
    await this.repo.revokeSession(session.id, contractId, actor);
  }

  /**
   * 고객이 서명 직전에 확인하는 계약서.
   * signed 봉인본이 있으면 그 파일을 그대로 돌리고, 그 전에는 발행 시 고정한 snapshot으로
   * 읽기 전용 작성본 HTML을 만든다. 최종 승인/PDF 봉인은 별도 단계에서 처리한다.
   */
  async finalDocument(sessionId: string) {
    const session = await this.repo.getSession(sessionId);
    if (!session || session.status !== 'signed' || !session.documentStoragePath || !session.documentSha256) return null;
    return this.assets.get(session.documentStoragePath, session.documentSha256);
  }

  async publicDocument(token: string) {
    const session = await this.byToken(token);
    const now = Date.now();
    if (session.status === 'revoked') throw new Error('철회된 전자계약 링크입니다.');
    if (session.expiresAt < now && !['pending_review', 'approving', 'signed'].includes(session.status)) {
      throw new Error('만료된 전자계약 링크입니다.');
    }
    if (session.status === 'signed' && session.documentStoragePath && session.documentSha256) {
      return this.assets.get(session.documentStoragePath, session.documentSha256);
    }
    let html: string;
    try { html = await buildContractHtml(session.snapshot, { printButton: true }); }
    catch { html = fallbackContractHtml(session.snapshot); }
    return { bytes: new Uint8Array(Buffer.from(html, 'utf8')), contentType: 'text/html; charset=utf-8' };
  }

}
