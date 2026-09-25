import type { EsignSession, EsignTone } from './types';

export const ESIGN_STEPS = [
  { key:'summary', label:'요약확인' },
  { key:'information', label:'계약자정보' },
  { key:'identity', label:'본인확인' },
  { key:'agreement', label:'계약·약관' },
  { key:'documents', label:'서류제출' },
  { key:'signed', label:'서명' },
] as const;

export type EsignState = '미발송'|'발행'|'열람'|'진행중'|'검토대기'|'서명완료'|'반려'|'만료'|'철회';
export type EsignStage = { state:EsignState; done:number; total:number; current:string|null; label:string; tone:EsignTone };

export function esignStage(session: EsignSession|null|undefined, now=Date.now()):EsignStage {
  const total=ESIGN_STEPS.length, base={total,current:null as string|null};
  if(!session) return {...base,state:'미발송',done:0,label:'미발송',tone:'grey'};
  if(session.status==='signed') return {...base,state:'서명완료',done:total,label:'서명완료',tone:'green'};
  if(session.status==='revoked') return {...base,state:'철회',done:0,label:'철회',tone:'red'};
  if(session.status==='rejected') return {...base,state:'반려',done:Math.min(Object.keys(session.progress||{}).length,total),label:'보완요청',tone:'red'};
  if(session.expiresAt < now && !['pending_review','approving'].includes(session.status)) return {...base,state:'만료',done:0,label:'만료',tone:'red'};
  if(session.status==='pending_review'||session.status==='approving'||session.status==='submitting') return {...base,state:'검토대기',done:total-1,label:session.status==='submitting'?'제출 처리 중':'검토대기',tone:'amber'};
  const done=ESIGN_STEPS.filter((x)=>Number(session.progress?.[x.key]||0)>0).length;
  if(session.status==='opened' && done===0) return {...base,state:'열람',done:0,label:'열람',tone:'navy'};
  if(session.status==='sent' && done===0) return {...base,state:'발행',done:0,label:'발행',tone:'navy'};
  const current=ESIGN_STEPS.find((x)=>!session.progress?.[x.key])?.label ?? null;
  return {...base,state:'진행중',done,current,label:current?`${current} 중`:'진행중',tone:'amber'};
}

export function adminStage(session: EsignSession|null): '작성'|'발송 전'|'고객 작성 중'|'검토 대기'|'완료' {
  if(!session) return '발송 전';
  if(session.status==='signed') return '완료';
  if(session.status==='pending_review'||session.status==='approving'||session.status==='submitting') return '검토 대기';
  if(['sent','opened','in_progress','rejected'].includes(session.status)) return '고객 작성 중';
  return '발송 전';
}
