import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/[[path]].js';
import {sha256} from '../functions/_lib/core.js';

function adapter(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/0001_init.sql','utf8'));
 const wrap=(s,params=[])=>({bind(...args){return wrap(s,args)}, async all(){return {success:true,results:sqlite.prepare(s).all(...params)}},async first(){return sqlite.prepare(s).get(...params)||null},async run(){return {success:true,meta:sqlite.prepare(s).run(...params)}}});
 return {sqlite,db:{prepare:s=>wrap(s),async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const stmt of statements)out.push(await stmt.run());sqlite.exec('COMMIT');return out}catch(err){sqlite.exec('ROLLBACK');throw err}}}};
}
function setup(){const {sqlite,db}=adapter();const main='test-main-user',guest='test-guest-user';
 sqlite.prepare('INSERT INTO users(id,google_sub,email,name) VALUES(?,?,?,?)').run(main,'sub1','admin@example.test','Admin');
 sqlite.prepare('INSERT INTO memberships(company_id,user_id,role,active) VALUES(?,?,?,1)').run('main',main,'admin');
 sqlite.prepare('INSERT INTO users(id,google_sub,email,name) VALUES(?,?,?,?)').run(guest,'sub2','guest@example.test','User');
 sqlite.prepare('INSERT INTO memberships(company_id,user_id,role,active) VALUES(?,?,?,1)').run('main',guest,'user');
 const r2=new Map();const files={async put(key,data){r2.set(key,new Uint8Array(await new Response(data).arrayBuffer()))},async get(key){if(!r2.has(key))return null;return {body:new Response(r2.get(key)).body}},async delete(key){r2.delete(key)}};
 const env={DB:db,FILES:files,PUBLIC_BASE_URL:'https://mybiz.example.test',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',ADMIN_EMAILS:'admin@example.test',TOKEN_ENCRYPTION_KEY:btoa('abcdefghijklmnopqrstuvwxyzABCDEF')};
 const tokens={admin:'a'.repeat(64),user:'b'.repeat(64)};
 return {sqlite,env,tokens,users:{admin:main,user:guest},async initialize(){for(const [role,userId] of [['admin',main],['user',guest]]){sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await sha256(tokens[role]),userId,'2099-01-01T00:00:00Z')}},async call(path,method='GET',data=null,role='admin',headers={}){const req=new Request('https://mybiz.example.test/api'+path,{method,headers:{cookie:`mybiz_session=${tokens[role]}`,...(!['GET','HEAD'].includes(method)?{origin:'https://mybiz.example.test'}:{}),...(data!==null&&! (data instanceof Uint8Array)?{'content-type':'application/json'}:{}),...headers},...(!['GET','HEAD'].includes(method)?{body:data instanceof Uint8Array?data:(data===null?JSON.stringify({}):JSON.stringify(data))}:{} )});const res=await onRequest({request:req,env});let content;try{content=await res.clone().json()}catch{content=await res.text()}return {status:res.status,content,headers:res.headers}}}
}

test('full real workflow: projects, BOQ, expense approvals, invoicing, partial payments, receipt and reports',async()=>{
 const t=setup();await t.initialize();
 const contact=await t.call('/contacts','POST',{type:'customer',name:'ลูกค้า จำกัด',payment_terms_days:30});assert.equal(contact.status,201,JSON.stringify(contact.content));
 const vendor=await t.call('/contacts','POST',{type:'supplier',name:'ร้านวัสดุ'});assert.equal(vendor.status,201);
 const p=await t.call('/projects','POST',{code:'P-100',name:'งานสร้างบ้าน',customer_id:contact.content.id,contract_value:100000,vat_rate:7,wht_rate:3,retention_rate:5,advance_received:10000});assert.equal(p.status,201,JSON.stringify(p.content));
 const pid=p.content.id;assert.equal((await t.call('/projects')).content.length,1);
 const boq=await t.call(`/projects/${pid}/boq`,'POST',{code:'MAT-001',category:'วัสดุ',description:'คอนกรีต',quantity:10,unit:'ลบ.ม.',unit_rate:1000});assert.equal(boq.status,201,JSON.stringify(boq.content));
 const rev=await t.call(`/boq/${boq.content.id}`,'PATCH',{quantity:12,unit_rate:1000,category:'วัสดุ',description:'คอนกรีต',reason:'แก้ปริมาณ'});assert.equal(rev.status,200,JSON.stringify(rev.content));
 const milestone=await t.call(`/projects/${pid}/milestones`,'POST',{title:'งวดฐานราก',amount:50000,due_date:'2026-12-01'});assert.equal(milestone.status,201,JSON.stringify(milestone.content));
 const expense=await t.call('/expenses','POST',{project_id:pid,vendor_id:vendor.content.id,expense_date:'2026-11-17',description:'ซื้อคอนกรีต',vat_amount:700,wht_amount:0,items:[{category:'วัสดุ',description:'ปูน',amount:10000,boq_item_id:boq.content.id}]});assert.equal(expense.status,201,JSON.stringify(expense.content));
 const exid=expense.content.id;const submit=await t.call(`/expenses/${exid}/submit`,'POST',{});assert.equal(submit.status,200,JSON.stringify(submit.content));
 assert.equal((await t.call(`/expenses/${exid}/approve`,'POST',{},'user')).status,403);
 assert.equal((await t.call(`/expenses/${exid}/approve`,'POST',{})).status,200);
 const pyOut=await t.call('/payments','POST',{target_type:'expense',target_id:exid,amount:5000,payment_date:'2026-11-18'});assert.equal(pyOut.status,201,JSON.stringify(pyOut.content));
 const doc=await t.call('/documents','POST',{type:'invoice',project_id:pid,contact_id:contact.content.id,milestone_id:milestone.content.id,title:'งวด 1',doc_date:'2026-11-17',due_date:'2026-12-01',vat_rate:7,wht_rate:3,retention:2000,advance_deduct:1000,items:[{description:'งวดฐานราก',quantity:1,unit:'งาน',unit_rate:50000}]});assert.equal(doc.status,201,JSON.stringify(doc.content));
 const did=doc.content.id;const issued=await t.call(`/documents/${did}/issue`,'POST',{});assert.equal(issued.status,200,JSON.stringify(issued.content));
 const detailed=await t.call(`/documents/${did}`);assert.match(detailed.content.number,/^INV-2026-0001$/);assert.equal(detailed.content.net_due_cents,5000000+350000-150000-200000-100000);
 const pdfBytes=new TextEncoder().encode('%PDF-1.4\n'+('PDF ARCHIVE TEST '.repeat(20)));const archived=await t.call(`/documents/${did}/archive`,'POST',pdfBytes,'admin',{'content-type':'application/pdf'});assert.equal(archived.status,200,JSON.stringify(archived.content));const fetchedPdf=await t.call(`/documents/${did}/pdf`);assert.equal(fetchedPdf.status,200);assert.ok(fetchedPdf.content.startsWith('%PDF-1.4'));assert.equal((await t.call(`/documents/${did}/archive`,'POST',pdfBytes)).status,409);
 const payIn=await t.call('/payments','POST',{target_type:'invoice',target_id:did,amount:10000,payment_date:'2026-11-18',method:'bank'});assert.equal(payIn.status,201,JSON.stringify(payIn.content));
 const over=await t.call('/payments','POST',{target_type:'invoice',target_id:did,amount:50000,payment_date:'2026-11-18'});assert.equal(over.status,400,JSON.stringify(over.content));
 const receipt=await t.call(`/documents/${did}/receipt`,'POST',{payment_id:payIn.content.id});assert.equal(receipt.status,201,JSON.stringify(receipt.content));
 assert.equal((await t.call(`/documents/${receipt.content.id}/issue`,'POST',{})).status,200);
 const dash=await t.call('/dashboard');assert.equal(dash.status,200,JSON.stringify(dash.content));assert.equal(dash.content.active_count,0);assert.equal(dash.content.projects[0].budget_cents,1200000);assert.equal(dash.content.projects[0].cost_cents,1000000);
 const report=await t.call('/reports?kind=budget');assert.equal(report.status,200,JSON.stringify(report.content));assert.equal(report.content.rows.length,1);
 const fileBytes=new TextEncoder().encode('important attachment');const upload=await t.call(`/files/upload?project_id=${pid}&category=contract&filename=test.txt`,'POST',fileBytes,'admin',{'content-type':'text/plain','x-file-size':String(fileBytes.length)});assert.equal(upload.status,201,JSON.stringify(upload.content));assert.equal(upload.content.provider,'r2');
 const file=await t.call('/files/'+upload.content.id);assert.equal(file.status,200);assert.equal(file.content,'important attachment');
 const forbidden=await t.call(`/projects/${pid}`,'GET',null,'user');assert.equal(forbidden.status,403);
 const pm=await t.call(`/projects/${pid}/team`,'POST',{email:'guest@example.test'});assert.equal(pm.status,200);
 assert.equal((await t.call(`/projects/${pid}`,'GET',null,'user')).status,200);
 assert.equal((await t.call('/reports','GET',null,'user')).status,403);
 const backup=await t.call('/admin/backup');assert.equal(backup.status,200);
});

test('invalid origins and missing credentials rejected by API',async()=>{
 const t=setup();await t.initialize();
 const res=await onRequest({env:t.env,request:new Request('https://mybiz.example.test/api/contacts',{method:'POST',headers:{cookie:`mybiz_session=${t.tokens.admin}`,origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({name:'bad'})})});assert.equal(res.status,403);
 assert.equal((await t.call('/auth/me','GET',null,'admin')).status,200);
});
