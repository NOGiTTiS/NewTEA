# 📘 ข้อกำหนดความต้องการของระบบ NewTEA (System Specification)
### Triam Evaluation and Assessment : ระบบบันทึกผลการเรียนประจำรายวิชา
**โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth)**

---

## 1. ภาพรวมระบบ (System Overview)

### 1.1 ที่มาและความสำคัญ
เดิมทีโรงเรียนเตรียมอุดมศึกษาภาคเหนือใช้กระบวนการบันทึกผลการเรียนผ่าน Google Sheets โดยครูผู้สอนแต่ละท่านต้องทำสำเนาชีต "TEA" แยกรายวิชา นำไปสู่ปัญหาความกระจัดกระจายของข้อมูล ความยุ่งยากในการติดตามการส่งตรวจ การตรวจสอบสิทธิ์ และภาระงานซ้ำซ้อนในการนำคะแนนขึ้นระบบ SGS (Secondary Grading System)

ระบบ **"NewTEA"** ถูกพัฒนาขึ้นใหม่ในรูปแบบ **Full-Stack Web Application** แบบรวมศูนย์ข้อมูล เพื่ออำนวยความสะดวกให้แก่ครูผู้สอน หัวหน้ากลุ่มสาระการเรียนรู้ ฝ่ายวิชาการ และครูที่ปรึกษา โดยรองรับโครงสร้างการจัดการเรียนการสอนที่มีความซับซ้อน ได้แก่:
- นักเรียนระดับชั้น ม.4, ม.5, และ ม.6 รวมทั้งสิ้น 45 ห้องเรียน (ใช้สัญลักษณ์จุด เช่น `4.1` - `4.15`, `5.1` - `5.15`, `6.1` - `6.15`)
- กลุ่มการเรียนภาษาที่ 3 ข้ามห้องเรียน (เกาหลี, ฝรั่งเศส, ญี่ปุ่น, จีน)
- กลุ่มการเรียนวิชาเลือกเฉพาะห้อง (เช่น ม.4.13, ม.4.14: ทัศนศิลป์, ดนตรีไทย, ดนตรีสากล, นาฏศิลป์, ฟุตบอล, วอลเลย์บอล, แบดมินตัน)
- การจัดการเรียนการสอนแบบครูร่วมสอน (Co-teaching) และการแบ่งห้องสอนในรายวิชาเดียวกัน
- การเชื่อมต่อแบบ 1-Click กับเครื่องมือ **AutoSGS** (`D:\TUNorth\apps\sgs`)
- การพิมพ์เอกสารแบบฟอร์ม ปพ.5 ที่สมบูรณ์แบบตามระเบียบกระทรวงศึกษาธิการ

---

### 1.2 สถาปัตยกรรมเทคโนโลยี (Technology Stack)

| ส่วนของระบบ | เทคโนโลยีที่เลือกใช้ | รายละเอียดและเวอร์ชัน |
| :--- | :--- | :--- |
| **Frontend UI** | **Next.js 16 (App Router) + React 19** | TypeScript 5, Tailwind CSS, Shadcn UI (Radix UI), Lucide Icons, Sonner |
| **State & Table Grid** | **Zustand + TanStack Table v8** | รองรับ Keyboard Navigation (Tab/Enter) เลื่อนเซลล์เสมือนโปรแกรม Spreadsheet |
| **Package Manager** | **Bun** | สำหรับ Frontend (ห้ามใช้ npm/npx อย่างเด็ดขาด) |
| **Backend API** | **Go 1.26 + Fiber** | สถาปัตยกรรมความเร็วสูง รัน Live Reload ด้วย Air |
| **Calculation Engine** | **Pure TypeScript Engine** | รันการคำนวณแบบ Real-time บน Client พร้อมโมดูล Go Verification บน Server |
| **Database & ORM** | **PostgreSQL 17 + GORM** | ฐานข้อมูลเชิงสัมพันธ์ ตัวแปรชื่อ `tunorth-tea_db` |
| **Authentication** | **Better Auth** | รองรับ Google Workspace SSO (`@tn.ac.th`) และ Username/Password |
| **DevOps & Server** | **Docker + Ubuntu Server 24.04** | เซิร์ฟเวอร์ On-Premise ของโรงเรียน (เน็ตเวิร์ก `tunorth-net`, Port 8010) ตาม [DEPLOYMENT_GUIDE.md](file:///D:/TUNorth/DEPLOYMENT_GUIDE.md) |
| **Source Code Repository** | **GitHub (Git)** | [https://github.com/NOGiTTiS/NewTEA](https://github.com/NOGiTTiS/NewTEA) |

---

## 2. แบบจำลองข้อมูล (Data Model)

### 2.1 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ ROOM_ADVISORS : advises
    USERS ||--o{ COURSE_TEACHERS : teaches
    ROOMS ||--o{ ROOM_ADVISORS : has
    ROOMS ||--o{ STUDENTS : contains
    ACADEMIC_TERMS ||--o{ COURSES : belongs_to
    ACADEMIC_TERMS ||--o{ VERIFICATION_MILESTONES : defines
    COURSES ||--o{ COURSE_TEACHERS : assigned
    COURSES ||--o{ COURSE_ENROLLMENTS : contains
    COURSES ||--o{ SCORE_COLUMNS : defines
    COURSES ||--o{ COURSE_VERIFICATIONS : tracks
    STUDENTS ||--o{ COURSE_ENROLLMENTS : enrolled
    STUDENTS ||--o{ STUDENT_AUDIT_LOGS : tracked
    COURSE_ENROLLMENTS ||--o{ STUDENT_SCORES : receives
    COURSE_ENROLLMENTS ||--o| STUDENT_EVALUATIONS : evaluated

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role "ADMIN, TEACHER, DEPT_HEAD, ACADEMIC, ADVISOR"
        string department "กลุ่มสาระการเรียนรู้"
        datetime created_at
        datetime updated_at
    }

    ROOMS {
        string id PK "เช่น 4.1, 5.14, 6.15"
        int grade_level "4, 5, 6"
        int room_number "1-15"
    }

    ROOM_ADVISORS {
        uuid id PK
        string room_id FK
        uuid user_id FK
        int advisor_order "1, 2, 3"
    }

    STUDENTS {
        string student_id PK "รหัสประจำตัวนักเรียน"
        string national_id "เลขบัตรประชาชน 13 หลัก"
        string prefix "นาย/นางสาว/เด็กชาย/เด็กหญิง"
        string first_name
        string last_name
        string room_id FK
        int seat_no "เลขที่"
        string language_group "เกาหลี/ฝรั่งเศส/ญี่ปุ่น/จีน"
        string elective_group "ทัศนศิลป์/ฟุตบอล ฯลฯ"
        string status "ACTIVE, TRANSFERRED, RESIGNED, SUSPENDED"
    }

    ACADEMIC_TERMS {
        uuid id PK
        int year "เช่น 2568, 2569"
        int semester "1 หรือ 2"
        boolean is_active
        date start_date
        date end_date
    }

    VERIFICATION_MILESTONES {
        uuid id PK
        uuid term_id FK
        int round "1:ก่อนกลางภาค, 2:กลางภาค, 3:หลังกลางภาค/ปลายภาค"
        string title
        date teacher_deadline
        date academic_deadline
    }

    COURSES {
        uuid id PK
        uuid term_id FK
        string course_code "เช่น ท32101, ค32101"
        string course_name
        float credits "เช่น 1.0, 1.5, 2.0"
        int total_hours "คาบเรียนรวม เช่น 40, 60"
        string course_type "BASIC, ADDITIONAL"
        string department "กลุ่มสาระฯ"
        string description "คำอธิบายรายวิชา"
        json structure_data "โครงสร้างรายวิชาและตัวชี้วัด"
        string target_group_type "ALL_ROOMS, SPECIFIC_ROOMS, LANGUAGE_GROUP, ELECTIVE_GROUP"
        json target_rooms "['4.1', '4.2', ...]"
        string target_subgroup "เช่น ญี่ปุ่น หรือ ฟุตบอล"
        uuid created_by FK
        datetime created_at
    }

    COURSE_TEACHERS {
        uuid id PK
        uuid course_id FK
        uuid user_id FK
        boolean is_primary
        json assigned_rooms "['4.1', '4.3'] หรือ null ถ้าสอนร่วมกันทุกห้อง"
    }

    COURSE_ENROLLMENTS {
        uuid id PK
        uuid course_id FK
        string student_id FK
        string room_id
        int seat_no
        string status "ENROLLED, DROPPED, EXEMPT"
    }

    SCORE_COLUMNS {
        uuid id PK
        uuid course_id FK
        string name "เช่น ชิ้นงานที่ 1, สอบเก็บคะแนน"
        float max_score "คะแนนเต็ม"
        float weight "น้ำหนักคะแนน"
        int period_type "1:ก่อนกลาง, 2:กลางภาค, 3:หลังกลาง, 4:ปลายภาค"
        int sequence "ลำดับการแสดงผล"
    }

    STUDENT_SCORES {
        uuid id PK
        uuid enrollment_id FK
        uuid score_column_id FK
        float score
        boolean is_absent "ขาดสอบ/ขาดส่งงาน"
        string remarks
    }

    STUDENT_EVALUATIONS {
        uuid id PK
        uuid enrollment_id FK UK
        int attendance_hours "เวลาเรียนที่มา"
        float attendance_percentage "คิดเป็น %"
        float total_score "คะแนนรวม 100"
        string grade "0, 1, 1.5, 2, 2.5, 3, 3.5, 4"
        string special_grade "มส, ร, ผ, มผ, หรือ null"
        json desirable_subscores "คะแนน 8 ข้อย่อย"
        int desirable_grade "0:ไม่ผ่าน, 1:ผ่าน, 2:ดี, 3:ดีเยี่ยม"
        json reading_subscores "คะแนน 6 ข้อย่อย"
        int reading_grade "0:ไม่ผ่าน, 1:ผ่าน, 2:ดี, 3:ดีเยี่ยม"
        json competency_subscores "คะแนน 5 ด้าน"
        int competency_grade "0:ไม่ผ่าน, 1:ผ่าน, 2:ดี, 3:ดีเยี่ยม"
        boolean is_overridden "มีการแก้เกรดประเมินด้วยมือ"
        string override_reason
    }

    COURSE_VERIFICATIONS {
        uuid id PK
        uuid course_id FK
        int round "1, 2, 3"
        boolean teacher_submitted
        datetime teacher_submitted_at
        boolean sgs_transferred "ครูยืนยันส่ง SGS"
        string dept_head_status "PENDING, APPROVED, REVISE"
        string dept_head_comment
        datetime dept_head_reviewed_at
        string academic_status "PENDING, APPROVED, REVISE"
        string academic_comment
        datetime academic_reviewed_at
    }

    STUDENT_AUDIT_LOGS {
        uuid id PK
        string student_id FK
        string action "CHANGE_ROOM, CHANGE_GROUP, STATUS_CHANGE"
        string old_value
        string new_value
        uuid changed_by FK
        datetime changed_at
    }
```

---

## 3. ฟีเจอร์ทั้งหมดพร้อม Acceptance Criteria

### Feature 1: การยืนยันตัวตนและการจัดการสิทธิ์ (Authentication & Authorization)
- **คำอธิบาย:** ระบบรองรับการเข้าใช้งาน 2 ทาง (Google Workspace SSO ด้วยอีเมลโรงเรียน `@tn.ac.th` และ Username/Password) พร้อมระบบจัดสิทธิ์ตามบทบาท (RBAC) และการจัดการบัญชีผู้ใช้ครบวงจรสำหรับผู้ดูแลระบบ
- **Acceptance Criteria:**
  - [x] ผู้ใช้สามารถกดปุ่ม "Sign in with Google" เพื่อล็อกอินด้วยโดเมน `@tn.ac.th` ได้สำเร็จ
  - [x] ผู้ใช้ที่ไม่มีบัญชี Google สามารถล็อกอินด้วย Username/Password ที่ Admin กำหนดให้ได้
  - [x] ผู้ใช้ได้รับสิทธิ์ตรงตามบทบาท: `ADMIN`, `TEACHER`, `DEPT_HEAD`, `ACADEMIC`, `ADVISOR`
  - [x] ผู้ดูแลระบบ (ADMIN) สามารถจัดการบัญชีผู้ใช้ได้ครบวงจร (CRUD) ที่หน้า `/admin/users` (เพิ่มผู้ใช้, แก้ไขชื่อ/อีเมล/กลุ่มสาระฯ, เปลี่ยนสิทธิ์ด่วน, รีเซ็ตรหัสผ่าน, ลบผู้ใช้ พร้อมป้องกันการลบ ADMIN คนสุดท้าย)
  - [x] ผู้ดูแลระบบสามารถนำเข้าบัญชีผู้ใช้และครูผู้สอนผ่านไฟล์ Excel (.xlsx) / CSV พร้อมดาวน์โหลด Template มาตรฐาน และระบบเข้ารหัสผ่านด้วย Scrypt ที่ตรงตามข้อกำหนดของ Better Auth
  - [x] ครูประจำวิชาสามารถเข้าถึงและแก้ไขได้เฉพาะวิชาที่ตนเองเป็นผู้สร้าง หรือเป็น Co-teacher เท่านั้น
  - [x] ครูที่ปรึกษา (Advisor) สามารถดูแดชบอร์ดสรุปผลการเรียนเฉพาะห้องที่ตนเป็นที่ปรึกษาได้

---

### Feature 2: การจัดการข้อมูลหลักและการนำเข้า (Master Data Management)
- **คำอธิบาย:** Admin สามารถนำเข้าไฟล์ Excel/CSV ข้อมูลนักเรียน ครูที่ปรึกษา และจัดการกรณีนักเรียนเปลี่ยนกลุ่ม ย้ายห้อง หรือลาออก
- **Acceptance Criteria:**
  - [x] รองรับการอัปโหลดไฟล์ Excel/CSV บัญชีรายชื่อนักเรียน โดยระบบตรวจจับคอลัมน์: รหัสประจำตัว, เลขบัตรประชาชน, คำนำหน้า, ชื่อ, สกุล, ห้อง (`4.1` - `6.15`), เลขที่, ภาษาที่ 3, และวิชาเลือก
  - [x] รองรับการนำเข้าครูที่ปรึกษาประจำห้อง 1-3 ท่านต่อห้องตามรูปแบบ Google Sheet เดิม
  - [x] สามารถปรับสถานะนักเรียนเป็น `ACTIVE`, `TRANSFERRED`, `RESIGNED` พร้อมบันทึกประวัติ (Audit Log)
  - [x] เมื่อนักเรียนย้ายห้อง ข้อมูลคะแนนในรายวิชาเดิมยังคงถูกเก็บรักษาไว้ และแสดงสัญลักษณ์แจ้งเตือนในระบบ

---

### Feature 3: การสร้างรายวิชาและการจัดกลุ่มนักเรียน (Course Setup & Enrollment)
- **คำอธิบาย:** ครูผู้สอนสามารถกด "สร้างรายวิชา" ระบุรหัสวิชา ชื่อวิชา สัดส่วนคะแนน และเลือกนักเรียนตามห้องหรือกลุ่มย่อย พร้อมเชิญครูร่วมสอน
- **Acceptance Criteria:**
  - [x] ครูกดสร้างรายวิชา เลือกระดับชั้นและห้องที่สอนได้หลากหลายรูปแบบ:
    - สอนทั้ง 15 ห้องในระดับชั้นนั้น
    - สอนเฉพาะบางห้อง (เช่น `5.13`, `5.14`)
    - สอนข้ามห้องตามกลุ่มภาษาที่ 3 (เช่น ดึงเฉพาะนักเรียนภาษาญี่ปุ่นจากทุกห้อง)
    - สอนเฉพาะกลุ่มวิชาเลือก (เช่น ดึงเฉพาะนักเรียนวิชาฟุตบอล ม.5.13-5.14)
  - [x] สามารถเพิ่มครูร่วมสอน (Co-teachers) และกำหนดห้องที่ครูแต่ละคนรับผิดชอบได้
  - [x] นักเรียนที่ตรงตามเงื่อนไขถูกดึงเข้าห้องเรียน (Enrollment) ให้อัตโนมัติ

---

### Feature 4: ตารางบันทึกคะแนนเสมือนสเปรดชีต (Spreadsheet-like Gradebook Grid)
- **คำอธิบาย:** หน้ากรอกคะแนนแยกตามห้องเรียนด้วย Dropdown Selector มีโครงสร้างตารางที่ใช้งานง่าย เลื่อนเซลล์ด้วยคีย์บอร์ดได้เหมือน Excel และบันทึกอัตโนมัติ
- **Acceptance Criteria:**
  - [x] หน้ากรอกคะแนนเลือกห้องเรียนด้วย Dropdown สวยงาม กะทัดรัด รองรับ 45 ห้อง
  - [x] ครูสามารถเพิ่ม/ลด/แก้ไขช่องคะแนนเก็บ น้ำหนักคะแนน และคะแนนเต็มได้อย่างอิสระ พร้อม Default (10+10+10 / 20 / 10+10+10 / 20)
  - [x] รองรับการนำทางด้วยคีย์บอร์ด (Arrow Keys, Enter เลื่อนลง, Tab เลื่อนขวา)
  - [x] บันทึกคะแนนลงเซิร์ฟเวอร์แบบ Real-time Auto-save (พร้อมแจ้งเตือน Toast เมื่อบันทึกสำเร็จ)
  - [x] รองรับการระบุตัวย่อพิเศษ: ขาดสอบ/ขาดส่งงาน (`ข`), หรือเว้นว่าง

---

### Feature 5: เครื่องยนต์คำนวณผลการเรียนและการประเมิน 3 ด้าน (Assessment Engine)
- **คำอธิบาย:** คำนวณเวลาเรียน ตัดเกรด $0 - 4$ อัตโนมัติ พร้อม Auto-map การประเมิน 3 ด้านแยกแท็บรายข้อย่อย ตามเกณฑ์ Admin Setting
- **Acceptance Criteria:**
  - [x] หากเวลาเรียนรวมต่ำกว่า 80% ระบบจะแสดงผลการเรียนเป็น **"มส"** อัตโนมัติ
  - [x] คำนวณตัดเกรดอิงเกณฑ์มาตรฐาน: 80-100 (4), 75-79 (3.5), 70-74 (3), 65-69 (2.5), 60-64 (2), 55-59 (1.5), 50-54 (1), <50 (0)
  - [x] รองรับผลการเรียนพิเศษ: **ร, มส, ผ, มผ**
  - [x] คำนวณ Auto-map การประเมิน 3 ด้านและกระจายลงรายข้อย่อย (คุณลักษณะ 8 ข้อ, การอ่านฯ 5 ข้อ, สมรรถนะ 5 ด้าน) ตามเกณฑ์ที่ตั้งใน Admin Setting
  - [x] ครูผู้สอนสามารถคลิกปรับแก้คะแนนและระดับการประเมิน 3 ด้านของนักเรียนรายบุคคลได้อิสระ

---

### Feature 6: กระบวนการส่งตรวจ 3 ระยะและการล็อกข้อมูล (Verification & Approval Workflow)
- **คำอธิบาย:** ระบบส่งตรวจตามปฏิทินวิชาการ 3 ระยะ ล็อกข้อมูลไม่ให้แก้ไขเมื่อส่งตรวจ และส่งคืนให้แก้ไขพร้อมคอมเมนต์
- **Acceptance Criteria:**
  - [x] ระบบมีรอบส่งตรวจ 3 ระยะ:
    1. ตรวจครั้งที่ 1 (ก่อนกลางภาค)
    2. ตรวจครั้งที่ 2 (กลางภาค)
    3. ตรวจครั้งที่ 3 (หลังกลางภาค/ปลายภาค) + ส่ง SGS
  - [x] เมื่อครูกด "ส่งตรวจ" สถานะวิชาจะเปลี่ยนเป็น `PENDING` และตารางคะแนนจะถูกล็อก (Read-Only) ทันที
  - [x] หัวหน้ากลุ่มสาระฯ และฝ่ายวิชาการ มีหน้าแดชบอร์ดตรวจสอบรายวิชาในสังกัด สามารถกด "อนุมัติ (เรียบร้อย)" หรือ "ส่งกลับให้แก้ไข (แก้ไข)" พร้อมระบุหมายเหตุ
  - [x] หากส่งกลับให้แก้ไข ระบบจะปลดล็อกให้ครูกลับมาแก้ไขคะแนน พร้อมแสดงข้อความหมายเหตุเตือนชัดเจน

---

### Feature 7: การส่งออกข้อมูลสำหรับ AutoSGS (1-Click AutoSGS Clipboard Export)
- **คำอธิบาย:** ปุ่มคัดลอกข้อมูลลง System Clipboard ในรูปแบบ Tab-Separated Values ตรงตามโปรแกรม `D:\TUNorth\apps\sgs`
- **Acceptance Criteria:**
  - [x] มีฟังก์ชันและปุ่ม **"คัดลอกสำหรับ AutoSGS"** แยกตาม 3 โหมดมาตรฐาน:
    1. **โหมดผลการเรียน:** ข้อมูลคะแนนเรียงตามแนวนอน คั่นด้วย `\t` (Tab) และขึ้นบรรทัดใหม่ด้วย `\n` (แยกช่วงก่อนกลางภาค+กลางภาค และหลังกลางภาค+ปลายภาค)
    2. **โหมดคุณลักษณะอันพึงประสงค์ (8 คอลัมน์):** ค่าคะแนน 8 คอลัมน์ย่อยตามมาตรฐาน พร้อม 4 Trailing Tabs
    3. **โหมดการอ่าน คิดวิเคราะห์และเขียน (5 คอลัมน์):** ค่าคะแนน 5 คอลัมน์ย่อยตามมาตรฐาน พร้อม 3 Trailing Tabs
  - [x] ตรวจสอบจำนวนแถวนักเรียนให้ครบถ้วนทุกที่นั่ง (ไม่มีการตัดแถวท้ายทิ้งแม้ยังไม่มีคะแนน)
  - [x] ทดสอบการจับคู่ข้อมูลกับโปรแกรม AutoSGS บน Windows จริง (ผ่าน Python Clipboard Parser Test Suite และ Directive `# Source: NewTEA | Rows: N`)

---

### Feature 8: การออกเอกสารแบบฟอร์ม ปพ.5 (PDF Report Export)
- **คำอธิบาย:** ประมวลผลเอกสาร ปพ.5 รวมเป็นไฟล์ PDF ฉบับสมบูรณ์ พร้อมพิมพ์ส่งฝ่ายวิชาการ
- **Acceptance Criteria:**
  - [x] เอกสาร ปพ.5 ประกอบด้วย 7 องค์ประกอบครบถ้วน:
    1. หน้าปก (ตราโรงเรียนเตรียมอุดมศึกษาภาคเหนือ, ข้อมูลวิชา, ภาคเรียน, ครูผู้สอน)
    2. คำอธิบายรายวิชา (Course Description)
    3. โครงสร้างรายวิชาและสัดส่วนคะแนน
    4. หน้าว่างสำหรับแนบรายงานเวลาเรียนจากระบบ Studentcare
    5. ตารางสรุปคะแนนรวมและผลการเรียน
    6. ตารางสรุปผลการประเมิน 3 ด้าน
    7. หน้าสรุปสถิติผลการเรียนและช่องลงนามอนุมัติ (ครู, หัวหน้ากลุ่มสาระฯ, หัวหน้างานวัดผล, รองฯ วิชาการ, ผู้อำนวยการ)
  - [x] รูปแบบเอกสารคมชัด จัดหน้าพอดีกระดาษ A4 สวยงามพร้อมพิมพ์ ผ่าน `@media print` และเบราว์เซอร์ Native Print-to-PDF

---

### Feature 9: แดชบอร์ดติดตามภาพรวมฝ่ายวิชาการ (Academic Affairs Tracking Dashboard)
- **คำอธิบาย:** หน้าจอแสดงสถานะการส่งตรวจของครูและรายวิชาทั้งโรงเรียนแบบเรียลไทม์ ทดแทนชีตตรวจคะแนนเดิม
- **Acceptance Criteria:**
  - [x] แสดงตารางรวมวิชาทั้งหมดในโรงเรียน (รหัสวิชา, ชื่อวิชา, ครูผู้สอน, ห้องที่สอน)
  - [x] แสดงสถานะติ๊กส่งตรวจทั้ง 3 ระยะ และสถานะส่ง SGS พร้อมไฟสถานะ (สีเขียว: เรียบร้อย, สีเหลือง: รอดำเนินการ, สีแดง: ส่งกลับแก้ไข)
  - [x] สามารถกรองดูตามกลุ่มสาระการเรียนรู้ หรือระดับชั้นได้
  - [x] สามารถคลิกดูรายละเอียดคะแนนของวิชานั้น ๆ ได้โดยตรง

---

### Feature 10: สถาปัตยกรรม UI มาตรฐานและระบบการแบ่งหน้า (Standardized Layout & Universal Pagination)
- **คำอธิบาย:** การออกแบบหน้าจอที่รวมศูนย์ Semantic `<main>` container, Responsive Padding, Max-width ผ่าน `DashboardShell` พร้อม Reusable Pagination Component รองรับการแบ่งหน้าข้อมูลขนาดใหญ่ทุกตาราง
- **Acceptance Criteria:**
  - [x] โครงสร้างหน้าจอทุกหน้าผ่าน `DashboardShell` มีระยะขอบ (Padding) และขอบเขตความกว้าง (Max-width) เป็นมาตรฐานเดียวกัน ไร้ปัญหา Nested Container ซ้ำซ้อน
  - [x] คอมโพเนนต์ `Pagination` รองรับการคำนวณเลขหน้าแบบย่อด้วยจุดไข่ปลา `…`, ปุ่มนำทาง (หน้าแรก, ก่อนหน้า, ตัวเลข, ถัดไป, สุดท้าย) และ Dropdown เลือกจำนวนรายการต่อหน้า
  - [x] ใช้งานระบบ Pagination ในทุกหน้าตารางข้อมูล: `/admin/users`, `/admin/students`, `/courses`, `/admin/advisors`, และ `/advisor`
  - [x] รองรับ Responsive เต็มรูปแบบทั้ง PC, Tablet และ Mobile พร้อมธีมสี Brand Purple (`#5f06c4`) ตาม Design Tokens และ Dark/Light Mode 100%

---

## 4. แผนการพัฒนาแบ่งตามระยะ (Development Phases & Checklists)

### 🚀 Phase 1: การวางรากฐานและโครงสร้างพื้นฐาน (Foundation & Core Infrastructure)
- [x] สร้างโครงสร้างโปรเจกต์ `frontend` ด้วย Next.js 16 (App Router) + React 19 + TypeScript 5
- [x] กำหนดค่า Package Manager ด้วย **Bun** (บล็อก npm/npx ในโปรเจกต์)
- [x] ติดตั้งและตั้งค่า Tailwind CSS + Shadcn UI + Lucide Icons + Sonner + Zustand
- [x] สร้างโครงสร้างโปรเจกต์ `backend` ด้วย Go 1.26 + Fiber + GORM
- [x] ตั้งค่าการทำงานของ Air สำหรับ Go Live Reload (Windows file lock safe)
- [x] ตั้งค่าฐานข้อมูล PostgreSQL 17 ในรูปแบบ Docker Compose พร้อม Volume
- [x] กำหนดแบบจำลองข้อมูล (GORM Models & Migrations) ตามข้อกำหนดในส่วนที่ 2
- [x] ตั้งค่าระบบ Better Auth (Google Workspace OAuth 2.0 & Email/Password Authentication)

---

### 👥 Phase 2: ระบบจัดการข้อมูลหลักและผู้ใช้งาน (Master Data & User Management)
- [x] พัฒนาระบบ RBAC Middleware ใน Go Fiber ตรวจสอบสิทธิ์ผู้ใช้ (ADMIN, TEACHER, DEPT_HEAD, ACADEMIC, ADVISOR)
- [x] พัฒนาระบบ Upload & Parser ไฟล์ Excel/CSV สำหรับ Admin (ข้อมูลนักเรียน 45 ห้อง และครูที่ปรึกษา)
- [x] พัฒนาระบบจัดการสถานะนักเรียน (ย้ายห้อง, เปลี่ยนกลุ่มภาษา/วิชาเลือก, ลาออก) พร้อม Audit Trail
- [x] สร้างหน้า UI จัดการปีการศึกษา/ภาคเรียน และกำหนดการตรวจ 3 ระยะสำหรับฝ่ายวิชาการ (`/admin/terms`)
- [x] สร้างหน้า UI แดชบอร์ดเฉพาะสำหรับครูที่ปรึกษา (ดูรายชื่อและผลการเรียนนักเรียนในห้องตนเอง) (`/advisor`)
- [x] พัฒนาระบบจัดการครูที่ปรึกษาครบวงจร (CRUD ครูที่ปรึกษาประจำ 45 ห้อง 1-3 คน/ห้อง) (`/admin/advisors`)
- [x] พัฒนาระบบจัดการบัญชีผู้ใช้และกำหนดสิทธิ์ (RBAC & Full User CRUD: เพิ่ม, แก้ไข, รีเซ็ตรหัสผ่าน, ลบ พร้อมความปลอดภัย และ Sidebar ในตัว) (`/admin/users`)
- [x] พัฒนาระบบนำเข้าบัญชีผู้ใช้และครูผู้สอนผ่านไฟล์ Excel/CSV (Import Users พร้อมดาวน์โหลด Template .xlsx / .csv และระบบ Upsert อัตโนมัติด้วย Scrypt Hash)
- [x] ปรับเปลี่ยนระบบการนำทางจาก Navbar ด้านบนเป็น Sidebar Layout พร้อม Drawer รองรับ Responsive Mobile และ PC ทุกหน้า
- [x] ปรับโครงสร้างหน้าเว็บทุกหน้าให้เป็นมาตรฐานเดียวกัน (Standardized DashboardShell Container & Responsive Padding)
- [x] ปรับปรุงระบบ Typography & Global Font Inheritance (ฟอนต์ Prompt เป็นหลักสำหรับภาษาไทย/UI และฟอนต์ Inter สำหรับตัวเลข/ภาษาอังกฤษ ครอบคลุม Form Inputs, Selects, Buttons, Tables และ Print Engine ไร้การหลุดฟอนต์)
- [x] พัฒนา Reusable Pagination Component พร้อมเชื่อมต่อในทุกหน้าตารางข้อมูล (`/admin/users`, `/admin/students`, `/courses`, `/admin/advisors`, `/advisor`)
- [x] ออกแบบระบบวิชาเลือกเฉพาะแบบ Hybrid (Dropdown มาตรฐาน + ระบุเอง) ป้องกัน Typo และรองรับการดึงเข้าคอร์สใน Phase 3
- [x] พัฒนาระบบเลื่อนชั้นปีการศึกษาและเปลี่ยนภาคเรียน (Year-End Rollover Wizard & Academic Term Transition: จบ ม.6 เป็น GRADUATED, เลื่อนชั้น ม.4-ม.5 อัตโนมัติ 1-to-1, นำเข้า ม.4 ใหม่, และตัวกรองสลับดูปีการศึกษาย้อนหลังในหน้ารายวิชา)
- [x] พัฒนาระบบบริหารจัดการห้องเรียน (Classroom Expansion & Reduction Management: เพิ่มห้องเรียนใหม่, ลบห้องเรียนว่างอย่างปลอดภัย, ปลดล็อก Importer ให้รองรับเลขห้องไดนามิก, และสร้างหน้าจอ `/admin/rooms`)
- [x] พัฒนาระบบการตั้งค่าระบบและธีมสีประจำวันอัตโนมัติ (System Settings & Auto Theme: สถาปัตยกรรมแบบเดียวกับ CPMS, แท็บข้อมูลทั่วไป/สถานศึกษา/ชื่อ ผอ., แท็บ Auto Theme สลับสี 7 วันตามวัฒนธรรมไทย พร้อมสลับสีเที่ยงคืนและ Custom Palettes, และแท็บเกณฑ์ประเมิน 3 ด้าน ที่ `/admin/settings`)

---

### 📚 Phase 3: ระบบสร้างรายวิชาและตารางกรอกคะแนน (Course Setup & Gradebook Engine)
- [x] พัฒนาระบบสร้างรายวิชาสำหรับครูผู้สอน (เลือกห้องทั้ง 15 ห้อง, เลือกเฉพาะห้อง, หรือเลือกตามกลุ่มภาษา/วิชาเลือก)
- [x] พัฒนาระบบเชิญครูร่วมสอน (Co-teachers) และการกำหนดความรับผิดชอบรายห้อง
- [x] พัฒนาระบบบันทึกคะแนนแบบแบ่งความรับผิดชอบรายห้องเด็ดขาด (Strict Room Isolation: ครูบันทึกได้เฉพาะห้องที่ได้รับมอบหมาย, ห้องครูท่านอื่นและแท็บภาพรวม ALL เป็น Read-Only ป้องกันการบันทึกทับ)
- [x] พัฒนาคอมโพเนนต์ Gradebook Grid ด้วย TanStack Table v8:
  - [x] ระบบแยกแท็บรายห้อง (`4.1`, `4.2`, ...)
  - [x] ระบบเพิ่ม/แก้ไข/ลบ คอลัมน์คะแนนเก็บและกำหนดค่าน้ำหนัก
  - [x] การนำทางด้วยคีย์บอร์ด (Arrow Keys, Tab, Enter เสมือน Spreadsheet)
  - [x] ระบบ Real-time Auto-save เมื่อผู้ใช้หยุดพิมพ์ (Debounce API call)
- [x] พัฒนาโมดูล Calculation Engine:
  - [x] การตัดเกรด $0 - 4$ ตามเกณฑ์มาตรฐาน
  - [x] การตรวจสอบเวลาเรียน $< 80\%$ ติด "มส"
  - [x] การคำนวณ Auto-map การประเมิน 3 ด้านพร้อมระบบ Override
  - [x] เขียน Unit Test ครอบคลุม 46 กรณีทดสอบบน Bun Frontend และ 10 ฟังก์ชันบน Go Backend ผ่าน 100%

---

### 🛡️ Phase 4: กระบวนการส่งตรวจและการอนุมัติ (Verification & Approval Chain)
- [x] พัฒนา API และ UI การส่งตรวจ 3 ระยะตามเดดไลน์ที่วิชาการกำหนด
- [x] พัฒนาระบบ Data Locking: ล็อกตารางคะแนนเป็น Read-Only เมื่อส่งตรวจสำเร็จ
- [x] พัฒนาแดชบอร์ดสำหรับหัวหน้ากลุ่มสาระฯ (ตรวจสอบคะแนนรายวิชาในกลุ่มสาระ, อนุมัติ, หรือส่งกลับแก้ไขพร้อมบันทึกหมายเหตุ)
- [x] พัฒนาแดชบอร์ดภาพรวมฝ่ายวิชาการ (Academic Overview Grid) ทดแทน Sheet ตรวจคะแนน TEA68 แบบเรียลไทม์
- [x] พัฒนาระบบปลดล็อกการแก้ไขเมื่อมีการส่งกลับแก้ไข (Revision Workflow)
- [x] พัฒนาระบบขอปลดล็อกแก้ไขคะแนนหลังส่งตรวจ/อนุมัติ (Unlock Request Workflow) รองรับกรณี นร. ส่งงานย้อนหลังหรือส่งแก้คะแนน พร้อมระบบป้องกัน SGS และ Audit Trail บันทึกผู้อนุมัติ

---

### ⚡ Phase 5: การเชื่อมต่อ AutoSGS และการสร้างเอกสาร ปพ.5 (AutoSGS & PDF Report Engine)
- [x] พัฒนาฟังก์ชัน 1-Click Clipboard Export สำหรับ AutoSGS (`D:\TUNorth\apps\sgs`):
  - [x] จัด Format โหมดผลการเรียน (แนวนอน Tab-delimited แยกช่วงก่อนกลางภาค+กลางภาค และหลังกลางภาค+ปลายภาค)
  - [x] จัด Format โหมดคุณลักษณะอันพึงประสงค์ (8 คอลัมน์ + 4 Trailing Tabs)
  - [x] จัด Format โหมดการอ่าน คิดวิเคราะห์และเขียน (5 คอลัมน์ + 3 Trailing Tabs)
- [x] พัฒนาระบบ AutoSGS Room Guard ป้องกันการคัดลอกข้อมูลรวมทุกห้อง (ALL) ไปยัง SGS ผิดพลาด พร้อม Modal เลือกห้องเรียน
- [x] พัฒนาระบบบันทึกข้อมูลและคำอธิบายรายวิชา (Course Description & Structure Data) สำหรับเตรียมจัดพิมพ์ ปพ.5 องค์ประกอบที่ 2 และ 3
- [x] ปรับปรุงหน้าแรก (/) ให้เป็น Modern Quick Action Hub ศูนย์รวมทางลัดการทำงานตามบทบาท (ครู, หัวหน้ากลุ่มสาระฯ, วิชาการ, ที่ปรึกษา, แอดมิน)
- [x] ทดสอบการจับคู่ข้อมูลกับโปรแกรม AutoSGS บน Windows จริง (ผ่าน Python Clipboard Parser Test Suite และ Directive `# Source: NewTEA | Rows: N`)
- [x] พัฒนาระบบ Render เอกสาร ปพ.5 แบบ PDF ฉบับสมบูรณ์ (`/courses/[id]/pp5`):
  - [x] ออกแบบหน้าปกและข้อมูลสาระวิชา พร้อมตราโรงเรียนความละเอียดสูง (`/school-logo.png`)
  - [x] ออกแบบหน้าคำอธิบายรายวิชาและโครงสร้างวิชา
  - [x] เว้นหน้าว่างสำหรับแทรกรายงานเวลาเรียน Studentcare
  - [x] ออกแบบตารางสรุปคะแนนรวม และการประเมิน 3 ด้าน
  - [x] ออกแบบหน้าสรุปสถิติและช่องลงนามผู้บริหาร/ฝ่ายวิชาการ (5 ลำดับการลงนามอนุมัติ)

---

### 🚢 Phase 6: การทดสอบ การทำ Dockerization และการขึ้นระบบจริง (Deployment & Production)
- [x] เขียน Unit Test และ E2E Test สำหรับ Calculation Engine และ Approval Workflow
- [x] สร้าง `Dockerfile` สำหรับ `tea-frontend` (Multi-stage build ด้วย Bun)
- [x] สร้าง `Dockerfile` สำหรับ `tea-backend` (Go Fiber binary)
- [x] สร้าง `docker-compose.yml` โปรดักชันเชื่อมต่อเครือข่าย `tunorth-net` และ `tea-db` พร้อม `docker-compose.local.yml` สำหรับ Dev
- [x] แก้ไขปัญหาคอนฟลิกต์ชื่อ Container และเสริม Dynamic Database URL ใน Go Backend พร้อม Retry Loop
- [x] ปรับแต่ง Better Auth และ API Client ให้รองรับ Dual-Access (ภายนอก `https://tea.tn.ac.th` + ภายใน LAN `http://192.168.165.11:8010`) ไร้ปัญหา CORS
- [x] ระบบ Seed บัญชีผู้ดูแลระบบคนแรกอัตโนมัติ (`admin@tn.ac.th` / `Admin@2026`) เมื่อเริ่มระบบบน Fresh Database
- [x] เชื่อมโยงสคริปต์ระบบแม่ของโรงเรียน (`deploy.sh`, `setup.sh`, `restore_db.sh`, `deploy_newtea.sh`) และอัปเดต LAN Portal (Port 80)
- [x] กำหนดค่า Nginx Proxy Port 8010 และ Cloudflare Tunnel ตาม [DEPLOYMENT_GUIDE.md](file:///D:/TUNorth/DEPLOYMENT_GUIDE.md)
- [x] แก้ไขปัญหา Next.js Rewrite Destination (HTTP 500 บน Cloudflare): ปรับปรุง `next.config.ts`, `Dockerfile`, `docker-compose.yml` ให้ส่ง `BACKEND_INTERNAL_URL=http://tea-backend:8080` ในขั้นตอน Docker Build สำเร็จ
- [x] ปรับปรุง Nginx Gateway สำหรับ `tea.tn.ac.th`: เพิ่ม Route `/api/auth` ส่งไปยัง `tea-frontend:3000` บน Port 80 และ Port 8010 ป้องกันการส่ง Auth ผิด Container
- [x] จัดการ Version Control: สร้าง `.gitignore`, `.env.example`, `README.md` และ Push โค้ดทั้งหมดขึ้น GitHub ([https://github.com/NOGiTTiS/NewTEA](https://github.com/NOGiTTiS/NewTEA))
- [x] ทดสอบประสิทธิภาพการทำงานพร้อมกันของครู 100–150 คน (Concurrency & Load Test)
- [x] ทำคู่มือการใช้งานสำหรับครูและผู้ดูแลระบบ ([user_manual.md](file:///D:/TUNorth/apps/NewTEA/docs/user_manual.md), [admin_manual.md](file:///D:/TUNorth/apps/NewTEA/docs/admin_manual.md))

