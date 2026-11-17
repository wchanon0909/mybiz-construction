# MyBiz Construction — คู่มือออนไลน์บน GitHub + Cloudflare Pages

**เป้าหมาย:** เปิดเว็บไซต์ที่ใช้งานกับข้อมูลจริงของคุณผ่าน Cloudflare Pages, D1, R2 และ Google Sign-In โดยเลือกเชื่อม Google Drive สำหรับไฟล์ทั่วไปเพิ่มได้หลังจากล็อกอินสำเร็จ

## A. เตรียมสิ่งที่ต้องมี (สรุป)

| บริการ / สิ่งที่จะสร้าง | ชื่อที่แนะนำ | ใช้ทำอะไร |
|---|---|---|
| GitHub Private Repository | `mybiz-construction` | เก็บซอร์สโค้ด ไม่เก็บรหัสผ่าน/ข้อมูลธุรกิจ |
| Cloudflare Pages | `mybiz-construction` (เปลี่ยนได้) | เว็บ + Backend API ในโปรเจกต์เดียว |
| Cloudflare D1 | `mybiz-db` | ฐานข้อมูลโครงการ BOQ เอกสาร รายรับ–รายจ่าย |
| Cloudflare R2 Standard Bucket | `mybiz-files` | ไฟล์สัญญา หลักฐานการเงิน PDF ฉบับจริง |
| Google Cloud Project | `MyBiz Construction` | OAuth และ Google Drive API |
| Google OAuth 2.0 Client | Web application | Google Login และเชื่อม Google Drive |
| Gmail เจ้าของ Drive | Gmail แยกจาก Admin | รูปถ่ายหน้างาน Drawing ไฟล์ทั่วไป |

ไม่จำเป็นต้องซื้อ Domain แยกทันที ใช้ `https://<pages-project>.pages.dev` ได้ หากใช้ Custom Domain ภายหลังต้องเปลี่ยน `PUBLIC_BASE_URL` และเพิ่ม Google OAuth Redirect URI ตามโดเมนใหม่

## B. อัปโหลดขึ้น GitHub

1. ดาวน์โหลดและแตกไฟล์ ZIP ของ MyBiz
2. เข้า GitHub → New repository → ชื่อ `mybiz-construction` → เลือก **Private** → Create
3. คลิก Add file → Upload files และนำ **เนื้อหาทั้งหมดของโฟลเดอร์** `mybiz-construction` ใส่ระดับบนสุดของ Repo
4. ตรวจสอบว่าหน้า Repo เห็น `package.json`, `public/`, `functions/`, `migrations/`, `scripts/`, `docs/` โดยตรง
5. กด Commit changes

ไม่อัปโหลด `.env`, API key, OAuth Client Secret, Refresh Token หรือไฟล์สำรองข้อมูลขึ้น GitHub เด็ดขาด

## C. สร้าง D1 และนำเข้า Schema

1. เข้า Cloudflare Dashboard ด้วยบัญชีที่ใช้ Deploy เว็บ
2. ไปที่ **D1 SQL Database** (ชื่อเมนูอาจเปลี่ยนตาม UI) → Create database
3. ตั้งชื่อ `mybiz-db` และยืนยัน
4. เลือก database นี้แล้วไปที่ Console เพื่อทดสอบด้วย `SELECT 1;`
5. เปิดไฟล์ `migrations/0001_init.sql` และนำคำสั่ง SQL ไป Execute ใน database นี้ หรือใช้ Wrangler ดังนี้:

```bash
npx wrangler login
npx wrangler d1 execute mybiz-db --remote --file=migrations/0001_init.sql
```

คำสั่งนี้รันจากโฟลเดอร์โปรเจกต์ที่มี `migrations/` อยู่ ในโหมด `--remote` จะปรับฐานข้อมูลจริง อย่ารันซ้ำกับข้อมูลสำคัญโดยไม่สำรองก่อน (ไฟล์นี้ใช้ `IF NOT EXISTS` สำหรับสร้าง schema ครั้งแรก)

รันคำสั่งตรวจสอบใน D1 Console:

```sql
SELECT id, name FROM companies;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

ควรเห็นบริษัทเริ่มต้น `main / MyBiz Construction` และตารางต่าง ๆ เช่น `projects`, `documents`, `payments`, `attachments`, `users`, `audit_logs`

## D. สร้าง R2

1. Cloudflare Dashboard → **R2 Object Storage** → Create bucket
2. ตั้งชื่อ Bucket: `mybiz-files` และเลือก Standard Storage
3. ตั้ง Bucket ให้ Private ไม่ต้องเปิด Public URL / Public Access
4. ยัง **ไม่ต้องสร้าง R2 API Token** เพราะเว็บจะเข้าถึงด้วย Cloudflare Binding `FILES` ที่ผูกใน Pages
5. ไฟล์ R2 จะถูกสร้างผ่านระบบ MyBiz โดยอัตโนมัติเมื่อออก PDF หรืออัปโหลดเอกสารสำคัญ

## E. สร้าง Cloudflare Pages และเชื่อม GitHub

1. Cloudflare Dashboard → Workers & Pages → Create Application → Pages → Connect to Git (ชื่อเมนูจริงอาจต่างออกไป)
2. อนุญาตให้ Cloudflare เข้าถึง GitHub Repository `mybiz-construction`
3. เลือก Production branch: `main`
4. ตั้งค่าการ Build:

| ช่อง | ค่าที่ต้องกรอก |
|---|---|
| Framework preset | `None` หรือ Custom |
| Build command | `npm run build` |
| Build output directory | `public` |
| Root directory | `/` หรือเว้นว่าง (root ของ repo) |
| Environment Variable สำหรับ Build (ถ้ามีปัญหา Node) | `NODE_VERSION` = `22` |

5. กด Deploy; ครั้งแรกหน้าเว็บอาจแสดง **ระบบรอการตั้งค่า Cloudflare** เพราะยังไม่ได้ผูก D1/R2 และ Google Secrets ซึ่งเป็นพฤติกรรมที่ตั้งใจไว้ ไม่ใช่ Demo
6. จำ URL จริงของเว็บไซต์ เช่น `https://mybiz-construction.pages.dev` ไปใช้กับ Google OAuth และ `PUBLIC_BASE_URL`

ตัวโปรเจกต์ใช้ **Pages Advanced Mode** สคริปต์ `npm run build` สร้าง `public/_worker.js` โดยอัตโนมัติ ไม่ต้องสร้าง Cloudflare Worker แยกอีกตัว และไม่ควรเปิด Pages Functions ที่ Route API ซ้ำ

## F. ตั้ง Bindings ใน Cloudflare Pages

ใน Pages Project → Settings → Functions/Bindings (Production Environment):

| ชนิด | Variable / Binding name (ต้องตรง) | ทรัพยากร |
|---|---|---|
| D1 Database | `DB` | `mybiz-db` |
| R2 Bucket | `FILES` | `mybiz-files` |

ถ้าต้องการทดสอบ Preview Deployment ให้ตั้ง Bindings ของ Preview ด้วย **แต่ควรใช้ฐานข้อมูลและ Bucket แยกจาก Production** เพื่อไม่ให้การทดสอบไปเปลี่ยนข้อมูลจริง

## G. ตั้ง Google Cloud OAuth

1. เข้า [Google Cloud Console](https://console.cloud.google.com/) แล้ว Create Project ชื่อ `MyBiz Construction`
2. ไปที่ APIs & Services → Library → เปิด **Google Drive API**
3. ไปที่ Google Auth Platform / OAuth consent screen ตั้งชื่อแอปและ Email ของผู้ดูแล, User type ตามบัญชี Google ของคุณ (บัญชี Gmail ทั่วไปใช้ External)
4. ตั้ง Scopes ที่ใช้: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file` โดยให้ Drive ใช้เฉพาะไฟล์ที่แอปสร้าง/เข้าถึงได้
5. สร้าง OAuth 2.0 Client ID ประเภท **Web application** และตั้งชื่อ เช่น `MyBiz Web`
6. กำหนด **Authorized JavaScript origins** ตาม URL เว็บไซต์ (ถ้าคอนโซลร้องขอ):

```text
https://mybiz-construction.pages.dev
```

7. กำหนด **Authorized redirect URIs** 2 ค่า (ต้องแทนที่ด้วย URL จริงของคุณ):

```text
https://mybiz-construction.pages.dev/api/auth/callback
https://mybiz-construction.pages.dev/api/storage/drive/callback
```

8. Copy `Client ID` และ `Client Secret` ไปใส่ใน Cloudflare Pages (ไม่ใส่ใน GitHub)
9. ถ้า OAuth App อยู่ใน **Testing Mode**, เพิ่ม Gmail ของ Admin และ Gmail สำหรับ Storage เป็น Test users ด้วย แต่ **Refresh Token ที่ใช้สิทธิ์ Drive อาจมีอายุเพียง 7 วัน** ใน External Testing Mode; ก่อนใช้งานระยะยาวให้จัดการสถานะ Publishing/Production และตรวจข้อกำหนดการยืนยัน OAuth ของ Google โดยไม่พยายามหลีกเลี่ยงข้อกำหนด

**Login เป็นคนละขั้นตอนกับ Drive:** Google Login ใช้สิทธิ์ `openid email profile` ส่วน Admin เชื่อมบัญชี Drive Storage เพิ่มภายหลังใน Settings โดยใช้ `drive.file email`

## H. ตั้ง Environment Variables/Secrets ใน Cloudflare Pages

ไปที่ Pages Project → Settings → Variables and Secrets (Production)

| ชื่อ (ต้องตรงตัวพิมพ์ใหญ่) | ตัวอย่างค่า / ความหมาย | เก็บเป็น Secret? |
|---|---|---|
| `PUBLIC_BASE_URL` | `https://mybiz-construction.pages.dev` (ไม่มี `/` ปิดท้าย) | ไม่จำเป็น |
| `ADMIN_EMAILS` | `admin@gmail.com` (Gmail Admin คนแรก) | แนะนำ Secret |
| `GOOGLE_CLIENT_ID` | `123456789-abc.apps.googleusercontent.com` | ไม่จำเป็น แต่ตั้งเป็น Secret ได้ |
| `GOOGLE_CLIENT_SECRET` | จาก Google OAuth Client | **ใช่** |
| `TOKEN_ENCRYPTION_KEY` | Base64 ของข้อมูลสุ่ม 32 bytes | **ใช่** |

หากมี Admin หลายคน ใช้ `ADMIN_EMAILS` แบบคั่นด้วยคอมมา เช่น `admin1@gmail.com,admin2@gmail.com`; ระบบจะอนุญาต Admin รายชื่อเหล่านี้ตั้งแต่แรก คนอื่นต้องให้ Admin เชิญก่อน

### สร้าง TOKEN_ENCRYPTION_KEY

ให้เปิด Terminal ในคอมพิวเตอร์ของคุณแล้วรัน (ต้องมี Node.js):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

คัดลอกผลลัพธ์ที่ได้ 1 บรรทัดไปใส่เป็น Secret ชื่อ `TOKEN_ENCRYPTION_KEY` และ **เก็บต้นฉบับไว้ใน Password Manager**; ถ้าทำกุญแจหาย/เปลี่ยนค่า Refresh Token ของ Drive ที่เข้ารหัสไว้จะถอดคืนไม่ได้ ต้องเชื่อม Drive ใหม่

หลังกรอกครบให้กด Save แล้ว **Redeploy Production** เพื่อให้ Binding และ Secrets ถูกนำไปใช้งาน

## I. เปิดใช้งานครั้งแรก

1. เปิด `https://<your-pages-project>.pages.dev`
2. กด **เข้าสู่ระบบด้วย Google** โดยใช้ Gmail ที่อยู่ใน `ADMIN_EMAILS`
3. หากได้ข้อความ `redirect_uri_mismatch` ให้กลับไปตรวจ Redirect URI, URL และ Protocol `https://` แบบตัวอักษรต่อตัวอักษรใน Google Cloud
4. ใน MyBiz → **Settings → ข้อมูลกิจการ** กรอกชื่อกิจการ ที่อยู่ เลขผู้เสียภาษี และข้อมูลบัญชีรับเงิน
5. ใน **Settings → Users** เชิญอีเมล User; ให้ User ล็อกอิน จากนั้น Admin ไปที่ Project → Team เพิ่มสิทธิ์เข้าโครงการ
6. สร้าง Customer → Project → BOQ → งวดงาน → บันทึกรายจ่าย → เอกสาร → รายการรับ/จ่าย เพื่อเริ่มใช้งาน

## J. เชื่อม Gmail สำหรับ Google Drive (ทำหลัง Login)

1. สร้าง/เตรียม Google Account สำหรับ Storage โดยเฉพาะ (พื้นที่ฟรีสูงสุดปกติ 15 GB แชร์กับ Gmail/Photos)
2. Admin เข้า MyBiz → **Settings → พื้นที่ไฟล์ → เชื่อมต่อ Google Drive**
3. เลือก Gmail ที่เตรียมไว้ อนุญาต Scope ตามหน้าจอของ Google
4. ระบบสร้างโฟลเดอร์หลัก `MyBiz-Construction` ภายใต้ My Drive ของบัญชีนี้
5. เวลาผู้ใช้ที่มีสิทธิ์อัปโหลดรูป/แบบจากหน้า Project → Files จะจัดเก็บลง Folder ของ Project ใน Drive และบันทึก Drive File ID ไว้ใน D1
6. **อย่าแชร์ Root Folder แบบ Anyone with the link**; MyBiz ใช้ Drive API เพื่อดาวน์โหลดโดยตรวจสิทธิ์ฝั่ง Server

หากไม่เชื่อม Drive ระบบยังใช้งานข้อมูลและเอกสารสำคัญบน D1/R2 ได้ แต่การอัปโหลดประเภท `site_photo`, `drawing`, `general` จะยังทำไม่ได้

## K. สำรองข้อมูล

### K1 — ภายใน MyBiz (เหมาะกับการเก็บ Snapshot ขนาดเล็ก)

Settings → Backup → ดาวน์โหลด JSON ตารางธุรกิจจาก D1; การ Export บนเว็บมีเพดาน 10,000 แถวต่อตาราง และ 50,000 แถวรวม ไม่รวม OAuth refresh token, session และ **ไม่รวมไฟล์ R2 / Drive**

### K2 — สำรอง D1 เต็ม

```bash
npx wrangler d1 export mybiz-db --remote --output=./mybiz-db-backup.sql
```

ไฟล์นี้มีข้อมูลธุรกิจจริงและข้อมูลที่อาจอ่อนไหว ให้เข้ารหัสและเก็บแยกจาก GitHub และ Cloudflare

### K3 — สำรองไฟล์แนบ

ใช้เครื่องมือที่ได้รับอนุญาตของ Cloudflare R2 และ Google Drive เพื่อดาวน์โหลด/สำรองข้อมูลที่สำคัญไปยัง Storage อิสระเพิ่มเติม **การ Export D1 ไม่ใช่การสำรอง R2/Drive**

### K4 — การกู้คืน

การ Restore D1 ต้องตรวจสอบ Schema และลำดับการนำเข้ากับสภาพฐานข้อมูลปลายทางก่อน และต้อง Restore ไฟล์ R2/Drive ที่สัมพันธ์กับ attachment IDs เดิม ให้ทดลอง Restore ในสภาพแวดล้อมแยกก่อนใช้กับ Production

## L. ปัญหาที่พบบ่อย

| อาการ | วิธีตรวจ |
|---|---|
| หน้าเว็บขึ้น `ยังไม่ตั้งค่าระบบ` | ตรวจ DB, FILES, Secrets ครบ และ Redeploy |
| Google Login ขึ้น `redirect_uri_mismatch` | ตรวจ URL Callback ทั้ง 2 อันใน Google Cloud |
| Google Login สำเร็จแต่เข้า MyBiz ไม่ได้ | Email ไม่อยู่ใน `ADMIN_EMAILS` หรือยังไม่ได้รับ Invite หรือถูกระงับ |
| เก็บ PDF ไม่สำเร็จ | ตรวจ R2 Binding `FILES` และพื้นที่/สิทธิ์ แล้วกดสร้าง PDF ใหม่จากหน้าเอกสาร |
| อัปโหลดรูป Drive ไม่ได้ | ตรวจว่าเชื่อมบัญชี Storage แล้วและ Drive API/OAuth ยังใช้งานได้ |
| เข้าหน้า Reports/Settings ไม่ได้ | หน้าเหล่านี้เปิดให้ Admin เท่านั้น |
| เพิ่งเปลี่ยน Custom Domain แล้วล็อกอินไม่ผ่าน | แก้ `PUBLIC_BASE_URL`, Google Redirect URIs และ Redeploy |

เอกสารอ้างอิงทางการ:  
Cloudflare Pages Advanced Mode: https://developers.cloudflare.com/pages/functions/advanced-mode/  
Cloudflare Pages Build: https://developers.cloudflare.com/pages/configuration/build-configuration/  
Cloudflare D1 Import/Export: https://developers.cloudflare.com/d1/best-practices/import-export-data/  
Google Drive OAuth Scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
