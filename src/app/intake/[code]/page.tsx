import Link from 'next/link';
import { notFound } from 'next/navigation';
import { settlements, today } from '../../../server/erp5';
import { writeEnabled } from '../../../adapters/erp5/settlement-repository';
import { blockOf, margin, type FeeBasis } from '../../../domain/settlement/types';
import { num, sp, txt, when, won, yes } from '../../_fn/fmt';
import Progress from './Progress';

export const dynamic = 'force-dynamic';

const fee = (f: FeeBasis) =>
  f.mode === 'RATE' ? `${(f.rate * 100).toFixed(2)}%` : f.mode === 'FLAT' ? `정액 ${won(f.amount)}` : `모름 (${f.note ?? ''})`;

export default async function IntakeDetail({
  params, searchParams,
}: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { code } = await params;
  const q = await searchParams;
  const hit = await settlements.get(code);
  if (!hit) notFound();
  const { row: r, warnings } = hit;
  const events = await settlements.events(r.plate, r.receivedAt);

  const F = ({ k, v }: { k: string; v: React.ReactNode }) => <dl><dt>{k}</dt><dd>{v}</dd></dl>;

  return (
    <>
      <p><Link href="/intake">← 계약접수</Link></p>
      {sp(q.created) && <p className="fn-ok">ERP5 에 새 접수를 세웠습니다 — {r.id}</p>}
      {sp(q.exists) && <p className="fn-err">같은 차량번호 + 접수일이 원장에 이미 있어 새로 만들지 않았습니다. 있던 줄입니다.</p>}
      <h1>{txt(r.plate)} · {txt(r.receivedAt)} · {txt(r.customer)}</h1>
      <p className="fn-muted">{r.id} · 다음 할 일: {blockOf(r) ?? (r.progress.cancelled ? '취소됨' : '끝')}</p>

      <h2>진행</h2>
      {!writeEnabled() && <p className="fn-err">ERP5 쓰기가 꺼져 있어 눌러도 저장되지 않습니다 (.env.local ERP5_WRITE=on).</p>}
      <Progress code={r.id} paper={r.progress.paper} delivered={r.progress.delivered}
        deliveredAt={r.progress.deliveredAt ?? ''} cancelled={r.progress.cancelled} today={today()} />

      <h2>접수</h2>
      <div className="fn-grid fn-box">
        <F k="모델" v={txt(r.model)} /><F k="공급사" v={`${txt(r.supplier)} · ${txt(r.supplierCode)}`} />
        <F k="영업채널" v={`${txt(r.channel)} · ${txt(r.channelCode)}`} /><F k="영업담당" v={`${txt(r.agent)} · ${txt(r.agentCode)}`} />
        <F k="상품구분" v={txt(r.product)} /><F k="렌트구분" v={txt(r.rentKind)} /><F k="계약방식" v={txt(r.contractType)} />
        <F k="기간" v={num(r.term, '개월')} /><F k="렌탈료" v={won(r.rent)} /><F k="보증금" v={won(r.deposit)} />
        <F k="차량가액" v={won(r.price)} /><F k="분납여부" v={txt(r.payKind)} />
        <F k="메모" v={txt(r.note)} />
      </div>

      <h2>정산 (읽기)</h2>
      <div className="fn-grid fn-box">
        <F k="청구월" v={txt(r.progress.billMonth)} /><F k="정산대상 · 비율" v={`${r.settleTarget} · ${r.settleRatio}`} />
        <F k="공급사 수수료" v={fee(r.supplierFee)} /><F k="영업 수수료" v={fee(r.channelFee)} />
        <F k="청구금액" v={won(r.money.claim)} /><F k="지급액" v={won(r.money.pay)} /><F k="남는 것" v={won(margin(r))} />
        <F k="청구 단계" v={r.claimStage} /><F k="지급 단계" v={r.payStage} />
        <F k="청구서 보냄" v={`${yes(r.progress.billed)} ${txt(r.progress.billedAt)}`} />
        <F k="계산서" v={`${yes(r.progress.invoiceIssued)} ${txt(r.progress.invoiceAt)}`} />
        <F k="수금" v={`${yes(r.progress.collected)} ${won(r.progress.collectedAmt)}`} />
        <F k="지급" v={`${yes(r.progress.paid)} ${won(r.progress.paidAmt)}`} />
        <F k="청구 보류 · 정산 제외" v={`${yes(r.progress.billHold)} · ${yes(r.progress.settleExclude)}`} />
        <F k="정산 메모" v={txt(r.settleNote)} />
        <F k="어디서 왔나" v={`${txt(r.source.sheet)} ${r.source.tab ? `· ${r.source.tab} ${r.source.rowNo ?? ''}행` : ''}`} />
      </div>
      {warnings.length > 0 && <><h2>살필 것</h2><ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul></>}

      <h2>고친 이력 ({events.length})</h2>
      {events.length === 0 ? <p className="fn-muted">남은 이력이 없습니다.</p> : (
        <table><thead><tr><th>때</th><th>칸</th><th>전</th><th>후</th><th>누가</th></tr></thead>
          <tbody>{events.map((e, i) => <tr key={i}><td>{when(e.at)}</td><td>{e.field}</td><td>{txt(e.from)}</td><td>{txt(e.to)}</td><td>{e.by.length > 20 ? `${e.by.slice(0, 6)}…` : e.by}</td></tr>)}</tbody>
        </table>)}
    </>
  );
}
