import { inflateSync } from 'node:zlib';
const PNG=Uint8Array.from([137,80,78,71,13,10,26,10]), W=600,H=180,MIN_PIX=70,MIN_W=40,MIN_H=10;
export type SignatureInk={pixels:number;width:number;height:number};
const u32=(b:Uint8Array,o:number)=>(((b[o]*0x1000000)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3])>>>0);
const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function inspectSignature(value:unknown):SignatureInk|null{
  const s=String(value??'').trim(), pre='data:image/png;base64,'; if(!s.startsWith(pre))return null;
  const enc=s.slice(pre.length); if(!enc||enc.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(enc))return null;
  let bytes:Uint8Array; try{bytes=Buffer.from(enc,'base64');}catch{return null;}
  if(bytes.length<33||!PNG.every((x,i)=>bytes[i]===x))return null;
  let off=8,w=0,h=0,depth=0,color=0;const chunks:Uint8Array[]=[];
  while(off+12<=bytes.length){const len=u32(bytes,off);off+=4;if(len>bytes.length-off-8)return null;const type=String.fromCharCode(bytes[off],bytes[off+1],bytes[off+2],bytes[off+3]);off+=4;const d=bytes.subarray(off,off+len);off+=len+4;
    if(type==='IHDR'){if(d.length!==13||w||h)return null;w=u32(d,0);h=u32(d,4);depth=d[8];color=d[9];if(d[10]||d[11]||d[12])return null;} else if(type==='IDAT')chunks.push(d); else if(type==='IEND')break;}
  if(w!==W||h!==H||depth!==8||!chunks.length)return null;const bpp=color===6?4:color===2?3:0;if(!bpp)return null;const stride=w*bpp, expected=(stride+1)*h;
  let inf:Uint8Array;try{inf=inflateSync(Buffer.concat(chunks.map(x=>Buffer.from(x))),{maxOutputLength:expected});}catch{return null;}if(inf.length!==expected)return null;
  let src=0,prev=new Uint8Array(stride),pix=0,minX=w,maxX=-1,minY=h,maxY=-1;
  for(let y=0;y<h;y++){const filter=inf[src++];if(filter>4)return null;const row=new Uint8Array(stride);for(let i=0;i<stride;i++){const raw=inf[src++],left=i>=bpp?row[i-bpp]:0,up=prev[i],ul=i>=bpp?prev[i-bpp]:0;const adj=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,ul);row[i]=(raw+adj)&255;}
    for(let x=0;x<w;x++){const i=x*bpp,r=row[i],g=row[i+1],b=row[i+2],a=color===6?row[i+3]:255;if(a<24||(r>245&&g>245&&b>245))continue;pix++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}prev=row;}
  return pix?{pixels:pix,width:maxX-minX+1,height:maxY-minY+1}:null;
}
export const hasMeaningfulSignature=(v:unknown)=>{const x=inspectSignature(v);return !!x&&x.pixels>=MIN_PIX&&x.width>=MIN_W&&x.height>=MIN_H;};
