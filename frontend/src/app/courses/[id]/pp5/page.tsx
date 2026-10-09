'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { fetchApi } from '@/lib/api'
import { sortRooms } from '@/lib/utils'
import {
  calculateStandardGrade,
  calculateWeightedTotalScore,
  ScoreColumnDefinition
} from '@/lib/calculation-engine'
import {
  ArrowLeft,
  Printer,
  FileText,
  Filter,
  CheckSquare,
  Square,
  Clock,
  ExternalLink,
  ChevronDown,
  Layers,
  BookOpen
} from 'lucide-react'
import { toast } from 'sonner'
import { PdfPagesRenderer } from '@/components/pdf-pages-renderer'

export interface CourseAttachmentItem {
  url: string
  type: 'pdf' | 'image'
  name: string
}

interface TeacherAssignment {
  id?: string
  userId: string
  user?: {
    id?: string
    name?: string
    email?: string
    department?: string
  }
  isPrimary?: boolean
  assignedRooms?: string | string[]
}

interface CourseDetail {
  id: string
  courseCode: string
  courseName: string
  credits: number
  totalHours: number
  attendanceMaxPeriod1?: number
  attendanceMaxPeriod2?: number
  courseType: string
  department: string
  description?: string
  descriptionFilePath?: string
  descriptionFileType?: string
  descriptionFiles?: CourseAttachmentItem[] | string
  structureData?: string
  structureFilePath?: string
  structureFileType?: string
  structureFiles?: CourseAttachmentItem[] | string
  targetGroupType: string
  targetRooms?: string
  targetSubgroup?: string
  term?: {
    id: string
    year: number
    semester: number
  }
  teachers?: TeacherAssignment[]
}

interface ScoreColumn {
  id: string
  name: string
  maxScore: number
  weight: number
  periodType: number
  sequence: number
}

interface StudentEvaluation {
  id?: string
  enrollmentId: string
  attendanceHoursPeriod1?: number
  attendanceHoursPeriod2?: number
  attendanceHours: number
  attendancePercentage: number
  totalScore: number
  grade: string
  specialGrade?: string
  desirableSubscores?: number[]
  desirableGrade?: number
  readingSubscores?: number[]
  readingGrade?: number
  competencySubscores?: number[]
  competencyGrade?: number
}

interface GradebookStudent {
  enrollmentId: string
  studentId: string
  studentCode: string
  prefix: string
  firstName: string
  lastName: string
  roomId: string
  seatNo: number
  languageGroup?: string
  electiveGroup?: string
  status: string
  studentStatus: string
  scores: Record<string, number>
  absentMap: Record<string, boolean>
  remarksMap?: Record<string, string>
  evaluation?: StudentEvaluation
  parsedDesirableSubscores?: number[]
  parsedReadingSubscores?: number[]
  parsedCompetencySubscores?: number[]
}

function parseSubscores(raw: unknown, defaultCount: number, defaultLevel: number): number[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x) || 0)
  }
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((x) => Number(x) || 0)
      }
    } catch {
      // fallback
    }
  }
  return Array.from({ length: defaultCount }, () => defaultLevel)
}

function parseAttachmentFiles(
  raw: unknown,
  legacyPath?: string,
  legacyType?: string
): CourseAttachmentItem[] {
  if (Array.isArray(raw)) {
    return raw as CourseAttachmentItem[]
  }
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as CourseAttachmentItem[]
      }
    } catch {
      // fallback
    }
  }
  if (legacyPath) {
    return [
      {
        url: legacyPath,
        type: (legacyType === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
        name: legacyPath.split('/').pop() || 'ไฟล์แนบ'
      }
    ]
  }
  return []
}

export default function PP5ReportPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params?.id as string

  const [course, setCourse] = React.useState<CourseDetail | null>(null)
  const [rooms, setRooms] = React.useState<string[]>([])
  const [advisorsByRoom, setAdvisorsByRoom] = React.useState<Record<string, string[]>>({})
  const [scoreColumns, setScoreColumns] = React.useState<ScoreColumn[]>([])
  const [students, setStudents] = React.useState<GradebookStudent[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const descriptionAttachments = React.useMemo(() => {
    if (!course) return []
    return parseAttachmentFiles(
      course.descriptionFiles,
      course.descriptionFilePath,
      course.descriptionFileType
    )
  }, [course])

  const structureAttachments = React.useMemo(() => {
    if (!course) return []
    return parseAttachmentFiles(
      course.structureFiles,
      course.structureFilePath,
      course.structureFileType
    )
  }, [course])

  // Scope selection: 'ALL' (ทุกห้องเรียงตามหมวด 1-7) หรือเลือกห้องเดี่ยว
  const [selectedRoomScope, setSelectedRoomScope] = React.useState<string>('ALL')

  // Section selectors (1 to 7)
  const [includedSections, setIncludedSections] = React.useState<Record<string, boolean>>({
    cover: true,
    description: true,
    structure: true,
    studentcare: true,
    scores: true,
    assessments: true,
    sgs: true
  })
  const [isSectionFilterOpen, setIsSectionFilterOpen] = React.useState(false)

  // Load Gradebook and Advisors data
  React.useEffect(() => {
    async function loadData() {
      if (!courseId) return
      setIsLoading(true)
      try {
        const res = await fetchApi<{
          course: CourseDetail
          rooms: string[]
          advisorsByRoom?: Record<string, string[]>
          scoreColumns: ScoreColumn[]
          students: GradebookStudent[]
        }>(`/api/courses/${courseId}/gradebook`)

        setCourse(res.course)
        const sorted = sortRooms(res.rooms || [])
        setRooms(sorted)
        setAdvisorsByRoom(res.advisorsByRoom || {})
        setScoreColumns(res.scoreColumns || [])

        // If advisorsByRoom was empty, try fetching from /api/advisors as fallback
        if (!res.advisorsByRoom || Object.keys(res.advisorsByRoom).length === 0) {
          try {
            const advRes = await fetchApi<{
              advisorsByRoom?: Record<string, Array<{ name: string }>>
            }>('/api/advisors')
            if (advRes?.advisorsByRoom) {
              const mapped: Record<string, string[]> = {}
              Object.entries(advRes.advisorsByRoom).forEach(([rm, list]) => {
                mapped[rm] = list.map((item) => item.name)
              })
              setAdvisorsByRoom(mapped)
            }
          } catch {
            // ignore
          }
        }

        // Parse subscores
        const enriched = (res.students || []).map((s) => ({
          ...s,
          parsedDesirableSubscores: parseSubscores(
            s.evaluation?.desirableSubscores,
            8,
            s.evaluation?.desirableGrade ?? 3
          ),
          parsedReadingSubscores: parseSubscores(
            s.evaluation?.readingSubscores,
            5,
            s.evaluation?.readingGrade ?? 3
          ),
          parsedCompetencySubscores: parseSubscores(
            s.evaluation?.competencySubscores,
            5,
            s.evaluation?.competencyGrade ?? 3
          )
        }))
        setStudents(enriched)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลรายวิชาได้'
        toast.error(msg)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [courseId])

  // Displayed rooms for per-classroom sections (4, 5, 6, 7)
  const targetClassrooms = React.useMemo(() => {
    if (selectedRoomScope === 'ALL') {
      return rooms
    }
    return [selectedRoomScope]
  }, [rooms, selectedRoomScope])

  const toggleSection = (key: string) => {
    setIncludedSections((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const toggleAllSections = (checked: boolean) => {
    setIncludedSections({
      cover: checked,
      description: checked,
      structure: checked,
      studentcare: checked,
      scores: checked,
      assessments: checked,
      sgs: checked
    })
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          กำลังเตรียมข้อมูลเอกสาร ปพ.5 ตามระเบียบโรงเรียน...
        </p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <p className="text-base font-bold text-destructive mb-4">ไม่พบข้อมูลรายวิชา</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-card border border-border text-xs font-semibold hover:bg-muted"
        >
          กลับหน้าก่อนหน้า
        </button>
      </div>
    )
  }

  // Teacher names
  const teacherNames =
    course.teachers && course.teachers.length > 0
      ? course.teachers.map((t) => t.user?.name || '').filter(Boolean).join('   ')
      : 'คณะครูผู้สอนกลุ่มสาระฯ'

  // Grade level
  const gradeLevel =
    rooms.length > 0 && rooms[0].includes('.')
      ? rooms[0].split('.')[0]
      : course.courseCode.match(/\d/)?.[0] || '6'

  // Weekly hours approx: totalHours / 20 weeks
  const weeklyHours = course.totalHours > 0 ? (course.totalHours / 20).toFixed(0) : '2'

  // Score weights breakdown
  const p1Cols = scoreColumns.filter((c) => c.periodType === 1)
  const p2Cols = scoreColumns.filter((c) => c.periodType === 2)
  const p3Cols = scoreColumns.filter((c) => c.periodType === 3)
  const p4Cols = scoreColumns.filter((c) => c.periodType === 4)

  const p1Weight = p1Cols.reduce((acc, c) => acc + c.weight, 0)
  const p2Weight = p2Cols.reduce((acc, c) => acc + c.weight, 0)
  const p3Weight = p3Cols.reduce((acc, c) => acc + c.weight, 0)
  const p4Weight = p4Cols.reduce((acc, c) => acc + c.weight, 0)
  const totalWeight = p1Weight + p2Weight + p3Weight + p4Weight || 100

  // Total Course Statistics for Cover Page (01.ปก.pdf) across ALL students in the course
  const totalStudentCount = students.length

  const overallGradeStats: Record<string, number> = {
    '4': 0,
    '3.5': 0,
    '3': 0,
    '2.5': 0,
    '2': 0,
    '1.5': 0,
    '1': 0,
    '0': 0,
    'ร': 0,
    'มส': 0,
    'ผ': 0,
    'มผ': 0
  }

  const overallDesirable = { '3': 0, '2': 0, '1': 0, '0': 0 }
  const overallReading = { '3': 0, '2': 0, '1': 0, '0': 0 }
  const overallCompetency = { '3': 0, '2': 0, '1': 0, '0': 0 }

  students.forEach((st) => {
    const finalGrade = st.evaluation?.specialGrade || st.evaluation?.grade || '0'
    if (overallGradeStats[finalGrade] !== undefined) {
      overallGradeStats[finalGrade]++
    } else {
      overallGradeStats['0']++
    }

    const dG = String(st.evaluation?.desirableGrade ?? 3)
    const rG = String(st.evaluation?.readingGrade ?? 3)
    const cG = String(st.evaluation?.competencyGrade ?? 3)

    if (overallDesirable[dG as keyof typeof overallDesirable] !== undefined) overallDesirable[dG as keyof typeof overallDesirable]++
    if (overallReading[rG as keyof typeof overallReading] !== undefined) overallReading[rG as keyof typeof overallReading]++
    if (overallCompetency[cG as keyof typeof overallCompetency] !== undefined) overallCompetency[cG as keyof typeof overallCompetency]++
  })

  // Calculations of "ดีขึ้นไปร้อยละ" = (ดีเยี่ยม + ดี) / Total * 100
  const desirableGoodPlus = totalStudentCount > 0
    ? (((overallDesirable['3'] + overallDesirable['2']) / totalStudentCount) * 100).toFixed(2)
    : '0.00'

  const readingGoodPlus = totalStudentCount > 0
    ? (((overallReading['3'] + overallReading['2']) / totalStudentCount) * 100).toFixed(2)
    : '0.00'

  const competencyGoodPlus = totalStudentCount > 0
    ? (((overallCompetency['3'] + overallCompetency['2']) / totalStudentCount) * 100).toFixed(2)
    : '0.00'

  return (
    <div className="min-h-screen bg-muted/40 text-foreground font-sans print:bg-white print:text-black">
      {/* Top Floating Control Bar (Hidden when printing) */}
      <header className="no-print sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={`/courses/${courseId}`}
              className="p-1.5 sm:p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="กลับไปสมุดบันทึกคะแนน"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">พิมพ์เล่มเอกสาร ปพ.5</span>
                <span className="px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 font-mono text-[11px] font-bold">
                  {course.courseCode}
                </span>
                <span className="text-xs text-muted-foreground hidden md:inline">
                  (รูปแบบมาตรฐาน รร.เตรียมอุดมศึกษา ภาคเหนือ)
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-md">
                {course.courseName} • {course.department}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Scope / Room Selector */}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-card border border-border rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <label htmlFor="room-scope-filter" className="text-muted-foreground text-[11px] font-medium hidden sm:inline">โหมดห้องเรียน:</label>
              <select
                id="room-scope-filter"
                value={selectedRoomScope}
                onChange={(e) => setSelectedRoomScope(e.target.value)}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL">★ พิมพ์ทั้งเล่ม (ทุกห้อง 1 - {rooms.length})</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    พิมพ์เฉพาะห้อง ม.{r}
                  </option>
                ))}
              </select>
            </div>

            {/* Sections Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSectionFilterOpen((prev) => !prev)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="hidden sm:inline">เลือกองค์ประกอบ</span>
                <span className="sm:hidden">องค์ประกอบ</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              {isSectionFilterOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-card border border-border shadow-xl p-3 z-50 space-y-2 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-bold text-foreground">ลำดับเอกสาร 7 ส่วน</span>
                    <button
                      type="button"
                      onClick={() => toggleAllSections(true)}
                      className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                    >
                      เลือกทั้งหมด
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { key: 'cover', label: '1. ปกทางการรวมทุกห้อง (01.ปก)' },
                      { key: 'description', label: '2. คำอธิบายรายวิชา (PDF/รูป/ข้อความ)' },
                      { key: 'structure', label: '3. โครงสร้างรายวิชา (PDF/รูป/สัดส่วน)' },
                      { key: 'studentcare', label: `4. เวลาเรียน StudentCare (ทุกห้อง ${rooms.length > 0 ? `1-${rooms.length}` : ''})` },
                      { key: 'scores', label: `5. บันทึกคะแนน NewTEA (ทุกห้อง ${rooms.length > 0 ? `1-${rooms.length}` : ''})` },
                      { key: 'assessments', label: `6. ประเมิน 3 ด้านรายข้อย่อย (ทุกห้อง ${rooms.length > 0 ? `1-${rooms.length}` : ''})` },
                      { key: 'sgs', label: `7. ผลการเรียนจาก SGS (ทุกห้อง ${rooms.length > 0 ? `1-${rooms.length}` : ''})` }
                    ].map((sec) => (
                      <label
                        key={sec.key}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={includedSections[sec.key]}
                          onChange={() => toggleSection(sec.key)}
                          className="rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
                        />
                        <span className="text-foreground">{sec.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-brand-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>พิมพ์ ปพ.5<span className="hidden sm:inline"> / บันทึก PDF</span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Printable Sheets Container */}
      <main className="max-w-[210mm] mx-auto py-8 print:p-0 print:m-0 print:max-w-none">
        {/* ========================================================================= */}
        {/* PART 1: COVER PAGE (ตรงตามแบบ 01.ปก.pdf 100% All-in-One ใน 1 หน้า A4)      */}
        {/* ========================================================================= */}
        {includedSections.cover && (
          <section className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[10mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[8mm]">
            <div className="space-y-1.5 text-center">
              {/* Emblem */}
              <img
                src="/school-logo.png"
                alt="ตราโรงเรียนเตรียมอุดมศึกษา ภาคเหนือ"
                className="w-16 h-auto mx-auto object-contain mb-1"
              />
              <h1 className="text-base font-bold text-black tracking-tight">
                แบบบันทึกผลการเรียนประจำรายวิชา
              </h1>
              <div className="flex items-center justify-center gap-3 text-[11px] font-semibold text-black">
                <span>โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                <span>ตำบลหัวรอ</span>
                <span>อำเภอเมืองพิษณุโลก</span>
                <span>จังหวัดพิษณุโลก</span>
              </div>

              {/* Course & Semester Info Grid */}
              <div className="w-full border border-black text-[11px] mt-1.5 divide-y divide-black text-black">
                <div className="grid grid-cols-3 divide-x divide-black py-0.5 px-2 text-left">
                  <div>
                    <span className="font-semibold">ชั้นมัธยมศึกษาปีที่</span>{' '}
                    <span className="font-bold">{gradeLevel}</span>
                  </div>
                  <div>
                    <span className="font-semibold">ภาคเรียนที่</span>{' '}
                    <span className="font-bold">{course.term?.semester || 1}</span>
                  </div>
                  <div>
                    <span className="font-semibold">ปีการศึกษา</span>{' '}
                    <span className="font-bold">{course.term?.year || 2569}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-black py-0.5 px-2 text-left">
                  <div>
                    <span className="font-semibold">รหัสวิชา</span>{' '}
                    <span className="font-mono font-bold">{course.courseCode}</span>
                  </div>
                  <div>
                    <span className="font-semibold">รายวิชา</span>{' '}
                    <span className="font-bold truncate">{course.courseName}</span>
                  </div>
                  <div>
                    <span className="font-semibold">หน่วยกิต</span>{' '}
                    <span className="font-bold">{course.credits.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="font-semibold">เวลา</span>{' '}
                    <span className="font-bold">{weeklyHours}</span> ชม./สด.
                  </div>
                </div>

                <div className="py-0.5 px-2 text-left">
                  <span className="font-semibold">ครูผู้สอน</span>{' '}
                  <span className="font-bold">{teacherNames}</span>
                </div>
              </div>
            </div>

            {/* Table of Advisory Teachers (ทุกห้องที่สังกัดรายวิชา) */}
            <div className="my-1.5">
              <table className="w-full text-[10px] border-collapse border border-black text-black">
                <tbody>
                  {rooms.map((rm) => {
                    const advList = advisorsByRoom[rm] || []
                    const adv1 = advList[0] || '-'
                    const adv2 = advList[1] || ''
                    const adv3 = advList[2] || ''

                    // Group label
                    let groupLabel = 'ทั้งหมด'
                    if (course.targetGroupType === 'LANGUAGE_GROUP' && course.targetSubgroup) {
                      groupLabel = course.targetSubgroup
                    } else if (course.targetGroupType === 'ELECTIVE_GROUP' && course.targetSubgroup) {
                      groupLabel = course.targetSubgroup
                    }

                    return (
                      <tr key={rm} className="border-b border-black">
                        <td className="border-r border-black px-1.5 py-0.5 w-20 font-semibold text-left">
                          ครูที่ปรึกษา
                        </td>
                        <td className="border-r border-black px-2 py-0.5 text-left w-48 truncate">
                          {adv1}
                        </td>
                        <td className="border-r border-black px-2 py-0.5 text-left w-48 truncate">
                          {adv2} {adv3 ? `  ${adv3}` : ''}
                        </td>
                        <td className="border-r border-black px-2 py-0.5 text-left w-36">
                          ชั้นมัธยมศึกษาปีที่ <span className="font-bold font-mono">{rm}</span>
                        </td>
                        <td className="px-2 py-0.5 text-center w-20 font-semibold">
                          {groupLabel}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Evaluation Section */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-black text-left">
                สรุปผลการประเมิน
              </p>

              {/* Table A: Academic Grade Distribution */}
              <table className="w-full text-[9px] border-collapse border border-black text-center text-black">
                <thead>
                  <tr className="bg-slate-50 border-b border-black font-bold">
                    <th rowSpan={2} className="border-r border-black px-1 py-1 w-20">
                      จำนวนนักเรียน
                    </th>
                    <th colSpan={8} className="border-r border-black px-1 py-0.5">
                      ระดับผลการเรียน
                    </th>
                    <th colSpan={4} className="px-1 py-0.5">
                      ผลการประเมิน
                    </th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-black font-bold">
                    {['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'ผ', 'มผ'].map((g, idx) => (
                      <th
                        key={g}
                        className={`px-1 py-0.5 ${idx < 11 ? 'border-r border-black' : ''}`}
                      >
                        {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black font-mono">
                    <td className="border-r border-black px-1 py-0.5 font-bold font-sans">
                      {totalStudentCount}
                    </td>
                    {['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'ผ', 'มผ'].map((g, idx) => (
                      <td
                        key={`val-${g}`}
                        className={`px-1 py-0.5 ${idx < 11 ? 'border-r border-black' : ''}`}
                      >
                        {overallGradeStats[g] > 0 ? overallGradeStats[g] : '0'}
                      </td>
                    ))}
                  </tr>
                  <tr className="font-mono text-[8.5px]">
                    <td className="border-r border-black px-1 py-0.5 font-sans font-semibold">
                      คิดเป็นร้อยละ
                    </td>
                    {['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'ผ', 'มผ'].map((g, idx) => {
                      const pct = totalStudentCount > 0
                        ? ((overallGradeStats[g] / totalStudentCount) * 100).toFixed(2)
                        : '0.00'
                      return (
                        <td
                          key={`pct-${g}`}
                          className={`px-1 py-0.5 ${idx < 11 ? 'border-r border-black' : ''}`}
                        >
                          {pct}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>

              {/* Table B: 3D Assessment Summary Tables (Side by Side) */}
              <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                {/* 1. คุณลักษณะอันพึงประสงค์ */}
                <table className="w-full border-collapse border border-black text-center text-black">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black">
                      <th colSpan={5} className="px-1 py-0.5 font-bold">
                        คุณลักษณะอันพึงประสงค์
                      </th>
                    </tr>
                    <tr className="border-b border-black text-[8px] font-semibold">
                      <th className="border-r border-black px-0.5 py-0.5">จำนวนนักเรียน</th>
                      <th className="border-r border-black px-0.5 py-0.5">ดีเยี่ยม</th>
                      <th className="border-r border-black px-0.5 py-0.5">ดี</th>
                      <th className="border-r border-black px-0.5 py-0.5">ผ่าน</th>
                      <th className="px-0.5 py-0.5">ไม่ผ่าน</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black font-mono">
                      <td className="border-r border-black px-0.5 py-0.5 font-bold font-sans">{totalStudentCount}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallDesirable['3']}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallDesirable['2']}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallDesirable['1']}</td>
                      <td className="px-0.5 py-0.5">{overallDesirable['0']}</td>
                    </tr>
                    <tr className="border-b border-black font-mono text-[8px]">
                      <td className="border-r border-black px-0.5 py-0.5 font-sans">คิดเป็นร้อยละ</td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallDesirable['3'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallDesirable['2'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallDesirable['1'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallDesirable['0'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                    </tr>
                    <tr className="font-bold bg-pink-50/50">
                      <td className="border-r border-black px-0.5 py-0.5 font-sans">ดีขึ้นไปร้อยละ</td>
                      <td colSpan={4} className="px-0.5 py-0.5 font-mono text-[10px]">
                        {desirableGoodPlus}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 2. การอ่าน คิดวิเคราะห์ และเขียน */}
                <table className="w-full border-collapse border border-black text-center text-black">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black">
                      <th colSpan={5} className="px-1 py-0.5 font-bold">
                        การอ่าน คิดวิเคราะห์ และเขียน
                      </th>
                    </tr>
                    <tr className="border-b border-black text-[8px] font-semibold">
                      <th className="border-r border-black px-0.5 py-0.5">จำนวนนักเรียน</th>
                      <th className="border-r border-black px-0.5 py-0.5">ดีเยี่ยม</th>
                      <th className="border-r border-black px-0.5 py-0.5">ดี</th>
                      <th className="border-r border-black px-0.5 py-0.5">ผ่าน</th>
                      <th className="px-0.5 py-0.5">ไม่ผ่าน</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black font-mono">
                      <td className="border-r border-black px-0.5 py-0.5 font-bold font-sans">{totalStudentCount}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallReading['3']}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallReading['2']}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallReading['1']}</td>
                      <td className="px-0.5 py-0.5">{overallReading['0']}</td>
                    </tr>
                    <tr className="border-b border-black font-mono text-[8px]">
                      <td className="border-r border-black px-0.5 py-0.5 font-sans">คิดเป็นร้อยละ</td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallReading['3'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallReading['2'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallReading['1'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallReading['0'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                    </tr>
                    <tr className="font-bold bg-pink-50/50">
                      <td className="border-r border-black px-0.5 py-0.5 font-sans">ดีขึ้นไปร้อยละ</td>
                      <td colSpan={4} className="px-0.5 py-0.5 font-mono text-[10px]">
                        {readingGoodPlus}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 3. สมรรถนะสำคัญผู้เรียน */}
                <table className="w-full border-collapse border border-black text-center text-black">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black">
                      <th colSpan={5} className="px-1 py-0.5 font-bold">
                        สมรรถนะสำคัญผู้เรียน
                      </th>
                    </tr>
                    <tr className="border-b border-black text-[8px] font-semibold">
                      <th className="border-r border-black px-0.5 py-0.5">จำนวนนักเรียน</th>
                      <th className="border-r border-black px-0.5 py-0.5">ดีเยี่ยม</th>
                      <th className="border-r border-black px-0.5 py-0.5">ดี</th>
                      <th className="border-r border-black px-0.5 py-0.5">พอใช้</th>
                      <th className="px-0.5 py-0.5">ปรับปรุง</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black font-mono">
                      <td className="border-r border-black px-0.5 py-0.5 font-bold font-sans">{totalStudentCount}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallCompetency['3']}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallCompetency['2']}</td>
                      <td className="border-r border-black px-0.5 py-0.5">{overallCompetency['1']}</td>
                      <td className="px-0.5 py-0.5">{overallCompetency['0']}</td>
                    </tr>
                    <tr className="border-b border-black font-mono text-[8px]">
                      <td className="border-r border-black px-0.5 py-0.5 font-sans">คิดเป็นร้อยละ</td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallCompetency['3'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallCompetency['2'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="border-r border-black px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallCompetency['1'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-0.5 py-0.5">
                        {totalStudentCount > 0 ? ((overallCompetency['0'] / totalStudentCount) * 100).toFixed(2) : '0.00'}
                      </td>
                    </tr>
                    <tr className="font-bold bg-pink-50/50">
                      <td className="border-r border-black px-0.5 py-0.5 font-sans">ดีขึ้นไปร้อยละ</td>
                      <td colSpan={4} className="px-0.5 py-0.5 font-mono text-[10px]">
                        {competencyGoodPlus}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval & Signatures (การอนุมัติผลการเรียน 5 ลำดับ บนหน้าปกแผ่นนี้) */}
            <div className="space-y-1.5 pt-1 text-[10px] text-black">
              <p className="font-bold text-left">การอนุมัติผลการเรียน</p>
              
              <div className="space-y-1 pl-4">
                {/* 1. Teacher */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" /> อนุมัติ
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" /> ไม่อนุมัติ
                  </div>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span>ลงชื่อ</span>
                    <span className="flex-1 border-b border-dotted border-black inline-block" />
                    <span className="w-36 text-left">ครูผู้สอน</span>
                  </div>
                </div>

                {/* 2. Department Head */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" /> อนุมัติ
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" /> ไม่อนุมัติ
                  </div>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span>ลงชื่อ</span>
                    <span className="flex-1 border-b border-dotted border-black inline-block" />
                    <span className="w-36 text-left">หัวหน้ากลุ่มสาระการเรียนรู้</span>
                  </div>
                </div>

                {/* 3. Measurement Head */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" /> อนุมัติ
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" /> ไม่อนุมัติ
                  </div>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span>ลงชื่อ</span>
                    <span className="flex-1 border-b border-dotted border-black inline-block" />
                    <span className="w-36 text-left">หัวหน้างานวัดผลและประเมินผล</span>
                  </div>
                </div>

                {/* 4. Academic Vice Principal */}
                <div className="flex items-center gap-4 pt-0.5">
                  <span className="font-semibold">เรียนเสนอเพื่อโปรดพิจารณา</span>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span>ลงชื่อ</span>
                    <span className="flex-1 border-b border-dotted border-black inline-block" />
                    <span className="w-36 text-left">รองผู้อำนวยการโรงเรียน</span>
                  </div>
                </div>

                {/* 5. Director (อนุมัติผลทางการ) */}
                <div className="flex flex-col items-center justify-center pt-1.5 space-y-1">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 border border-black inline-block" /> อนุมัติ
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 border border-black inline-block" /> ไม่อนุมัติ
                    </div>
                  </div>
                  <div className="w-64 border-b border-dotted border-black h-4" />
                  <p className="font-bold text-[11px]">(นายยงค์ยุทธ รุ่งแจ้ง)</p>
                  <p className="text-[10px]">ผู้อำนวยการโรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</p>
                  <p className="text-[9px] text-slate-700">วันที่ ...... เดือน .......................... พ.ศ. ............</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* PART 2: COURSE DESCRIPTION (คำอธิบายรายวิชา - ไฟล์แนบ PDF/รูป หรือข้อความ) */}
        {/* ========================================================================= */}
        {includedSections.description && (
          <>
            {descriptionAttachments.length > 0 ? (
              descriptionAttachments[0].type === 'pdf' ? (
                <PdfPagesRenderer
                  pdfUrl={descriptionAttachments[0].url}
                  title="คำอธิบายรายวิชา (Course Description)"
                  courseCode={course.courseCode}
                />
              ) : (
                descriptionAttachments.map((img, idx) => (
                  <section
                    key={`desc-img-${idx}`}
                    className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[10mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[8mm]"
                  >
                    <div className="border-b border-black pb-2 text-center space-y-0.5">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-700">
                        <span>รหัสวิชา {course.courseCode} รายวิชา {course.courseName}</span>
                        <span>
                          คำอธิบายรายวิชา (หน้าที่ {idx + 1} จาก {descriptionAttachments.length})
                        </span>
                      </div>
                    </div>

                    <div className="my-auto flex justify-center items-center py-2">
                      <img
                        src={img.url}
                        alt={`คำอธิบายรายวิชา หน้าที่ ${idx + 1}`}
                        className="max-h-[250mm] w-auto max-w-full object-contain mx-auto border border-slate-300 rounded-lg print:border-none"
                      />
                    </div>

                    <div className="pt-2 border-t border-black text-[10px] text-slate-700 flex justify-between">
                      <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                      <span>
                        คำอธิบายรายวิชา {course.courseCode} (หน้า {idx + 1}/{descriptionAttachments.length})
                      </span>
                    </div>
                  </section>
                ))
              )
            ) : (
              <section className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[16mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[12mm]">
                <div className="space-y-6">
                  <div className="border-b-2 border-black pb-3 text-center space-y-1">
                    <h2 className="text-xl font-bold tracking-tight text-black">
                      คำอธิบายรายวิชา (Course Description)
                    </h2>
                    <p className="text-xs text-black">
                      รหัสวิชา {course.courseCode} รายวิชา {course.courseName} • กลุ่มสาระการเรียนรู้{course.department}
                    </p>
                    <p className="text-xs text-slate-700">
                      ระดับชั้นมัธยมศึกษาปีที่ {gradeLevel} เวลาเรียน {course.totalHours} ชั่วโมง/ภาคเรียน ({course.credits} หน่วยกิต)
                    </p>
                  </div>

                  <div className="text-sm leading-relaxed text-black whitespace-pre-wrap text-justify indent-8 space-y-4">
                    {course.description ? (
                      course.description
                    ) : (
                      <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs italic">
                        (อยู่ระหว่างการบันทึกคำอธิบายรายวิชาในระบบ NewTEA หรือแนบไฟล์เอกสาร)
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between">
                  <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                  <span>คำอธิบายรายวิชา {course.courseCode}</span>
                </div>
              </section>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* PART 3: COURSE STRUCTURE (โครงสร้างรายวิชา - ไฟล์แนบ PDF/รูป หรือสัดส่วน)  */}
        {/* ========================================================================= */}
        {includedSections.structure && (
          <>
            {structureAttachments.length > 0 ? (
              structureAttachments[0].type === 'pdf' ? (
                <PdfPagesRenderer
                  pdfUrl={structureAttachments[0].url}
                  title="โครงสร้างรายวิชาและสัดส่วนคะแนนการประเมิน"
                  courseCode={course.courseCode}
                />
              ) : (
                structureAttachments.map((img, idx) => (
                  <section
                    key={`struct-img-${idx}`}
                    className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[10mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[8mm]"
                  >
                    <div className="border-b border-black pb-2 text-center space-y-0.5">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-700">
                        <span>รหัสวิชา {course.courseCode} รายวิชา {course.courseName}</span>
                        <span>
                          โครงสร้างรายวิชา (หน้าที่ {idx + 1} จาก {structureAttachments.length})
                        </span>
                      </div>
                    </div>

                    <div className="my-auto flex justify-center items-center py-2">
                      <img
                        src={img.url}
                        alt={`โครงสร้างรายวิชา หน้าที่ ${idx + 1}`}
                        className="max-h-[250mm] w-auto max-w-full object-contain mx-auto border border-slate-300 rounded-lg print:border-none"
                      />
                    </div>

                    <div className="pt-2 border-t border-black text-[10px] text-slate-700 flex justify-between">
                      <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                      <span>
                        โครงสร้างรายวิชา {course.courseCode} (หน้า {idx + 1}/{structureAttachments.length})
                      </span>
                    </div>
                  </section>
                ))
              )
            ) : (
              <section className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[16mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[12mm]">
                <div className="space-y-6">
                  <div className="border-b-2 border-black pb-3 text-center space-y-1">
                    <h2 className="text-xl font-bold tracking-tight text-black">
                      โครงสร้างรายวิชาและสัดส่วนคะแนนการประเมิน
                    </h2>
                    <p className="text-xs text-black">
                      รหัสวิชา {course.courseCode} รายวิชา {course.courseName} • {course.totalHours} ชั่วโมง ({course.credits} หน่วยกิต)
                    </p>
                  </div>

                  {/* Learning Outcomes / Unit Structure */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-black">
                      ผลการเรียนรู้ / ตัวชี้วัด / โครงสร้างหน่วยการเรียนรู้:
                    </h3>
                    <div className="text-xs leading-relaxed text-black whitespace-pre-wrap p-4 rounded-xl border border-black bg-slate-50/50 min-h-[90px]">
                      {course.structureData ? (
                        course.structureData
                      ) : (
                        <span className="text-slate-400 italic">
                          (อยู่ระหว่างการบันทึกโครงสร้างหน่วยการเรียนรู้ในระบบ NewTEA หรือแนบไฟล์เอกสาร)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assessment Periods & Weight Table */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-black">
                      สัดส่วนการวัดและประเมินผลการเรียนรู้ (คะแนนเต็ม 100 คะแนน):
                    </h3>
                    <table className="w-full text-xs border-collapse border border-black">
                      <thead>
                        <tr className="bg-slate-100 text-black font-bold border-b border-black">
                          <th className="border border-black px-3 py-2 text-center w-12">ลำดับ</th>
                          <th className="border border-black px-3 py-2 text-left">ช่วงการวัดและประเมินผล</th>
                          <th className="border border-black px-3 py-2 text-center w-28">คะแนนเต็ม</th>
                          <th className="border border-black px-3 py-2 text-center w-28">สัดส่วน (ร้อยละ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black px-3 py-1.5 text-center">1</td>
                          <td className="border border-black px-3 py-1.5 font-medium">คะแนนเก็บระหว่างภาคเรียน (ก่อนกลางภาค)</td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono">
                            {p1Cols.reduce((acc, c) => acc + c.maxScore, 0)}
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono font-bold">{p1Weight}</td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 text-center">2</td>
                          <td className="border border-black px-3 py-1.5 font-medium">การประเมินผลกลางภาคเรียน (สอบกลางภาค)</td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono">
                            {p2Cols.reduce((acc, c) => acc + c.maxScore, 0)}
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono font-bold">{p2Weight}</td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 text-center">3</td>
                          <td className="border border-black px-3 py-1.5 font-medium">คะแนนเก็บระหว่างภาคเรียน (หลังกลางภาค)</td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono">
                            {p3Cols.reduce((acc, c) => acc + c.maxScore, 0)}
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono font-bold">{p3Weight}</td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 text-center">4</td>
                          <td className="border border-black px-3 py-1.5 font-medium">การประเมินผลปลายภาคเรียน (สอบปลายภาค)</td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono">
                            {p4Cols.reduce((acc, c) => acc + c.maxScore, 0)}
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center font-mono font-bold">{p4Weight}</td>
                        </tr>
                        <tr className="bg-slate-100 font-bold border-t-2 border-black">
                          <td colSpan={2} className="border border-black px-3 py-2 text-right">รวมทั้งสิ้น</td>
                          <td className="border border-black px-3 py-2 text-center font-mono">
                            {scoreColumns.reduce((acc, c) => acc + c.maxScore, 0)}
                          </td>
                          <td className="border border-black px-3 py-2 text-center font-mono text-sm">{totalWeight}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between">
                  <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                  <span>โครงสร้างรายวิชา {course.courseCode}</span>
                </div>
              </section>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* PART 4: STUDENTCARE ATTENDANCE SHEETS (เรียงทุกห้องตั้งแต่ห้อง 1 - 15)     */}
        {/* ========================================================================= */}
        {includedSections.studentcare && (
          <>
            {targetClassrooms.map((room) => {
              const roomStudents = students.filter((s) => s.roomId === room)
              if (roomStudents.length === 0) return null

              return (
                <section
                  key={`studentcare-${room}`}
                  className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[16mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[12mm]"
                >
                  <div className="space-y-6">
                    <div className="border-b-2 border-black pb-3 text-center space-y-1">
                      <h2 className="text-xl font-bold tracking-tight text-black">
                        แบบบันทึกเวลาเรียนประจำห้องเรียน (StudentCare)
                      </h2>
                      <p className="text-xs text-black">
                        รหัสวิชา {course.courseCode} รายวิชา {course.courseName} • ชั้นมัธยมศึกษาปีที่ {room}
                      </p>
                      <p className="text-xs text-slate-700">
                        ภาคเรียนที่ {course.term?.semester || 1} ปีการศึกษา {course.term?.year || 2569}
                      </p>
                    </div>

                    {/* Placeholder Box for Physical / Exported Studentcare Attachment */}
                    <div className="my-10 p-12 rounded-3xl border-2 border-dashed border-slate-400 bg-slate-50/60 text-center space-y-4 flex flex-col items-center justify-center min-h-[380px]">
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-700">
                        <Clock className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5 max-w-md">
                        <p className="text-base font-bold text-black">
                          พื้นที่สำหรับสอดแทรกแบบบันทึกเวลาเรียน ชั้น ม.{room}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          (โปรดพิมพ์รายงานบันทึกเวลาเรียนฉบับสมบูรณ์จากระบบ StudentCare แล้วนำมาสอดแทรกหรือเย็บรวม ณ หน้านี้)
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-300 text-xs text-black space-y-1">
                        <p>
                          <span className="font-bold">นักเรียนในห้อง:</span> {roomStudents.length} คน |{' '}
                          <span className="font-bold">เวลาเรียนทั้งหมด:</span> {course.totalHours} ชั่วโมง
                        </p>
                        <p>
                          <span className="font-bold">เกณฑ์เวลาเรียนขั้นต่ำ (80%):</span> {(course.totalHours * 0.8).toFixed(1)} ชั่วโมง
                        </p>
                        <p className="text-[11px] text-slate-600 italic pt-1">
                          * ผู้เรียนที่มีเวลาเรียนต่ำกว่าร้อยละ 80 ของเวลาเรียนทั้งหมด จะมีผลการเรียนเป็น &ldquo;มส&rdquo; (หมดสิทธิ์สอบ)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between">
                    <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                    <span>รายงานเวลาเรียน StudentCare ห้อง ม.{room}</span>
                  </div>
                </section>
              )
            })}
          </>
        )}

        {/* ========================================================================= */}
        {/* PART 5: NEWTEA GRADEBOOK SCORE SHEETS (เรียงทุกห้องตั้งแต่ห้อง 1 - 15)     */}
        {/* ========================================================================= */}
        {includedSections.scores && (
          <>
            {targetClassrooms.map((room) => {
              const roomStudents = students
                .filter((s) => s.roomId === room)
                .sort((a, b) => a.seatNo - b.seatNo)
              if (roomStudents.length === 0) return null

              let totalScoreSum = 0
              let gradedCount = 0

              roomStudents.forEach((st) => {
                const finalGrade = st.evaluation?.specialGrade || st.evaluation?.grade || '0'
                const numGrade = parseFloat(finalGrade)
                if (!isNaN(numGrade) && !st.evaluation?.specialGrade) {
                  totalScoreSum += numGrade
                  gradedCount++
                }
              })
              const roomGPA = gradedCount > 0 ? (totalScoreSum / gradedCount).toFixed(2) : '-'

              return (
                <section
                  key={`scores-${room}`}
                  className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[12mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[8mm]"
                >
                  <div className="space-y-3">
                    <div className="border-b-2 border-black pb-1.5 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold tracking-tight text-black">
                          ตารางสรุปผลการเรียนรู้ประจำรายวิชา (ปพ.5)
                        </h2>
                        <p className="text-[11px] text-black">
                          รหัสวิชา {course.courseCode} {course.courseName} • ห้อง ม.{room}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-black">
                        <p className="font-bold">ภาคเรียนที่ {course.term?.semester || 1}/{course.term?.year || 2569}</p>
                        <p className="text-[10px] text-slate-700">นร. ทั้งหมด {roomStudents.length} คน</p>
                      </div>
                    </div>

                    <table className="w-full text-[9.5px] border-collapse border border-black">
                      <thead>
                        <tr className="bg-slate-100 text-black font-bold border-b border-black">
                          <th className="border border-black px-1 py-1 text-center w-7">ที่</th>
                          <th className="border border-black px-1 py-1 text-center w-14">รหัส</th>
                          <th className="border border-black px-1.5 py-1 text-left">ชื่อ - สกุล</th>
                          <th className="border border-black px-1 py-1 text-center w-11">ก่อนกลาง ({p1Weight})</th>
                          <th className="border border-black px-1 py-1 text-center w-11">กลางภาค ({p2Weight})</th>
                          <th className="border border-black px-1 py-1 text-center w-11">หลังกลาง ({p3Weight})</th>
                          <th className="border border-black px-1 py-1 text-center w-11">ปลายภาค ({p4Weight})</th>
                          <th className="border border-black px-1 py-1 text-center w-11 font-bold bg-slate-200">รวม 100</th>
                          <th className="border border-black px-1 py-1 text-center w-9 font-bold bg-slate-200">เกรด</th>
                          <th className="border border-black px-1 py-1 text-center w-9">เวลา %</th>
                          <th className="border border-black px-1 py-1 text-center w-11">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomStudents.map((st, idx) => {
                          const p1Score = p1Cols.reduce((acc, col) => acc + (st.absentMap[col.id] ? 0 : (st.scores[col.id] || 0)), 0)
                          const p2Score = p2Cols.reduce((acc, col) => acc + (st.absentMap[col.id] ? 0 : (st.scores[col.id] || 0)), 0)
                          const p3Score = p3Cols.reduce((acc, col) => acc + (st.absentMap[col.id] ? 0 : (st.scores[col.id] || 0)), 0)
                          const p4Score = p4Cols.reduce((acc, col) => acc + (st.absentMap[col.id] ? 0 : (st.scores[col.id] || 0)), 0)

                          const total = st.evaluation?.totalScore !== undefined
                            ? st.evaluation.totalScore
                            : calculateWeightedTotalScore(st.scores, st.absentMap, scoreColumns)

                          const finalGrade = st.evaluation?.specialGrade || st.evaluation?.grade || calculateStandardGrade(total)
                          const attPct = st.evaluation?.attendancePercentage ?? 100

                          return (
                            <tr key={st.enrollmentId} className="hover:bg-slate-50 border-b border-black">
                              <td className="border border-black px-0.5 py-0.5 text-center font-mono">{st.seatNo || idx + 1}</td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono">{st.studentCode}</td>
                              <td className="border border-black px-1.5 py-0.5 truncate max-w-[130px]">
                                {st.prefix}{st.firstName} {st.lastName}
                              </td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono">{p1Score}</td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono">{p2Score}</td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono">{p3Score}</td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono">{p4Score}</td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono font-bold bg-slate-50">
                                {total.toFixed(1)}
                              </td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono font-bold bg-slate-100">
                                {finalGrade}
                              </td>
                              <td className="border border-black px-1 py-0.5 text-center font-mono">{attPct.toFixed(0)}%</td>
                              <td className="border border-black px-1 py-0.5 text-center text-[8.5px] text-slate-600">
                                {st.evaluation?.specialGrade ? st.evaluation.specialGrade : ''}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div className="flex items-center justify-between text-[10px] font-semibold text-black pt-1">
                      <span>จำนวนนักเรียน: {roomStudents.length} คน</span>
                      <span>ผลการเรียนเฉลี่ยประจำห้อง: {roomGPA}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-300 text-[9.5px] text-slate-600 flex justify-between">
                    <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                    <span>ตารางคะแนนรวมและเกรด ห้อง ม.{room}</span>
                  </div>
                </section>
              )
            })}
          </>
        )}

        {/* ========================================================================= */}
        {/* PART 6: 3D ASSESSMENTS SUMMARY SHEETS (เรียงทุกห้องตั้งแต่ห้อง 1 - 15)     */}
        {/* ========================================================================= */}
        {includedSections.assessments && (
          <>
            {targetClassrooms.map((room) => {
              const roomStudents = students
                .filter((s) => s.roomId === room)
                .sort((a, b) => a.seatNo - b.seatNo)
              if (roomStudents.length === 0) return null

              return (
                <section
                  key={`assessments-${room}`}
                  className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[12mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[8mm]"
                >
                  <div className="space-y-3">
                    <div className="border-b-2 border-black pb-1.5 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold tracking-tight text-black">
                          ตารางสรุปผลการประเมิน 3 ด้าน (ปพ.5)
                        </h2>
                        <p className="text-[10px] text-black">
                          คุณลักษณะอันพึงประสงค์ (8 ข้อ) • การอ่าน คิดวิเคราะห์ฯ (5 ข้อ) • สมรรถนะสำคัญ (5 ด้าน) • ม.{room}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-black">
                        <p className="font-bold">ภาคเรียนที่ {course.term?.semester || 1}/{course.term?.year || 2569}</p>
                      </div>
                    </div>

                    <table className="w-full text-[8.5px] border-collapse border border-black">
                      <thead>
                        <tr className="bg-slate-100 text-black font-bold border-b border-black">
                          <th rowSpan={2} className="border border-black px-1 py-1 text-center w-6">ที่</th>
                          <th rowSpan={2} className="border border-black px-1.5 py-1 text-left">ชื่อ - สกุล</th>
                          <th colSpan={9} className="border border-black px-1 py-0.5 text-center bg-purple-50">
                            คุณลักษณะอันพึงประสงค์ (8 ข้อ)
                          </th>
                          <th colSpan={6} className="border border-black px-1 py-0.5 text-center bg-blue-50">
                            การอ่าน คิดวิเคราะห์ฯ (5 ข้อ)
                          </th>
                          <th colSpan={6} className="border border-black px-1 py-0.5 text-center bg-amber-50">
                            สมรรถนะสำคัญ (5 ด้าน)
                          </th>
                        </tr>
                        <tr className="bg-slate-50 text-black text-[7.5px] font-semibold border-b border-black">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <th key={`d-${i}`} className="border border-black px-0.5 py-0.5 text-center w-3.5">{i}</th>
                          ))}
                          <th className="border border-black px-0.5 py-0.5 text-center font-bold bg-purple-100 w-4.5">สรุป</th>

                          {[1, 2, 3, 4, 5].map((i) => (
                            <th key={`r-${i}`} className="border border-black px-0.5 py-0.5 text-center w-3.5">{i}</th>
                          ))}
                          <th className="border border-black px-0.5 py-0.5 text-center font-bold bg-blue-100 w-4.5">สรุป</th>

                          {[1, 2, 3, 4, 5].map((i) => (
                            <th key={`c-${i}`} className="border border-black px-0.5 py-0.5 text-center w-3.5">{i}</th>
                          ))}
                          <th className="border border-black px-0.5 py-0.5 text-center font-bold bg-amber-100 w-4.5">สรุป</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomStudents.map((st, idx) => {
                          const dSub = st.parsedDesirableSubscores || [3, 3, 3, 3, 3, 3, 3, 3]
                          const rSub = st.parsedReadingSubscores || [3, 3, 3, 3, 3]
                          const cSub = st.parsedCompetencySubscores || [3, 3, 3, 3, 3]

                          const dSum = st.evaluation?.desirableGrade ?? 3
                          const rSum = st.evaluation?.readingGrade ?? 3
                          const cSum = st.evaluation?.competencyGrade ?? 3

                          return (
                            <tr key={st.enrollmentId} className="hover:bg-slate-50 border-b border-black">
                              <td className="border border-black px-0.5 py-0.5 text-center font-mono">{st.seatNo || idx + 1}</td>
                              <td className="border border-black px-1.5 py-0.5 truncate max-w-[110px]">
                                {st.prefix}{st.firstName} {st.lastName}
                              </td>

                              {dSub.slice(0, 8).map((val, i) => (
                                <td key={`dval-${i}`} className="border border-black px-0.5 py-0.5 text-center font-mono">{val}</td>
                              ))}
                              <td className="border border-black px-0.5 py-0.5 text-center font-mono font-bold bg-purple-50">{dSum}</td>

                              {rSub.slice(0, 5).map((val, i) => (
                                <td key={`rval-${i}`} className="border border-black px-0.5 py-0.5 text-center font-mono">{val}</td>
                              ))}
                              <td className="border border-black px-0.5 py-0.5 text-center font-mono font-bold bg-blue-50">{rSum}</td>

                              {cSub.slice(0, 5).map((val, i) => (
                                <td key={`cval-${i}`} className="border border-black px-0.5 py-0.5 text-center font-mono">{val}</td>
                              ))}
                              <td className="border border-black px-0.5 py-0.5 text-center font-mono font-bold bg-amber-50">{cSum}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div className="text-[8.5px] text-slate-700 leading-normal pt-1">
                      <p className="font-semibold text-black">เกณฑ์ระดับคุณภาพการประเมิน:</p>
                      <p>
                        คุณลักษณะอันพึงประสงค์ & การอ่าน คิดวิเคราะห์ฯ: 3 = ดีเยี่ยม, 2 = ดี, 1 = ผ่าน, 0 = ไม่ผ่าน |
                        สมรรถนะสำคัญ: 3 = ดีเยี่ยม, 2 = ดี, 1 = พอใช้, 0 = ปรับปรุง
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-300 text-[9.5px] text-slate-600 flex justify-between">
                    <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                    <span>สรุปผลการประเมิน 3 ด้าน ห้อง ม.{room}</span>
                  </div>
                </section>
              )
            })}
          </>
        )}

        {/* ========================================================================= */}
        {/* PART 7: SGS GRADE REPORT SHEETS (เรียงทุกห้องตั้งแต่ห้อง 1 - 15)           */}
        {/* ========================================================================= */}
        {includedSections.sgs && (
          <>
            {targetClassrooms.map((room) => {
              const roomStudents = students.filter((s) => s.roomId === room)
              if (roomStudents.length === 0) return null

              return (
                <section
                  key={`sgs-${room}`}
                  className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[16mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[12mm]"
                >
                  <div className="space-y-6">
                    <div className="border-b-2 border-black pb-3 text-center space-y-1">
                      <h2 className="text-xl font-bold tracking-tight text-black">
                        แบบรายงานผลการเรียนจากระบบ SGS (Secondary Grading System)
                      </h2>
                      <p className="text-xs text-black">
                        รหัสวิชา {course.courseCode} รายวิชา {course.courseName} • ชั้นมัธยมศึกษาปีที่ {room}
                      </p>
                      <p className="text-xs text-slate-700">
                        ภาคเรียนที่ {course.term?.semester || 1} ปีการศึกษา {course.term?.year || 2569}
                      </p>
                    </div>

                    {/* Placeholder Box for SGS Printed Report Attachment */}
                    <div className="my-10 p-12 rounded-3xl border-2 border-dashed border-slate-400 bg-slate-50/60 text-center space-y-4 flex flex-col items-center justify-center min-h-[380px]">
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-700">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5 max-w-md">
                        <p className="text-base font-bold text-black">
                          พื้นที่สำหรับสอดแทรกแบบรายงานผลการเรียน SGS ชั้น ม.{room}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          (โปรดพิมพ์แบบรายงานผลการเรียนที่ได้รับอนุมัติจากระบบ SGS ของ สพฐ. แล้วนำมาสอดแทรกหรือเย็บรวม ณ หน้านี้)
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-300 text-xs text-black space-y-1">
                        <p>
                          <span className="font-bold">นักเรียนในห้อง:</span> {roomStudents.length} คน |{' '}
                          <span className="font-bold">สถานะการโอนคะแนน SGS:</span> โอนคะแนนเรียบร้อย
                        </p>
                        <p className="text-[11px] text-slate-600 italic pt-1">
                          * เอกสาร ปพ.5 สมบูรณ์จะต้องแนบผลการเรียนจากระบบ SGS ควบคู่กับสมุดบันทึกผลการเรียนประจำรายวิชาเสมอ
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between">
                    <span>แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ</span>
                    <span>รายงานผลการเรียน SGS ห้อง ม.{room}</span>
                  </div>
                </section>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
