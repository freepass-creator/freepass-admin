'use client';

import { ActionBar, PanelHeader } from './Primitives';

export function RouteLoading({ title }: { title: string }) {
  return (
    <section className="workspace erp-screen dz-route-state" data-phone="list" aria-busy="true" aria-live="polite">
      <section className="panel product-panel">
        <PanelHeader title={title} />
        <div className="dz-state-block">
          <strong>불러오는 중…</strong>
          <p>최신 데이터를 확인하고 있습니다.</p>
          <span className="dz-state-skeleton" aria-hidden />
          <span className="dz-state-skeleton short" aria-hidden />
          <span className="dz-state-skeleton" aria-hidden />
        </div>
      </section>
    </section>
  );
}

export function RouteError({ title, error, reset }: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="workspace dz-route-state" data-phone="list">
      <section className="panel product-panel">
        <PanelHeader title={title} />
        <div className="dz-state-block error" role="alert">
          <strong>데이터를 불러오지 못했습니다.</strong>
          <p>일시적인 오류가 발생했습니다. 다시 시도해 주세요.</p>
          {error.digest ? <small>오류번호 {error.digest}</small> : null}
        </div>
        <ActionBar>
          <button type="button" className="primary" onClick={() => {
            /* Actual Next production receipt: reset() alone kept the same server error
               without issuing a new request. Fatal route retry must really re-request the URL. */
            reset();
            window.location.reload();
          }}>다시 시도</button>
        </ActionBar>
      </section>
    </section>
  );
}
