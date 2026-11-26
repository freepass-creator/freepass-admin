import { notFound } from 'next/navigation';
import { creditConsentPreviewEnabled } from '../../../server/esign-scope';
import '../../sign/sign.css';
import './preview.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신용조회 동의서 초안 · FreePass', robots: { index: false, follow: false } };

/** Review only: no customer data, token, action, signature capture or persistence. */
export default function CreditConsentPreview() {
  if (!creditConsentPreviewEnabled()) notFound();
  return <main className="sg-root cc-preview"><div className="sg-shell">
    <div className="sg-brand">FreePass · 신용조회 사전 동의</div>
    <p className="sg-alert warn" id="preview-only">검토용 초안 — 고객 발송·서명 접수 불가. 대괄호 항목 확정 후 승인이 필요합니다.</p>
    <article className="sg-card cc-document" aria-label="신용조회 동의서 한 장 초안">
      <header className="sg-head"><h1>신용조회 개인정보 수집·이용 동의서</h1>
        <p>개인(신용)정보 조회·제공 동의 포함 · 초안 2026-10-21<br/>차량 대여계약 전 심사를 위한 별도 문서입니다. 이 동의만으로 대여계약이 체결되지 않습니다.</p></header>
      <p><b>개인정보처리자·조회 주체:</b> [실제 심사 법인명·사업자등록번호 확정]<br/>
        <b>문의·철회:</b> [담당 부서·연락처 확정] · <b>대상:</b> 개인 신청인 본인</p>
      <section><h2>1. 개인정보 수집·이용 (신용심사에 필수)</h2><dl>
        <Row label="목적">본인 확인, 차량 대여·구독 심사 및 보증금 조건 안내. 뮤카 상품은 NICE 신용점수에 따른 보증금 심사에 이용합니다. 마케팅에 이용하지 않습니다.</Row>
        <Row label="항목">성명, 생년월일, 휴대전화번호, 본인확인 결과, NICE 신용점수·조회일, 심사 결과·안내 보증금, 동의별 선택·동의일시·문안 버전·서명. [본인확인 식별값의 필요성·종류 확정]</Row>
        <Row label="보유·이용 기간"><strong>[제안·미확정] 심사 종료(철회·거절 포함) 후 30일 이내 파기.</strong> 계약 체결 시에도 신용점수 원문을 계약서에 옮기지 않습니다. 법정 보존이 필요하면 대상·근거·기간을 특정해 분리 보관합니다. [동의 증빙 보존 근거·기간 별도 확정]</Row>
        <Row label="거부 권리·불이익">동의를 거부할 수 있습니다. 거부 시 신용점수 기반 심사·보증금 조건 확정이 어렵습니다. 일반 상품 안내는 받을 수 있습니다.</Row>
      </dl><Choice name="collection" label="개인정보 수집·이용" /></section>
      <section><h2>2. 개인신용정보 조회 (신용심사에 필수)</h2><dl>
        <Row label="조회 대상 기관">[NICE평가정보㈜ 여부 및 실제 계약 조회기관 확정] → 위 조회 주체</Row>
        <Row label="목적·조회 항목">이번 차량 대여·구독 신청의 신용점수별 보증금 심사 / NICE 신용점수·조회일. 연체·대출·채무 내역은 이 초안의 조회 항목에 포함하지 않습니다.</Row>
        <Row label="조회 동의 효력">[제안·미확정] 동의일부터 7일 이내, 이번 신청의 최초 조회 1회. 미조회 상태에서 신청 철회 시 종료. 추가 조회는 별도 동의를 받습니다.</Row>
        <Row label="보유·거부 안내">조회 주체의 보유기간은 제1항과 같습니다. 조회 동의를 거부할 수 있으며 신용점수 기반 심사·보증금 확정이 제한됩니다. [신용평점 영향은 조회기관 확인 후 구체적으로 고지]</Row>
      </dl><Choice name="inquiry" label="개인신용정보 조회" /></section>
      <section><h2>3. 제3자 제공 (해당 조회 방식에 필요한 경우 필수)</h2><dl>
        <Row label="받는 자·목적">[조회기관의 정확한 법인명] / 본인 식별·신용점수 조회 응답. 심사 법인 외 공급사에 결과를 전달한다면 해당 법인별 제공 동의를 추가합니다.</Row>
        <Row label="항목·보유기간">[조회에 필요한 성명·생년월일·본인확인 식별값 등 실제 전문 항목 확정] / <strong>[받는 자의 보유·이용 기간과 근거 확정]</strong></Row>
        <Row label="거부 권리·불이익">제공 동의를 거부할 수 있습니다. 본인 식별을 위한 제공이 필요한 조회 방식에서는 조회 및 신용점수 기반 보증금 심사를 진행할 수 없습니다.</Row>
      </dl><Choice name="provision" label="위 제3자 제공" /></section>
      <footer><p>각 항목에 따로 동의 여부를 표시합니다. 본 초안은 주민등록번호·운전면허번호·신분증 사본·얼굴 사진·계좌정보를 수집하는 근거가 아닙니다. 조회기관이 추가 항목을 요구하면 적법 근거와 문안을 다시 확인하고 별도 절차를 진행합니다. 계약서와 계약 서명은 추후 별도입니다.</p>
        <p>위 문의처로 열람·정정·삭제·처리정지·동의 철회를 요청할 수 있습니다. 본인 확인 후 처리 결과를 안내하며, 철회 후 추가 조회·이용을 중단하고 보존 의무가 없는 정보는 지체 없이 파기합니다. 이미 적법하게 처리된 사실은 소급 취소되지 않습니다. 자동화 평가가 적용되는 경우 결과 설명·이의 제기 방법을 별도 안내합니다.</p>
        <div className="sg-signbox cc-signature">성명: __________________　 동의일: ______년 ___월 ___일<br/>본인 서명: __________________ <small>(미리보기 · 입력/저장 안 함)</small></div>
        <p className="cc-version">독립 문서 CREDIT_INQUIRY_CONSENT · 문안 draft-2026-10-21 · 계약번호 없음</p></footer>
    </article>
    <div className="sg-actions one"><button className="sg-primary" disabled aria-describedby="preview-only">동의서 제출 · 검토 중</button></div>
  </div></main>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
function Choice({ name, label }: { name: string; label: string }) {
  return <fieldset className="cc-choice" disabled><legend>{label} 동의 여부 (미리보기)</legend>
    <label><input type="radio" name={name} value="agree" /> 동의함</label>
    <label><input type="radio" name={name} value="refuse" /> 동의하지 않음</label>
  </fieldset>;
}
