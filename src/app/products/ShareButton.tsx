'use client';

import { useState } from 'react';

export function ShareButton({title}:{title:string}){
  const [done,setDone]=useState(false);
  async function share(){
    const url=window.location.href;
    try{
      if(navigator.share){
        await navigator.share({title,url});
      }else{
        await navigator.clipboard.writeText(url);
        setDone(true);
        window.setTimeout(()=>setDone(false),1600);
      }
    }catch(error){
      if((error as Error).name!=='AbortError')setDone(false);
    }
  }
  return <button className="btn" type="button" onClick={share}>{done?'링크 복사됨':'공유'}</button>;
}
