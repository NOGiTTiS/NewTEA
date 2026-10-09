# 🎓 NewTEA — Triam Evaluation & Assessment
> **ระบบบันทึกผลการเรียนประจำรายวิชาและประเมินผลแบบรวมศูนย์ (Centralized Gradebook & Assessment System)**  
> **โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth)**

---

## 📌 ภาพรวมโครงการ (Project Overview)

ระบบ **Triam Evaluation and Assessment (NewTEA)** ได้รับการพัฒนาขึ้นเพื่อทดแทนกระบวนการเดิมที่ครูผู้สอนต้องทำสำเนา Google Sheets "TEA" แยกตามรายวิชา ซึ่งก่อให้เกิดความกระจัดกระจายของข้อมูล ภาระงานซ้ำซ้อน และความยากลำบากในการตรวจสอบผลการเรียนของฝ่ายวิชาการ

NewTEA รวมศูนย์ข้อมูลนักเรียน รายวิชา คะแนนเก็บ และผลการประเมินทั้งโรงเรียนไว้ในระบบเดียว โดยถูกออกแบบให้รองรับโครงสร้างการจัดการเรียนการสอนจริงของโรงเรียนเตรียมอุดมศึกษาภาคเหนือ:
- **45 ห้องเรียนปกติ:** ชั้น ม.4 – ม.6 รวม 45 ห้อง (ใช้รหัสสัญลักษณ์จุด เช่น `4.1` – `4.15`, `5.1` – `5.15`, `6.1` – `6.15`)
- **กลุ่มภาษาที่ 3 ข้ามห้องเรียน:** ฝรั่งเศส, เยอรมัน, ญี่ปุ่น, เกาหลี, จีน
- **กลุ่มวิชาเลือกเฉพาะห้อง:** เช่น ม.4.13, ม.4.14 (ทัศนศิลป์, ดนตรีไทย, ดนตรีสากล, นาฏศิลป์, ฟุตบอล, วอลเลย์บอล, แบดมินตัน)
- **การเรียนการสอนแบบครูร่วมสอน (Co-teaching):** แบ่งความรับผิดชอบรายห้องชัดเจน (Strict Room Isolation) ป้องกันการกรอกคะแนนทับซ้อน

---

## ✨ คุณสมบัติเด่นของระบบ (Key Features)

### 📊 1. Gradebook Grid เสมือน Spreadsheet (TanStack Table v8)
- แสดงผลแท็บรายห้อง (`4.1`, `4.2`, ...) และแท็บรวมทั้งระดับชั้น
- การนำทางด้วยแป้นพิมพ์อย่างลื่นไหล (Arrow Keys, Tab, Enter เสมือน Microsoft Excel)
- ระบบ Real-time Auto-save เมื่อผู้ใช้หยุดพิมพ์ (Debounced API synchronization)

### ⚙️ 2. Pure Assessment Engine (แม่นยำ 100%)
- **ตัดเกรดมาตรฐาน $0 - 4$** อัตโนมัติตามช่วงคะแนนกระทรวงศึกษาธิการ
- **ตรวจสอบเวลาเรียนอัตโนมัติ:** เวลาเรียนต่ำกว่า 80% ติด **"มส"** ทันที พร้อมอัปเดตเกรดเป็น 0
- **Auto-mapping การประเมิน 3 ด้าน:**
  - คุณลักษณะอันพึงประสงค์ (8 ข้อ)
  - การอ่าน คิดวิเคราะห์ และเขียน (5 ข้อ)
  - สมรรถนะสำคัญของผู้เรียน (5 ด้าน)
- รองรับระบบ **Teacher Override** ให้ครูผู้สอนปรับแก้ผลการประเมินรายคนได้ตามจริง

### 🛡️ 3. Verification & Approval Chain (ระบบตรวจรับรอง 3 ระยะ)
- ตรวจสอบคะแนน 3 ระยะตามเดดไลน์ที่ฝ่ายวิชาการกำหนด (ก่อนกลางภาค, กลางภาค, ปลายภาค)
- **Data Locking:** ล็อกตารางคะแนนเป็น Read-Only ทันทีเมื่อครูส่งตรวจ
- **แดชบอร์ดหัวหน้ากลุ่มสาระฯ (`/dept-head`):** ตรวจรับรอง ("เรียบร้อย") หรือส่งกลับแก้ไข ("แก้ไข") พร้อมบันทึกหมายเหตุ
- **แดชบอร์ดติดตามฝ่ายวิชาการ (`/academic`):** ตรวจสอบสถานะการส่งตรวจทั้งโรงเรียนแบบ Real-time พร้อมระบบพิจารณาคำขอปลดล็อกคะแนน (Unlock Request)

### ⚡ 4. 1-Click Clipboard Integration กับ AutoSGS
- เชื่อมต่อกับเครื่องมือ AutoSGS ใน 1 คลิกผ่าน System Clipboard
- จัดรูปแบบข้อความ Tab-delimited (`\t` และ `\n`) ตรงตามโครงสร้างเว็บ SGS ทั้ง 3 โหมด:
  1. โหมดผลการเรียน (แยกช่วงก่อนกลางภาค+กลางภาค และหลังกลางภาค+ปลายภาค)
  2. โหมดคุณลักษณะอันพึงประสงค์ (8 คอลัมน์)
  3. โหมดการอ่าน คิดวิเคราะห์ และเขียน (5 คอลัมน์)
- เพียงกดปุ่มคัดลอกใน NewTEA แล้วเปิดหน้าเว็บ SGS กดปุ่ม `F2` พิมพ์คะแนนอัตโนมัติทันที

### 📄 5. การส่งออกเอกสาร ปพ.5 ฉบับสมบูรณ์ (PDF Export)
- ส่งออกเล่มเอกสาร ปพ.5 ครบถ้วน 7 องค์ประกอบตามระเบียบ สพฐ.
- ตราโรงเรียนความละเอียดสูง คำอธิบายรายวิชา โครงสร้างรายวิชา
- หน้าสำหรับสอดแทรกรายงานเวลาเรียนจากระบบ Studentcare
- ตารางสรุปคะแนน สถิติการตัดเกรด และช่องลงนามผู้บริหาร 5 ลำดับขั้น

### 🎨 6. Dynamic Branding & 7-Day Auto Theme Engine
- ปรับแต่งข้อมูลสถานศึกษา ชื่อผู้อำนวยการ โลโก้ และ Favicon จากหน้าตั้งค่าระบบ (`/admin/settings`)
- ระบบ **Auto Theme สลับสีตามวัน 7 วัน** ตามวัฒนธรรมไทย (อาทิตย์-เสาร์) พร้อมคำนวณเฉดสี 50–950 แบบไดนามิก ไร้รอยต่อตอนเที่ยงคืน (Midnight Rollover) และ Zero FOUC

### 🔐 7. Better Auth & RBAC
- รองรับ Google Workspace SSO (`@tn.ac.th`) และ Email/Password
- ระบบควบคุมสิทธิ์ 5 บทบาท: `ADMIN`, `TEACHER`, `DEPT_HEAD`, `ACADEMIC`, `ADVISOR`

---

## 🏗️ สถาปัตยกรรมเทคโนโลยี (Tech Stack)

```text
[ ผู้ใช้งาน / คุณครู 100-150 คน ]
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ Cloudflare Tunnel / Local Nginx Proxy (Port 8010)       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Docker Network: tunorth-net                            │
│                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────┐  │
│  │ Frontend: tea-frontend  │  │ Backend: tea-backend│  │
│  │ (Next.js 16 + React 19) │◄─┤ (Go 1.26 + Fiber)   │  │
│  │ Port: 3000 (Bun engine) │  │ Port: 8080 (Air)    │  │
│  └─────────────────────────┘  └──────────┬──────────┘  │
│                                          │ (GORM)      │
│                                          ▼             │
│                               ┌─────────────────────┐  │
│                               │ Database: tea-db    │  │
│                               │ PostgreSQL 17       │  │
│                               │ db: tunorth-tea_db  │  │
│                               └─────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

| เลเยอร์ | เทคโนโลยี | รายละเอียด |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (App Router) + React 19** | TypeScript 5 (Strictly NO Semicolons) |
| **Package Manager** | **Bun 1.3.9** | รวดเร็วและเสถียร (บล็อก npm/npx) |
| **UI Design System** | **Tailwind CSS v4 + Shadcn UI** | Lucide Icons, Sonner Toast, Prompt Font |
| **State & Table Grid** | **Zustand + TanStack Table v8** | Virtualized Grid, Keyboard Navigation, Auto-save |
| **Backend API** | **Go 1.26 + Fiber v2** | High-performance Go REST API, Air Live Reload |
| **Database & ORM** | **PostgreSQL 17 + GORM** | รันบน Docker Container `tea-db`, DB: `tunorth-tea_db` |
| **Authentication** | **Better Auth** | Google SSO (`@tn.ac.th`) + Email/Password |
| **Infrastructure** | **Docker + Ubuntu Server 24.04** | เซิร์ฟเวอร์ On-Premise โรงเรียนเตรียมอุดมศึกษาภาคเหนือ |

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
NewTEA/
├── .env.example                     # ไฟล์แม่แบบตัวแปรสภาพแวดล้อม
├── docker-compose.yml               # Docker Compose สำหรับ Production
├── docker-compose.local.yml         # Docker Compose สำหรับ Local Database Dev
├── README.md                        # เอกสารภาพรวมโครงการ (ไฟล์นี้)
├── gemini.md                        # คู่มือสถาปัตยกรรมและสมองส่วนกลางระบบ
│
├── docs/                            # เอกสารข้อกำหนดและการติดตั้ง
│   ├── spec.md                      # System Requirements Specification & Phase Checklist
│   └── DEPLOYMENT_NEWTEA.md         # คู่มือการติดตั้งและ Deploy บนเซิร์ฟเวอร์
│
├── frontend/                        # แอปพลิเคชันฝั่งหน้าเว็บ (Next.js 16 + Bun)
│   ├── src/
│   │   ├── app/                     # Next.js App Router Pages
│   │   │   ├── page.tsx             # หน้าหลัก Dashboard
│   │   │   ├── login/               # หน้าเข้าสู่ระบบ
│   │   │   ├── courses/             # หน้ารายวิชา และสมุดเกรด (/courses/[id])
│   │   │   │   └── [id]/pp5/        # หน้าพิมพ์เล่ม ปพ.5 PDF ฉบับสมบูรณ์
│   │   │   ├── advisor/             # แดชบอร์ดครูที่ปรึกษา
│   │   │   ├── dept-head/           # แดชบอร์ดตรวจรับรองหัวหน้ากลุ่มสาระฯ
│   │   │   ├── academic/            # แดชบอร์ดติดตามฝ่ายวิชาการ
│   │   │   └── admin/               # เมนูผู้ดูแลระบบ (users, students, advisors, terms, rooms, settings)
│   │   ├── components/              # คอมโพเนนต์ UI (DashboardShell, Sidebar, Pagination, etc.)
│   │   └── lib/                     # โมดูลคำนวณและ API (Calculation Engine, Better Auth, Branding)
│   ├── package.json
│   └── next.config.ts
│
└── backend/                         # เซิร์ฟเวอร์ API (Go Fiber + GORM)
    ├── cmd/api/main.go              # จุดเริ่มต้น API Server, CORS, Router
    ├── internal/
    │   ├── config/                  # โหลด Environment Variables
    │   ├── database/                # เชื่อมต่อ PostgreSQL, Auto-migrate, Seed 45 ห้อง
    │   ├── handlers/                # REST Handlers (users, students, courses, settings, etc.)
    │   ├── middleware/              # RBAC & Authentication Middleware
    │   ├── models/                  # GORM Models ครบทุก Entity
    │   └── services/                # Business Logic (User Import, Student Import, etc.)
    └── go.mod
```

---

## 🚀 เริ่มต้นพัฒนาบนเครื่อง Local (Local Development)

### 1. โคลน Repository และสร้างไฟล์ `.env`
```bash
git clone https://github.com/NOGiTTiS/NewTEA.git
cd NewTEA
cp .env.example .env
```

### 2. รันฐานข้อมูล PostgreSQL บน Docker
```bash
docker compose -f docker-compose.local.yml up -d
```

### 3. รัน Backend API (Go Fiber)
```bash
cd backend
go run cmd/api/main.go
# หรือรันผ่าน Air เพื่อรองรับ Live Reload:
# air
```
*API ทำงานที่: `http://localhost:8080`*

### 4. รัน Frontend (Next.js 16 + Bun)
```bash
cd frontend
bun install
bun run dev
```
*เปิดเบราว์เซอร์ที่: `http://localhost:3000`*

### 5. บัญชีผู้ดูแลระบบตั้งต้น (Initial Admin Account)
เมื่อระบบเริ่มทำงานครั้งแรก จะมีบัญชี Admin มาตรฐาน:
- **Email:** `admin@tn.ac.th`
- **Password:** `Admin@2026`

---

## 🧪 การรันชุดทดสอบ (Running Tests)

```bash
# ทดสอบโมดูลคำนวณและฟังก์ชันฝั่ง Frontend (79 Tests Pass 100%)
cd frontend
bun test

# ทดสอบ Backend Go API
cd backend
go test ./...
```

---

## 📜 ข้อกำหนดในการพัฒนา (Coding Standards)

- **Strict No Semicolons:** ไฟล์ `.ts`, `.tsx`, `.js` ทุกไฟล์ห้ามใส่เครื่องหมาย `;` ท้ายบรรทัดเด็ดขาด (`semi: false`)
- **Design Tokens:** ห้าม Hardcode Hex Color ในคลาส ให้ใช้ Tailwind Theme Tokens จาก `@theme` เสมอ
- **Typography:** ใช้ฟอนต์ **Prompt** สำหรับภาษาไทย/UI และฟอนต์ **Inter** สำหรับตัวเลข/ภาษาอังกฤษ
- **Package Manager:** ฝั่ง Frontend บังคับใช้ **Bun** เท่านั้น (ห้ามใช้ npm/npx)

---

## 🏫 โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth)
- **เว็บไซต์สถานศึกษา:** https://tn.ac.th
- **ที่อยู่:** 99 หมู่ 3 ตำบลหัวรอ อำเภอเมือง จังหวัดพิษณุโลก 65000
- **ผู้พัฒนา:** DevOps & Software Architecture Team, TUNorth
