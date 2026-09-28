'use client';

import { ActionBar, PanelHeader } from './Primitives';
import { Panel, PanelBody, PanelFoot, PanelHead, PanelState, Screen } from '../_erp/parts';

export function RouteLoading({ title }: { title: string }) {
  return (
    <>
      <Screen name="route-loading">
        <div className="erp-workspace">
          <Panel kind="list">
            <PanelHead kind="목록" title={title} count={<span className="sr-only">불러오는 중</span>} />
            <PanelBody>
              <div className="erp-route-progress" role="status" aria-label="데이터 불러오는 중" />
            </PanelBody>
          </Panel>
        </div>
      </Screen>
      <section className="workspace dz-route-state" data-phone="list" aria-busy="true" aria-live="polite">
        <section className="panel product-panel">
          <PanelHeader title={title} />
          <div className="dz-route-progress" role="status" aria-label="데이터 불러오는 중" />
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
          <Panel kind="list">
            <PanelHead kind="목록" title={title} count="읽기 실패" />
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
