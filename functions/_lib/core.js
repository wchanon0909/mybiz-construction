/* MyBiz API helpers: no secrets are ever sent to the browser. */
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new HttpError(status,message)};
export const id=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
export const pick=(v)=>v?.results||[];
export async function rows(db,sql,...args){return pick(await db.prepare(sql).bind(...args).all());}
export async function one(db,sql,...args){return (await db.prepare(sql).bind(...args).first())||null;}
export async function run(db,sql,...args){return db.prepare(sql).bind(...args).run();}
export async function body(req){let obj;try{obj=await req.json()}catch{fail(400,'ข้อมูล JSON ไม่ถูกต้อง')}if(!obj||Array.isArray(obj)||typeof obj!=='object')fail(400,'ข้อมูลไม่ถูกต้อง');return obj;}
export function s(value,max=250){return String(value??'').trim().slice(0,max)}
export function needed(value,label='ข้อมูล'){const v=s(value);if(!v)fail(400,`กรุณาระบุ${label}`);return v;}
export function int(value,min=0,max=10**12){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)fail(400,'จำนวนเงิน/จำนวนไม่ถูกต้อง');return n;}
export function moneyFromBaht(value){const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e10)fail(400,'จำนวนเงินไม่ถูกต้อง');return Math.round((n+Number.EPSILON)*100)}
export function signedMoney(value){const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e10)fail(400,'จำนวนเงินไม่ถูกต้อง');return Math.round(n*100)}
export function rate(value){const n=Number(value);if(!Number.isFinite(n)||n<0||n>100||Math.round(n*100)!==n*100&&Math.abs(Math.round(n*100)-n*100)>1e-7)fail(400,'อัตราร้อยละไม่ถูกต้อง');return Math.round(n*100)}
export const pct=(cents,bps)=>Math.round(cents*bps/10000);
export function lineAmount(quantityMilli,unitRateCents){return Math.round(quantityMilli*unitRateCents/1000)}
export function docTotals(items,vatRate,whtRate,retention,advance){const subtotal=items.reduce((a,i)=>a+i.amount_cents,0);const vat=pct(subtotal,vatRate), wht=pct(subtotal,whtRate);if(retention<0||advance<0||retention+advance+wht>subtotal+vat)fail(400,'ยอดหักเกินมูลค่ารายการ');return {subtotal_cents:subtotal,vat_cents:vat,wht_cents:wht,retention_cents:retention,advance_deduct_cents:advance,total_cents:subtotal+vat,net_due_cents:subtotal+vat-wht-retention-advance};}
export function fmtDate(d){const v=s(d,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z')))fail(400,'วันที่ไม่ถูกต้อง');return v;}
export async function audit(env,user,action,type,entity,details={}){await run(env.DB,'INSERT INTO audit_logs(id,company_id,user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?,?,?)',id(),'main',user?.id||null,action,type,entity||null,JSON.stringify(details).slice(0,4000));}
export function cookie(req,name){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
export function setCookie(name,value,maxAge=604800){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export function randomToken(){const b=crypto.getRandomValues(new Uint8Array(32));return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
export async function sha256(value){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
export function isAdmin(user){return user?.role==='admin'}
export function adminOnly(user){if(!isAdmin(user))fail(403,'เฉพาะ Admin เท่านั้น')}
export async function session(env,req){const token=cookie(req,'mybiz_session');if(!token)return null;const hash=await sha256(token);const user=await one(env.DB,`SELECT u.id,u.name,u.email,u.picture,m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id AND m.company_id='main' AND m.active=1 WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now')`,hash);return user;}
export async function authorizeProject(env,user,projectId,write=false){const project=await one(env.DB,'SELECT * FROM projects WHERE id=? AND company_id=?',projectId,'main');if(!project)fail(404,'ไม่พบโครงการ');if(!isAdmin(user)){const member=await one(env.DB,'SELECT 1 AS ok FROM project_members WHERE project_id=? AND user_id=?',projectId,user.id);if(!member)fail(403,'คุณไม่มีสิทธิ์ในโครงการนี้');if(write&&project.status==='cancelled')fail(409,'โครงการถูกยกเลิกแล้ว')}return project;}
export function projectWhere(user,alias='p'){return isAdmin(user)?{sql:'',args:[]}:{sql:` AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=${alias}.id AND pm.user_id=?)`,args:[user.id]};}
export function checkEnv(env){const missing=['DB','FILES','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','PUBLIC_BASE_URL','ADMIN_EMAILS','TOKEN_ENCRYPTION_KEY'].filter(k=>!env[k]);if(missing.length)fail(503,'ยังไม่ตั้งค่าระบบ: '+missing.join(', '));}
export function checkOrigin(req,env){if(['GET','HEAD','OPTIONS'].includes(req.method))return;const origin=req.headers.get('origin');const expected=new URL(env.PUBLIC_BASE_URL).origin;if(!origin||origin!==expected)fail(403,'Invalid request origin');}
export async function checkGoogleIdToken(token,clientId){
 const [h,p,sig]=String(token||'').split('.');if(!h||!p||!sig)fail(401,'Google ID token ไม่ถูกต้อง');
 const decode=v=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));
 let header,claims;try{header=JSON.parse(new TextDecoder().decode(decode(h)));claims=JSON.parse(new TextDecoder().decode(decode(p)))}catch{fail(401,'Token ไม่ถูกต้อง')}
 if(header.alg!=='RS256'||!header.kid)fail(401,'Invalid Google token algorithm');
 const res=await fetch('https://www.googleapis.com/oauth2/v3/certs');if(!res.ok)fail(503,'ไม่สามารถตรวจสอบ Google Token');const jwks=await res.json();const jwk=jwks.keys.find(x=>x.kid===header.kid && x.kty==='RSA');if(!jwk)fail(401,'Google key ไม่ตรง');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const good=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(sig),new TextEncoder().encode(h+'.'+p));
 if(!good||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==clientId||claims.exp<=Math.floor(Date.now()/1000)||!claims.sub||claims.email_verified!==true)fail(401,'Google Token ไม่ผ่านการตรวจสอบ');
 return claims;
}
export async function googleCodeExchange(env,code,redirectUri){const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'})});const v=await res.json();if(!res.ok||!v.access_token)fail(400,'Google OAuth ไม่สำเร็จ');return v;}
export function redirect(url,cookies=[]){const h=new Headers({'cache-control':'no-store','location':url});for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:302,headers:h});}
export async function loginGoogle(env,req){const state=randomToken();const redirectUri=env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/api/auth/callback';const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');for(const [k,v] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,prompt:'select_account'}))url.searchParams.set(k,v);return redirect(url.toString(),[setCookie('mybiz_login_state',state,600)]);}
export async function loginCallback(env,req){const u=new URL(req.url);const state=u.searchParams.get('state');if(!state||state!==cookie(req,'mybiz_login_state')||!u.searchParams.get('code'))fail(400,'Login session ไม่ถูกต้อง กรุณาลองใหม่');
 const token=await googleCodeExchange(env,u.searchParams.get('code'),env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/api/auth/callback');const google=await checkGoogleIdToken(token.id_token,env.GOOGLE_CLIENT_ID);const email=String(google.email||'').toLowerCase();const allowed=env.ADMIN_EMAILS.toLowerCase().split(',').map(x=>x.trim()).includes(email);
 let user=await one(env.DB,'SELECT u.id,u.google_sub,u.email,m.active FROM users u LEFT JOIN memberships m ON m.user_id=u.id AND m.company_id=? WHERE u.google_sub=?','main',google.sub);
 if(!user){const invite=await one(env.DB,'SELECT * FROM invitations WHERE company_id=? AND LOWER(email)=?','main',email);if(!allowed&&!invite) return redirect(env.PUBLIC_BASE_URL+'/#/access-denied',[setCookie('mybiz_login_state','',0)]);
   const existing=await one(env.DB,'SELECT id,google_sub FROM users WHERE LOWER(email)=?',email);
   if(existing&&existing.google_sub!==google.sub)fail(403,'บัญชี Google ไม่ตรงกับข้อมูลผู้ใช้เดิม');
   const uid=existing?.id||id();if(!existing)await run(env.DB,'INSERT INTO users(id,google_sub,email,name,picture) VALUES(?,?,?,?,?)',uid,google.sub,email,s(google.name,150)||email,s(google.picture,450));
   await run(env.DB,"INSERT INTO memberships(company_id,user_id,role,active) VALUES('main',?,?,1) ON CONFLICT(company_id,user_id) DO UPDATE SET active=1",uid,allowed?'admin':invite.role);
   if(invite)await run(env.DB,'UPDATE invitations SET accepted_at=datetime(\'now\') WHERE id=?',invite.id);
   user={id:uid};
 }else if(!user.active){fail(403,'บัญชีถูกระงับ กรุณาติดต่อ Admin')}
 const sessionToken=randomToken();const expires=new Date(Date.now()+7*24*3600*1000).toISOString();await run(env.DB,'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',await sha256(sessionToken),user.id,expires);
 await audit(env,user,'login','user',user.id,{email});
 return redirect(env.PUBLIC_BASE_URL+'/#/dashboard',[setCookie('mybiz_session',sessionToken),setCookie('mybiz_login_state','',0)]);
}
export async function logout(env,req){const token=cookie(req,'mybiz_session');if(token)await run(env.DB,'DELETE FROM sessions WHERE token_hash=?',await sha256(token));return json({ok:true},200,{'set-cookie':setCookie('mybiz_session','',0)});}
function keyFromBase64(str){const raw=atob(str);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
export async function encrypt(env,plain){const raw=keyFromBase64(env.TOKEN_ENCRYPTION_KEY);if(raw.length!==32)fail(503,'TOKEN_ENCRYPTION_KEY ต้องเป็น base64 ของ 32 bytes');const key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(plain));return btoa(String.fromCharCode(...iv,...new Uint8Array(encrypted)));}
export async function decrypt(env,value){const all=Uint8Array.from(atob(value),x=>x.charCodeAt(0));const raw=keyFromBase64(env.TOKEN_ENCRYPTION_KEY);const key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);const out=await crypto.subtle.decrypt({name:'AES-GCM',iv:all.slice(0,12)},key,all.slice(12));return new TextDecoder().decode(out);}
export async function driveAccess(env){const conn=await one(env.DB,"SELECT * FROM storage_connections WHERE company_id='main' AND provider='google_drive'");if(!conn?.refresh_token_enc)fail(409,'ยังไม่ได้เชื่อม Google Drive ใน Settings');const refresh=await decrypt(env,conn.refresh_token_enc);const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:refresh})});const v=await res.json();if(!res.ok||!v.access_token)fail(503,'Google Drive ถูกตัดการเชื่อมต่อ กรุณาเชื่อมใหม่');return {accessToken:v.access_token,connection:conn};}
export async function driveJson(url,accessToken,options={}){const res=await fetch(url,{...options,headers:{Authorization:'Bearer '+accessToken,'content-type':'application/json',...(options.headers||{})}});const raw=await res.text();let v={};try{v=JSON.parse(raw)}catch{}if(!res.ok)fail(502,'Google Drive API: '+(v.error?.message||res.status));return v;}
export async function driveCreateFolder(accessToken,name,parent){const v=await driveJson('https://www.googleapis.com/drive/v3/files?fields=id,name',accessToken,{method:'POST',body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})})});return v.id;}
export async function startDriveConnection(env,req){const state=randomToken();const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');const redirectUri=env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/api/storage/drive/callback';for(const [k,v] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/drive.file email',access_type:'offline',prompt:'consent',state}))url.searchParams.set(k,v);return redirect(url.toString(),[setCookie('mybiz_drive_state',state,600)]);}
export async function driveCallback(env,req,user){adminOnly(user);const u=new URL(req.url);if(!u.searchParams.get('state')||u.searchParams.get('state')!==cookie(req,'mybiz_drive_state'))fail(400,'Google Drive state ไม่ถูกต้อง');const token=await googleCodeExchange(env,u.searchParams.get('code'),env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/api/storage/drive/callback');if(!token.refresh_token)fail(400,'ไม่ได้รับ Refresh Token กรุณายกเลิกสิทธิ์แอปเดิมแล้วเชื่อมใหม่');
 const profile=await driveJson('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',token.access_token);const prior=await one(env.DB,"SELECT account_email,root_folder_id FROM storage_connections WHERE company_id='main' AND provider='google_drive'");const email=profile.user?.emailAddress||'Unknown';const previousFiles=await one(env.DB,"SELECT COUNT(*) AS n FROM attachments WHERE provider='google_drive'");if(prior&&prior.account_email.toLowerCase()!==email.toLowerCase()&&previousFiles.n>0)fail(409,'มีไฟล์ที่ผูกกับบัญชี Drive เดิม กรุณาใช้บัญชีเดิมหรือย้ายไฟล์ก่อนเปลี่ยน');const sameAccount=prior&&prior.account_email.toLowerCase()===email.toLowerCase();const root=sameAccount?prior.root_folder_id:await driveCreateFolder(token.access_token,'MyBiz-Construction');const encrypted=await encrypt(env,token.refresh_token);
 await run(env.DB,"INSERT INTO storage_connections(company_id,provider,account_email,refresh_token_enc,root_folder_id) VALUES('main','google_drive',?,?,?) ON CONFLICT(company_id,provider) DO UPDATE SET account_email=excluded.account_email,refresh_token_enc=excluded.refresh_token_enc,root_folder_id=excluded.root_folder_id,connected_at=datetime('now')",profile.user?.emailAddress||'Unknown',encrypted,root);
 if(!sameAccount)await run(env.DB,'DELETE FROM storage_folders');await audit(env,user,'connect_drive','storage','google_drive',{email:profile.user?.emailAddress});
 return redirect(env.PUBLIC_BASE_URL+'/#/settings?tab=storage',[setCookie('mybiz_drive_state','',0)]);
}
