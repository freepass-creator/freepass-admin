'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type FilterOption={value:string;label:string;count:number};
export type FilterAxis={
  key:'term'|'maxRent'|'maxDeposit'|'mileage';
  label:string;
  options:FilterOption[];
};

export function ProductFilterSheet({
  axes,
  activeCount,
  resultCount,
}:{
  axes:FilterAxis[];
  activeCount:number;
  resultCount:number;
}){
  const router=useRouter();
  const searchParams=useSearchParams();
  const [open,setOpen]=useState(false);
  const [axisKey,setAxisKey]=useState<FilterAxis['key']>(axes[0]?.key??'term');
  const closeRef=useRef<HTMLButtonElement>(null);
  const axis=axes.find((item)=>item.key===axisKey)??axes[0];

  const current=(key:FilterAxis['key'])=>searchParams.get(key)??'';

  function navigate(key:FilterAxis['key'],value:string){
    const params=new URLSearchParams(searchParams.toString());
    if(value)params.set(key,value); else params.delete(key);
    params.delete('page');
    params.delete('id');
    params.delete('offerId');
    router.replace('/products?'+params.toString(),{scroll:false});
  }

  function clearAll(){
    const params=new URLSearchParams(searchParams.toString());
    for(const key of ['term','maxRent','maxDeposit','mileage'])params.delete(key);
    params.delete('page');params.delete('id');params.delete('offerId');
    router.replace('/products?'+params.toString(),{scroll:false});
  }

  return <>
    <button
      className={'condition-trigger '+(activeCount?'active':'')}
      type="button"
      aria-expanded={open}
      onClick={()=>setOpen(true)}
    >
      세부필터 {activeCount>0&&<span>{activeCount}</span>}
    </button>
    {open&&<div className="filter-sheet-backdrop" role="presentation" onMouseDown={(event)=>{
      if(event.currentTarget===event.target)setOpen(false);
    }}>
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
        <header className="filter-sheet-head">
          <strong id="filter-title">세부필터</strong>
          <span/>
          {activeCount>0&&<button type="button" onClick={clearAll}>초기화</button>}
          <button ref={closeRef} className="filter-close" type="button" aria-label="닫기" onClick={()=>setOpen(false)}>×</button>
        </header>
        <div className="filter-sheet-body">
          <nav className="filter-axis-map" aria-label="필터 항목">
            {axes.map((item)=><button
              key={item.key}
              type="button"
              aria-current={item.key===axis?.key?'true':undefined}
              onClick={()=>setAxisKey(item.key)}
            >
              {item.label}
              {current(item.key)&&<span>1</span>}
            </button>)}
          </nav>
          <div className="filter-axis-values">
            <div className="filter-values-head">
              <strong>{axis?.label}</strong>
              {axis&&current(axis.key)&&<button type="button" onClick={()=>navigate(axis.key,'')}>이 항목 지우기</button>}
            </div>
            <div className="filter-options">
              {(axis?.options??[]).filter((option)=>option.count>0).map((option)=>{
                const selected=current(axis!.key)===option.value;
                return <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={()=>navigate(axis!.key,selected?'':option.value)}
                >
                  <span className="filter-check">{selected?'✓':''}</span>
                  <span>{option.label}</span>
                  <small>{option.count}</small>
                </button>;
              })}
              {(axis?.options??[]).filter((option)=>option.count>0).length===0&&<p>선택 가능한 조건이 없습니다.</p>}
            </div>
          </div>
        </div>
        <footer className="filter-sheet-foot">
          <button className="btn primary" type="button" onClick={()=>setOpen(false)}>{resultCount}건 보기</button>
        </footer>
      </section>
    </div>}
  </>;
}
