# MyBiz Construction V1 — ระบบใช้งานจริงสำหรับ GitHub + Cloudflare Pages

**Version:** 1.0.0 / 17 พฤศจิกายน 2026  
**ประเภท:** งานรับเหมา / ควบคุมต้นทุนโครงการ / BOQ Lite  
**สำคัญ:** ไม่มีโหมดทดลอง ไม่มีฐานข้อมูลจำลอง และไม่ได้เก็บข้อมูลการเงินใน localStorage

MyBiz V1 เป็น Web Application ที่ใช้ D1 เป็นฐานข้อมูลหลัก, R2 สำหรับเอกสารสำคัญ และ Google Drive สำหรับรูปหน้างาน/แบบก่อสร้าง พร้อม Google Sign-In และการตรวจสิทธิ์ Admin/User ที่ API ทุกครั้ง

> **ก่อนใช้งาน:** ZIP นี้เป็นซอร์สโค้ดสำหรับขึ้นระบบจริง แต่ **ยังไม่ได้ Deploy ลงบัญชีของคุณ** และยังไม่ได้ทดสอบ OAuth, R2 และ Drive กับบัญชีจริงของคุณ คุณต้องสร้างบริการและตั้งค่า Secrets ตามคู่มือ `docs/SETUP-TH.md` ก่อนเปิดใช้งาน ด้วยเหตุผลด้านความปลอดภัย เราไม่ฝัง Credentials หรือข้อมูลบัญชีของคุณไว้ในไฟล์

## ความสามารถ

- Google Login, เซสชันแบบ HttpOnly Secure cookie, Invite/Approve และ Admin/User
- Dashboard การเงินจากรายการใน D1, รายการบิลค้างรับ, ต้นทุน และงานรออนุมัติ
- Projects: สัญญา, งวดงาน, การติดตามความคืบหน้าทางกายภาพ, ทีมงาน, งานเพิ่ม–ลด
- BOQ Lite แยกหมวด รหัส ปริมาณ หน่วย ราคา และประวัติการปรับงบ
- Expenses: สร้างร่าง, ส่งตรวจ, อนุมัติ/ตีกลับ, แนบหลักฐานใน R2
- Documents: ใบเสนอราคา ใบวางบิล ใบแจ้งหนี้ ใบเสร็จ สร้าง PDF ภาษาไทยและเก็บใน R2
- Finance: รับ–จ่ายเงินจริง บันทึกชำระบางส่วนต่อใบแจ้งหนี้หรือรายจ่าย พร้อมป้องกันการรับเกินยอดคงค้าง
- VAT/WHT/Retention/เงินล่วงหน้า: แยกยอดและเก็บในข้อมูลเอกสาร
- Reports: โครงการ, BOQ vs Actual, Cash Flow, ลูกหนี้, ค่าใช้จ่าย; ส่งออก CSV/XLSX
- Files: R2 สำหรับเอกสารสำคัญ, Google Drive (OAuth 2.0) สำหรับรูปหน้างาน/ไฟล์ใหญ่
- Audit log, Export ข้อมูลฐาน D1 เป็น JSON; คู่มือสำรองเต็มด้วย Wrangler และสำรองไฟล์แยก

## โครงสร้างโปรเจกต์

```text
mybiz-construction/
  public/                 เว็บไซต์ที่เผยแพร่และ _worker.js ซึ่งสร้างด้วย npm run build
    index.html
    app.css
    js/app.js              Frontend ติดต่อ REST API จริง
    js/pdf.js              สร้าง PDF A4 พร้อมภาษาไทยด้วย Canvas
    js/xlsx.js             สร้าง Excel XLSX โดยไม่พึ่ง CDN ภายนอก
    _headers               Security headers สำหรับ Static Assets
  functions/
    _lib/core.js           Google OAuth, Session, Drive, Validation
    api/[[path]].js        Backend API จริง
  migrations/0001_init.sql โครงสร้างฐานข้อมูล D1
  scripts/build.mjs        สร้าง Pages Advanced Mode _worker.js
  scripts/check.mjs        ตรวจความถูกต้องพื้นฐาน
  tests/workflow.test.mjs  ทดสอบ API กับ SQLite และ R2 adapter ในเครื่อง
  docs/SETUP-TH.md         **คู่มือสร้างทรัพยากรและออนไลน์ทีละขั้นตอน**
  docs/OPERATION-TH.md     วิธีใช้งานและข้อจำกัดที่ควรทราบ
  package.json
```

## GitHub → Cloudflare Pages (สรุป)

1. สร้าง **GitHub Private Repository** และอัปโหลดไฟล์ทั้งหมดใน ZIP เข้าระดับ root ของ Repo (อย่าอัปโหลดเป็นโฟลเดอร์ซ้อนอีกชั้น)
2. ใน Cloudflare สร้าง **D1** ชื่อ `mybiz-db` และรัน `migrations/0001_init.sql` ก่อนใช้งาน
3. ใน Cloudflare สร้าง **R2 Bucket** ชื่อ `mybiz-files` ชนิด Standard
4. สร้าง Cloudflare Pages project โดยเชื่อม GitHub repo เดียวกัน: **Build command:** `npm run build`; **Output directory:** `public`; **Root:** `/`
5. ผูก Bindings: **D1 variable `DB`** → `mybiz-db` และ **R2 variable `FILES`** → `mybiz-files`
6. สร้าง Google Cloud Project, เปิด Drive API, สร้าง OAuth Client ประเภท **Web application**, ตั้ง Callback URL ทั้ง 2 รายการ
7. เพิ่ม Pages Environment Variables/Secrets: `PUBLIC_BASE_URL`, `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`
8. Deploy ใหม่หลังเพิ่ม bindings/secrets แล้วลงชื่อ Google ด้วยบัญชี Admin ที่อยู่ใน `ADMIN_EMAILS`
9. ไปที่ Settings → Storage เพื่อเชื่อม Gmail ที่จะเป็นเจ้าของพื้นที่ Google Drive

**คู่มือเต็ม (รวมค่าที่ต้องกรอกทุกช่อง) อยู่ที่ `docs/SETUP-TH.md`**

## Build และ Test

ไม่ใช้ dependencies ภายนอกในการ Build (ต้องมี Node.js 20+):

```bash
npm run build
npm test
```

`npm run build` จะตรวจไฟล์และสร้าง `public/_worker.js` สำหรับ Cloudflare Pages **Advanced Mode** ที่ Route `/api/*` ไป Backend และเสิร์ฟหน้าจอจาก Pages Assets เมื่อเป็น URL ปกติ

> ชุดทดสอบใช้ Node SQLite เพื่อจำลอง D1 API ในเครื่อง ไม่เท่ากับการทดสอบ Cloudflare Production/Google OAuth/Drive จริง ต้องทำ Deployment Acceptance Test ตาม `docs/OPERATION-TH.md` ด้วย

## ข้อจำกัดก่อนใช้งานกับเอกสารการเงินจริง

- เอกสาร PDF ใช้ Canvas และเก็บฉบับที่ออกจริงไว้ใน R2 เพื่อรองรับภาษาไทย แต่ไม่ใช่ **e-Tax Invoice/e-Receipt ที่ผ่านการรับรองทางราชการ**; รูปแบบภาษีและข้อความเอกสารต้องตรวจให้ตรงสถานะกิจการและกฎหมายก่อนใช้งานจริง
- ระบบนี้เป็น **Project Financial Management / Cost Control** ไม่ใช่ระบบบัญชีแยกประเภท (General Ledger) แบบเต็ม ไม่ทำงบการเงินตามมาตรฐานบัญชีโดยอัตโนมัติ
- VAT/WHT/Retention/Advance ที่ตั้งเป็นค่าเริ่มต้นเป็น **ข้อมูลทางธุรกิจ** ต้องตรวจฐานคำนวณและภาระภาษีตามประเภทสัญญา ไม่ควรนำยอดจากโปรแกรมไปยื่นภาษีโดยไม่ตรวจสอบ
- การชำระบางส่วนรองรับ **หนึ่งรายการชำระต่อหนึ่งเอกสารต้นทาง** (จ่ายหลายครั้งต่อหนึ่งใบได้) ยังไม่รองรับการจัดสรรยอดชำระครั้งเดียวไปหลายใบพร้อมกัน
- ข้อมูล Backup แบบ JSON ในหน้า Settings **ไม่รวมไฟล์ R2/Google Drive**; การสำรองข้อมูลออกนอกผู้ให้บริการและทดสอบ Restore ต้องตั้งกระบวนการเองตามคู่มือ
- การอัปโหลด Drive ใช้ API ผ่าน Worker; ไฟล์ขนาดใหญ่ที่อินเทอร์เน็ตไม่เสถียรอาจต้องอัปโหลดใหม่ แม้ใช้ Drive resumable session เพื่อเริ่มโอน
- ยังไม่มีโมดูลสต็อก, บัญชีแยกประเภท, e-Tax, OCR, ระบบการแจ้งเตือนทางอีเมล, งานอัตโนมัติสำหรับ Backup นอก Cloudflare หรือบัญชีรับ–จ่ายหลายสกุลเงิน

หากจะใช้จัดเก็บข้อมูลการเงินที่มีผลทางกฎหมายจำนวนมาก ควรทดสอบ Security, Restore และกระบวนการเอกสารกับผู้ดูแลบัญชี/กฎหมายก่อนเปิดใช้งานเต็มรูปแบบ
