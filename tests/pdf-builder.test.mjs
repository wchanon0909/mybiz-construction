import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Browser-free PDF smoke test: a Canvas stub lets us validate PDF bytes and xref.
test('Thai A4 PDF builder creates real PDF bytes and valid cross-reference',async()=>{
 const jpeg='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD06iiigD//2Q==';
 const fakeContext={scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},measureText(text){return {width:String(text).length*5.8}}};
 const fakeCanvas={width:0,height:0,getContext:()=>fakeContext,toDataURL:()=>`data:image/jpeg;base64,${jpeg}`};
 const sandbox={window:{},document:{fonts:{ready:Promise.resolve()},createElement:()=>fakeCanvas},Blob,TextEncoder,Uint8Array,atob,Intl,console};
 runInNewContext(readFileSync('public/js/pdf.js','utf8'),sandbox,{filename:'pdf.js'});
 const d={type:'invoice',number:'INV-2026-0001',doc_date:'2026-11-17',due_date:'2026-12-01',title:'ใบแจ้งหนี้งวดงานโครงสร้าง',subtotal_cents:10000000,vat_cents:700000,wht_cents:300000,net_due_cents:10400000,retention_cents:0,advance_deduct_cents:0,vat_rate_bps:700,wht_rate_bps:300,items:[{description:'คอนกรีตผสมเสร็จ',quantity_milli:1000,unit:'งาน',unit_rate_cents:10000000,amount_cents:10000000}]};
 const blob=await sandbox.window.MyBizPDF.create(d,{name:'บริษัท ทดสอบ จำกัด'});
 assert.equal(blob.type,'application/pdf');
 const bytes=new Uint8Array(await blob.arrayBuffer());assert.ok(bytes.length>400);
 const str=Buffer.from(bytes).toString('latin1');
 assert.ok(str.startsWith('%PDF-1.4'));
 assert.match(str,/\/Type \/Catalog/);assert.match(str,/\/Type \/Pages/);assert.match(str,/\/Subtype \/Image/);
 assert.match(str,/xref\n0 6\n/);
 const xref=Number(str.match(/startxref\n(\d+)\n%%EOF/)[1]);assert.equal(str.slice(xref,xref+5),'xref\n');
});
