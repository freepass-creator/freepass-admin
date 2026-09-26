import { adminDataStatus } from '../../../server/data-status';
import { PanelHeader, Notice, ActionBar } from '../../_design/Primitives';
import { logoutAction } from '../../login/actions';

export const dynamic = 'force-dynamic';

export default async function DataStatusPage() {
  const s = await adminDataStatus();
  const legacyCatalog = s.catalog.servedBy === 'LEGACY_ERP5_BRIDGE';
  return (
    <section className="fn-data-status">
      <PanelHeader title="데이터 연결 상태" count={s.live ? 'LIVE' : 'CHECK'} />
      <p className="fn-muted">데이터 정본: 프리패스 데이터 · 상품 모드 {s.catalog.mode} · 확인 {s.checkedAt}</p>
      {legacyCatalog
        ? <Notice tone="warn">
            상품 Catalog는 프리패스 데이터 전환 대기 중입니다. 현재 화면값은 freepasserp5 legacy bridge read이며 정본 권한은 프리패스 데이터에 있습니다.
          </Notice>
        : <Notice tone="ok">상품 Catalog가 프리패스 데이터 ACTIVE consumer contract를 사용합니다.</Notice>}
      {s.credential.ok
        ? s.writeEnabled
          ? <Notice tone="ok">Admin workflow/legacy bridge 저장소 연결됨 · 쓰기 켜짐 · {s.writeGate.mode}{s.writeGate.approvalRef ? ` · 승인 ${s.writeGate.approvalRef}` : ''}</Notice>
          : <Notice tone="warn">Admin workflow/legacy bridge 저장소 연결됨 · 쓰기 꺼짐 · {s.writeGate.reason}</Notice>
        : <Notice tone="warn">Admin workflow/legacy bridge 자격증명 오류 — {s.credential.why}</Notice>}
      {s.catalog.holdReasons.length > 0 && (
        <p className="fn-muted">Catalog HOLD · {s.catalog.holdReasons.join(' · ')}</p>
      )}
      <div className="fn-data-grid">
        {s.probes.map((p) => (
          <div className="fn-box" key={p.key}>
            <h2>{p.label}</h2>
            <p><b>{p.ok ? `${p.count?.toLocaleString('ko-KR')}건` : '읽기 실패'}</b></p>
            {p.error
              ? <p className="fn-err">{p.error}</p>
              : <p className="fn-muted">
                  {p.key === 'products'
                    ? `프리패스 데이터 consumer boundary · ${s.catalog.servedBy}`
                    : `Admin workflow store · ${s.project}`}
                </p>}
          </div>
        ))}
      </div>
      <form action={logoutAction}>
        <ActionBar><button type="submit" className="dz-bar-sub">로그아웃</button></ActionBar>
      </form>
    </section>
  );
}
