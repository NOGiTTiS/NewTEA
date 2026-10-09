'use client'

import * as React from 'react'
import Link from 'next/link'
import { fetchApi } from '@/lib/api'
import { RoleGuard } from '@/components/role-guard'
import { DashboardShell } from '@/components/dashboard-shell'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { useSession } from '@/lib/auth-client'
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Users,
  Eye,
  CheckSquare,
  Sparkles,
  RefreshCw,
  Building,
  Calendar,
  X,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Bell,
  Unlock
} from 'lucide-react'
import { toast } from 'sonner'

interface AcademicTerm {
  id: string
  year: number
  semester: number
  isActive: boolean
}

interface VerificationRound {
  id: string
  courseId: string
  round: number
  teacherSubmitted: boolean
  teacherSubmittedAt?: string | null
  deptHeadStatus: string // PENDING, APPROVED, REVISE
  deptHeadComment?: string | null
  deptHeadReviewedAt?: string | null
  academicStatus: string
  academicComment?: string | null
  academicReviewedAt?: string | null
  sgsTransferred: boolean
  unlockRequested?: boolean
  unlockReason?: string | null
  unlockRequestedAt?: string | null
  unlockApprovedBy?: string | null
  unlockApprovedAt?: string | null
}

interface DeptHeadCourseSummary {
  course: {
    id: string
    courseCode: string
    courseName: string
    department: string
    credits: number
    totalHours: number
    courseType: string
  }
  primaryTeacher: string
  rooms: string[]
  enrolledCount: number
  verifications: VerificationRound[]
}

const DEPARTMENTS = [
  'กลุ่มสาระการเรียนรู้ภาษาไทย',
  'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
  'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
  'กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม',
  'กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา',
  'กลุ่มสาระการเรียนรู้ศิลปะ',
  'กลุ่มสาระการเรียนรู้การงานอาชีพ',
  'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ',
  'กิจกรรมพัฒนาผู้เรียน'
]

const ROUND_NAMES: Record<number, string> = {
  1: 'ระยะที่ 1 (ก่อนกลางภาค)',
  2: 'ระยะที่ 2 (กลางภาค)',
  3: 'ระยะที่ 3 (หลังกลางภาค/ปลายภาค)'
}

export default function DeptHeadDashboardPage() {
  const { data: session } = useSession()
  const user = session?.user as { role?: string; department?: string; name?: string } | undefined
  const userRole = (user?.role || '').toUpperCase()
  const userDept = user?.department || ''

  const [terms, setTerms] = React.useState<AcademicTerm[]>([])
  const [selectedTermId, setSelectedTermId] = React.useState<string>('')
  const [selectedDept, setSelectedDept] = React.useState<string>('')
  const [courses, setCourses] = React.useState<DeptHeadCourseSummary[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false)
  const [selectedCourse, setSelectedCourse] = React.useState<DeptHeadCourseSummary | null>(null)
  const [selectedRound, setSelectedRound] = React.useState<number>(1)
  const [reviewStatus, setReviewStatus] = React.useState<'APPROVED' | 'REVISE'>('APPROVED')
  const [reviewComment, setReviewComment] = React.useState('')
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false)

  // Set default department
  React.useEffect(() => {
    if (userDept) {
      setSelectedDept(userDept)
    } else if (DEPARTMENTS.length > 0) {
      setSelectedDept(DEPARTMENTS[0])
    }
  }, [userDept])

  // Load Terms
  const loadTerms = React.useCallback(async () => {
    try {
      const data = await fetchApi<{ terms: AcademicTerm[] }>('/api/terms')
      if (data && data.terms) {
        setTerms(data.terms)
        const active = data.terms.find((t) => t.isActive)
        if (active) {
          setSelectedTermId(active.id)
        } else if (data.terms.length > 0) {
          setSelectedTermId(data.terms[0].id)
        }
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลภาคเรียนได้')
    }
  }, [])

  // Load Courses for Dept Head
  const loadCourses = React.useCallback(async () => {
    if (!selectedDept && userRole !== 'ADMIN') return
    setIsLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (selectedTermId) queryParams.append('termId', selectedTermId)
      if (selectedDept) queryParams.append('department', selectedDept)

      const res = await fetchApi<{ department: string; total: number; courses: DeptHeadCourseSummary[] }>(
        `/api/dept-head/courses?${queryParams.toString()}`
      )
      setCourses(res.courses || [])
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
      toast.error(errMsg)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedTermId, selectedDept, userRole])

  React.useEffect(() => {
    loadTerms()
  }, [loadTerms])

  React.useEffect(() => {
    if (selectedTermId) {
      loadCourses()
    }
  }, [selectedTermId, selectedDept, loadCourses])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadCourses()
  }

  // Filtered Courses
  const filteredCourses = React.useMemo(() => {
    return courses.filter((item) => {
      const codeMatch = item.course.courseCode.toLowerCase().includes(searchQuery.toLowerCase())
      const nameMatch = item.course.courseName.toLowerCase().includes(searchQuery.toLowerCase())
      const teacherMatch = item.primaryTeacher.toLowerCase().includes(searchQuery.toLowerCase())
      const searchOk = !searchQuery || codeMatch || nameMatch || teacherMatch

      if (!searchOk) return false

      if (statusFilter === 'ALL') return true

      if (statusFilter === 'UNLOCK_REQUEST') {
        return item.verifications.some((v) => v.unlockRequested)
      }

      // Filter by round status
      if (statusFilter === 'WAITING_REVIEW') {
        // Any round is teacher submitted and dept head still PENDING
        return item.verifications.some((v) => v.teacherSubmitted && v.deptHeadStatus === 'PENDING')
      }
      if (statusFilter === 'APPROVED') {
        // All submitted rounds are approved
        return item.verifications.some((v) => v.deptHeadStatus === 'APPROVED')
      }
      if (statusFilter === 'REVISE') {
        // Any round is REVISE
        return item.verifications.some((v) => v.deptHeadStatus === 'REVISE')
      }
      if (statusFilter === 'NOT_SUBMITTED') {
        // Round 1 not even submitted
        const r1 = item.verifications.find((v) => v.round === 1)
        return !r1 || !r1.teacherSubmitted
      }

      return true
    })
  }, [courses, searchQuery, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / pageSize) || 1
  const paginatedCourses = React.useMemo(() => {
    return paginateArray(filteredCourses, currentPage, pageSize)
  }, [filteredCourses, currentPage, pageSize])

  // Reset page when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, pageSize, selectedDept, selectedTermId])

  // Statistics
  const stats = React.useMemo(() => {
    const total = courses.length
    let waitingRound1 = 0
    let approvedRound1 = 0
    let reviseRound1 = 0

    let waitingRound2 = 0
    let approvedRound2 = 0
    let reviseRound2 = 0

    let waitingRound3 = 0
    let approvedRound3 = 0
    let reviseRound3 = 0

    let unlockRequestedCount = 0

    courses.forEach((c) => {
      c.verifications.forEach((v) => {
        if (v.unlockRequested) unlockRequestedCount++
        if (v.round === 1) {
          if (v.teacherSubmitted && v.deptHeadStatus === 'PENDING') waitingRound1++
          if (v.deptHeadStatus === 'APPROVED') approvedRound1++
          if (v.deptHeadStatus === 'REVISE') reviseRound1++
        } else if (v.round === 2) {
          if (v.teacherSubmitted && v.deptHeadStatus === 'PENDING') waitingRound2++
          if (v.deptHeadStatus === 'APPROVED') approvedRound2++
          if (v.deptHeadStatus === 'REVISE') reviseRound2++
        } else if (v.round === 3) {
          if (v.teacherSubmitted && v.deptHeadStatus === 'PENDING') waitingRound3++
          if (v.deptHeadStatus === 'APPROVED') approvedRound3++
          if (v.deptHeadStatus === 'REVISE') reviseRound3++
        }
      })
    })

    const totalWaiting = waitingRound1 + waitingRound2 + waitingRound3

    return {
      total,
      totalWaiting,
      unlockRequestedCount,
      waitingRound1,
      approvedRound1,
      reviseRound1,
      waitingRound2,
      approvedRound2,
      reviseRound2,
      waitingRound3,
      approvedRound3,
      reviseRound3
    }
  }, [courses])

  // Open review modal for course
  const openReviewModal = (courseItem: DeptHeadCourseSummary, defaultRound = 1) => {
    setSelectedCourse(courseItem)
    setSelectedRound(defaultRound)

    // Pre-fill existing review data if any
    const existingVer = courseItem.verifications.find((v) => v.round === defaultRound)
    if (existingVer && existingVer.deptHeadStatus === 'REVISE') {
      setReviewStatus('REVISE')
      setReviewComment(existingVer.deptHeadComment || '')
    } else if (existingVer && existingVer.deptHeadStatus === 'APPROVED') {
      setReviewStatus('APPROVED')
      setReviewComment(existingVer.deptHeadComment || '')
    } else {
      setReviewStatus('APPROVED')
      setReviewComment('')
    }

    setReviewModalOpen(true)
  }

  // Handle round tab change in modal
  const handleModalRoundChange = (round: number) => {
    setSelectedRound(round)
    if (!selectedCourse) return
    const existingVer = selectedCourse.verifications.find((v) => v.round === round)
    if (existingVer && existingVer.deptHeadStatus === 'REVISE') {
      setReviewStatus('REVISE')
      setReviewComment(existingVer.deptHeadComment || '')
    } else if (existingVer && existingVer.deptHeadStatus === 'APPROVED') {
      setReviewStatus('APPROVED')
      setReviewComment(existingVer.deptHeadComment || '')
    } else {
      setReviewStatus('APPROVED')
      setReviewComment('')
    }
  }

  const [isProcessingUnlock, setIsProcessingUnlock] = React.useState(false)

  // Approve Unlock Request
  const handleApproveUnlock = async (courseId: string, round: number) => {
    setIsProcessingUnlock(true)
    try {
      const res = await fetchApi<{ message: string }>(
        `/api/courses/${courseId}/verifications/approve-unlock`,
        {
          method: 'POST',
          body: JSON.stringify({ round })
        }
      )
      toast.success(res.message || 'อนุมัติการปลดล็อกแก้ไขคะแนนเรียบร้อยแล้ว')
      setReviewModalOpen(false)
      loadCourses()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอนุมัติปลดล็อก'
      toast.error(msg)
    } finally {
      setIsProcessingUnlock(false)
    }
  }

  // Reject Unlock Request
  const handleRejectUnlock = async (courseId: string, round: number) => {
    setIsProcessingUnlock(true)
    try {
      const res = await fetchApi<{ message: string }>(
        `/api/courses/${courseId}/verifications/reject-unlock`,
        {
          method: 'POST',
          body: JSON.stringify({ round, reason: reviewComment.trim() })
        }
      )
      toast.success(res.message || 'ปฏิเสธคำขอปลดล็อกเรียบร้อยแล้ว')
      setReviewModalOpen(false)
      loadCourses()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ'
      toast.error(msg)
    } finally {
      setIsProcessingUnlock(false)
    }
  }

  // Submit review
  const handleSubmitReview = async () => {
    if (!selectedCourse) return
    if (reviewStatus === 'REVISE' && !reviewComment.trim()) {
      toast.error('กรุณาระบุหมายเหตุหรือสิ่งที่ต้องปรับปรุงแก้ไขเมื่อเลือกส่งกลับให้แก้ไข')
      return
    }

    setIsSubmittingReview(true)
    try {
      const res = await fetchApi<{ message: string; verification: VerificationRound }>(
        `/api/courses/${selectedCourse.course.id}/verifications/dept-head`,
        {
          method: 'POST',
          body: JSON.stringify({
            round: selectedRound,
            status: reviewStatus,
            comment: reviewComment.trim()
          })
        }
      )

      toast.success(res.message || 'บันทึกผลการตรวจรับรองเรียบร้อยแล้ว')
      setReviewModalOpen(false)
      loadCourses()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกผลการตรวจ'
      toast.error(msg)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const renderStatusBadge = (ver?: VerificationRound) => {
    if (!ver) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
          <Clock className="w-3 h-3 text-muted-foreground" />
          ยังไม่ส่ง
        </span>
      )
    }

    if (ver.unlockRequested) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
          <Bell className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          ขอปลดล็อก
        </span>
      )
    }

    if (!ver.teacherSubmitted) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
          <Clock className="w-3 h-3 text-muted-foreground" />
          ยังไม่ส่ง
        </span>
      )
    }

    if (ver.deptHeadStatus === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          รับรองแล้ว
        </span>
      )
    }

    if (ver.deptHeadStatus === 'REVISE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          ส่งกลับแก้ไข
        </span>
      )
    }

    // Teacher submitted, awaiting dept head review
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        รอตรวจรับรอง
      </span>
    )
  }

  return (
    <RoleGuard allowedRoles={['DEPT_HEAD', 'ADMIN']}>
      <DashboardShell
        title="ตรวจรับรองคะแนนกลุ่มสาระฯ"
        description="สำหรับหัวหน้ากลุ่มสาระการเรียนรู้ ตรวจสอบความถูกต้องและอนุมัติหรือส่งกลับแก้ไขคะแนนประจำ 3 ระยะ"
        badge={`${courses.length} วิชา`}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shrink-0"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">รายวิชาทั้งหมดในกลุ่มสาระฯ</p>
                <div className="rounded-xl p-2 bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</span>
                <span className="text-xs text-muted-foreground">วิชา</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                รอตรวจรับรองทั้งหมด <strong className="text-amber-600 dark:text-amber-400">{stats.totalWaiting}</strong> ครั้ง
              </p>
              {stats.unlockRequestedCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                  <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>ขอปลดล็อกแก้ไข {stats.unlockRequestedCount} รายการ</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ระยะ 1: ก่อนกลางภาค</p>
                <div className="rounded-xl p-2 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.waitingRound1}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">รอตรวจ</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">รับรอง {stats.approvedRound1}</span>
                {stats.reviseRound1 > 0 && <span className="text-rose-600 dark:text-rose-400">แก้ไข {stats.reviseRound1}</span>}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ระยะ 2: กลางภาค</p>
                <div className="rounded-xl p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.waitingRound2}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">รอตรวจ</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">รับรอง {stats.approvedRound2}</span>
                {stats.reviseRound2 > 0 && <span className="text-rose-600 dark:text-rose-400">แก้ไข {stats.reviseRound2}</span>}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ระยะ 3: ปลายภาค & สรุปผล</p>
                <div className="rounded-xl p-2 bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.waitingRound3}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">รอตรวจ</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">รับรอง {stats.approvedRound3}</span>
                {stats.reviseRound3 > 0 && <span className="text-rose-600 dark:text-rose-400">แก้ไข {stats.reviseRound3}</span>}
              </div>
            </div>
          </div>

          {/* Filters & Control Bar */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Term Selector */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-xl border border-border">
                  <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span className="font-medium">ภาคเรียน:</span>
                  <select
                    value={selectedTermId}
                    onChange={(e) => setSelectedTermId(e.target.value)}
                    className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
                  >
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.semester}/{t.year} {t.isActive ? '(ปัจจุบัน)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Selector (For Admin) or Fixed Department Badge (For Dept Head) */}
                {userRole === 'ADMIN' ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-xl border border-border">
                    <Building className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="font-medium">กลุ่มสาระฯ:</span>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer max-w-[200px] truncate"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    <Building className="w-3.5 h-3.5" />
                    {selectedDept || 'ยังไม่กำหนดกลุ่มสาระฯ'}
                  </div>
                )}

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-xl border border-border">
                  <Filter className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span className="font-medium">สถานะ:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">ทุกสถานะ</option>
                    <option value="UNLOCK_REQUEST">🔔 มีคำขอปลดล็อกแก้ไข</option>
                    <option value="WAITING_REVIEW">รอตรวจรับรอง (มีงานค้าง)</option>
                    <option value="APPROVED">รับรองแล้ว</option>
                    <option value="REVISE">ส่งกลับให้แก้ไข</option>
                    <option value="NOT_SUBMITTED">ยังไม่ส่งตรวจ</option>
                  </select>
                </div>
              </div>

              {/* Right: Search Box & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="ค้นหารหัส, ชื่อวิชา, ครู..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="รีเฟรชข้อมูล"
                  className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Courses Table */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  รายการวิชาในกลุ่มสาระฯ ({filteredCourses.length} รายการ)
                </h3>
                <p className="text-xs text-muted-foreground">
                  คลิกที่ปุ่ม &quot;ตรวจรับรอง&quot; เพื่ออนุมัติคะแนน หรือคลิก &quot;ดูสมุดคะแนน&quot; เพื่อตรวจสอบตารางคะแนนแบบละเอียด
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 text-center">
                <RefreshCw className="w-8 h-8 mx-auto text-brand-500 animate-spin mb-3" />
                <p className="text-xs text-muted-foreground">กำลังโหลดรายวิชาและข้อมูลการส่งตรวจ...</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold text-foreground">ไม่พบรายวิชาที่ตรงตามเงื่อนไข</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ลองเปลี่ยนเงื่อนไขการค้นหา หรือสลับกลุ่มสาระการเรียนรู้
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 min-w-[200px]">รหัสวิชา / ชื่อวิชา</th>
                      <th className="py-3 px-4 min-w-[150px]">ครูผู้สอน</th>
                      <th className="py-3 px-4 min-w-[140px]">ห้องเรียน / นร.</th>
                      <th className="py-3 px-4 text-center min-w-[130px]">ระยะ 1: ก่อนกลางภาค</th>
                      <th className="py-3 px-4 text-center min-w-[130px]">ระยะ 2: กลางภาค</th>
                      <th className="py-3 px-4 text-center min-w-[130px]">ระยะ 3: ปลายภาค</th>
                      <th className="py-3 px-4 text-right min-w-[160px]">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedCourses.map((item, idx) => {
                      const v1 = item.verifications.find((v) => v.round === 1)
                      const v2 = item.verifications.find((v) => v.round === 2)
                      const v3 = item.verifications.find((v) => v.round === 3)
                      const rowIndex = (currentPage - 1) * pageSize + idx + 1

                      // Check if any round needs review
                      const hasPendingReview = item.verifications.some(
                        (v) => v.teacherSubmitted && v.deptHeadStatus === 'PENDING'
                      )

                      return (
                        <tr
                          key={item.course.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            hasPendingReview ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center text-muted-foreground font-mono">
                            {rowIndex}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                                {item.course.courseCode}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                {item.course.credits} นก.
                              </span>
                            </div>
                            <div className="font-medium text-foreground truncate max-w-[260px] mt-0.5">
                              {item.course.courseName}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground truncate max-w-[180px]">
                              {item.primaryTeacher || 'ไม่ระบุผู้สอน'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {item.rooms.slice(0, 3).map((r) => (
                                <span
                                  key={r}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground"
                                >
                                  {r}
                                </span>
                              ))}
                              {item.rooms.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                                  +{item.rooms.length - 3} ห้อง
                                </span>
                              )}
                              <span className="text-muted-foreground text-[11px] ml-1">
                                ({item.enrolledCount} คน)
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => openReviewModal(item, 1)}
                              className="hover:opacity-80 transition-opacity"
                              title="คลิกเพื่อตรวจระยะที่ 1"
                            >
                              {renderStatusBadge(v1)}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => openReviewModal(item, 2)}
                              className="hover:opacity-80 transition-opacity"
                              title="คลิกเพื่อตรวจระยะที่ 2"
                            >
                              {renderStatusBadge(v2)}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => openReviewModal(item, 3)}
                              className="hover:opacity-80 transition-opacity"
                              title="คลิกเพื่อตรวจระยะที่ 3"
                            >
                              {renderStatusBadge(v3)}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/courses/${item.course.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
                                title="เปิดดูสมุดคะแนนรายวิชานี้"
                              >
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                สมุดคะแนน
                              </Link>

                              <button
                                onClick={() => openReviewModal(item, 1)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                                  hasPendingReview
                                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-brand-500/25 ring-2 ring-brand-500/20'
                                    : 'bg-background border border-border text-foreground hover:bg-muted'
                                }`}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                ตรวจรับรอง
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && filteredCourses.length > 0 && (
              <div className="p-4 border-t border-border bg-card">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredCourses.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize)
                    setCurrentPage(1)
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal ตรวจรับรองผลการเรียน (Review Verification Modal) */}
        {reviewModalOpen && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      ตรวจรับรองคะแนนรายวิชา
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedCourse.course.courseCode} - {selectedCourse.course.courseName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Course Metadata Pill */}
                <div className="p-3 rounded-2xl bg-muted/40 border border-border flex flex-wrap gap-y-2 justify-between items-center text-xs">
                  <div>
                    <span className="text-muted-foreground">ครูผู้สอน: </span>
                    <strong className="text-foreground">{selectedCourse.primaryTeacher}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ห้องที่สอน: </span>
                    <strong className="text-foreground font-mono">
                      {selectedCourse.rooms.join(', ')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">นักเรียน: </span>
                    <strong className="text-foreground">{selectedCourse.enrolledCount} คน</strong>
                  </div>
                </div>

                {/* Round Selector Tabs */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-2 block">
                    เลือกระยะที่ต้องการตรวจ:
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-muted border border-border">
                    {[1, 2, 3].map((r) => {
                      const ver = selectedCourse.verifications.find((v) => v.round === r)
                      const isSelected = selectedRound === r
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleModalRoundChange(r)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                            isSelected
                              ? 'bg-card text-brand-600 dark:text-brand-400 shadow-sm border border-border'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <span>ระยะที่ {r}</span>
                          <span className="text-[10px] font-normal scale-95">
                            {ver?.unlockRequested ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">🔔 ขอปลดล็อก</span>
                            ) : ver?.deptHeadStatus === 'APPROVED' ? (
                              <span className="text-emerald-600 dark:text-emerald-400">✓ รับรองแล้ว</span>
                            ) : ver?.deptHeadStatus === 'REVISE' ? (
                              <span className="text-rose-600 dark:text-rose-400">แก้ไข</span>
                            ) : ver?.teacherSubmitted ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">รอตรวจ</span>
                            ) : (
                              <span className="text-muted-foreground">ยังไม่ส่ง</span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Status Info for Selected Round */}
                {(() => {
                  const currentVer = selectedCourse.verifications.find((v) => v.round === selectedRound)
                  return (
                    <>
                      {/* Unlock Request Highlight Box */}
                      {currentVer?.unlockRequested && (
                        <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                              <Bell className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                ครูผู้สอนส่งคำขอปลดล็อกแก้ไขคะแนน
                              </h4>
                              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                                {currentVer.unlockRequestedAt
                                  ? `ส่งคำขอเมื่อ ${new Date(currentVer.unlockRequestedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.`
                                  : 'มีคำขอส่งเพื่อปลดล็อกแก้ไขคะแนน'}
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-card border border-amber-200 dark:border-amber-800/50 text-xs">
                            <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                              เหตุผลในการขอปลดล็อก:
                            </span>
                            <p className="text-foreground font-medium italic">
                              &quot;{currentVer.unlockReason || 'ไม่ระบุเหตุผล'}&quot;
                            </p>
                          </div>

                          {currentVer.round === 3 && currentVer.sgsTransferred && userRole !== 'ADMIN' && (
                            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>
                                วิชานี้ถูกส่งเข้า SGS แล้ว สิทธิ์การอนุมัติปลดล็อกต้องดำเนินการโดยฝ่ายวิชาการหรือ Admin เท่านั้น
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isProcessingUnlock || (currentVer.round === 3 && currentVer.sgsTransferred && userRole !== 'ADMIN')}
                              onClick={() => handleApproveUnlock(selectedCourse.course.id, selectedRound)}
                              className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              อนุมัติปลดล็อกแก้ไข
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingUnlock}
                              onClick={() => handleRejectUnlock(selectedCourse.course.id, selectedRound)}
                              className="py-2 px-3 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 text-muted-foreground transition-colors"
                            >
                              ปฏิเสธคำขอ
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">ระยะการตรวจ:</span>
                          <span className="font-semibold text-foreground">
                            {ROUND_NAMES[selectedRound]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">สถานะส่งตรวจของครู:</span>
                          {currentVer?.teacherSubmitted ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              ส่งตรวจแล้ว{' '}
                              {currentVer.teacherSubmittedAt && (
                                <span className="text-muted-foreground font-normal">
                                  ({new Date(currentVer.teacherSubmittedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" /> ครูผู้สอนยังไม่ได้กดส่งตรวจ
                            </span>
                          )}
                        </div>
                        {currentVer?.deptHeadComment && (
                          <div className="pt-2 border-t border-border mt-2">
                            <span className="text-muted-foreground block mb-0.5">หมายเหตุล่าสุด:</span>
                            <p className="p-2 rounded-xl bg-muted/60 text-foreground italic">
                              &quot;{currentVer.deptHeadComment}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}

                {/* Review Result Decision (APPROVED vs REVISE) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    ผลการพิจารณาตรวจสอบ:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewStatus('APPROVED')}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                        reviewStatus === 'APPROVED'
                          ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>รับรองเรียบร้อย (อนุมัติ)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewStatus('REVISE')}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                        reviewStatus === 'REVISE'
                          ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <RotateCcw className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      <span>ส่งกลับให้แก้ไข (ปลดล็อก)</span>
                    </button>
                  </div>
                  {reviewStatus === 'REVISE' && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      การส่งกลับแก้ไขจะปลดล็อกตารางคะแนนในระยะนี้ทันทีเพื่อให้ครูปรับปรุงได้
                    </p>
                  )}
                </div>

                {/* Review Comments Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      หมายเหตุ / ข้อเสนอแนะ{' '}
                      {reviewStatus === 'REVISE' && <span className="text-rose-500">* (จำเป็น)</span>}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      จะแสดงให้ครูผู้สอนเห็นในหน้าวิชา
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={
                      reviewStatus === 'REVISE'
                        ? 'ระบุสิ่งที่ต้องปรับปรุงแก้ไข เช่น กรอกคะแนนช่องก่อนกลางภาคไม่ครบ หรือคะแนนเกินเต็ม...'
                        : 'บันทึกข้อเสนอแนะเพิ่มเติม (ถ้ามี)...'
                    }
                    className="w-full p-3 text-xs rounded-2xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none transition-all"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                <Link
                  href={`/courses/${selectedCourse.course.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  เปิดดูคะแนนในแท็บใหม่
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all flex items-center gap-1.5 ${
                      reviewStatus === 'REVISE'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 ring-2 ring-rose-600/20'
                        : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/25 ring-2 ring-brand-500/20'
                    } disabled:opacity-50`}
                  >
                    {isSubmittingReview ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" />
                        ยืนยันผลการตรวจ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
    </RoleGuard>
  )
}
