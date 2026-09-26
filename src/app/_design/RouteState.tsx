'use client';

import { ActionBar, PanelHeader } from './Primitives';
import { Panel, PanelBody, PanelFoot, PanelHead, PanelState, Screen } from '../_erp/parts';

export function RouteLoading({ title }: { title: string }) {
  return (
    <>
      <Screen name="route-loading">
        <div className="erp-workspace">
          <Panel>
            <PanelHead kind="상태" title={title} count="불러오는 중" />
            <PanelBody>
              <PanelState kind="loading" title="최신 데이터를 확인하고 있습니다.">
                화면 구성을 유지한 채 데이터를 불러옵니다.
              </PanelState>
            </PanelBody>
          </Panel>
        </div>
      </Screen>
      <section className="workspace dz-route-state" data-phone="list" aria-busy="true" aria-live="polite">
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
    </>
  );
}

export function RouteError({ title, error, reset }: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = () => {
    /* Actual Next production receipt: reset() alone kept the same server error
       without issuing a new request. Fatal route retry must really re-request the URL. */
    reset();
    window.location.reload();
  };
  return (
    <>
      <Screen name="route-error">
        <div className="erp-workspace">
          <Panel>
            <PanelHead kind="상태" title={title} count="읽기 실패" />
            <PanelBody>
              <PanelState kind="error" title="데이터를 불러오지 못했습니다.">
                일시적인 오류가 발생했습니다. 다시 시도해 주세요.{error.digest ? ` 오류번호 ${error.digest}` : ''}
              </PanelState>
            </PanelBody>
            <PanelFoot><button type="button" className="erp-btn erp-btn--primary" onClick={retry}>다시 시도</button></PanelFoot>
          </Panel>
        </div>
      </Screen>
      <section className="workspace dz-route-state" data-phone="list">
        <section className="panel product-panel">
          <PanelHeader title={title} />
          <div className="dz-state-block error" role="alert">
            <strong>데이터를 불러오지 못했습니다.</strong>
            <p>일시적인 오류가 발생했습니다. 다시 시도해 주세요.</p>
            {error.digest ? <small>오류번호 {error.digest}</small> : null}
          </div>
          <ActionBar><button type="button" className="primary" onClick={retry}>다시 시도</button></ActionBar>
        </section>
      </section>
    </>
  );
}
