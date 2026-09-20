import type { ReactNode } from 'react';

export function BottomActionBar({
  secondary,
  primary,
  ariaLabel='현재 화면 작업',
}:{
  secondary?:ReactNode;
  primary?:ReactNode;
  ariaLabel?:string;
}){
  return <div
    className={'shared-bottom-action-bar '+(secondary&&primary?'two-actions':'one-action')}
    data-ui-bottom-action
    aria-label={ariaLabel}
  >
    {secondary&&<div className="shared-bottom-secondary">{secondary}</div>}
    {primary&&<div className="shared-bottom-primary">{primary}</div>}
  </div>;
}
