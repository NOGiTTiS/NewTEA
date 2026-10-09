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
  FileSpreadsheet,
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
  Send,
  Layers,
  GraduationCap,
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
  academicStatus: string // PENDING, APPROVED, REVISE
  academicComment?: string | null
  academicReviewedAt?: string | null
  sgsTransferred: boolean
  unlockRequested?: boolean
  unlockReason?: string | null
  unlockRequestedAt?: string | null
  unlockApprovedBy?: string | null
  unlockApprovedAt?: string | null
}

interface AcademicOverviewCourse {
  id: string
  courseCode: string
  courseName: string
  department: string
  credits: number
  totalHours: number
  courseType: string
  primaryTeacher: string
  teachers: string[]
  rooms: string[]
  enrolledCount: number
  verifications: VerificationRound[]
}

interface AcademicStats {
  totalCourses: number
  round1Submitted: number
  round1Approved: number
  round1Revise: number
  round2Submitted: number
  round2Approved: number
  round2Revise: number
  round3Submitted: number
  round3Approved: number
  round3Revise: number
  sgsTransferredCount: number
  unlockRequestedCount: number
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

export default function AcademicOverviewPage() {
  const { data: session } = useSession()
  const user = session?.user as { role?: string; department?: string; name?: string } | undefined
  const userRole = (user?.role || '').toUpperCase()

  const [terms, setTerms] = React.useState<AcademicTerm[]>([])
  const [selectedTermId, setSelectedTermId] = React.useState<string>('')
  const [selectedDept, setSelectedDept] = React.useState<string>('ALL')
  const [selectedGrade, setSelectedGrade] = React.useState<string>('ALL')
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL')
  const [searchQuery, setSearchQuery] = React.useState('')

  const [courses, setCourses] = React.useState<AcademicOverviewCourse[]>([])
  const [stats, setStats] = React.useState<AcademicStats>({
    totalCourses: 0,
    round1Submitted: 0,
    round1Approved: 0,
    round1Revise: 0,
    round2Submitted: 0,
    round2Approved: 0,
    round2Revise: 0,
    round3Submitted: 0,
    round3Approved: 0,
    round3Revise: 0,
    sgsTransferredCount: 0,
    unlockRequestedCount: 0
  })

  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [togglingSgsId, setTogglingSgsId] = React.useState<string | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  // Academic Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false)
  const [selectedCourse, setSelectedCourse] = React.useState<AcademicOverviewCourse | null>(null)
  const [selectedRound, setSelectedRound] = React.useState<number>(1)
  const [reviewStatus, setReviewStatus] = React.useState<'APPROVED' | 'REVISE'>('APPROVED')
  const [reviewComment, setReviewComment] = React.useState('')
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false)

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

  // Load Academic Overview
  const loadOverview = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (selectedTermId) queryParams.append('termId', selectedTermId)
      if (selectedDept && selectedDept !== 'ALL') queryParams.append('department', selectedDept)
      if (selectedGrade && selectedGrade !== 'ALL') queryParams.append('gradeLevel', selectedGrade)
      if (statusFilter && statusFilter !== 'ALL') queryParams.append('status', statusFilter)

      const res = await fetchApi<{
        term: AcademicTerm
        total: number
        courses: AcademicOverviewCourse[]
        stats: AcademicStats
      }>(`/api/academic/overview?${queryParams.toString()}`)

      setCourses(res.courses || [])
      if (res.stats) {
        setStats(res.stats)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลภาพรวมวิชาการ'
      toast.error(msg)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedTermId, selectedDept, selectedGrade, statusFilter])

  React.useEffect(() => {
    loadTerms()
  }, [loadTerms])

  React.useEffect(() => {
    if (selectedTermId) {
      loadOverview()
    }
  }, [selectedTermId, selectedDept, selectedGrade, statusFilter, loadOverview])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadOverview()
  }

  // Filtered by Search Query
  const filteredCourses = React.useMemo(() => {
    if (!searchQuery.trim()) return courses
    const q = searchQuery.toLowerCase().trim()
    return courses.filter((item) => {
      const codeMatch = item.courseCode.toLowerCase().includes(q)
      const nameMatch = item.courseName.toLowerCase().includes(q)
      const teacherMatch = item.primaryTeacher.toLowerCase().includes(q) ||
        item.teachers.some((t) => t.toLowerCase().includes(q))
      const deptMatch = item.department.toLowerCase().includes(q)
      return codeMatch || nameMatch || teacherMatch || deptMatch
    })
  }, [courses, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / pageSize) || 1
  const paginatedCourses = React.useMemo(() => {
    return paginateArray(filteredCourses, currentPage, pageSize)
  }, [filteredCourses, currentPage, pageSize])

  // Reset page on filter change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedDept, selectedGrade, statusFilter, selectedTermId, pageSize])

  // Toggle SGS Transferred Status
  const handleToggleSGS = async (courseId: string, currentStatus: boolean) => {
    setTogglingSgsId(courseId)
    const newStatus = !currentStatus
    try {
      await fetchApi<{ message: string; sgsTransferred: boolean }>(
        `/api/courses/${courseId}/verifications/sgs`,
        {
          method: 'POST',
          body: JSON.stringify({ sgsTransferred: newStatus })
        }
      )

      toast.success(newStatus ? 'บันทึกว่าส่งเข้า SGS แล้ว' : 'ยกเลิกสถานะส่งเข้า SGS')

      // Update state in-place
      setCourses((prev) =>
        prev.map((c) => {
          if (c.id === courseId) {
            const updatedVers = c.verifications.map((v) =>
              v.round === 3 ? { ...v, sgsTransferred: newStatus } : v
            )
            return { ...c, verifications: updatedVers }
          }
          return c
        })
      )

      setStats((prev) => ({
        ...prev,
        sgsTransferredCount: newStatus
          ? prev.sgsTransferredCount + 1
          : Math.max(0, prev.sgsTransferredCount - 1)
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปรับสถานะ SGS'
      toast.error(msg)
    } finally {
      setTogglingSgsId(null)
    }
  }

  // Open Academic Review Modal
  const openReviewModal = (courseItem: AcademicOverviewCourse, defaultRound = 1) => {
    setSelectedCourse(courseItem)
    setSelectedRound(defaultRound)

    const existingVer = courseItem.verifications.find((v) => v.round === defaultRound)
    if (existingVer && existingVer.academicStatus === 'REVISE') {
      setReviewStatus('REVISE')
      setReviewComment(existingVer.academicComment || '')
    } else if (existingVer && existingVer.academicStatus === 'APPROVED') {
      setReviewStatus('APPROVED')
      setReviewComment(existingVer.academicComment || '')
    } else {
      setReviewStatus('APPROVED')
      setReviewComment('')
    }

    setReviewModalOpen(true)
  }

  const handleModalRoundChange = (round: number) => {
    setSelectedRound(round)
    if (!selectedCourse) return
    const existingVer = selectedCourse.verifications.find((v) => v.round === round)
    if (existingVer && existingVer.academicStatus === 'REVISE') {
      setReviewStatus('REVISE')
      setReviewComment(existingVer.academicComment || '')
    } else if (existingVer && existingVer.academicStatus === 'APPROVED') {
      setReviewStatus('APPROVED')
      setReviewComment(existingVer.academicComment || '')
    } else {
      setReviewStatus('APPROVED')
      setReviewComment('')
    }
  }

  // Submit Academic Review
  const handleSubmitReview = async () => {
    if (!selectedCourse) return
    if (reviewStatus === 'REVISE' && !reviewComment.trim()) {
      toast.error('กรุณาระบุหมายเหตุหรือสิ่งที่ต้องปรับปรุงแก้ไขเมื่อเลือกส่งกลับให้แก้ไข')
      return
    }

    setIsSubmittingReview(true)
    try {
      const res = await fetchApi<{ message: string; verification: VerificationRound }>(
        `/api/courses/${selectedCourse.id}/verifications/academic`,
        {
          method: 'POST',
          body: JSON.stringify({
            round: selectedRound,
            status: reviewStatus,
            comment: reviewComment.trim()
          })
        }
      )

      toast.success(res.message || 'บันทึกการตรวจของฝ่ายวิชาการเรียบร้อยแล้ว')
      setReviewModalOpen(false)
      loadOverview()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกผลการตรวจ'
      toast.error(msg)
    } finally {
      setIsSubmittingReview(false)
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
      loadOverview()
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
      loadOverview()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ'
      toast.error(msg)
    } finally {
      setIsProcessingUnlock(false)
    }
  }

  // Render Status Badge for a round
  const renderRoundCell = (ver?: VerificationRound, roundNum = 1, onReviewClick?: () => void) => {
    if (!ver) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
          <Clock className="w-2.5 h-2.5 text-muted-foreground" />
          ยังไม่ส่ง
        </span>
      )
    }

    if (ver.unlockRequested) {
      return (
        <button
          onClick={onReviewClick}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:ring-2 hover:ring-amber-500/20 transition-all cursor-pointer animate-pulse"
          title="ครูส่งคำขอปลดล็อกแก้ไข (คลิกเพื่อพิจารณา)"
        >
          <Bell className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
          ขอปลดล็อก
        </button>
      )
    }

    if (!ver.teacherSubmitted) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
          <Clock className="w-2.5 h-2.5 text-muted-foreground" />
          ยังไม่ส่ง
        </span>
      )
    }

    // Both Approved
    if (ver.academicStatus === 'APPROVED') {
      return (
        <button
          onClick={onReviewClick}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:ring-2 hover:ring-emerald-500/20 transition-all cursor-pointer"
          title="วิชาการอนุมัติแล้ว (คลิกดู/แก้ไข)"
        >
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
          อนุมัติแล้ว
        </button>
      )
    }

    // Revise by either Academic or Dept Head
    if (ver.academicStatus === 'REVISE' || ver.deptHeadStatus === 'REVISE') {
      return (
        <button
          onClick={onReviewClick}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:ring-2 hover:ring-rose-500/20 transition-all cursor-pointer"
          title="ส่งกลับให้แก้ไข (คลิกดู/แก้ไข)"
        >
          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
          แก้ไข
        </button>
      )
    }

    // Dept Head Approved, waiting academic
    if (ver.deptHeadStatus === 'APPROVED' && ver.academicStatus === 'PENDING') {
      return (
        <button
          onClick={onReviewClick}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:ring-2 hover:ring-blue-500/20 transition-all cursor-pointer animate-pulse"
          title="สาระฯ รับรองแล้ว รอวิชาการอนุมัติ (คลิกเพื่อตรวจ)"
        >
          <CheckSquare className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
          สาระฯ ผ่าน/รอตรวจ
        </button>
      )
    }

    // Teacher submitted, waiting dept head & academic
    return (
      <button
        onClick={onReviewClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:ring-2 hover:ring-amber-500/20 transition-all cursor-pointer"
        title="ครูส่งตรวจแล้ว (คลิกเพื่อตรวจ)"
      >
        <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
        รอตรวจ
      </button>
    )
  }

  const sgsPercentage = stats.totalCourses > 0
    ? Math.round((stats.sgsTransferredCount / stats.totalCourses) * 100)
    : 0

  return (
    <RoleGuard allowedRoles={['ACADEMIC', 'ADMIN']}>
      <DashboardShell
        title="ติดตามภาพรวมวิชาการ (TEA68)"
        description="รายงานติดตามสถานะการส่งตรวจและตัดเกรดทั้งโรงเรียน 3 ระยะ พร้อมบันทึกส่งเข้า SGS แบบเรียลไทม์"
        badge={`${stats.totalCourses} วิชา`}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={loadOverview}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shrink-0"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Top KPI Cards (TEA68 Overview) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Courses */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">วิชาทั้งหมดในเทอม</p>
                <div className="rounded-xl p-2 bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.totalCourses}</span>
                <span className="text-xs text-muted-foreground">วิชา</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ม.4 - ม.6 ทั้งหมด 45 ห้อง
              </p>
              {stats.unlockRequestedCount > 0 && (
                <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                  <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>ขอปลดล็อกแก้ไข {stats.unlockRequestedCount} รายการ</span>
                </div>
              )}
            </div>

            {/* Round 1 */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ระยะ 1: ก่อนกลางภาค</p>
                <div className="rounded-xl p-2 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.round1Submitted}</span>
                <span className="text-xs text-muted-foreground">/{stats.totalCourses} ส่งแล้ว</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">อนุมัติ {stats.round1Approved}</span>
                {stats.round1Revise > 0 && <span className="text-rose-600 dark:text-rose-400">แก้ไข {stats.round1Revise}</span>}
              </div>
            </div>

            {/* Round 2 */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ระยะ 2: กลางภาค</p>
                <div className="rounded-xl p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.round2Submitted}</span>
                <span className="text-xs text-muted-foreground">/{stats.totalCourses} ส่งแล้ว</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">อนุมัติ {stats.round2Approved}</span>
                {stats.round2Revise > 0 && <span className="text-rose-600 dark:text-rose-400">แก้ไข {stats.round2Revise}</span>}
              </div>
            </div>

            {/* Round 3 */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ระยะ 3: ปลายภาค</p>
                <div className="rounded-xl p-2 bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stats.round3Submitted}</span>
                <span className="text-xs text-muted-foreground">/{stats.totalCourses} ส่งแล้ว</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">อนุมัติ {stats.round3Approved}</span>
                {stats.round3Revise > 0 && <span className="text-rose-600 dark:text-rose-400">แก้ไข {stats.round3Revise}</span>}
              </div>
            </div>

            {/* SGS Transferred */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">นำเข้า SGS แล้ว</p>
                <div className="rounded-xl p-2 bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
                  {stats.sgsTransferredCount}
                </span>
                <span className="text-xs text-muted-foreground">({sgsPercentage}%)</span>
              </div>
              <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${sgsPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
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

                {/* Department Selector */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-xl border border-border">
                  <Building className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span className="font-medium">กลุ่มสาระฯ:</span>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="ALL">ทุกกลุ่มสาระฯ</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grade Level Selector */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-xl border border-border">
                  <GraduationCap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span className="font-medium">ระดับชั้น:</span>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">ทุกระดับชั้น</option>
                    <option value="4">มัธยมศึกษาปีที่ 4 (4.1 - 4.15)</option>
                    <option value="5">มัธยมศึกษาปีที่ 5 (5.1 - 5.15)</option>
                    <option value="6">มัธยมศึกษาปีที่ 6 (6.1 - 6.15)</option>
                  </select>
                </div>

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
                    <option value="SUBMITTED">ครูส่งตรวจแล้ว</option>
                    <option value="APPROVED">อนุมัติแล้ว</option>
                    <option value="REVISE">ส่งกลับให้แก้ไข</option>
                    <option value="PENDING">ยังไม่ส่งตรวจ</option>
                    <option value="SGS">นำเข้า SGS แล้ว</option>
                  </select>
                </div>
              </div>

              {/* Right: Search Box & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 lg:w-64">
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

          {/* TEA68 Real-time Tracking Grid Table */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  ตารางติดตามการส่งตรวจรายวิชา TEA68 ({filteredCourses.length} วิชา)
                </h3>
                <p className="text-xs text-muted-foreground">
                  ฝ่ายวิชาการสามารถคลิกไฟสถานะในแต่ละระยะเพื่อตรวจรับรอง หรือคลิก Checkbox SGS เพื่อบันทึกการส่งคะแนนเข้า SGS
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 mx-auto text-brand-500 animate-spin mb-3" />
                <p className="text-xs text-muted-foreground">กำลังโหลดข้อมูลติดตามรายวิชาทั้งโรงเรียน...</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="py-16 text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold text-foreground">ไม่พบรายวิชาที่ตรงตามเงื่อนไข</p>
                <p className="text-xs text-muted-foreground mt-1">
                  กรุณาตรวจสอบการเลือกกลุ่มสาระฯ ระดับชั้น หรือคำค้นหา
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3 min-w-[190px]">รหัสวิชา / ชื่อวิชา</th>
                      <th className="py-3 px-3 min-w-[140px]">กลุ่มสาระฯ</th>
                      <th className="py-3 px-3 min-w-[140px]">ครูผู้สอน</th>
                      <th className="py-3 px-3 min-w-[120px]">ห้อง / นร.</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">ระยะ 1 (ก่อนกลาง)</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">ระยะ 2 (กลางภาค)</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">ระยะ 3 (ปลายภาค)</th>
                      <th className="py-3 px-3 text-center min-w-[100px]">ส่ง SGS</th>
                      <th className="py-3 px-3 text-right min-w-[130px]">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedCourses.map((item, idx) => {
                      const v1 = item.verifications.find((v) => v.round === 1)
                      const v2 = item.verifications.find((v) => v.round === 2)
                      const v3 = item.verifications.find((v) => v.round === 3)
                      const rowIndex = (currentPage - 1) * pageSize + idx + 1
                      const isSgsDone = v3?.sgsTransferred || false
                      const isTogglingThis = togglingSgsId === item.id

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-3 text-center text-muted-foreground font-mono">
                            {rowIndex}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                                {item.courseCode}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                {item.credits} นก.
                              </span>
                            </div>
                            <div className="font-medium text-foreground truncate max-w-[220px] mt-0.5" title={item.courseName}>
                              {item.courseName}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-muted-foreground">
                            <span className="truncate max-w-[130px] block" title={item.department}>
                              {item.department.replace('กลุ่มสาระการเรียนรู้', '')}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-medium text-foreground truncate max-w-[140px]" title={item.primaryTeacher}>
                              {item.primaryTeacher || 'ไม่ระบุผู้สอน'}
                            </div>
                            {item.teachers.length > 1 && (
                              <div className="text-[10px] text-muted-foreground">
                                + ร่วมสอน {item.teachers.length - 1} ท่าน
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {item.rooms.slice(0, 2).map((r) => (
                                <span
                                  key={r}
                                  className="px-1 py-0.2 rounded text-[10px] font-mono bg-muted text-muted-foreground"
                                >
                                  {r}
                                </span>
                              ))}
                              {item.rooms.length > 2 && (
                                <span className="px-1 py-0.2 rounded text-[10px] bg-muted text-muted-foreground">
                                  +{item.rooms.length - 2}
                                </span>
                              )}
                              <span className="text-muted-foreground text-[10px] ml-0.5">
                                ({item.enrolledCount})
                              </span>
                            </div>
                          </td>

                          {/* Round 1 */}
                          <td className="py-3 px-3 text-center">
                            {renderRoundCell(v1, 1, () => openReviewModal(item, 1))}
                          </td>

                          {/* Round 2 */}
                          <td className="py-3 px-3 text-center">
                            {renderRoundCell(v2, 2, () => openReviewModal(item, 2))}
                          </td>

                          {/* Round 3 */}
                          <td className="py-3 px-3 text-center">
                            {renderRoundCell(v3, 3, () => openReviewModal(item, 3))}
                          </td>

                          {/* SGS Transferred Checkbox / Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSGS(item.id, isSgsDone)}
                              disabled={isTogglingThis}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                                isSgsDone
                                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                  : 'bg-muted/60 text-muted-foreground border border-border hover:bg-muted'
                              }`}
                              title={isSgsDone ? 'ส่งเข้า SGS เรียบร้อยแล้ว (คลิกเพื่อยกเลิก)' : 'คลิกเพื่อทำเครื่องหมายว่าส่งเข้า SGS แล้ว'}
                            >
                              {isTogglingThis ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : isSgsDone ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                  <span>เรียบร้อย</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span>ยังไม่ส่ง</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/courses/${item.id}`}
                                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="เปิดดูสมุดคะแนนรายวิชานี้"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>

                              <button
                                onClick={() => openReviewModal(item, 1)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 transition-colors"
                                title="เปิดหน้าต่างตรวจรับรองฝ่ายวิชาการ"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>ตรวจ</span>
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

        {/* Academic Review Modal */}
        {reviewModalOpen && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      ฝ่ายวิชาการตรวจรับรองคะแนน
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedCourse.courseCode} - {selectedCourse.courseName}
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

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Course Metadata Pill */}
                <div className="p-3 rounded-2xl bg-muted/40 border border-border flex flex-wrap gap-y-2 justify-between items-center text-xs">
                  <div>
                    <span className="text-muted-foreground">กลุ่มสาระฯ: </span>
                    <strong className="text-foreground">{selectedCourse.department}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ผู้สอน: </span>
                    <strong className="text-foreground">{selectedCourse.primaryTeacher}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">นักเรียน: </span>
                    <strong className="text-foreground font-mono">{selectedCourse.enrolledCount} คน</strong>
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
                            ) : ver?.academicStatus === 'APPROVED' ? (
                              <span className="text-emerald-600 dark:text-emerald-400">✓ อนุมัติแล้ว</span>
                            ) : ver?.academicStatus === 'REVISE' ? (
                              <span className="text-rose-600 dark:text-rose-400">แก้ไข</span>
                            ) : ver?.deptHeadStatus === 'APPROVED' ? (
                              <span className="text-blue-600 dark:text-blue-400">สาระฯ ผ่าน</span>
                            ) : ver?.teacherSubmitted ? (
                              <span className="text-amber-600 dark:text-amber-400">รอตรวจ</span>
                            ) : (
                              <span className="text-muted-foreground">ยังไม่ส่ง</span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Status Summary for Selected Round */}
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

                          {currentVer.round === 3 && currentVer.sgsTransferred && (
                            <div className="p-3 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                              <div>
                                <span className="font-bold block">คำเตือน SGS:</span>
                                <span>
                                  วิชานี้ถูกบันทึกส่งเข้า SGS เรียบร้อยแล้ว หากอนุมัติปลดล็อกแก้ไข ฝ่ายวิชาการจะต้องตรวจสอบและนำเข้าข้อมูลผลคะแนนชุดใหม่เข้าสู่ SGS (ผ่าน AutoSGS) อีกครั้งหลังจากครูส่งตรวจรอบใหม่
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isProcessingUnlock}
                              onClick={() => handleApproveUnlock(selectedCourse.id, selectedRound)}
                              className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              อนุมัติปลดล็อกแก้ไข
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingUnlock}
                              onClick={() => handleRejectUnlock(selectedCourse.id, selectedRound)}
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
                        <span className="text-muted-foreground">สถานะครูส่งตรวจ:</span>
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

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">สถานะหัวหน้ากลุ่มสาระฯ:</span>
                        {currentVer?.deptHeadStatus === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> รับรองเรียบร้อยแล้ว
                          </span>
                        ) : currentVer?.deptHeadStatus === 'REVISE' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> ส่งกลับให้แก้ไข
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" /> ยังไม่ตรวจรับรอง
                          </span>
                        )}
                      </div>

                      {currentVer?.deptHeadComment && (
                        <div className="pt-2 border-t border-border mt-2">
                          <span className="text-muted-foreground block mb-0.5">หมายเหตุจากหัวหน้ากลุ่มสาระฯ:</span>
                          <p className="p-2 rounded-xl bg-muted/60 text-foreground italic">
                            &quot;{currentVer.deptHeadComment}&quot;
                          </p>
                        </div>
                      )}

                      {currentVer?.academicComment && (
                        <div className="pt-2 border-t border-border mt-2">
                          <span className="text-muted-foreground block mb-0.5">หมายเหตุจากฝ่ายวิชาการเดิม:</span>
                          <p className="p-2 rounded-xl bg-muted/60 text-foreground italic">
                            &quot;{currentVer.academicComment}&quot;
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
                    ผลการพิจารณาตรวจสอบของฝ่ายวิชาการ:
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
                      <span>อนุมัติคะแนน (เรียบร้อย)</span>
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
                      การส่งกลับแก้ไขจะปลดล็อกตารางคะแนนในระยะนี้ทันที เพื่อให้ครูปรับปรุงแก้ไขได้
                    </p>
                  )}
                </div>

                {/* Comments Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      หมายเหตุ / ข้อเสนอแนะ{' '}
                      {reviewStatus === 'REVISE' && <span className="text-rose-500">* (จำเป็น)</span>}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      จะแจ้งเตือนให้ครูผู้สอนเห็นในหน้าวิชา
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={
                      reviewStatus === 'REVISE'
                        ? 'ระบุสิ่งที่ฝ่ายวิชาการต้องการให้ปรับปรุงแก้ไข เช่น ตรวจสอบคะแนนสอบปลายภาค หรือแก้ไขเกรด...'
                        : 'บันทึกข้อเสนอแนะเพิ่มเติมจากฝ่ายวิชาการ (ถ้ามี)...'
                    }
                    className="w-full p-3 text-xs rounded-2xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none transition-all"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                <Link
                  href={`/courses/${selectedCourse.id}`}
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
