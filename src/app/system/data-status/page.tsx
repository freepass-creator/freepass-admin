import { adminDataStatus } from '../../../server/data-status';
import { PanelHeader, Notice, ActionBar } from '../../_design/Primitives';
import { logoutAction } from '../../login/actions';

export const dynamic = 'force-dynamic';

export default async function DataStatusPage() {
  const s = await adminDataStatus();
  return (
    <section className="fn-data-status">
      <PanelHeader title="데이터 연결 상태" count={s.live ? 'LIVE' : 'CHECK'} />
      <p className="fn-muted">정본 프로젝트: {s.project} · 확인 {s.checkedAt}</p>
      {s.credential.ok
        ? <Notice tone="ok">ERP5 자격증명 연결됨 · 쓰기 {s.writeEnabled ? '켜짐' : '꺼짐'}</Notice>
        : <Notice tone="warn">ERP5 자격증명 오류 — {s.credential.why}</Notice>}
      <div className="fn-data-grid">
        {s.probes.map((p) => (
          <div className="fn-box" key={p.key}>
            <h2>{p.label}</h2>
            <p><b>{p.ok ? `${p.count?.toLocaleString('ko-KR')}건` : '읽기 실패'}</b></p>
            {p.error ? <p className="fn-err">{p.error}</p> : <p className="fn-muted">실제 ERP5 repository read</p>}
          </div>
        ))}
      </div>
      <form action={logoutAction}>
        <ActionBar><button type="submit" className="dz-bar-sub">로그아웃</button></ActionBar>
      </form>
    </section>
  );
}
