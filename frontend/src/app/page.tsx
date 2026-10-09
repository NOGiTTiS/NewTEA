'use client'

import * as React from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard-shell'
import { useSession } from '@/lib/auth-client'
import {
  GraduationCap,
  Layers,
  ShieldCheck,
  Zap,
  BookOpen,
  Users,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  UserCheck,
  Settings,
  ClipboardCopy,
  FileText,
  Sparkles,
  CheckCircle2
} from 'lucide-react'

export default function Home() {
  const { data: session } = useSession()
  const user = session?.user as { role?: string; name?: string; email?: string } | undefined
  const userRole = (user?.role || 'TEACHER').toUpperCase()

  return (
    <DashboardShell
      title="หน้าหลัก"
      description="Triam Evaluation and Assessment System (NewTEA)"
      badge="TUNorth"
      actions={
        <Link
          href="/courses"
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">สมุดบันทึกคะแนน</span>
          <span className="sm:hidden">วิชา</span>
        </Link>
      }
    >
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white p-6 sm:p-10 lg:p-12 shadow-xl shadow-brand-900/20">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-brand-100">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth)
              </span>
              {user && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  ยินดีต้อนรับ, {user.name} ({userRole})
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              ระบบบันทึกผลการเรียนประจำรายวิชา NewTEA
            </h1>
            <p className="text-sm sm:text-base text-brand-100 leading-relaxed max-w-2xl">
              ศูนย์กลางบันทึกคะแนน ตัดเกรดอัตโนมัติ และประเมินผลการเรียนรู้แบบรวมศูนย์
              รองรับ 45 ห้องเรียน (ม.4 - ม.6), กลุ่มภาษาที่ 3, วิชาเลือก, ตรวจสอบ 3 ระยะ และเชื่อมต่อ AutoSGS
            </p>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Core Portals & Workflows */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500" />
              เมนูหลักและระบบงาน (Main Portals)
            </h2>
            <span className="text-xs font-medium text-muted-foreground">
              เข้าถึงตามบทบาทการทำงาน
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Courses & Gradebook */}
            <Link
              href="/courses"
              className="group bg-card border border-border hover:border-brand-500/60 p-5 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    สำหรับครูทุกคน
                  </span>
                </div>
                <h3 className="font-bold text-sm text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  สมุดบันทึกคะแนน (Gradebook)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  จัดการรายวิชา กรอกคะแนนสอบ เวลาเรียน ตัดเกรด Auto-map ประเมิน 3 ด้าน ส่งตรวจ 3 ระยะ และคัดลอก AutoSGS
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 pt-2 border-t border-border">
                <span>เปิดสมุดบันทึกคะแนน</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 2: Dept Head Review */}
            <Link
              href="/dept-head"
              className="group bg-card border border-border hover:border-brand-500/60 p-5 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    หัวหน้ากลุ่มสาระฯ
                  </span>
                </div>
                <h3 className="font-bold text-sm text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  ตรวจผลการเรียนกลุ่มสาระฯ
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ตรวจสอบคะแนนรายวิชาในกลุ่มสาระฯ 3 ระยะ ตรวจรับรอง (APPROVED) ส่งกลับแก้ไข (REVISE) และอนุมัติขอปลดล็อก
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 pt-2 border-t border-border">
                <span>เข้าสู่ระบบตรวจคะแนน</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 3: Academic Overview */}
            <Link
              href="/academic"
              className="group bg-card border border-border hover:border-brand-500/60 p-5 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    ฝ่ายวิชาการ
                  </span>
                </div>
                <h3 className="font-bold text-sm text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  ภาพรวมฝ่ายวิชาการ & SGS
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ตาราง TEA68 Grid ติดตามสถานะการส่งตรวจทั้งโรงเรียนแบบเรียลไทม์ ติ๊กยืนยันนำส่ง SGS และอนุมัติปลดล็อกปลายภาค
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 pt-2 border-t border-border">
                <span>เปิดแดชบอร์ดวิชาการ</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 4: Advisor Dashboard */}
            <Link
              href="/advisor"
              className="group bg-card border border-border hover:border-brand-500/60 p-5 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    ครูที่ปรึกษา
                  </span>
                </div>
                <h3 className="font-bold text-sm text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  แดชบอร์ดครูที่ปรึกษา
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  เลือกดูห้องเรียน 45 ห้อง (ม.4-ม.6) ตรวจสอบสถิตินักเรียนในความดูแล ภาษาที่ 3 และวิชาเลือกรายบุคคล
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 pt-2 border-t border-border">
                <span>เปิดแดชบอร์ดที่ปรึกษา</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* Administration Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-500" />
              ศูนย์ควบคุมการจัดการระบบ (Administration Center)
            </h2>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              ระบบฐานข้อมูลพร้อมใช้งาน
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <Link
              href="/admin/users"
              className="bg-card border border-border hover:border-brand-500/60 p-4 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-foreground">จัดการบัญชีผู้ใช้</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  เพิ่ม/แก้ไข/ลบ กำหนดบทบาท RBAC รีเซ็ตรหัสผ่าน และนำเข้าไฟล์ Excel/CSV
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 pt-1.5 border-t border-border">
                เปิดระบบ <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/students"
              className="bg-card border border-border hover:border-brand-500/60 p-4 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-foreground">จัดการข้อมูลนักเรียน</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  บัญชีนักเรียน 45 ห้อง ค้นหา กรองสถานะ ย้ายห้อง ลาออก และ Audit Trail
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 pt-1.5 border-t border-border">
                เปิดระบบ <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/advisors"
              className="bg-card border border-border hover:border-brand-500/60 p-4 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-foreground">ครูที่ปรึกษาประจำห้อง</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  กำหนดครูที่ปรึกษา 45 ห้อง (1-3 ท่าน/ห้อง) และนำเข้าข้อมูลจาก Google Sheets
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 pt-1.5 border-t border-border">
                เปิดระบบ <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/terms"
              className="bg-card border border-border hover:border-brand-500/60 p-4 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-foreground">ปีการศึกษา & เดดไลน์</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  จัดการภาคเรียน สลับสถานะ Active และกำหนดเดดไลน์ส่งตรวจ 3 ระยะ
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 pt-1.5 border-t border-border">
                เปิดระบบ <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/settings"
              className="bg-card border border-border hover:border-brand-500/60 p-4 rounded-2xl shadow-xs transition-all hover:shadow-md space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-foreground">เกณฑ์ประเมิน 3 ด้าน</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  กำหนดเกณฑ์และช่วงคะแนนตัดเกรด Auto-map คุณลักษณะ การอ่านฯ และสมรรถนะ
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 pt-1.5 border-t border-border">
                เปิดระบบ <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>

        {/* Integration Tools & Resources Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AutoSGS Integration Box */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <ClipboardCopy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    เครื่องมือ AutoSGS (1-Click Clipboard F2)
                  </h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    พร้อมใช้งาน v1.1.3+
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ในหน้าสมุดบันทึกคะแนน สามารถกดปุ่ม &quot;คัดลอกสำหรับ AutoSGS&quot; แล้วสลับไปที่หน้าเว็บ SGS ของ สพฐ. จากนั้นกดปุ่ม <kbd className="font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground font-bold">F2</kbd> โปรแกรมจะพิมพ์คะแนนให้อัตโนมัติในเสี้ยววินาที
            </p>
            <div className="pt-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
              <span>ตำแหน่งโปรแกรมบนเครื่อง:</span>
              <code className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border border-border">
                D:\TUNorth\apps\sgs\dist\AutoSGS.exe
              </code>
            </div>
          </div>

          {/* ปพ.5 PDF Report Engine Box */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    ระบบพิมพ์เล่มเอกสาร ปพ.5 (7 องค์ประกอบ)
                  </h3>
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">
                    Phase 5 Engine
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ระบบส่งออกเล่มเอกสาร ปพ.5 ฉบับสมบูรณ์ ประกอบด้วย หน้าปก, คำอธิบายรายวิชา, โครงสร้างรายวิชา, หน้าแทรกเวลาเรียน Studentcare, สรุปผลการเรียน, ผลประเมิน 3 ด้าน, และสถิติพร้อมช่องลงนาม
            </p>
            <div className="pt-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
              <span>ฟอร์แมตเอกสาร:</span>
              <span className="font-semibold text-foreground">PDF คมชัดพร้อมสั่งพิมพ์ (Print-ready)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border pt-6 pb-2 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 โรงเรียนเตรียมอุดมศึกษาภาคเหนือ (TUNorth) · ระบบ NewTEA</p>
          <p>Design Token: @design · Tailwind CSS v4 · ฟอนต์ Prompt</p>
        </footer>
      </div>
    </DashboardShell>
  )
}
