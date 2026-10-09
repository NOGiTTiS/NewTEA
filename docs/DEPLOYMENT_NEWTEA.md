# 📘 คู่มือขั้นตอนการติดตั้งและ Deploy เฉพาะระบบ NewTEA (Dedicated Deployment SOP)
> **ระบบบันทึกผลการเรียนประจำรายวิชา (Triam Evaluation and Assessment : NewTEA)**  
> **โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth)**  
> *เอกสารคู่มือมาตรฐานการปฏิบัติงาน (Standard Operating Procedure - SOP)*

---

## 📑 สารบัญ
1. [สถาปัตยกรรมและข้อมูลระบบ (Architecture Specifications)](#1-สถาปัตยกรรมและข้อมูลระบบ-architecture-specifications)
2. [สิ่งที่ต้องเตรียมความพร้อมก่อน Deploy (Prerequisites & Pre-flight Checklist)](#2-สิ่งที่ต้องเตรียมความพร้อมก่อน-deploy-prerequisites--pre-flight-checklist)
3. [ขั้นตอนการ Deploy ครั้งแรก (Initial Deployment Guide)](#3-ขั้นตอนการ-deploy-ครั้งแรก-initial-deployment-guide)
   - [ทางเลือกที่ 1: สั่งรันอัตโนมัติแบบคำสั่งเดียว (Recommended 1-Click)](#ทางเลือกที่-1-สั่งรันอัตโนมัติแบบคำสั่งเดียว-recommended-1-click)
   - [ทางเลือกที่ 2: สั่งรันทีละขั้นตอน (Step-by-Step Manual)](#ทางเลือกที่-2-สั่งรันทีละขั้นตอน-step-by-step-manual)
4. [การเริ่มต้นใช้งานและบัญชีผู้ดูแลระบบ (First-Time Access & Superadmin)](#4-การเริ่มต้นใช้งานและบัญชีผู้ดูแลระบบ-first-time-access--superadmin)
5. [การตั้งค่า Ingress (Cloudflare Tunnel & Local LAN Access)](#5-การตั้งค่า-ingress-cloudflare-tunnel--local-lan-access)
6. [ขั้นตอนการ Re-deploy เมื่อมีการอัปเดตโค้ด (Updating & Re-deployment)](#6-ขั้นตอนการ-re-deploy-เมื่อมีการอัปเดตโค้ด-updating--re-deployment)
7. [การสำรองและกู้คืนฐานข้อมูลเฉพาะ NewTEA (Backup & Recovery SOP)](#7-การสำรองและกู้คืนฐานข้อมูลเฉพาะ-newtea-backup--recovery-sop)
8. [การตรวจสอบสถานะและแก้ไขปัญหาที่พบบ่อย (Troubleshooting & FAQs)](#8-การตรวจสอบสถานะและแก้ไขปัญหาที่พบบ่อย-troubleshooting--faqs)

---

## 1. สถาปัตยกรรมและข้อมูลระบบ (Architecture Specifications)

ระบบ NewTEA ทำงานอยู่บนเซิร์ฟเวอร์หลักของโรงเรียน ร่วมกับระบบอื่นๆ โดยมีการแยกฐานข้อมูลและคอนเทนเนอร์เป็นเอกเทศ:

```text
[ Internet (ภายนอก) ]                         [ LAN School (ภายในโรงเรียน) ]
         │                                                    │
         ▼                                                    ▼
┌───────────────────────────┐                       ┌───────────────────────────┐
│ Cloudflare Tunnel         │                       │ Nginx Reverse Proxy       │
│ Domain: tea.tn.ac.th      │                       │ Port: 8010                │
└─────────────┬─────────────┘                       └─────────────┬─────────────┘
              │                                                   │
              └─────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ Docker Network: tunorth-net                             │
       │                                                         │
       │   ┌──────────────────────┐    ┌──────────────────────┐  │
       │   │ tea-frontend         │    │ tea-backend          │  │
       │   │ Next.js 16 + Bun     │◄──►│ Go 1.26 + Fiber      │  │
       │   │ Port: 3000           │    │ Port: 8080           │  │
       │   └──────────────────────┘    └──────────┬───────────┘  │
       │                                          │ (GORM)       │
       │                                          ▼              │
       │                               ┌──────────────────────┐  │
       │                               │ tea-db               │  │
       │                               │ PostgreSQL 17 Alpine │  │
       │                               │ Port: 5432 (Internal)│  │
       │                               └──────────────────────┘  │
       └─────────────────────────────────────────────────────────┘
```

### ข้อมูลคอนฟิกพื้นฐาน (Configuration Matrix):

| รายการ | รายละเอียด | หมายเหตุ |
| :--- | :--- | :--- |
| **เครื่องเซิร์ฟเวอร์ (Host)** | HP ProLiant ML350 G6 (Ubuntu Server 24.04 LTS) | IP LAN: `192.168.165.11` |
| **Docker Network** | `tunorth-net` | เครือข่ายบริดจ์กลางของโรงเรียน |
| **URL ภายในโรงเรียน (LAN)** | `http://192.168.165.11:8010` | ใช้งานได้แม้ไม่มีอินเทอร์เน็ตภายนอก |
| **URL ภายนอก (Internet)** | `https://tea.tn.ac.th` | ผ่าน Cloudflare Tunnel (SSL อัตโนมัติ) |
| **คอนเทนเนอร์ฐานข้อมูล** | `tea-db` (Postgres 17-alpine) | จัดการผ่าน `~/TUNorth/infra` |
| **ชื่อฐานข้อมูล (DB Name)** | `tunorth-tea_db` | ผู้ใช้: `tea_user`, รหัสผ่าน: `tea_password` |
| **คอนเทนเนอร์ Backend** | `tea-backend` (Go Fiber v2) | พอร์ตภายใน: `8080` |
| **คอนเทนเนอร์ Frontend** | `tea-frontend` (Next.js 16 Bun Standalone) | พอร์ตภายใน: `3000` |
| **โฟลเดอร์เก็บข้อมูลถาวร** | `~/TUNorth/data/postgres/tea`<br>`~/TUNorth/data/uploads/tea` | เก็บข้อมูล DB และไฟล์แนบหลักสูตร |

---

## 2. สิ่งที่ต้องเตรียมความพร้อมก่อน Deploy (Prerequisites & Pre-flight Checklist)

ก่อนเริ่มรันคำสั่ง ให้เปิด Terminal บนเซิร์ฟเวอร์ Ubuntu Server (`192.168.165.11`) และตรวจสอบความพร้อมดังนี้:

```bash
# 1. ตรวจสอบว่ามี Docker และ Docker Compose พร้อมใช้งาน
docker --version
docker compose version

# 2. ตรวจสอบว่าเครือข่าย tunorth-net ถูกสร้างไว้แล้วหรือไม่
docker network inspect tunorth-net >/dev/null 2>&1 && echo "✅ Network tunorth-net พร้อม" || docker network create tunorth-net

# 3. ตรวจสอบตำแหน่งโฟลเดอร์โปรเจกต์
cd ~/TUNorth/apps/NewTEA && pwd
```

---

## 3. ขั้นตอนการ Deploy ครั้งแรก (Initial Deployment Guide)

### ทางเลือกที่ 1: สั่งรันอัตโนมัติแบบคำสั่งเดียว (Recommended 1-Click)
ทีมพัฒนาระบบได้จัดทำสคริปต์อัตโนมัติ `deploy_newtea.sh` ไว้ที่รากของโปรเจกต์โรงเรียน คุณสามารถสั่งรันเพียงคำสั่งเดียว ระบบจะเตรียมโฟลเดอร์ เปิดฐานข้อมูล และบิลด์คอนเทนเนอร์ให้ครบวงจร:

```bash
cd ~/TUNorth
chmod +x ./scripts/deploy_newtea.sh
./scripts/deploy_newtea.sh
```

---

### ทางเลือกที่ 2: สั่งรันทีละขั้นตอน (Step-by-Step Manual)
หากต้องการตรวจสอบขั้นตอนอย่างละเอียด หรือแก้ไขปัญหาเฉพาะจุด ให้ปฏิบัติตาม 5 ขั้นตอนดังนี้:

#### ขั้นตอนที่ 1: สร้างโฟลเดอร์เก็บข้อมูลถาวรและกำหนดสิทธิ์
```bash
# สร้างโฟลเดอร์สำหรับ Database Volume และไฟล์อัปโหลด
mkdir -p ~/TUNorth/data/postgres/tea
mkdir -p ~/TUNorth/data/uploads/tea
chmod -R 777 ~/TUNorth/data/postgres/tea ~/TUNorth/data/uploads/tea
```

#### ขั้นตอนที่ 2: เปิดใช้งานคอนเทนเนอร์ฐานข้อมูล (`tea-db`) และ Proxy (`local-nginx`)
ระบบฐานข้อมูลถูกควบคุมผ่าน `infra/docker-compose.yml`:
```bash
cd ~/TUNorth/infra
docker compose up -d tea-db nginx
```

#### ขั้นตอนที่ 3: ตรวจสอบความพร้อมของฐานข้อมูล (Healthcheck)
รอประมาณ 3–5 วินาที แล้วทดสอบการตอบสนองของ PostgreSQL:
```bash
docker exec -it tea-db pg_isready -U tea_user -d tunorth-tea_db
```
*ผลลัพธ์ที่ถูกต้อง:* `tunorth-tea_db:5432 - accepting connections`

#### ขั้นตอนที่ 4: สั่ง Build และเริ่มต้น Frontend & Backend ของ NewTEA
```bash
cd ~/TUNorth/apps/NewTEA
docker compose up -d --build
```

#### ขั้นตอนที่ 5: ตรวจสอบสถานะการทำงานของคอนเทนเนอร์ทั้งหมด
```bash
docker ps --filter "name=tea" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
*ผลลัพธ์ที่ถูกต้อง:* ควรเห็นคอนเทนเนอร์ 3 ตัวสถานะเป็น `Up`:
- `tea-db` (healthy)
- `tea-backend` (healthy)
- `tea-frontend` (Up)

---

## 4. การเริ่มต้นใช้งานและบัญชีผู้ดูแลระบบ (First-Time Access & Superadmin)

เมื่อรันระบบเป็นครั้งแรกบนฐานข้อมูลที่ว่างเปล่า (Fresh DB):
1. **Auto-Migration:** Go Backend จะสร้างตารางในฐานข้อมูลทั้ง 18 ตารางให้อัตโนมัติ
2. **Initial Seeding:** ระบบจะลงข้อมูลพื้นฐานให้อัตโนมัติ:
   - บัญชีห้องเรียนปกติ 45 ห้อง (`4.1` - `6.15`)
   - เกณฑ์การประเมิน 3 ด้านและข้อมูลสถานศึกษา
   - **บัญชีผู้ดูแลระบบคนแรก (Superadmin):**
     - **อีเมล:** `admin@tn.ac.th`
     - **รหัสผ่านเริ่มต้น:** `Admin@2026`
     - **สิทธิ์:** `ADMIN` (เข้ารหัส Scrypt ตามมาตรฐาน Better Auth)

### การเข้าสู่ระบบ:
- **ช่องทางภายในโรงเรียน (LAN):** เปิดเว็บเบราว์เซอร์ไปที่ `http://192.168.165.11:8010/login`
- **ช่องทางอินเทอร์เน็ต:** เปิดเว็บเบราว์เซอร์ไปที่ `https://tea.tn.ac.th/login`
- กรอกอีเมล `admin@tn.ac.th` และรหัสผ่าน `Admin@2026` เพื่อเริ่มต้นใช้งาน

> [!WARNING]
> เพื่อความปลอดภัยของข้อมูลเกรดและผลการเรียนทั้งโรงเรียน **กรุณาเปลี่ยนรหัสผ่านของบัญชี admin ทันทีหลังล็อกอินครั้งแรก** โดยไปที่เมนู **"จัดการผู้ใช้" (`/admin/users`)** แล้วกดปุ่ม "รีเซ็ตรหัสผ่าน"

---

## 5. การตั้งค่า Ingress (Cloudflare Tunnel & Local LAN Access)

### 5.1 การเข้าใช้งานผ่านเครือข่ายภายในโรงเรียน (School LAN Access)
Nginx Reverse Proxy ของโรงเรียน (`local-nginx`) ถูกตั้งค่าไว้ที่พอร์ต `8010` เรียบร้อยแล้วใน `infra/nginx/nginx.conf`:
- `/` ➔ ส่งต่อไปยัง `http://tea-frontend:3000`
- `/api/` ➔ ส่งต่อไปยัง `http://tea-backend:8080/api/`
- `/uploads/` ➔ ส่งต่อไปยัง `http://tea-backend:8080/uploads/`

คุณครูสามารถเข้าใช้งานผ่านหน้า Portal กลางของโรงเรียนได้โดยตรงที่:
👉 **`http://192.168.165.11`** ➔ คลิกเมนู **"10. NewTEA (สมุดบันทึกผลการเรียน/ปพ.5)"**

### 5.2 การตั้งค่า Cloudflare Tunnel (Internet Access: `tea.tn.ac.th`)
หากต้องการให้ครูสามารถกรอกคะแนนและพิมพ์ ปพ.5 จากที่บ้านผ่านโดเมน `https://tea.tn.ac.th`:

1. เข้าเว็บเบราว์เซอร์ไปยัง [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. ไปที่เมนู **Networks** ➔ **Tunnels** ➔ เลือก Tunnel ชื่อ **`TUNorth-Server`**
3. คลิกแท็บ **Public Hostname** แล้วกดปุ่ม **+ Add a public hostname**:
   - **Subdomain:** `tea`
   - **Domain:** `tn.ac.th`
   - **Service Type:** `HTTP`
   - **URL:** `tea-frontend:3000` (หรือ `local-nginx:8010`)
4. กด **Save hostname**
5. ระบบ Cloudflare จะสร้าง SSL Certificate (HTTPS) และเปิดให้เข้าใช้งานผ่าน `https://tea.tn.ac.th` ทันทีภายใน 1 นาที

---

## 6. ขั้นตอนการ Re-deploy เมื่อมีการอัปเดตโค้ด (Updating & Re-deployment)

หากโปรแกรมเมอร์มีการแก้ไขปรับปรุงโค้ด และส่งขึ้นเซิร์ฟเวอร์ คุณสามารถสั่ง Re-deploy ได้อย่างรวดเร็วโดยไม่กระทบฐานข้อมูล:

### แบบที่ 1: Re-deploy เฉพาะ Frontend (แก้งานหน้าเว็บ, UI, รายงาน ปพ.5)
```bash
cd ~/TUNorth/apps/NewTEA
docker compose up -d --build tea-frontend
```
*(ใช้เวลาประมาณ 1–2 นาที โดย Backend และ Database ยังคงทำงานต่อเนื่อง)*

### แบบที่ 2: Re-deploy เฉพาะ Backend (แก้งานคำนวณ, API, การส่งตรวจ)
```bash
cd ~/TUNorth/apps/NewTEA
docker compose up -d --build tea-backend
```
*(ใช้เวลาประมาณ 15–30 วินาที)*

### แบบที่ 3: Re-deploy ทั้งระบบ NewTEA ในคำสั่งเดียว
```bash
cd ~/TUNorth
./scripts/deploy_newtea.sh
```

---

## 7. การสำรองและกู้คืนฐานข้อมูลเฉพาะ NewTEA (Backup & Recovery SOP)

### 7.1 การสั่งสำรองข้อมูลด้วยตนเองทันที (Manual Database Backup)
ระบบมีสคริปต์สำรองข้อมูลกลางที่รวม `tea-db` ไว้แล้ว:
```bash
cd ~/TUNorth
./scripts/backup.sh
```
ไฟล์สำรองจะถูกบันทึกไว้ที่:  
`~/TUNorth/backups/YYYY-MM-DD_HHMM/databases/tea-db_tunorth-tea_db_*.sql`

หรือหากต้องการ Dump เฉพาะฐานข้อมูล NewTEA อย่างรวดเร็ว:
```bash
docker exec tea-db pg_dump -U tea_user tunorth-tea_db > ~/TUNorth/backups/tea_dump_$(date +%Y%m%d_%H%M%S).sql
```

*(ระบบเซิร์ฟเวอร์โรงเรียนมีการตั้ง CronJob สำรองข้อมูลอัตโนมัติทุกวันในเวลา 02:00 น.)*

### 7.2 การกู้คืนฐานข้อมูลเฉพาะ NewTEA (Smart Recovery)
หากเกิดเหตุฉุกเฉินและต้องการย้อนข้อมูล NewTEA กลับไปใช้ไฟล์สำรองล่าสุด:

```bash
cd ~/TUNorth
# กู้คืนเฉพาะระบบ tea จากชุดสำรองล่าสุด
./scripts/restore_db.sh latest tea
```
*ระบบจะหยุด `tea-backend` ชั่วคราว ล้างสกีมาเดิม นำเข้าข้อมูล `.sql` และสั่งเริ่มระบบใหม่อัตโนมัติ พร้อมแสดงสรุปจำนวนระเบียน (Users, Students, Courses)*

---

## 8. การตรวจสอบสถานะและแก้ไขปัญหาที่พบบ่อย (Troubleshooting & FAQs)

### ❓ ปัญหาที่ 1: ตรวจสอบ Logs การทำงานของเซิร์ฟเวอร์อย่างไร?
```bash
# ดู Log ของ Backend แบบ Real-time
docker logs -f tea-backend

# ดู Log ของ Frontend แบบ Real-time
docker logs -f tea-frontend

# ดู Log ของ Database
docker logs -f tea-db
```

### ❓ ปัญหาที่ 2: Backend ขึ้น error `failed to connect to database`
- **สาเหตุ:** `tea-db` ยังไม่พร้อมทำงาน หรือยังไม่ได้เปิดคอนเทนเนอร์ฐานข้อมูล
- **วิธีแก้ไข:**
  ```bash
  cd ~/TUNorth/infra && docker compose up -d tea-db
  docker restart tea-backend
  ```

### ❓ ปัญหาที่ 3: เกิดข้อผิดพลาด `Conflict. The container name "/tea-db" is already in use`
- **สาเหตุ:** มีการรันคำสั่ง Docker Compose ในโฟลเดอร์อื่นที่ใช้ชื่อ `tea-db` ซ้ำ
- **วิธีแก้ไข:**
  - ไฟล์ `apps/NewTEA/docker-compose.yml` เวอร์ชันล่าสุดถูกปรับให้ใช้ `tea-db` จาก `infra` เท่านั้นแล้ว
  - ให้รันคำสั่ง: `cd ~/TUNorth/apps/NewTEA && docker compose up -d`

### ❓ ปัญหาที่ 4: ล็อกอินผ่าน LAN IP `192.168.165.11:8010` แล้วคุกกี้หลุด
- **สาเหตุ:** โดเมนและ Origin ไม่ตรงกัน
- **วิธีแก้ไข:** ระบบในเวอร์ชันปัจจุบันได้เปิด `trustedOrigins` ครอบคลุมทั้ง `http://192.168.165.11:8010` และ `https://tea.tn.ac.th` ไว้เรียบร้อยแล้ว หากยังพบปัญหาให้ตรวจสอบว่าเข้าใช้งานผ่านพอร์ต `8010` หรือไม่

### ❓ ปัญหาที่ 5: ลืมรหัสผ่าน Admin และต้องการรีเซ็ตฉุกเฉินผ่าน Terminal
รันคำสั่ง SQL ตรงเข้าสู่ฐานข้อมูล:
```bash
docker exec -it tea-db psql -U tea_user -d tunorth-tea_db -c "UPDATE \"user\" SET role = 'ADMIN' WHERE email = 'admin@tn.ac.th';"
```
หรือรันสคริปต์รีเซ็ตรหัสผ่านของ Better Auth:
```bash
docker exec -it tea-frontend bun run src/scripts/seed-admin.ts
```

---
*จัดทำและตรวจสอบความถูกต้องโดย: ทีมวิศวกรรมสถาปัตยกรรมระบบ NewTEA (TUNorth DevOps Team)*
