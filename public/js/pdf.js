// MyBiz PDF generator. A4 pages rasterized from Canvas to preserve Thai text
// in browsers without font-embedding libraries. The PDF includes actual issue snapshots.
(()=>{
'use strict';
const encoder=new TextEncoder();
const A4_W=595.28,A4_H=841.89,SCALE=2;
const toBaht=(v)=>Number(v||0)/100;
const money=(v)=>toBaht(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const plain=(v)=>String(v??'').trim();
function thaiWords(text){
 const str=plain(text);
 try {return [...new Intl.Segmenter('th',{granularity:'word'}).segment(str)].map(x=>x.segment)}
 catch{return Array.from(str)}
}
function wrap(ctx,text,width){
 const result=[];
 for(const part of plain(text).split(/\n/)){
  let line='';
  for(const word of thaiWords(part)){
   if(ctx.measureText(line+word).width<=width){line+=word;continue}
   if(line)result.push(line.trimEnd());
   line=word;
   while(ctx.measureText(line).width>width&&line.length>1){const cc=Array.from(line);let slice=cc.shift();while(cc.length&&ctx.measureText(slice+cc[0]).width<=width)slice+=cc.shift();result.push(slice);line=cc.join('')}
  }
  result.push(line||' ');
 }
 return result;
}
function createCanvas(){const canvas=document.createElement('canvas');canvas.width=Math.round(A4_W*SCALE);canvas.height=Math.round(A4_H*SCALE);const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Browser ไม่รองรับ Canvas สำหรับสร้าง PDF');ctx.scale(SCALE,SCALE);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,A4_W,A4_H);return {canvas,ctx};}
function makePainter(ctx){const f="'IBM Plex Sans Thai', 'Noto Sans Thai', Tahoma, sans-serif";
 const ink='#1a263d',mute='#647084';
 function font(size=10,bold=false){ctx.font=`${bold?'700':'400'} ${size}px ${f}`;ctx.textBaseline='alphabetic';}
 function text(t,x,y,size=10,bold=false,color=ink,align='left'){font(size,bold);ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(plain(t),x,y);}
 function multiline(t,x,y,width,{size=10,leading=15,bold=false,color=ink,maxLines=30}={}){font(size,bold);const lines=wrap(ctx,t,width).slice(0,maxLines);for(const line of lines){text(line,x,y,size,bold,color);y+=leading}return y;}
 function line(x1,y1,x2,y2,color='#d7dfeb',width=1){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
 return {font,text,multiline,line,ink,mute};
}
function jpegsToPdf(pages){
 if(!pages.length)throw new Error('ไม่มีหน้าเอกสาร');
 const objects=2+3*pages.length, offsets=Array(objects+1).fill(0),pieces=[];let pos=0;
 function push(part){const v=typeof part==='string'?encoder.encode(part):part;pieces.push(v);pos+=v.byteLength;}
 function obj(i,content){offsets[i]=pos;push(`${i} 0 obj\n`);for(const part of content)push(part);push('\nendobj\n');}
 push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 obj(1,['<< /Type /Catalog /Pages 2 0 R >>']);
 obj(2,[`<< /Type /Pages /Kids [${pages.map((_,i)=>3+3*i+' 0 R').join(' ')}] /Count ${pages.length} >>`]);
 for(let i=0;i<pages.length;i++){
  const pageId=3+3*i,contentId=pageId+1,imgId=pageId+2;
  const content=`q\n${A4_W} 0 0 ${A4_H} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(pageId,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
  obj(contentId,[`<< /Length ${encoder.encode(content).byteLength} >>\nstream\n`,content,'endstream']);
  const data=pages[i];
  obj(imgId,[`<< /Type /XObject /Subtype /Image /Width ${Math.round(A4_W*SCALE)} /Height ${Math.round(A4_H*SCALE)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,data,'\nendstream']);
 }
 const xref=pos;push(`xref\n0 ${objects+1}\n0000000000 65535 f \n`);
 for(let i=1;i<=objects;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push(`trailer\n<< /Size ${objects+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(pieces,{type:'application/pdf'});
}
function jpeg(canvas){const uri=canvas.toDataURL('image/jpeg',0.88);const bin=atob(uri.slice(uri.indexOf(',')+1));const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes;}
async function create(doc,fallbackCompany={}){
 if(document.fonts?.ready)await document.fonts.ready;
 const snap=doc.snapshot||{},company=snap.company||fallbackCompany,customer=snap.contact||{},project=snap.project||{};
 const items=snap.items||doc.items||[],pages=[];let ctx,canvas,paint,y;
 const titles={quotation:'ใบเสนอราคา / QUOTATION',billing:'ใบวางบิล / BILLING',invoice:'ใบแจ้งหนี้ / INVOICE',receipt:'ใบเสร็จรับเงิน / RECEIPT'};
 function begin(){({canvas,ctx}=createCanvas());paint=makePainter(ctx);const {text,multiline,line,mute}=paint;
  ctx.fillStyle='#15284a';ctx.fillRect(0,0,A4_W,11);
  text(company.legal_name||company.name||'MyBiz Construction',36,48,17,true);
  let a=multiline(company.address,36,68,310,{size:9,leading:12,maxLines:3,color:mute});
  text('เลขผู้เสียภาษี: '+(company.tax_id||'—'),36,Math.max(81,a+3),9,false,mute);
  text(titles[doc.type]||'เอกสารธุรกิจ',559,48,15,true,'#1a355f','right');
  text('เลขที่: '+(doc.number||'—'),559,67,9,false,mute,'right');
  text('วันที่: '+plain(doc.doc_date),559,81,9,false,mute,'right');
  text('ครบกำหนด: '+plain(doc.due_date||'—'),559,95,9,false,mute,'right');
  line(36,119,559,119);
  text('ลูกค้า / เรียน',36,142,9,false,mute);
  multiline(customer.name||'—',36,160,270,{size:12,leading:15,bold:true,maxLines:2});
  multiline(customer.address||'',36,186,270,{size:9,leading:12,maxLines:3,color:mute});
  text('โครงการ',334,142,9,false,mute);
  multiline(project.name||'—',334,160,220,{size:11,leading:14,bold:true,maxLines:2});
  text('รหัส: '+plain(project.code||'—'),334,190,9,false,mute);
  line(36,222,559,222);
  text(doc.title||'',36,244,11,true);
  ctx.fillStyle='#edf2f8';ctx.fillRect(36,259,523,27);
  text('รายการ',46,277,9,true);text('จำนวน',373,277,9,true,paint.ink,'right');text('ราคา/หน่วย',456,277,9,true,paint.ink,'right');text('รวม',551,277,9,true,paint.ink,'right');
  y=305;
 }
 function end(){paint.line(36,793,559,793);paint.text('MyBiz Construction • '+plain(doc.number)+' • '+plain(doc.doc_date),36,811,8,false,paint.mute);pages.push(jpeg(canvas))}
 begin();
 for(const item of items){
  paint.font(9,false);const lines=wrap(ctx,item.description,290).slice(0,7);const h=Math.max(34,lines.length*14+12);
  if(y+h>680){end();begin()}
  for(let i=0;i<lines.length;i++)paint.text(lines[i],46,y+i*14,9);
  paint.text((Number(item.quantity_milli)/1000).toLocaleString('th-TH',{maximumFractionDigits:3})+' '+plain(item.unit||''),373,y,9,false,paint.ink,'right');
  paint.text(money(item.unit_rate_cents),456,y,9,false,paint.ink,'right');
  paint.text(money(item.amount_cents),551,y,9,false,paint.ink,'right');
  y+=h;paint.line(36,y-12,559,y-12,'#e9eef4',0.7);
 }
 if(y>570){end();begin()}
 let yy=Math.max(y+9,365);const sums=[
  ['มูลค่าก่อน VAT',doc.subtotal_cents],['VAT ('+(doc.vat_rate_bps/100)+'%)',doc.vat_cents],
  ['หัก WHT ('+(doc.wht_rate_bps/100)+'%)',-doc.wht_cents],['หัก Retention',-doc.retention_cents],
  ['หักคืนเงินล่วงหน้า',-doc.advance_deduct_cents]];
 for(const [label,v] of sums){paint.text(label,403,yy,9,false,paint.mute,'right');paint.text((v<0?'- ':'')+money(Math.abs(v)),551,yy,9,false,paint.ink,'right');yy+=23}
 paint.line(332,yy-12,559,yy-12,'#b6c5d6');paint.text('ยอดสุทธิ',403,yy+8,11,true,paint.ink,'right');paint.text(money(doc.net_due_cents)+' บาท',551,yy+8,11,true,paint.ink,'right');
 const noteY=Math.min(yy+38,690);paint.multiline(doc.note||'',36,noteY,510,{size:9,leading:13,maxLines:5,color:paint.mute});
 paint.text('บัญชีรับเงิน: '+plain(company.bank_name||'')+' '+plain(company.bank_account||''),36,760,9,false,paint.mute);
 end();
 const blob=jpegsToPdf(pages);
 if(blob.size>12*1024*1024)throw new Error('PDF ใหญ่เกิน 12MB กรุณาลดจำนวนรายการในเอกสาร');
 return blob;
}
window.MyBizPDF={create};
})();
