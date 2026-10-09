# NewTEA System — Brain & Project Context (gemini.md)
> **สมองส่วนกลางและคู่มือสถาปัตยกรรมสำหรับ AI และนักพัฒนา: Triam Evaluation and Assessment (NewTEA)**
> **โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth)**

---

## 1. ข้อมูลและบริบทของระบบ (System Identity & Domain Knowledge)

### 1.1 วัตถุประสงค์ของโครงการ
ระบบ **Triam Evaluation and Assessment (NewTEA)** พัฒนาขึ้นเพื่อเป็น **Centralized Gradebook & Assessment Web Application (ระบบบันทึกผลการเรียนประจำรายวิชาแบบรวมศูนย์)** สำหรับโรงเรียนเตรียมอุดมศึกษาภาคเหนือ เพื่อทดแทนการทำงานเดิมที่ครูต้องก๊อปปี้ Google Sheets "TEA" แยกรายวิชา โดยมีเป้าหมายหลักคือ:
1. รวมศูนย์ฐานข้อมูลนักเรียน ข้อมูลวิชา คะแนนเก็บ และผลการประเมินทั้งโรงเรียนไว้ในฐานข้อมูลกลาง (PostgreSQL 17)
2. จัดการห้องเรียนปกติ ม.4 - ม.6 รวม 45 ห้อง (ใช้สัญลักษณ์จุด เช่น `4.1` - `4.15`, `5.1` - `5.15`, `6.1` - `6.15`), กลุ่มภาษาที่ 3 (เกาหลี, ฝรั่งเศส, ญี่ปุ่น, จีน), และกลุ่มวิชาเลือกเฉพาะห้อง (เช่น 13, 14: ทัศนศิลป์, ดนตรีไทย, ดนตรีสากล, นาฏศิลป์, ฟุตบอล, วอลเลย์บอล, แบดมินตัน)
3. รองรับการเรียนการสอนแบบครู 1 คนต่อวิชา, ครูหลายคนร่วมสอน 1 วิชา (Co-teaching), และการแบ่งห้องสอนในรหัสวิชาเดียวกัน
4. ออกแบบหน้าบันทึกคะแนนเป็น **แท็บรายห้อง (Classroom Tabs)** แบบ Spreadsheet Grid (TanStack Table v8) รองรับ Keyboard Navigation (Tab/Enter) เสมือนโปรแกรม Excel พร้อมระบบ Real-time Auto-save
5. คำนวณเวลาเรียน (ต่ำกว่า 80% ติด **"มส"** อัตโนมัติ), ตัดเกรดมาตรฐาน 0 - 4, รองรับ ร, มส, ผ, มผ, และ **Auto-map ผลประเมิน 3 ด้าน** (คุณลักษณะอันพึงประสงค์, การอ่านคิดวิเคราะห์และเขียน, สมรรถนะสำคัญ) พร้อมเปิดให้ครูผู้สอนปรับแก้ (Override) ได้
6. สร้าง Workflow ตรวจสอบและล็อกคะแนน 3 ระยะ (ก่อนกลางภาค, กลางภาค, หลังกลางภาค/ปลายภาค) ตามกำหนดการของฝ่ายวิชาการ โดยหัวหน้ากลุ่มสาระฯ และฝ่ายวิชาการสามารถตรวจรับรอง ("เรียบร้อย") หรือส่งกลับให้แก้ไข ("แก้ไข") พร้อมระบุหมายเหตุ
7. เชื่อมต่อกับเครื่องมือ **AutoSGS** (`D:\TUNorth\apps\sgs`) แบบ 1-Click ผ่าน System Clipboard (คัดลอกข้อมูล 3 โหมด: ผลการเรียน, คุณลักษณะ 8 คอลัมน์, การอ่านฯ 6 คอลัมน์) เพื่อให้ครูเปิดเว็บ SGS แล้วกดปุ่ม `F2` พิมพ์คะแนนอัตโนมัติได้ทันที
8. ส่งออกเล่มเอกสาร ปพ.5 ฉบับสมบูรณ์ 7 องค์ประกอบ (พร้อมหน้าว่างสำหรับสอดแทรกรายงานเวลาเรียนจากระบบ Studentcare) ในรูปแบบ PDF คมชัดพร้อมสั่งพิมพ์

---

## 2. กฎเหล็กในการพัฒนา (Strict Coding & Architectural Rules)

> [!IMPORTANT]
> ### 🚨 กฎข้อที่ 1: ห้ามใส่ Semicolon ใน TypeScript/JavaScript ทุกไฟล์
> - ทุกไฟล์ `.ts`, `.tsx`, `.js`, `.mjs` ในโปรเจกต์ต้องปฏิบัติตามกฎ `semi: false` อย่างเคร่งครัด **ห้ามมีเครื่องหมาย `;` ท้ายบรรทัดเด็ดขาด**
> - ตรวจสอบความถูกต้องก่อน commit หรือส่งมอบงานเสมอ

> [!IMPORTANT]
> ### 🎨 กฎข้อที่ 2: ห้าม Hardcode Hex Color ในคอมโพเนนต์ UI ทุกชิ้น
> - ต้องใช้ Design Tokens จากธีม `@design` (อ้างอิง `design/gemini-code-1786583759173.html`)
> - **สีหลัก Brand Purple:** `brand-50` ถึง `brand-950` โดยมีสีหลัก `#5f06c4` (ใช้คลาส Tailwind เช่น `bg-brand-500`, `hover:bg-brand-600`, `text-brand-600`, `border-brand-500` เป็นต้น)
> - **สี Semantic Tokens:** `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `bg-muted`
> - ห้ามเขียน `#5f06c4`, `#ffffff`, `#000000` หรือรหัส Hex อื่นๆ ลงใน class inline หรือ style เด็ดขาด

> [!IMPORTANT]
> ### 🔤 กฎข้อที่ 3: ใช้ฟอนต์ Prompt เป็นฟอนต์หลัก
> - ฟอนต์ภาษาไทยและ UI หลัก: Google Font **Prompt**
> - ฟอนต์ตัวเลขและภาษาอังกฤษ: Google Font **Inter**

> [!IMPORTANT]
> ### 🌓 กฎข้อที่ 4: รองรับ Dark / Light Mode และ Responsive สมบูรณ์
> - รองรับการสลับธีม 3 รูปแบบ: Light Mode, Dark Mode, และ System Mode ผ่าน `next-themes`
> - ออกแบบคอมโพเนนต์ให้แสดงผลสวยงามและใช้งานได้จริงบนทุกขนาดหน้าจอ: PC, Tablet, และ Mobile

> [!IMPORTANT]
> ### ⚡ กฎข้อที่ 5: ใช้ Bun เท่านั้นฝั่ง Frontend (บล็อก npm และ npx อย่างเด็ดขาด)
> - ห้ามใช้ `npm` หรือ `npx` ในโปรเจกต์ NewTEA โดยมีระบบตรวจสอบใน `preinstall` สคริปต์
> - ติดตั้งแพ็กเกจด้วย `bun add`
> - รันคำสั่งด้วย `bun run`

> [!IMPORTANT]
> ### 📋 กฎข้อที่ 6: ตรวจสอบและอัปเดต Checklist เสมอ
> - หลังทำแต่ละขั้นตอนย่อยเสร็จ ให้ทำเครื่องหมาย `- [x]` ใน [docs/spec.md](file:///D:/TUNorth/apps/NewTEA/docs/spec.md)
> - หลังทำเสร็จทั้ง Phase ให้หยุดและรายงานรายละเอียดการทดสอบให้ผู้ใช้ตรวจสอบก่อนไป Phase ถัดไป

> [!IMPORTANT]
> ### 🤖 กฎข้อที่ 7: 1-Click Clipboard Integration กับ AutoSGS
> - ตารางคะแนนและการประเมินต้องจัดรูปแบบข้อความ Tab-delimited (`\t` และ `\n`) ให้ตรงตามโครงสร้างของโปรแกรม `D:\TUNorth\apps\sgs` ทั้ง 3 โหมด เพื่อให้กดปุ่ม Copy แล้วกด `F2` บน SGS ได้ทันที

---

## 3. สถาปัตยกรรมและเทคโนโลยีที่ใช้ (Tech Stack & Infrastructure)

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

| เลเยอร์ | เทคโนโลยี | รายละเอียดและคอนฟิก |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (App Router) + React 19** | TypeScript 5 (Strictly NO Semicolons) |
| **Package Manager** | **Bun 1.3.9** | ห้ามใช้ npm/npx ในการติดตั้งหรือรันคำสั่ง |
| **UI Design System** | **Tailwind CSS v4 + Shadcn UI (Radix)** | Lucide Icons, Sonner (Toast), Design Tokens Brand `#5f06c4` |
| **Theme & Typography** | **next-themes + Prompt Font** | Light / Dark / System Mode Toggle (Prompt หลัก, Inter ตัวเลข/Eng) |
| **State & Table Engine** | **Zustand + TanStack Table v8** | Virtualized Grid, Tab Navigation รายห้อง, Auto-save |
| **Backend API** | **Go 1.26 + Fiber v2** | High-performance Go REST API, Air Live Reload |
| **Database & ORM** | **PostgreSQL 17 + GORM** | รันบน Docker Container `tea-db` (`newtea-postgres`), DB `tunorth-tea_db` |
| **Authentication** | **Better Auth** | Google Workspace SSO (`@tn.ac.th`) และ Username/Password (Scrypt Hash) |
| **Server & Deployment** | **Docker + Ubuntu 24.04 LTS** | Server On-Premise ของโรงเรียน พอร์ต 8010, เน็ตเวิร์ก `tunorth-net` |
| **Source Code Repository** | **GitHub (Git)** | [https://github.com/NOGiTTiS/NewTEA](https://github.com/NOGiTTiS/NewTEA) |

---

## 4. โครงสร้างโปรเจกต์ (Project Structure)

```text
D:\TUNorth\apps\NewTEA\
├── .env                             # ค่าตัวแปรสภาพแวดล้อม (DB, Ports, Better Auth)
├── .env.example                     # ตัวอย่างค่าตัวแปรสภาพแวดล้อมสำหรับ Production / Deployment
├── .gitignore                       # ละเว้นโฟลเดอร์ node_modules, .next, tmp, .env จาก Git
├── docker-compose.yml               # PostgreSQL 17 Container บนเครือข่าย tunorth-net
├── gemini.md                        # สมองส่วนกลางและคู่มือสถาปัตยกรรม (ไฟล์นี้)
├── README.md                        # เอกสารภาพรวมโครงการ คู่มือเริ่มต้นใช้งาน และสถาปัตยกรรม
│
├── docs\                            # เอกสารโครงการ
│   ├── spec.md                      # ข้อกำหนดความต้องการ (SRS) + Acceptance Criteria + Phase Checklist
│   ├── tea_requirements_and_architecture_plan.md # แผนสถาปัตยกรรมและผลการสัมภาษณ์ความต้องการ
│   ├── user_manual.md               # คู่มือการใช้งานสำหรับครูผู้สอน
│   └── admin_manual.md              # คู่มือการใช้งานสำหรับผู้ดูแลระบบและฝ่ายวิชาการ
│
├── frontend\                        # Frontend App (Next.js 16 + Bun)
│   ├── package.json                 # กำหนด Bun เป็น packageManager + ล็อก npm
│   ├── tsconfig.json                # TypeScript Config (No semicolons rule)
│   ├── next.config.ts               # Next.js 16 Configuration (Reverse Proxy /api rewrites)
│   ├── postcss.config.mjs           # Tailwind CSS PostCSS Config
│   ├── Dockerfile                   # Bun Multi-stage build (Standalone, ARG BACKEND_INTERNAL_URL)
│   ├── .dockerignore                # ละเว้นไฟล์ที่ไม่จำเป็นสำหรับการ build container
│   ├── .env.local                   # Turbopack Local Environment sync
│   └── src\
│       ├── app\
│       │   ├── globals.css          # Tailwind CSS v4 Theme Tokens (@theme, Brand ม่วง, Light/Dark)
│       │   ├── layout.tsx           # Root Layout (ฟอนต์ Prompt, ThemeProvider, Sonner Toaster)
│       │   ├── page.tsx             # หน้าหลัก Dashboard ภาพรวมระบบ
│       │   ├── icon.svg             # ระบบไอคอนหลัก NewTEA
│       │   ├── login\page.tsx       # หน้าเข้าสู่ระบบ (Google SSO @tn.ac.th + Email/Password)
│       │   ├── courses\             # หน้ารายวิชา (/courses) และสมุดเกรด (/courses/[id], /courses/[id]/pp5)
│       │   ├── advisor\page.tsx     # แดชบอร์ดเฉพาะสำหรับครูที่ปรึกษาประจำห้อง
│       │   ├── dept-head\page.tsx   # แดชบอร์ดหัวหน้ากลุ่มสาระการเรียนรู้ ตรวจรับรอง/ส่งกลับ
│       │   ├── academic\page.tsx    # แดชบอร์ดภาพรวมฝ่ายวิชาการ (TEA68 Grid)
│       │   ├── admin\
│       │   │   ├── users\page.tsx   # จัดการผู้ใช้และกำหนดสิทธิ์ RBAC + Import User Excel/CSV
│       │   │   ├── students\page.tsx# จัดการข้อมูลนักเรียน 45 ห้อง (CRUD + Audit Trail + Rollover)
│       │   │   ├── advisors\page.tsx# จัดการครูที่ปรึกษาประจำ 45 ห้อง (1-3 ท่าน/ห้อง)
│       │   │   ├── rooms\page.tsx   # จัดการห้องเรียน (เปิด/ปิดห้องเรียน รองรับเลขห้องถึง 99)
│       │   │   ├── terms\page.tsx   # จัดการปีการศึกษา/ภาคเรียน และกำหนดการตรวจ 3 ระยะ
│       │   │   └── settings\page.tsx# จัดการการตั้งค่าระบบ (ข้อมูล รร., Auto Theme 7 วัน, เกณฑ์ 3 ด้าน, โลโก้/Favicon)
│       │   └── api\auth\[...all]\route.ts # Better Auth API Handler
│       ├── components\
│       │   ├── app-sidebar.tsx      # Sidebar Navigation เมนูหลักรองรับ Responsive & Collapsible
│       │   ├── dashboard-shell.tsx  # Layout Shell มาตรฐาน รวม Header, Title, Responsive Main Container
│       │   ├── pagination.tsx       # Reusable Pagination Component (แบรนด์ม่วง, Accessible)
│       │   ├── role-guard.tsx       # Frontend Role Guard ตรวจสอบสิทธิ์การเข้าถึงหน้าจอ
│       │   ├── theme-provider.tsx   # Provider สลับโหมดสี Dark/Light
│       │   └── theme-toggle.tsx     # ปุ่มสลับ Light / Dark / System Mode
│       └── lib\
│           ├── utils.ts             # Tailwind class merging & natural room sorting
│           ├── api.ts               # API Fetch wrapper พร้อมดักจับเครือข่าย & Reverse Proxy
│           ├── pagination.ts        # Helper getPaginationRange & paginateArray
│           ├── dynamic-branding.ts  # Dynamic Theme & Day Palette Engine (7 วัน 7 สี วัฒนธรรมไทย)
│           ├── calculation-engine.ts# Pure Assessment Engine (เกรด, มส, Auto-map 3 ด้าน, AutoSGS)
│           ├── auth.ts              # Better Auth Server Configuration (PostgreSQL Pool)
│           ├── auth-client.ts       # Better Auth Client Hooks (signIn, signOut, useSession)
│           └── *.test.ts            # Unit Tests ครอบคลุม 79 tests (Pass 100%)
│
└── backend\                         # Backend API (Go Fiber + GORM)
    ├── go.mod                       # Go Module (newtea-backend)
    ├── go.sum                       # Go Checksums
    ├── Dockerfile                   # Go Linux Alpine Multi-stage build
    ├── .dockerignore                # ละเว้นไฟล์ชั่วคราวและ log สำหรับ Docker
    ├── .air.toml                    # Air Config สำหรับ Live Reload (Windows binary lock safe)
    ├── cmd\api\
    │   └── main.go                  # Entry Point ของ Fiber API Server, CORS, Router
    └── internal\
        ├── config\config.go         # โหลด Environment Variables
        ├── database\database.go     # เชื่อมต่อ PostgreSQL, Auto-migrate, Seed 45 ห้องเรียน
        ├── handlers\                # Fiber Handlers (health, users, students, advisors, courses, settings, etc.)
        ├── middleware\              # RBAC Middleware (RequireRole, Universal Admin bypass)
        ├── models\models.go         # แบบจำลองข้อมูล GORM ครบทุก Entity
        ├── services\                # Business logic (User Import, Student Import, etc.)
        └── utils\                   # Hashing (Scrypt matching Better Auth), Helper functions
```

---

## 5. สถานะการพัฒนาและแผนงาน (Development Roadmap Tracker)

| Phase | หัวข้องาน | สถานะ | รายละเอียด |
| :---: | :--- | :---: | :--- |
| **Phase 1** | **Foundation & Core Infrastructure** | ✅ **เสร็จสมบูรณ์** | • Next.js 16 + React 19 + TypeScript + Bun<br>• Tailwind CSS v4 + Prompt Font + Dark/Light Theme<br>• Go 1.26 + Fiber + Air Live Reload<br>• Docker PostgreSQL 17 (`tunorth-tea_db`)<br>• GORM Models + Auto-migrations + Seed 45 ห้องเรียน (`4.1`-`6.15`)<br>• Better Auth (Google SSO + Email/Password) |
| **Phase 2** | **Master Data & User Management** | ✅ **เสร็จสมบูรณ์** | • RBAC Middleware Go Fiber (ADMIN, TEACHER, DEPT_HEAD, ACADEMIC, ADVISOR)<br>• หน้าจัดการบัญชีผู้ใช้ครบวงจร (`/admin/users`) เพิ่ม, แก้ไข, รีเซ็ตรหัสผ่าน, ลบผู้ใช้ ปลอดภัยสูง<br>• นำเข้าไฟล์ Excel/CSV บัญชีผู้ใช้และครูผู้สอน พร้อม Scrypt Password Hashing มาตรฐาน Better Auth<br>• นำเข้าไฟล์ Excel/CSV บัญชีนักเรียน 45 ห้อง + ครูที่ปรึกษา (1-3 คน/ห้อง)<br>• จัดการสถานะนักเรียน (ACTIVE, TRANSFERRED, RESIGNED, GRADUATED) พร้อม Audit Trail<br>• หน้าจัดการปีการศึกษา/ภาคเรียน และกำหนดการตรวจ 3 ระยะ (`/admin/terms`)<br>• CRUD ครูที่ปรึกษาประจำ 45 ห้องเรียน พร้อม Datalist แนะนำชื่อและอีเมล (`/admin/advisors`)<br>• แดชบอร์ดเฉพาะสำหรับครูที่ปรึกษาพร้อมสถิตินักเรียนและภาษาที่ 3/วิชาเลือก (`/advisor`)<br>• **Standardized Layout:** ยุบรวม Semantic `<main>` container ใน `DashboardShell` มาตรฐานเดียวกันทุกหน้า<br>• **Universal Pagination:** เพิ่มระบบแบ่งหน้าและ Dropdown จำนวนแถวในทุกตารางข้อมูล<br>• **Year-End Rollover & Academic Term Transition:** ระบบตัวช่วยเลื่อนชั้นปีการศึกษา (จบ ม.6 เป็น `GRADUATED`, เลื่อน ม.4-ม.5 อัตโนมัติแบบ 1-to-1, นำเข้า ม.4 ใหม่) พร้อมตัวกรองดูปีการศึกษาย้อนหลังใน `/courses`<br>• **Classroom Management:** ระบบบริหารจัดการโครงสร้างห้องเรียน (`/admin/rooms`) เปิดห้องเรียนเพิ่ม หรือลดห้องเรียนอย่างปลอดภัย พร้อมปลดล็อก Importer รองรับเลขห้องไดนามิกถึง 99<br>• **System Settings & Dynamic Branding:** ระบบศูนย์กลางการตั้งค่าระบบ (`/admin/settings`) อ้างอิงสถาปัตยกรรม CPMS แบ่ง 3 แท็บ (ข้อมูลทั่วไป/สถานศึกษา/ชื่อ ผอ., ธีมสี & Auto Theme สลับสีตามวัน 7 วันตามวัฒนธรรมไทยพร้อม Midnight Rollover และ Zero FOUC, และเกณฑ์ประเมิน 3 ด้าน) เสริมระบบจัดการ Logo & Favicon รองรับการอัปโหลดไฟล์รูปภาพหรือระบุ URL ตรง พร้อม Live Preview และ Dynamic Injection แสดงผลครอบคลุม Sidebar, Login, Browser Title, Favicon และ Global Footer ทั่วทั้งระบบ |
| **Phase 3** | **Course Setup & Gradebook Engine** | ✅ **เสร็จสมบูรณ์** | • ครูสร้างรายวิชา (15 ห้อง, บางห้อง, กลุ่มภาษา, วิชาเลือก) + เชิญครูร่วมสอนและกำหนดห้อง<br>• TanStack Table v8 Gradebook แยกแท็บรายห้อง พร้อม Keyboard Nav (Enter, Tab, ลูกศร)<br>• Dynamic Score Columns & Weights พร้อมรองรับ ข (ขาดสอบ/ขาดส่งงาน)<br>• **Strict Room Isolation:** ระบบแบ่งความรับผิดชอบตามห้องเรียนแบบไม่มีลำดับชั้น ครูบันทึกได้เฉพาะห้องที่ได้รับมอบหมาย ห้องครูท่านอื่นและแท็บ ALL เป็น Read-Only ป้องกันการบันทึกทับ 100% (แอดมิน/วิชาการมีสิทธิ์สากล)<br>• Pure Calculation Engine (เกรด 0-4, เวลาเรียน <80% มส, Auto-map 3 ด้าน + Override) พร้อม Unit Tests ทั้ง Bun (79 tests) และ Go pass 100% |
| **Phase 4** | **Verification & Approval Workflow** | ✅ **เสร็จสมบูรณ์** | • ส่งตรวจ 3 ระยะตามกำหนดการฝ่ายวิชาการ พร้อม Verification Modal รายละเอียดชัดเจน<br>• Data Locking อัตโนมัติ (ล็อกคะแนนเป็น Read-Only ทันทีที่ครูกดส่งตรวจ ป้องกันแก้ไขระหว่างรออนุมัติ)<br>• แดชบอร์ดหัวหน้ากลุ่มสาระฯ (`/dept-head`) สรุป KPI, ตรวจรับรอง (APPROVED), หรือส่งกลับแก้ไข (REVISE) พร้อมบันทึกหมายเหตุ<br>• แดชบอร์ดติดตามภาพรวมฝ่ายวิชาการ (`/academic`) แบบเรียลไทม์ (TEA68 Grid) กรองกลุ่มสาระฯ/ระดับชั้น/สถานะ พร้อมปุ่มติ๊กส่งเข้า SGS<br>• Revision Workflow ปลดล็อกตารางคะแนนทันทีเมื่อส่งกลับแก้ไข พร้อมแถบแจ้งเตือนสีส้มเด่นชัดให้ครูแก้ไขและส่งใหม่ได้<br>• **Unlock Request Workflow:** ระบบขอปลดล็อกแก้ไขคะแนนหลังส่งตรวจ/อนุมัติ (กรณีนร.ส่งงานแก้เพิ่มคะแนน) พร้อมเหตุผลกำกับ, การอนุมัติโดยหัวหน้ากลุ่มสาระฯ/วิชาการ, ระบบป้องกัน SGS ปลายภาค, และบันทึก Audit Trail |
| **Phase 5** | **AutoSGS & PDF Report Engine** | ✅ **เสร็จสมบูรณ์** | • **AutoSGS 1-Click Clipboard Integration:** คัดลอกข้อมูล 3 โหมด (ผลการเรียน, คุณลักษณะ 8 ข้อ, การอ่านฯ 5 ข้อ) ตรงตาม `D:\TUNorth\apps\sgs` พร้อม Directive `# Source: NewTEA \| Rows: N` และผ่านการทดสอบกับ Python Parser 100%<br>• **AutoSGS Room Guard:** ระบบดักจับการคัดลอกจากแท็บ &quot;รวมทุกห้อง (ALL)&quot; พร้อม Modal เลือกห้องเรียน ป้องกันการวางข้อมูลล้นเกินในระบบ SGS ของ สพฐ.<br>• **Course Description & Info for ปพ.5:** รองรับการบันทึกและแก้ไขข้อมูลรายวิชา คำอธิบายรายวิชา (Course Description) และโครงสร้างหน่วยการเรียนรู้/ผลการเรียนรู้ใน `/courses/[id]` และ Backend API<br>• **Modern Homepage Hub:** อัปเกรดหน้าแรก (`/`) เป็น Quick Action Portal รวมทางลัดตาม Role และแนะนำเครื่องมือ AutoSGS<br>• **7-Component ปพ.5 Printable Report (`/courses/[id]/pp5`):** ระบบพิมพ์เล่ม ปพ.5 ฉบับสมบูรณ์ 7 องค์ประกอบ (หน้าปกตราพระเกี้ยว, คำอธิบายรายวิชา, โครงสร้างรายวิชาและสัดส่วนคะแนน, ใบแทรกเวลาเรียน Studentcare, ตารางคะแนนรวมและเกรด, ตารางผลประเมิน 3 ด้าน, สรุปสถิติและช่องลงนามอนุมัติ 5 ลำดับ) พร้อม Room Selector, Section Toggles, และ `@media print` A4 คมชัดพร้อมสั่งพิมพ์เป็น PDF ผ่านเบราว์เซอร์ |
| **Phase 6** | **Deployment, Production & Maintenance** | ✅ **เสร็จสมบูรณ์** | • **Dockerization:** Multi-stage Dockerfile สำหรับ `tea-frontend` (Bun Standalone พร้อม ARG `BACKEND_INTERNAL_URL`) และ `tea-backend` (Go Fiber Linux Alpine binary) พร้อม `.dockerignore`<br>• **Production Orchestration:** `docker-compose.yml` รวมบริการ `tea-db`, `tea-backend`, `tea-frontend` เชื่อมต่อเครือข่าย `tunorth-net` และ Persistent volumes<br>• **Proxy & Domain Routing:** คอนฟิก Nginx Reverse Gateway Port `8010` (`http://192.168.165.11:8010`), Virtual Hosts `tea.local` / `tea.tn.ac.th`, เชื่อมโยง Cloudflare Ingress เข้า `http://local-nginx:8010` แก้ไข 502 Bad Gateway และส่ง Route `/api/auth` เข้า `tea-frontend:3000`<br>• **Next.js Rewrites Fix:** แก้ไขปัญหา HTTP 500 บน Cloudflare ผ่าน `BACKEND_INTERNAL_URL=http://tea-backend:8080` ในขั้นตอน Docker Build สำเร็จ 100%<br>• **UI & Typography Standardization:** ปรับมาตรฐาน DashboardShell layout และ Typography (Prompt + Inter font stack) เท่าเทียมกันทุก 14 หน้าจอ พร้อม 79 Unit Tests (100% pass)<br>• **Version Control & GitHub:** บันทึกโครงสร้างโปรเจกต์ Git Repository และ Push ขึ้น GitHub ([https://github.com/NOGiTTiS/NewTEA](https://github.com/NOGiTTiS/NewTEA))<br>• **High-Performance Concurrency:** ผ่านการทดสอบ Load Test จำลองครู 150 คนเข้าใช้งานพร้อมกัน 1,500 requests ด้วยความสำเร็จ **99.9%** (1499/1500) และ Throughput **940.2 RPS** (Avg latency 131 ms)<br>• **Comprehensive Manuals:** จัดทำคู่มือครูผู้สอน ([docs/user_manual.md](file:///D:/TUNorth/apps/NewTEA/docs/user_manual.md)) และคู่มือผู้ดูแลระบบ/วิชาการ ([docs/admin_manual.md](file:///D:/TUNorth/apps/NewTEA/docs/admin_manual.md)) ครบถ้วน |

---

## 6. พอร์ตและจุดเชื่อมต่อระบบ (Ports & Endpoints Reference)

- **Frontend Application:** `http://localhost:3000` (Next.js 16 Reverse Proxy `/api/*` -> `http://127.0.0.1:8080` ใน Local Dev และ `http://tea-backend:8080` ใน Docker Standalone)
- **Backend API:** `http://localhost:8080`
  - Health Status: `GET /api/health`
  - Classrooms:
    - `GET /api/rooms` (ดึงรายชื่อห้องพร้อมสถิตินักเรียน Active และครูที่ปรึกษา)
    - `POST /api/rooms` (เปิดห้องเรียนใหม่เฉพาะ Admin)
    - `DELETE /api/rooms/:id` (ลบห้องเรียนเฉพาะ Admin พร้อมระบบความปลอดภัย)
  - User Management (RBAC):
    - `GET /api/users` (ค้นหา, กรอง role และกลุ่มสาระฯ พร้อมสถิติ)
    - `POST /api/users` (สร้างผู้ใช้ใหม่พร้อม Scrypt Hash)
    - `PUT /api/users/:id` (แก้ไขชื่อ, อีเมล, กลุ่มสาระฯ, สิทธิ์)
    - `PATCH /api/users/:id/role` (เปลี่ยนสิทธิ์แบบด่วน)
    - `PATCH /api/users/:id/department` (เปลี่ยนกลุ่มสาระฯ แบบด่วน)
    - `POST /api/users/:id/reset-password` (รีเซ็ตรหัสผ่าน)
    - `DELETE /api/users/:id` (ลบผู้ใช้ พร้อมป้องกันลบ Admin คนสุดท้าย)
    - `POST /api/users/import` (นำเข้าบัญชีผู้ใช้ผ่าน Excel/CSV)
    - `GET /api/users/template` (ดาวน์โหลดไฟล์ Template .xlsx / .csv)
  - Student Management:
    - `GET /api/students`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`
    - `POST /api/students/import`, `POST /api/students/bulk-delete`
    - `GET /api/students/:id/audit-logs`
    - `GET /api/students/rollover/preview` (ดูสถิติจำนวน นร. ก่อนเลื่อนชั้น)
    - `POST /api/students/rollover/graduate-m6` (อนุมัติจบ ม.6 ปรับสถานะเป็น GRADUATED)
    - `POST /api/students/rollover/promote` (เลื่อนชั้น ม.5->ม.6 และ ม.4->ม.5 อัตโนมัติ)
  - Advisory Teachers:
    - `GET /api/advisors`, `POST /api/advisors`, `PUT /api/advisors/:id`, `DELETE /api/advisors/:id`
    - `POST /api/advisors/import`, `GET /api/advisor/my-rooms`
  - Terms & Milestones:
    - `GET /api/terms`, `POST /api/terms`, `PUT /api/terms/:id`, `DELETE /api/terms/:id`
    - `GET /api/terms/:id/milestones`, `PUT /api/terms/:id/milestones`, `POST /api/terms/:id/milestones/reset`
  - System Settings & Branding:
    - `GET /api/settings/public` (ดึงข้อมูลสาธารณะ: ข้อมูล รร., ผอ., ธีมสี/Auto Theme 7 วัน, โลโก้, Favicon)
    - `GET /api/settings` (ดึงการตั้งค่าทั้งหมดเฉพาะ Admin)
    - `PUT /api/settings` (บันทึกการตั้งค่าระบบเฉพาะ Admin)
    - `GET /api/settings/assessment-criteria`, `PUT /api/settings/assessment-criteria` (เกณฑ์ประเมิน 3 ด้าน)
  - Courses & Gradebook:
    - `GET /api/courses`, `POST /api/courses`, `GET /api/courses/:id`, `PUT /api/courses/:id`, `DELETE /api/courses/:id`
    - `POST /api/courses/:id/co-teachers`, `DELETE /api/courses/:id/co-teachers/:teacherId`
    - `POST /api/courses/:id/columns`, `PUT /api/courses/:id/columns/:colId`, `DELETE /api/courses/:id/columns/:colId`
    - `POST /api/courses/:id/scores`, `POST /api/courses/:id/evaluations`
  - Verification & Approval Workflow:
    - `GET /api/courses/:id/verifications` (ดึงสถานะส่งตรวจ 3 ระยะ และกำหนดการเดดไลน์)
    - `POST /api/courses/:id/verifications/submit` (ครูส่งตรวจระยะที่ 1, 2, หรือ 3)
    - `POST /api/courses/:id/verifications/dept-head` (หัวหน้ากลุ่มสาระฯ รับรอง APPROVED หรือส่งกลับแก้ไข REVISE)
    - `POST /api/courses/:id/verifications/academic` (ฝ่ายวิชาการอนุมัติ APPROVED หรือส่งกลับแก้ไข REVISE)
    - `POST /api/courses/:id/verifications/sgs` (ทำเครื่องหมายโอนคะแนนเข้า SGS)
    - `POST /api/courses/:id/verifications/request-unlock` (ครูส่งคำขอปลดล็อกแก้ไขคะแนน พร้อมระบุเหตุผล)
    - `POST /api/courses/:id/verifications/approve-unlock` (อนุมัติปลดล็อกแก้ไข โดยหัวหน้ากลุ่มสาระฯ หรือฝ่ายวิชาการ พร้อม SGS Guard)
    - `POST /api/courses/:id/verifications/reject-unlock` (ปฏิเสธคำขอปลดล็อก)
    - `GET /api/dept-head/courses` (รายการวิชาและสถานะตรวจรับรองในกลุ่มสาระฯ)
    - `GET /api/academic/overview` (ตารางติดตาม TEA68 ภาพรวมทั้งโรงเรียนแบบเรียลไทม์)
- **PostgreSQL 17 Database:** `localhost:5432` (Container: `tea-db` / `newtea-postgres`, DB: `tunorth-tea_db`)
- **AutoSGS Application:** `D:\TUNorth\apps\sgs\main.py` (หรือ `AutoSGS.exe`)
- **Ubuntu Production Target:** Port `8010` บน `http://192.168.165.11:8010` (หรือ Cloudflare Tunnel: `tea.tn.ac.th`)

