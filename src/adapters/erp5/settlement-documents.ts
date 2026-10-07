/** Existing settlement projection → original template → private Drive artifact. No ledger issuance. */
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import {buildReceiptDocuments, type ReceiptDocumentConfig} from '../../domain/settlement/invoice-document';
import {invoiceDocHtml,invoicePageHtml,type DocumentBranding} from './settlement-invoice-html';
import {isCompletePdfBytes,pinPdfInfoDates} from '../../server/esign/pdf';
import type {Erp5SettlementRepository,ReceiptDocumentFile,ReceiptDocumentRun} from './settlement-repository';

type Config=ReceiptDocumentConfig & {branding:DocumentBranding;folderId:string;existingFiles?:Record<string,{id:string;name:string}>;dates?:Record<string,{claim?:string;pay?:string}>};
const hash=(v:string|Uint8Array,algorithm='sha256')=>createHash(algorithm).update(v).digest('hex');
const VERSION='receipt-pdf-original-v2-20261007';
export function documentConfig():Config {
  let c:Config;
  try{const path=process.env.SETTLEMENT_DOCUMENT_CONFIG_FILE;const raw=JSON.parse(path?readFileSync(path,'utf8'):process.env.SETTLEMENT_DOCUMENT_CONFIG_JSON??'');c=raw.septemberStatements?.documentConfig??raw;}catch{throw new Error('정산서 비공개 발행자·거래처·Drive 폴더 설정이 없습니다');}
  if(!c.issuer?.name||!c.branding?.name||!c.parties||!/^[-\w]{10,}$/.test(c.folderId??''))throw new Error('정산서 비공개 설정을 확인하세요');
  for(const field of ['markMain','markSub','name','erpMain','erpSub','tagline','bizNo','ceo','addr','web','erp','staff','staffPhone','phone','email','fax'] as const)if(typeof c.branding[field]!=='string')throw new Error('비공개 발행자 문구 설정이 누락됐습니다');
  for(const logo of Object.values(c.branding.logos??{})) if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo))throw new Error('로고는 검증된 내장 이미지여야 합니다');
  return c;
}
type DriveAuth={mode:'gws';exe:string}|{mode:'oauth';token:string};
export async function driveDocumentToken():Promise<DriveAuth>{
  if(process.platform==='win32'&&!process.env.VERCEL){
    const script=readFileSync(join(process.env.APPDATA??'','npm/gws.ps1'),'utf8');const exe=script.match(/'([^']+gws\.exe)'/i)?.[1];
    if(!exe)throw new Error('B3Q 기존 gws 실행 경로를 찾지 못했습니다');
    return{mode:'gws',exe};
  }
  const client_id=process.env.SETTLEMENT_DRIVE_CLIENT_ID,client_secret=process.env.SETTLEMENT_DRIVE_CLIENT_SECRET,refresh_token=process.env.SETTLEMENT_DRIVE_REFRESH_TOKEN;
  if(!client_id||!client_secret||!refresh_token)throw new Error('운영 Drive 연결이 없습니다 — B3Q gws는 Vercel 연결과 별개입니다');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
  const result=await response.json() as {access_token?:string};
  if(!response.ok||!result.access_token)throw new Error('Drive 인증에 실패했습니다');
  return{mode:'oauth',token:result.access_token};
}
async function gws(auth:Extract<DriveAuth,{mode:'gws'}>,method:string,params:Record<string,unknown>,metadata?:Record<string,unknown>,bytes?:Uint8Array){
  const args=['drive','files',method,'--params',JSON.stringify(params)];
  if(metadata)args.push('--json',JSON.stringify(metadata));
  let dir:string|undefined;
  try{
    if(bytes){dir=mkdtempSync(join(tmpdir(),'admin-receipt-pdf-'));const file=join(dir,'artifact.pdf');writeFileSync(file,bytes);args.push('--upload',file,'--upload-content-type','application/pdf');}
    const result=await promisify(execFile)(auth.exe,args,{cwd:dir??process.cwd(),windowsHide:true,timeout:30000,maxBuffer:1024*1024});
    return Response.json(JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))));
  }catch(e){const err=e as {stdout?:string;stderr?:string};let code=500;try{const raw=err.stdout??'';const j=JSON.parse(raw.slice(raw.indexOf('{')));code=Number(j.error?.code??j.code)||500;}catch{}return Response.json({code},{status:code>=400&&code<600?code:500});}
  finally{if(dir){unlinkSync(join(dir,'artifact.pdf'));rmdirSync(dir);}} // exact task-created file and empty directory only
}
async function drive(auth:DriveAuth,path:string,init?:RequestInit){
  if(auth.mode==='gws'){
    const u=new URL(`https://www.googleapis.com/${path}`),params:Record<string,unknown>=Object.fromEntries([...u.searchParams].map(([k,v])=>[k,v==='true'?true:v==='false'?false:k==='count'?Number(v):v]));
    if(u.pathname.endsWith('/generateIds'))return gws(auth,'generateIds',params as Record<string,unknown>);
    const id=u.pathname.split('/').at(-1);return gws(auth,'get',{...params,fileId:id});
  }
  return fetch(`https://www.googleapis.com/${path}`,{...init,headers:{...init?.headers,Authorization:`Bearer ${auth.token}`},signal:AbortSignal.timeout(25000)});
}
export async function saveReceiptPdf(token:DriveAuth,folder:string,id:string,name:string,key:string,bytes:Uint8Array,replaceExisting=false):Promise<ReceiptDocumentFile>{
  const sha256=hash(bytes),md5=hash(bytes,'md5');
  const query='supportsAllDrives=true&fields=id,name,mimeType,parents,trashed,md5Checksum,webViewLink,appProperties,owners';
  const read=()=>drive(token,`drive/v3/files/${encodeURIComponent(id)}?${query}`);
  let existing=await read();
  let oldFile:Record<string,unknown>|null=null;
  if(existing.ok)oldFile=await existing.clone().json() as Record<string,unknown>;
  if(oldFile && !(oldFile.owners as {emailAddress?:string}[]|undefined)?.some(x=>x.emailAddress==='pyh@teamjpk.com'))throw new Error('기존 PDF 소유자가 승인된 회사 계정이 아닙니다');
  if(oldFile && (oldFile.trashed||oldFile.mimeType!=='application/pdf'||!(oldFile.parents as string[]|undefined)?.includes(folder)))throw new Error('기존 PDF의 승인된 폴더·종류가 다릅니다');
  const properties=oldFile?.appProperties as Record<string,string>|undefined;
  if(properties?.receiptRun===key&&oldFile?.md5Checksum!==md5)throw new Error('동일 입력 PDF의 내용이 달라졌습니다 — 덮어쓰지 않습니다');
  if(existing.status===404)throw new Error('승인된 기존 정산서가 없습니다 — 새 파일을 자동 생성하지 않습니다');
  if(replaceExisting&&oldFile&&(oldFile.md5Checksum!==md5||properties?.receiptRun!==key)){
    const boundary=`fp_${crypto.randomUUID().replaceAll('-','')}`;
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify({id,name,mimeType:'application/pdf',parents:[folder],appProperties:{receiptRun:key,sha256,source:'freepass-admin'}}),`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,new Uint8Array(bytes).buffer,`\r\n--${boundary}--`]);
    const metadata={name,mimeType:'application/pdf',appProperties:{...(properties??{}),receiptRun:key,sha256,source:'freepass-admin'}};
    const replacing=Boolean(oldFile);
    const write=token.mode==='gws'
      ?await gws(token,replacing?'update':'create',{...(replacing?{fileId:id,keepRevisionForever:true}:{}),supportsAllDrives:true,fields:'id'},replacing?metadata:{...metadata,id,parents:[folder]},bytes)
      :await drive(token,`upload/drive/v3/files${replacing?'/'+encodeURIComponent(id):''}?uploadType=multipart&supportsAllDrives=true&fields=id${replacing?'&keepRevisionForever=true':''}`,{method:replacing?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:replacing?new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,new Uint8Array(bytes).buffer,`\r\n--${boundary}--`]):body});
    // A retry uses the same reserved id. 409 must still pass exact metadata/checksum readback.
    if(!write.ok&&write.status!==409)throw new Error(`Drive PDF 저장 실패 (${write.status})`);
    existing=await read();
  }
  if(!existing.ok)throw new Error(`Drive PDF 재조회 실패 (${existing.status})`);
  const file=await existing.json() as {id:string;name:string;mimeType:string;parents?:string[];trashed?:boolean;md5Checksum?:string;webViewLink?:string;appProperties?:Record<string,string>;owners?:{emailAddress?:string}[]};
  if(file.id!==id||file.name!==name||file.mimeType!=='application/pdf'||file.trashed||!file.parents?.includes(folder)||file.md5Checksum!==md5||file.appProperties?.receiptRun!==key||file.appProperties?.sha256!==sha256||!/^https:\/\/(drive|docs)\.google\.com\//.test(file.webViewLink??''))throw new Error('Drive PDF 식별자·폴더·내용 검증 실패');
  return{id,url:file.webViewLink!,name,sha256,md5};
}
export function assertUniqueDocumentIds(ids:unknown,count:number):asserts ids is string[]{
  if(!Array.isArray(ids)||ids.length!==count||ids.some(id=>typeof id!=='string'||!/^[-\w]{10,}$/.test(id))||new Set(ids).size!==count)throw new Error('문서 파일 ID가 비었거나 거래처 간 중복됩니다 — 저장하지 않습니다');
}
export function verifyReceiptDocumentRun(run:ReceiptDocumentRun|null,key:string,month:string,files:ReceiptDocumentFile[]){
  if(!run||run.status!=='READY'||run.key!==key||run.month!==month||run.files.length!==files.length||run.fileIds.length!==files.length||run.files.some((f,i)=>f.id!==files[i].id||f.name!==files[i].name||f.md5!==files[i].md5||f.sha256!==files[i].sha256||f.url!==files[i].url||run.fileIds[i]!==f.id))throw new Error('저장된 READY 실행 기록을 재확인하지 못했습니다');
  return run.files;
}
export type ReceiptDocumentRepository=Pick<Erp5SettlementRepository,'listWithPublishedReceipts'|'receiptDocumentPolicy'|'receiptDocumentRun'|'beginReceiptDocumentRun'|'finishReceiptDocumentRun'>;
export class ReceiptDocumentGenerationError extends Error{constructor(message:string,readonly partialFiles:ReceiptDocumentFile[]){super(message);}}
export async function generateReceiptDocuments(repo:ReceiptDocumentRepository,month:string,actor:string){
  const config=documentConfig();
  const policy=await repo.receiptDocumentPolicy();
  config.supplierAliases=policy?.partyNameNormalization?.supplierAliases??{};
  config.channelAliases=policy?.partyNameNormalization?.channelAliases??{};
  const first=await repo.listWithPublishedReceipts();
  if(first.published.status!=='READY'||!first.published.months[month]||!first.digest)throw new Error('월별 접수 게시 원장이 최신인지 확인할 수 없습니다');
  const documents=buildReceiptDocuments({month,rows:first.all.map(x=>x.raw),summary:first.published.months[month],config});
  const basisDigest=(read:typeof first)=>hash(JSON.stringify(read.all.map(x=>x.raw.displayReceiptBasis)));
  const initialBasisDigest=basisDigest(first);
  if(documents.length>60)throw new Error('한 번에 생성할 거래처가 너무 많습니다');
  const key=hash(JSON.stringify({version:VERSION,month,digest:first.digest,config,documents}));
  const token=await driveDocumentToken();
  const folderResponse=await drive(token,`drive/v3/files/${encodeURIComponent(config.folderId)}?supportsAllDrives=true&fields=id,mimeType,trashed,capabilities,owners`);
  if(!folderResponse.ok)throw new Error('승인된 Drive 폴더를 읽을 수 없습니다');
  const folder=await folderResponse.json() as {mimeType?:string;trashed?:boolean;capabilities?:{canAddChildren?:boolean};owners?:{emailAddress?:string}[]};
  if(folder.mimeType!=='application/vnd.google-apps.folder'||folder.trashed||folder.capabilities?.canAddChildren!==true||!folder.owners?.some(x=>x.emailAddress==='pyh@teamjpk.com'))throw new Error('Drive 폴더 쓰기 권한이 없습니다');
  const existingTargets=documents.map(d=>config.existingFiles?.[`${month}|${d.axis}|${d.party}`]);
  if(!existingTargets.every(x=>x&&/^[-\w]{10,}$/.test(x.id)&&x.name.trim()))throw new Error('기존 문서 연결 일부가 누락됐습니다 — 중복 생성하지 않습니다');
  assertUniqueDocumentIds(existingTargets.map(x=>x!.id),documents.length);
  const old=await repo.receiptDocumentRun(key);
  if(old?.status==='READY'){
    assertUniqueDocumentIds(old.fileIds,documents.length);
    assertUniqueDocumentIds(old.files.map(f=>f.id),documents.length);
    if(old.files.some((f,i)=>f.id!==existingTargets[i]!.id||f.name!==existingTargets[i]!.name))throw new Error('기존 실행 문서가 승인된 파일 연결과 다릅니다');
    for(const f of old.files){
      const r=await drive(token,`drive/v3/files/${encodeURIComponent(f.id)}?supportsAllDrives=true&fields=id,name,parents,trashed,md5Checksum,webViewLink,appProperties,owners`);
      if(!r.ok)throw new Error('저장된 정산서를 다시 읽을 수 없습니다');
      const actual=await r.json() as {id:string;name:string;parents:string[];trashed:boolean;md5Checksum:string;webViewLink:string;appProperties?:Record<string,string>;owners?:{emailAddress?:string}[]};
      if(actual.id!==f.id||actual.name!==f.name||actual.trashed||!actual.parents?.includes(config.folderId)||actual.md5Checksum!==f.md5||actual.appProperties?.receiptRun!==key||actual.appProperties?.sha256!==f.sha256||!actual.owners?.some(x=>x.emailAddress==='pyh@teamjpk.com'))throw new Error('저장 뒤 PDF가 바뀌거나 이동했습니다 — 이전 성공을 재사용하지 않습니다');
    }
    return{files:old.files,reused:true,month};
  }
  let ids=old?.fileIds??(existingTargets.every(Boolean)?existingTargets.map(x=>x!.id):undefined);
  if(!ids)throw new Error('기존 정산서 파일 연결이 없습니다');
  if(ids.some((id,i)=>id!==existingTargets[i]!.id))throw new Error('기존 실행 파일과 승인된 정산서 파일이 다릅니다');
  assertUniqueDocumentIds(ids,documents.length);
  const run=await repo.beginReceiptDocumentRun(key,month,ids,actor);
  assertUniqueDocumentIds(run.fileIds,documents.length);
  if(run.status==='READY')throw new Error('그 사이 문서 생성이 완료됐습니다 — 다시 눌러 저장 검증을 확인하세요');
  const files:ReceiptDocumentFile[]=[];
  let browser:Awaited<ReturnType<typeof puppeteer.launch>>|undefined;
  try{
    browser=await puppeteer.launch({executablePath:process.env.SETTLEMENT_CHROMIUM_EXECUTABLE_PATH||await chromium.executablePath(),args:chromium.args,headless:'shell',timeout:30000});
    const deadline=Date.now()+240000;
    // Revalidate before the first external artifact write. Keep immutable input for all documents.
    const live=await repo.listWithPublishedReceipts();
    if(live.published.status!=='READY'||live.digest!==first.digest||basisDigest(live)!==initialBasisDigest)throw new Error('생성 중 원장 또는 산식근거가 바뀌었습니다 — 다시 실행하세요');
    for(let i=0;i<documents.length;i++){
      if(Date.now()>deadline)throw new Error('정산서 생성 제한 시간 — 같은 입력으로 다시 실행하면 저장된 파일을 재사용합니다');
      const d=documents[i],page=await browser.newPage();
      try{
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);
        page.on('request',r=>{const u=r.url();if(u.startsWith('data:')||u==='about:blank'||/^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u))void r.continue();else void r.abort();});
        const html=invoicePageHtml(`${month} ${d.party} ${d.kind}`,invoiceDocHtml(d,{branding:config.branding,issuedAt:run.createdAt,dueDay:config.dates?.[month]?.[d.axis==='공급사'?'claim':'pay']}));
        await page.setContent(html,{waitUntil:'load',timeout:45000});
        const ready=await page.evaluate(async()=>{
          await document.fonts.ready;
          const fonts=['Pretendard Variable','Exo 2','Gaegu'];
          return {fonts:fonts.every(f=>[...document.fonts].some(x=>x.family.replaceAll('"','')===f&&x.status==='loaded')),images:[...document.images].every(x=>x.complete&&x.naturalWidth>0),pages:document.querySelectorAll('.doc').length,overflow:[...document.querySelectorAll<HTMLElement>('.doc')].some(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2)};
        });
        if(!ready.fonts||!ready.images||!ready.pages||ready.overflow)throw new Error(`${d.party}: 폰트·로고·A4 페이지 검증 실패`);
        await page.emulateMediaType('print');
        const bytes=pinPdfInfoDates(await page.pdf({format:'A4',printBackground:true,margin:{top:0,right:0,bottom:0,left:0}}),run.createdAt);
        if(!isCompletePdfBytes(bytes)||bytes.length>5*1024*1024)throw new Error('완전한 PDF가 아니거나 저장 크기를 초과했습니다');
        const name=existingTargets[i]?.name??`[${Number(month.slice(5))}월 ${d.axis==='공급사'?'청구':'지급'}] ${d.party.replace(/[\\/:*?"<>|]/g,'_')} ${String(d.lines.length).padStart(2,'0')}건.pdf`;
        files.push(await saveReceiptPdf(token,config.folderId,run.fileIds[i],name,key,bytes,Boolean(existingTargets[i])));
        // Persist progress; on interruption the same reserved IDs are read back, never duplicated.
      }finally{await page.close();}
    }
    const final=await repo.listWithPublishedReceipts();
    if(final.published.status!=='READY'||final.digest!==first.digest||basisDigest(final)!==initialBasisDigest)throw new Error('생성 도중 원장이 변경됐거나 산식근거가 바뀌었습니다 — 부분 생성 문서를 확정으로 표시하지 않습니다');
    assertUniqueDocumentIds(files.map(f=>f.id),documents.length);
    for(const f of files){
      const r=await drive(token,`drive/v3/files/${encodeURIComponent(f.id)}?supportsAllDrives=true&fields=id,name,parents,trashed,md5Checksum,appProperties,owners`);
      if(!r.ok)throw new Error('최종 Drive 전체 재조회 실패');
      const actual=await r.json() as {id:string;name:string;parents:string[];trashed:boolean;md5Checksum:string;appProperties?:Record<string,string>;owners?:{emailAddress?:string}[]};
      if(actual.id!==f.id||actual.name!==f.name||actual.trashed||!actual.parents?.includes(config.folderId)||actual.md5Checksum!==f.md5||actual.appProperties?.receiptRun!==key||actual.appProperties?.sha256!==f.sha256||!actual.owners?.some(x=>x.emailAddress==='pyh@teamjpk.com'))throw new Error('최종 Drive 전체 문서 대조 실패');
    }
    await repo.finishReceiptDocumentRun(run,files,true,first.digest);
    const saved=await repo.receiptDocumentRun(key);
    const verified=verifyReceiptDocumentRun(saved,key,month,files);
    return{files:verified,reused:false,month};
  }catch(e){await repo.finishReceiptDocumentRun(run,files,false).catch(()=>{});throw new ReceiptDocumentGenerationError(e instanceof Error?e.message:'문서 생성 오류',files);}
  finally{await browser?.close();}
}
