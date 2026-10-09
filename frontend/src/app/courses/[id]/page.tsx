'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { fetchApi } from '@/lib/api'
import { sortRooms } from '@/lib/utils'
import {
  calculateAttendancePercentage,
  calculateStandardGrade,
  evaluateStudent,
  calculateWeightedTotalScore,
  ScoreColumnDefinition,
  DESIRABLE_ITEMS,
  READING_ITEMS,
  COMPETENCY_ITEMS,
  calculateSummaryGradeFromSubscores,
  AssessmentCriteriaConfig,
  DEFAULT_ASSESSMENT_CRITERIA,
  isScoreBelowThreshold,
  getDesirableLabel,
  getReadingLabel,
  getCompetencyItemLabel,
  getCompetencySummaryLabel,
  generateDesirableSubscores,
  formatAutoSGSText,
  AutoSGSExportMode
} from '@/lib/calculation-engine'
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
  Clock,
  Edit2,
  Trash2,
  X,
  Award,
  BookOpen,
  Compass,
  Sliders,
  RotateCcw,
  Sparkles,
  ClipboardCopy,
  ChevronDown,
  Layers,
  Settings2,
  ShieldCheck,
  Send,
  Lock,
  Unlock,
  AlertTriangle,
  Calendar,
  Info,
  FileCheck,
  Eye,
  Printer,
  Upload,
  FileUp,
  FileText,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/lib/auth-client'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef
} from '@tanstack/react-table'

export interface VerificationMilestone {
  id: string
  termId: string
  round: number
  title: string
  teacherDeadline: string
  academicDeadline: string
}

interface ScoreColumn {
  id: string
  courseId: string
  name: string
  maxScore: number
  weight: number
  periodType: number // 1:ก่อนกลาง, 2:กลาง, 3:หลังกลาง, 4:ปลายภาค
  sequence: number
}

interface StudentEvaluation {
  id: string
  enrollmentId: string
  attendanceHoursPeriod1?: number
  attendanceHoursPeriod2?: number
  attendanceHours: number
  attendancePercentage: number
  totalScore: number
  grade: string
  specialGrade?: string
  desirableSubscores?: string | number[]
  desirableGrade: number
  readingSubscores?: string | number[]
  readingGrade: number
  competencySubscores?: string | number[]
  competencyGrade: number
  isOverridden: boolean
  overrideReason?: string
}

export interface CourseVerification {
  id: string
  courseId: string
  round: number // 1, 2, 3
  teacherSubmitted: boolean
  teacherSubmittedAt?: string
  sgsTransferred: boolean
  deptHeadStatus: 'PENDING' | 'APPROVED' | 'REVISE'
  deptHeadComment?: string
  deptHeadReviewedAt?: string
  academicStatus: 'PENDING' | 'APPROVED' | 'REVISE'
  academicComment?: string
  academicReviewedAt?: string
  unlockRequested?: boolean
  unlockReason?: string
  unlockRequestedAt?: string
  unlockApprovedBy?: string
  unlockApprovedAt?: string
  updatedAt?: string
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
  studentStatus?: string // 'ACTIVE' | 'TRANSFERRED' | 'RESIGNED' | 'SUSPENDED'
  scores: Record<string, number>
  absentMap: Record<string, boolean>
  remarksMap: Record<string, string>
  evaluation?: StudentEvaluation
  parsedDesirableSubscores?: number[]
  parsedReadingSubscores?: number[]
  parsedCompetencySubscores?: number[]
}

export interface CourseTeacherAssignment {
  id?: string
  courseId?: string
  userId: string
  user?: {
    id?: string
    name?: string
    email?: string
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
  verifications?: CourseVerification[]
  teachers?: CourseTeacherAssignment[]
}

export interface CourseAttachmentItem {
  url: string
  type: 'pdf' | 'image'
  name: string
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

type ActiveViewMode = 'ATTENDANCE' | 'SCORES' | 'DESIRABLE' | 'READING' | 'COMPETENCY'

function parseAssignedRooms(raw?: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((r) => String(r).trim()).filter(Boolean)
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === '[]') return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.map((r) => String(r).trim()).filter(Boolean)
        }
      } catch {
        // fallback
      }
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((r) => r.trim()).filter(Boolean)
    }
    return [trimmed]
  }
  return []
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

export default function CourseGradebookPage() {
  const params = useParams()
  const courseId = params?.id as string

  const [course, setCourse] = React.useState<CourseDetail | null>(null)
  const [rooms, setRooms] = React.useState<string[]>([])
  const [selectedRoomTab, setSelectedRoomTab] = React.useState<string>('ALL')
  const [scoreColumns, setScoreColumns] = React.useState<ScoreColumn[]>([])
  const [students, setStudents] = React.useState<GradebookStudent[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [activeMode, setActiveMode] = React.useState<ActiveViewMode>('ATTENDANCE')
  const [criteriaConfig, setCriteriaConfig] = React.useState<AssessmentCriteriaConfig>(DEFAULT_ASSESSMENT_CRITERIA)

  // User Session & Role
  const { data: session } = useSession()
  const currentUser = session?.user as { id?: string; role?: string; name?: string; email?: string } | undefined
  const userRole = (currentUser?.role || '').toUpperCase()
  const isAdminOrAcademic = userRole === 'ADMIN' || userRole === 'ACADEMIC'

  // Teacher co-teaching assignment resolution
  const courseTeachers = course?.teachers || []
  const hasMultipleTeachers = courseTeachers.length > 1

  const myTeacherAssignment = React.useMemo(() => {
    if (!currentUser) return undefined
    return courseTeachers.find(
      (t) => t.userId === currentUser.id || (currentUser.email && t.user?.email === currentUser.email)
    )
  }, [courseTeachers, currentUser])

  const myAssignedRooms = React.useMemo(() => {
    if (!hasMultipleTeachers) {
      return rooms
    }
    return parseAssignedRooms(myTeacherAssignment?.assignedRooms)
  }, [hasMultipleTeachers, rooms, myTeacherAssignment?.assignedRooms])

  const isRoomEditable = React.useCallback(
    (roomId: string) => {
      if (isAdminOrAcademic) return true
      if (!hasMultipleTeachers) return true
      return myAssignedRooms.includes(roomId)
    },
    [isAdminOrAcademic, hasMultipleTeachers, myAssignedRooms]
  )

  const isCurrentRoomEditable = React.useMemo(() => {
    if (selectedRoomTab === 'ALL') return false
    return isRoomEditable(selectedRoomTab)
  }, [selectedRoomTab, isRoomEditable])

  const currentRoomTeacherName = React.useMemo(() => {
    if (selectedRoomTab === 'ALL') return null
    const teacher = courseTeachers.find((t) => {
      const assigned = parseAssignedRooms(t.assignedRooms)
      return assigned.includes(selectedRoomTab)
    })
    return teacher?.user?.name || null
  }, [selectedRoomTab, courseTeachers])

  // Initial room auto-selection for assigned teacher
  const initialRoomSelectedRef = React.useRef(false)
  React.useEffect(() => {
    if (!initialRoomSelectedRef.current && course && currentUser && !isAdminOrAcademic) {
      if (hasMultipleTeachers && myAssignedRooms.length > 0) {
        setSelectedRoomTab(myAssignedRooms[0])
        initialRoomSelectedRef.current = true
      }
    }
  }, [course, currentUser, isAdminOrAcademic, hasMultipleTeachers, myAssignedRooms])

  // Check URL query parameter for initial active mode (e.g. ?mode=SCORES)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const modeParam = params.get('mode') as ActiveViewMode | null
      if (
        modeParam &&
        ['ATTENDANCE', 'SCORES', 'DESIRABLE', 'READING', 'COMPETENCY'].includes(modeParam)
      ) {
        setActiveMode(modeParam)
      }
    }
  }, [])

  // Auto-Save Status: 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('saved')

  // Column Management Modal State
  const [isColumnModalOpen, setIsColumnModalOpen] = React.useState(false)
  const [isEditingColumn, setIsEditingColumn] = React.useState(false)
  const [columnIdToEdit, setColumnIdToEdit] = React.useState<string | null>(null)
  const [addingToPeriod, setAddingToPeriod] = React.useState<number | null>(null)
  const [colName, setColName] = React.useState('')
  const [colMaxScore, setColMaxScore] = React.useState<number>(10)
  const [colWeight, setColWeight] = React.useState<number>(10)
  const [colPeriodType, setColPeriodType] = React.useState<number>(1)
  const [isSavingColumn, setIsSavingColumn] = React.useState(false)

  // Attendance Configuration Modal State
  const [isAttendanceConfigOpen, setIsAttendanceConfigOpen] = React.useState(false)
  const [configMaxP1, setConfigMaxP1] = React.useState<number>(20)
  const [configMaxP2, setConfigMaxP2] = React.useState<number>(20)
  const [isSavingAttendanceConfig, setIsSavingAttendanceConfig] = React.useState(false)

  // Evaluation Override Modal State
  const [selectedStudentForOverride, setSelectedStudentForOverride] = React.useState<GradebookStudent | null>(null)
  const [isOverrideModalOpen, setIsOverrideModalOpen] = React.useState(false)
  const [overrideAttendance, setOverrideAttendance] = React.useState<number>(100)
  const [overrideSpecialGrade, setOverrideSpecialGrade] = React.useState('')
  const [overrideDesirable, setOverrideDesirable] = React.useState<number>(3)
  const [overrideReading, setOverrideReading] = React.useState<number>(3)
  const [overrideCompetency, setOverrideCompetency] = React.useState<number>(3)
  const [overrideReason, setOverrideReason] = React.useState('')
  const [isSavingOverride, setIsSavingOverride] = React.useState(false)

  // Verification Submission Modal State
  const [isVerificationModalOpen, setIsVerificationModalOpen] = React.useState(false)
  const [selectedRoundToSubmit, setSelectedRoundToSubmit] = React.useState<number>(1)
  const [isSubmittingVerification, setIsSubmittingVerification] = React.useState(false)
  const [termMilestones, setTermMilestones] = React.useState<VerificationMilestone[]>([])

  // Unlock Request Modal State
  const [isUnlockModalOpen, setIsUnlockModalOpen] = React.useState(false)
  const [unlockRoundToRequest, setUnlockRoundToRequest] = React.useState<number>(1)
  const [unlockReasonInput, setUnlockReasonInput] = React.useState('')
  const [isSubmittingUnlock, setIsSubmittingUnlock] = React.useState(false)

  // AutoSGS Room Selector Guard Modal State
  const [isAutoSGSRoomModalOpen, setIsAutoSGSRoomModalOpen] = React.useState(false)
  const [pendingAutoSGSMode, setPendingAutoSGSMode] = React.useState<AutoSGSExportMode | null>(null)

  // Course Info & Description Modal State (for ปพ.5)
  const [isCourseInfoModalOpen, setIsCourseInfoModalOpen] = React.useState(false)
  const [infoCourseCode, setInfoCourseCode] = React.useState('')
  const [infoCourseName, setInfoCourseName] = React.useState('')
  const [infoCredits, setInfoCredits] = React.useState<number>(1.0)
  const [infoTotalHours, setInfoTotalHours] = React.useState<number>(40)
  const [infoCourseType, setInfoCourseType] = React.useState('BASIC')
  const [infoDepartment, setInfoDepartment] = React.useState('')
  const [infoDescription, setInfoDescription] = React.useState('')
  const [infoStructureData, setInfoStructureData] = React.useState('')
  const [isSavingCourseInfo, setIsSavingCourseInfo] = React.useState(false)

  // Debounce Timer Ref for auto-save
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const pendingScoresRef = React.useRef<
    Record<string, { enrollmentId: string; scoreColumnId: string; score: number; isAbsent: boolean }>
  >({})
  const pendingEvaluationsRef = React.useRef<
    Record<
      string,
      {
        enrollmentId: string
        attendanceHoursPeriod1?: number
        attendanceHoursPeriod2?: number
        desirableSubscores?: number[]
        desirableGrade?: number
        readingSubscores?: number[]
        readingGrade?: number
        competencySubscores?: number[]
        competencyGrade?: number
        isOverridden?: boolean
      }
    >
  >({})

  // Load Gradebook Data
  const loadGradebook = React.useCallback(async () => {
    if (!courseId) return
    setIsLoading(true)
    try {
      const [gradebookRes, criteriaRes, verRes] = await Promise.all([
        fetchApi<{
          course: CourseDetail
          rooms: string[]
          scoreColumns: ScoreColumn[]
          students: GradebookStudent[]
        }>(`/api/courses/${courseId}/gradebook`),
        fetchApi<{ criteria: AssessmentCriteriaConfig }>('/api/settings/assessment-criteria').catch(() => null),
        fetchApi<{ verifications: CourseVerification[]; milestones: VerificationMilestone[] }>(
          `/api/courses/${courseId}/verifications`
        ).catch(() => null)
      ])

      if (criteriaRes?.criteria) {
        setCriteriaConfig(criteriaRes.criteria)
      }

      if (verRes?.milestones) {
        setTermMilestones(verRes.milestones)
      }

      if (verRes?.verifications && gradebookRes.course) {
        gradebookRes.course.verifications = verRes.verifications
      }

      setCourse(gradebookRes.course)
      setRooms(gradebookRes.rooms || [])
      setScoreColumns(gradebookRes.scoreColumns || [])

      const maxP1 = gradebookRes.course.attendanceMaxPeriod1 ?? 20
      const maxP2 = gradebookRes.course.attendanceMaxPeriod2 ?? 20
      setConfigMaxP1(maxP1)
      setConfigMaxP2(maxP2)

      const preparedStudents = (gradebookRes.students || []).map((s) => {
        const dSub = parseSubscores(s.evaluation?.desirableSubscores, 8, s.evaluation?.desirableGrade ?? 3)
        if (!s.evaluation?.isOverridden && dSub.length === 8) {
          dSub[0] = 3
          dSub[1] = 3
          dSub[7] = 3
        }

        const currentEval = s.evaluation
        const evalWithAttendance: StudentEvaluation = currentEval
          ? {
              ...currentEval,
              attendanceHoursPeriod1: currentEval.attendanceHoursPeriod1 ?? maxP1,
              attendanceHoursPeriod2: currentEval.attendanceHoursPeriod2 ?? maxP2
            }
          : {
              id: '',
              enrollmentId: s.enrollmentId,
              attendanceHoursPeriod1: maxP1,
              attendanceHoursPeriod2: maxP2,
              attendanceHours: maxP1 + maxP2,
              attendancePercentage: 100,
              totalScore: 0,
              grade: '0',
              desirableGrade: 3,
              readingGrade: 3,
              competencyGrade: 3,
              isOverridden: false
            }

        return {
          ...s,
          evaluation: evalWithAttendance,
          parsedDesirableSubscores: dSub,
          parsedReadingSubscores: parseSubscores(s.evaluation?.readingSubscores, 5, s.evaluation?.readingGrade ?? 3),
          parsedCompetencySubscores: parseSubscores(s.evaluation?.competencySubscores, 5, s.evaluation?.competencyGrade ?? 3)
        }
      })

      setStudents(preparedStudents)
      setSaveStatus('saved')
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลตารางคะแนนได้')
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  React.useEffect(() => {
    loadGradebook()
  }, [loadGradebook])

  // Verification & Locking Helpers
  const isRoundLocked = React.useCallback(
    (round: number) => {
      const ver = course?.verifications?.find((v) => v.round === round)
      if (!ver) return false
      // Locked if submitted by teacher and not returned for revision
      return ver.teacherSubmitted && ver.deptHeadStatus !== 'REVISE' && ver.academicStatus !== 'REVISE'
    },
    [course?.verifications]
  )

  const isPeriodLocked = React.useCallback(
    (periodType: number) => {
      let round = 1
      if (periodType === 2) round = 2
      else if (periodType === 3 || periodType === 4) round = 3
      return isRoundLocked(round)
    },
    [isRoundLocked]
  )

  const revisionRounds = React.useMemo(() => {
    return (course?.verifications || []).filter(
      (v) => v.deptHeadStatus === 'REVISE' || v.academicStatus === 'REVISE'
    )
  }, [course?.verifications])

  const handleSubmitVerification = async (round: number) => {
    try {
      setIsSubmittingVerification(true)
      const res = await fetchApi<{ message: string; verification: CourseVerification }>(
        `/api/courses/${courseId}/verifications/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ round })
        }
      )
      toast.success(res.message)
      setIsVerificationModalOpen(false)
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งตรวจ'
      toast.error(msg)
    } finally {
      setIsSubmittingVerification(false)
    }
  }

  const unlockRequestedRounds = React.useMemo(() => {
    return (course?.verifications || []).filter((v) => v.unlockRequested)
  }, [course?.verifications])

  const handleRequestUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockReasonInput.trim()) {
      toast.error('กรุณาระบุเหตุผลในการขอปลดล็อกแก้ไขคะแนน')
      return
    }

    try {
      setIsSubmittingUnlock(true)
      const res = await fetchApi<{ message: string; verification: CourseVerification }>(
        `/api/courses/${courseId}/verifications/request-unlock`,
        {
          method: 'POST',
          body: JSON.stringify({
            round: unlockRoundToRequest,
            reason: unlockReasonInput.trim()
          })
        }
      )
      toast.success(res.message)
      setIsUnlockModalOpen(false)
      setUnlockReasonInput('')
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยื่นคำขอปลดล็อก'
      toast.error(msg)
    } finally {
      setIsSubmittingUnlock(false)
    }
  }

  // Filter students by selected tab & search
  const filteredStudents = React.useMemo(() => {
    return students.filter((s) => {
      const matchRoom = selectedRoomTab === 'ALL' || s.roomId === selectedRoomTab
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        s.studentCode.includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)
      return matchRoom && matchSearch
    })
  }, [students, selectedRoomTab, searchQuery])

  // Map ScoreColumns to calculation engine definition
  const columnDefsForCalc: ScoreColumnDefinition[] = React.useMemo(() => {
    return scoreColumns.map((col) => ({
      id: col.id,
      name: col.name,
      maxScore: col.maxScore,
      weight: col.weight,
      periodType: col.periodType,
      sequence: col.sequence
    }))
  }, [scoreColumns])

  // Flush Pending Scores to Backend
  const flushPendingScores = React.useCallback(async () => {
    const items = Object.values(pendingScoresRef.current)
    if (items.length === 0) return

    setSaveStatus('saving')
    try {
      await fetchApi(`/api/courses/${courseId}/scores`, {
        method: 'POST',
        body: JSON.stringify(items)
      })
      pendingScoresRef.current = {}
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
      toast.error('บันทึกคะแนนไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่อ')
    }
  }, [courseId])

  // Flush Pending Evaluations to Backend
  const flushPendingEvaluations = React.useCallback(async () => {
    const items = Object.values(pendingEvaluationsRef.current)
    if (items.length === 0) return

    setSaveStatus('saving')
    try {
      await fetchApi(`/api/courses/${courseId}/evaluations/batch`, {
        method: 'POST',
        body: JSON.stringify(items)
      })
      pendingEvaluationsRef.current = {}
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
      toast.error('บันทึกผลการประเมินไม่สำเร็จ โปรดลองอีกครั้ง')
    }
  }, [courseId])

  // Handle Score Input Change with Debounced Auto-save and 'ข' support
  const handleScoreChange = (
    enrollmentId: string,
    scoreColumnId: string,
    inputValue: string,
    maxScore: number
  ) => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขคะแนนห้องนี้')
      return
    }

    const trimmed = inputValue.trim()
    const isAbsentInput = trimmed === 'ข' || trimmed === 'x' || trimmed === 'X'

    let finalScore = 0
    let isAbsent = false

    if (isAbsentInput) {
      isAbsent = true
      finalScore = 0
    } else if (trimmed === '') {
      isAbsent = false
      finalScore = 0
    } else {
      let numVal = parseFloat(trimmed)
      if (isNaN(numVal) || numVal < 0) {
        numVal = 0
      }
      if (numVal > maxScore) {
        toast.warning(`คะแนนเกินคะแนนเต็ม (${maxScore})`)
        numVal = maxScore
      }
      isAbsent = false
      finalScore = numVal
    }

    // 1. Update local state immediately with Calculation Engine
    setStudents((prev) =>
      prev.map((student) => {
        if (student.enrollmentId !== enrollmentId) return student

        const newScores = { ...student.scores, [scoreColumnId]: finalScore }
        const newAbsentMap = { ...student.absentMap, [scoreColumnId]: isAbsent }

        const evalResult = evaluateStudent({
          scores: newScores,
          absentMap: newAbsentMap,
          columns: columnDefsForCalc,
          attendancePercentage: student.evaluation?.attendancePercentage ?? 100,
          specialGrade: student.evaluation?.specialGrade,
          isOverridden: student.evaluation?.isOverridden,
          overrideDesirable: student.evaluation?.desirableGrade,
          overrideReading: student.evaluation?.readingGrade,
          overrideCompetency: student.evaluation?.competencyGrade,
          criteriaConfig
        })

        return {
          ...student,
          scores: newScores,
          absentMap: newAbsentMap,
          parsedDesirableSubscores: student.evaluation?.isOverridden
            ? student.parsedDesirableSubscores
            : evalResult.desirableSubscores,
          parsedReadingSubscores: student.evaluation?.isOverridden
            ? student.parsedReadingSubscores
            : evalResult.readingSubscores,
          parsedCompetencySubscores: student.evaluation?.isOverridden
            ? student.parsedCompetencySubscores
            : evalResult.competencySubscores,
          evaluation: student.evaluation
            ? {
                ...student.evaluation,
                totalScore: evalResult.totalScore,
                grade: evalResult.grade,
                specialGrade: evalResult.specialGrade,
                desirableGrade: evalResult.desirableGrade,
                readingGrade: evalResult.readingGrade,
                competencyGrade: evalResult.competencyGrade
              }
            : undefined
        }
      })
    )

    // 2. Queue for debounced auto-save
    const key = `${enrollmentId}_${scoreColumnId}`
    pendingScoresRef.current[key] = {
      enrollmentId,
      scoreColumnId,
      score: finalScore,
      isAbsent
    }

    setSaveStatus('saving')
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      flushPendingScores()
    }, 1000)
  }

  // Handle Subscore Change for 3 Assessments
  const handleSubscoreChange = (
    enrollmentId: string,
    aspect: 'DESIRABLE' | 'READING' | 'COMPETENCY',
    itemIndex: number,
    valStr: string
  ) => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขผลการประเมินห้องนี้')
      return
    }

    let level = parseInt(valStr, 10)
    if (isNaN(level) || level < 0) level = 0
    if (level > 3) level = 3

    setStudents((prev) =>
      prev.map((student) => {
        if (student.enrollmentId !== enrollmentId) return student

        if (aspect === 'DESIRABLE') {
          const currentArr = [...(student.parsedDesirableSubscores || [3, 3, 3, 3, 3, 3, 3, 3])]
          currentArr[itemIndex] = level
          const summary = calculateSummaryGradeFromSubscores(currentArr)

          pendingEvaluationsRef.current[enrollmentId] = {
            ...(pendingEvaluationsRef.current[enrollmentId] || { enrollmentId }),
            desirableSubscores: currentArr,
            desirableGrade: summary,
            isOverridden: true
          }

          return {
            ...student,
            parsedDesirableSubscores: currentArr,
            evaluation: student.evaluation
              ? { ...student.evaluation, desirableGrade: summary, isOverridden: true }
              : undefined
          }
        } else if (aspect === 'READING') {
          const currentArr = [...(student.parsedReadingSubscores || [3, 3, 3, 3, 3])]
          currentArr[itemIndex] = level
          const summary = calculateSummaryGradeFromSubscores(currentArr)

          pendingEvaluationsRef.current[enrollmentId] = {
            ...(pendingEvaluationsRef.current[enrollmentId] || { enrollmentId }),
            readingSubscores: currentArr,
            readingGrade: summary,
            isOverridden: true
          }

          return {
            ...student,
            parsedReadingSubscores: currentArr,
            evaluation: student.evaluation
              ? { ...student.evaluation, readingGrade: summary, isOverridden: true }
              : undefined
          }
        } else {
          const currentArr = [...(student.parsedCompetencySubscores || [3, 3, 3, 3, 3])]
          currentArr[itemIndex] = level
          const summary = calculateSummaryGradeFromSubscores(currentArr)

          pendingEvaluationsRef.current[enrollmentId] = {
            ...(pendingEvaluationsRef.current[enrollmentId] || { enrollmentId }),
            competencySubscores: currentArr,
            competencyGrade: summary,
            isOverridden: true
          }

          return {
            ...student,
            parsedCompetencySubscores: currentArr,
            evaluation: student.evaluation
              ? { ...student.evaluation, competencyGrade: summary, isOverridden: true }
              : undefined
          }
        }
      })
    )

    setSaveStatus('saving')
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      flushPendingEvaluations()
    }, 1000)
  }

  // Batch Fill All in Room with Level 3
  const handleBatchFillAllThree = (aspect: 'DESIRABLE' | 'READING' | 'COMPETENCY') => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขผลการประเมินห้องนี้')
      return
    }

    const count = aspect === 'DESIRABLE' ? 8 : 5
    const fullLevel3 = Array.from({ length: count }, () => 3)

    setStudents((prev) =>
      prev.map((student) => {
        const matchRoom = selectedRoomTab === 'ALL' || student.roomId === selectedRoomTab
        if (!matchRoom) return student

        if (aspect === 'DESIRABLE') {
          pendingEvaluationsRef.current[student.enrollmentId] = {
            ...(pendingEvaluationsRef.current[student.enrollmentId] || { enrollmentId: student.enrollmentId }),
            desirableSubscores: fullLevel3,
            desirableGrade: 3,
            isOverridden: true
          }
          return {
            ...student,
            parsedDesirableSubscores: fullLevel3,
            evaluation: student.evaluation
              ? { ...student.evaluation, desirableGrade: 3, isOverridden: true }
              : undefined
          }
        } else if (aspect === 'READING') {
          pendingEvaluationsRef.current[student.enrollmentId] = {
            ...(pendingEvaluationsRef.current[student.enrollmentId] || { enrollmentId: student.enrollmentId }),
            readingSubscores: fullLevel3,
            readingGrade: 3,
            isOverridden: true
          }
          return {
            ...student,
            parsedReadingSubscores: fullLevel3,
            evaluation: student.evaluation
              ? { ...student.evaluation, readingGrade: 3, isOverridden: true }
              : undefined
          }
        } else {
          pendingEvaluationsRef.current[student.enrollmentId] = {
            ...(pendingEvaluationsRef.current[student.enrollmentId] || { enrollmentId: student.enrollmentId }),
            competencySubscores: fullLevel3,
            competencyGrade: 3,
            isOverridden: true
          }
          return {
            ...student,
            parsedCompetencySubscores: fullLevel3,
            evaluation: student.evaluation
              ? { ...student.evaluation, competencyGrade: 3, isOverridden: true }
              : undefined
          }
        }
      })
    )

    flushPendingEvaluations()
    const levelLabel = aspect === 'COMPETENCY' ? 'ระดับ 3 (ดีมาก)' : 'ระดับ 3 (ดีเยี่ยม)'
    toast.success(`กำหนด${levelLabel} ให้ทุกคนในห้องนี้เรียบร้อยแล้ว`)
  }

  // Handle Attendance Change (Period 1 or 2)
  const handleAttendanceChange = (
    enrollmentId: string,
    period: 1 | 2,
    inputValue: string
  ) => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขเวลาเรียนห้องนี้')
      return
    }

    const maxP1 = course?.attendanceMaxPeriod1 ?? 20
    const maxP2 = course?.attendanceMaxPeriod2 ?? 20
    const currentMax = period === 1 ? maxP1 : maxP2

    let val = parseFloat(inputValue)
    if (isNaN(val) || val < 0) {
      val = 0
    }
    if (val > currentMax) {
      toast.warning(`เวลาเรียนเกินชั่วโมงเต็ม (${currentMax} ชม.)`)
      val = currentMax
    }

    setStudents((prev) =>
      prev.map((student) => {
        if (student.enrollmentId !== enrollmentId) return student

        const currentP1 = student.evaluation?.attendanceHoursPeriod1 ?? maxP1
        const currentP2 = student.evaluation?.attendanceHoursPeriod2 ?? maxP2

        const newP1 = period === 1 ? val : currentP1
        const newP2 = period === 2 ? val : currentP2

        const calcResult = calculateAttendancePercentage(newP1, newP2, maxP1, maxP2)

        const prevEval = student.evaluation
        const newTotalScore = prevEval?.totalScore ?? 0

        let newSpecialGrade = prevEval?.specialGrade
        let newGrade = prevEval?.grade ?? '0'

        if (calcResult.isMs) {
          newSpecialGrade = 'มส'
          newGrade = '0'
        } else if (newSpecialGrade === 'มส') {
          newSpecialGrade = undefined
          newGrade = calculateStandardGrade(newTotalScore)
        }

        const updatedEval: StudentEvaluation = {
          id: prevEval?.id || '',
          enrollmentId,
          attendanceHoursPeriod1: newP1,
          attendanceHoursPeriod2: newP2,
          attendanceHours: Math.round(newP1 + newP2),
          attendancePercentage: calcResult.attendancePercentage,
          totalScore: newTotalScore,
          grade: newGrade,
          specialGrade: newSpecialGrade,
          desirableGrade: prevEval?.desirableGrade ?? 3,
          readingGrade: prevEval?.readingGrade ?? 3,
          competencyGrade: prevEval?.competencyGrade ?? 3,
          isOverridden: prevEval?.isOverridden ?? false,
          overrideReason: prevEval?.overrideReason
        }

        pendingEvaluationsRef.current[enrollmentId] = {
          ...(pendingEvaluationsRef.current[enrollmentId] || { enrollmentId }),
          attendanceHoursPeriod1: newP1,
          attendanceHoursPeriod2: newP2
        }

        return {
          ...student,
          evaluation: updatedEval
        }
      })
    )

    setSaveStatus('saving')
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      flushPendingEvaluations()
    }, 1000)
  }

  // Quick fill 100% attendance for all students in current room
  const handleBatchFillAttendance100 = () => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขเวลาเรียนห้องนี้')
      return
    }

    const maxP1 = course?.attendanceMaxPeriod1 ?? 20
    const maxP2 = course?.attendanceMaxPeriod2 ?? 20

    setStudents((prev) =>
      prev.map((student) => {
        const matchRoom = selectedRoomTab === 'ALL' || student.roomId === selectedRoomTab
        if (!matchRoom) return student

        const prevEval = student.evaluation
        const newTotalScore = prevEval?.totalScore ?? 0
        let newSpecialGrade = prevEval?.specialGrade
        let newGrade = prevEval?.grade ?? '0'

        if (newSpecialGrade === 'มส') {
          newSpecialGrade = undefined
          newGrade = calculateStandardGrade(newTotalScore)
        }

        const updatedEval: StudentEvaluation = {
          id: prevEval?.id || '',
          enrollmentId: student.enrollmentId,
          attendanceHoursPeriod1: maxP1,
          attendanceHoursPeriod2: maxP2,
          attendanceHours: Math.round(maxP1 + maxP2),
          attendancePercentage: 100,
          totalScore: newTotalScore,
          grade: newGrade,
          specialGrade: newSpecialGrade,
          desirableGrade: prevEval?.desirableGrade ?? 3,
          readingGrade: prevEval?.readingGrade ?? 3,
          competencyGrade: prevEval?.competencyGrade ?? 3,
          isOverridden: prevEval?.isOverridden ?? false,
          overrideReason: prevEval?.overrideReason
        }

        pendingEvaluationsRef.current[student.enrollmentId] = {
          ...(pendingEvaluationsRef.current[student.enrollmentId] || { enrollmentId: student.enrollmentId }),
          attendanceHoursPeriod1: maxP1,
          attendanceHoursPeriod2: maxP2
        }

        return {
          ...student,
          evaluation: updatedEval
        }
      })
    )

    flushPendingEvaluations()
    toast.success('บันทึกเวลาเรียนเต็ม 100% ให้ทุกคนในห้องนี้เรียบร้อยแล้ว')
  }

  // Save Attendance Config (Max hours per period)
  const handleSaveAttendanceConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (configMaxP1 < 0 || configMaxP2 < 0 || (configMaxP1 + configMaxP2) <= 0) {
      toast.error('เวลาเรียนเต็มต้องมากกว่า 0 ชม.')
      return
    }

    try {
      setIsSavingAttendanceConfig(true)
      const res = await fetchApi<{ message: string; course: CourseDetail }>(
        `/api/courses/${courseId}/attendance-config`,
        {
          method: 'PUT',
          body: JSON.stringify({
            attendanceMaxPeriod1: configMaxP1,
            attendanceMaxPeriod2: configMaxP2
          })
        }
      )
      toast.success(res.message || 'บันทึกการตั้งค่าเวลาเรียนสำเร็จ')
      setIsAttendanceConfigOpen(false)
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตั้งค่า'
      toast.error(msg)
    } finally {
      setIsSavingAttendanceConfig(false)
    }
  }

  // Trigger Backend Auto-Calculation based on Admin Criteria
  const handleTriggerAutoCalculate = async () => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขผลการประเมินห้องนี้')
      return
    }

    try {
      setSaveStatus('saving')
      const query = selectedRoomTab !== 'ALL' ? `?room_id=${encodeURIComponent(selectedRoomTab)}` : ''
      const res = await fetchApi<{ message: string }>(`/api/courses/${courseId}/evaluations/auto-calculate${query}`, {
        method: 'POST'
      })
      toast.success(res.message || 'คำนวณการประเมิน 3 ด้านอัตโนมัติสำเร็จ')
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการคำนวณ'
      toast.error(msg)
    } finally {
      setSaveStatus('saved')
    }
  }

  // Column Management Helpers
  const handleStartAddColumn = (periodType: number) => {
    setIsEditingColumn(false)
    setColumnIdToEdit(null)
    setColPeriodType(periodType)
    setColName('')
    setColMaxScore(10)
    setColWeight(10)
    setAddingToPeriod(periodType)
  }

  const handleStartEditColumn = (col: ScoreColumn) => {
    setIsEditingColumn(true)
    setColumnIdToEdit(col.id)
    setColPeriodType(col.periodType)
    setColName(col.name)
    setColMaxScore(col.maxScore)
    setColWeight(col.weight)
    setAddingToPeriod(col.periodType)
  }

  const handleCancelAddEdit = () => {
    setIsEditingColumn(false)
    setColumnIdToEdit(null)
    setAddingToPeriod(null)
    setColName('')
    setColMaxScore(10)
    setColWeight(10)
  }

  // Reset Score Columns to Default (10+10+10 / 20 / 10+10+10 / 20)
  const handleResetColumnsToDefault = async () => {
    const confirmReset = window.confirm(
      'คุณต้องการรีเซ็ตช่องคะแนนเป็นค่าเริ่มต้น (10+10+10 / 20 / 10+10+10 / 20) หรือไม่?\n(คำเตือน: คะแนนดิบในช่องเดิมจะถูกล้าง)'
    )
    if (!confirmReset) return

    try {
      setIsSavingColumn(true)
      const res = await fetchApi<{ message: string; columns: ScoreColumn[] }>(
        `/api/courses/${courseId}/columns/reset`,
        { method: 'POST' }
      )
      toast.success(res.message)
      await loadGradebook()
      handleCancelAddEdit()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรีเซ็ตช่องคะแนน'
      toast.error(msg)
    } finally {
      setIsSavingColumn(false)
    }
  }

  // Save Column (Create or Update)
  const handleSaveColumn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!colName.trim()) {
      toast.error('กรุณาระบุชื่อช่องคะแนน')
      return
    }

    setIsSavingColumn(true)
    try {
      if (isEditingColumn && columnIdToEdit) {
        await fetchApi(`/api/courses/${courseId}/columns/${columnIdToEdit}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: colName,
            maxScore: colMaxScore,
            weight: colWeight,
            periodType: colPeriodType
          })
        })
        toast.success('แก้ไขช่องคะแนนสำเร็จ')
      } else {
        await fetchApi(`/api/courses/${courseId}/columns`, {
          method: 'POST',
          body: JSON.stringify({
            name: colName,
            maxScore: colMaxScore,
            weight: colWeight,
            periodType: colPeriodType
          })
        })
        toast.success('เพิ่มช่องคะแนนสำเร็จ')
      }

      await loadGradebook()
      handleCancelAddEdit()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกช่องคะแนนไม่สำเร็จ'
      toast.error(msg)
    } finally {
      setIsSavingColumn(false)
    }
  }

  // Delete Column
  const handleDeleteColumn = async (colId: string, colNameStr: string) => {
    if (!window.confirm(`ยืนยันการลบช่องคะแนน "${colNameStr}" หรือไม่? คะแนนของนักเรียนในช่องนี้จะถูกลบออกด้วย`)) {
      return
    }

    try {
      await fetchApi(`/api/courses/${courseId}/columns/${colId}`, {
        method: 'DELETE'
      })
      toast.success(`ลบช่องคะแนน "${colNameStr}" สำเร็จ`)
      await loadGradebook()
    } catch {
      toast.error('ลบช่องคะแนนไม่สำเร็จ')
    }
  }

  // Open Course Info Modal for ปพ.5
  const handleOpenCourseInfo = () => {
    if (!course) return
    setInfoCourseCode(course.courseCode || '')
    setInfoCourseName(course.courseName || '')
    setInfoCredits(course.credits || 1.0)
    setInfoTotalHours(course.totalHours || 40)
    setInfoCourseType(course.courseType || 'BASIC')
    setInfoDepartment(course.department || '')
    setInfoDescription(course.description || '')
    setInfoStructureData(course.structureData || '')
    setIsCourseInfoModalOpen(true)
  }

  // Save Course Info and Description
  const handleSaveCourseInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!infoCourseCode.trim() || !infoCourseName.trim()) {
      toast.error('กรุณาระบุรหัสวิชาและชื่อวิชา')
      return
    }

    try {
      setIsSavingCourseInfo(true)
      const res = await fetchApi<{ message: string; course: CourseDetail }>(
        `/api/courses/${courseId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            courseCode: infoCourseCode.trim(),
            courseName: infoCourseName.trim(),
            credits: Number(infoCredits),
            totalHours: Number(infoTotalHours),
            courseType: infoCourseType,
            department: infoDepartment,
            description: infoDescription,
            structureData: infoStructureData
          })
        }
      )
      toast.success(res.message || 'บันทึกข้อมูลรายวิชาสำเร็จ')
      setIsCourseInfoModalOpen(false)
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลรายวิชา'
      toast.error(msg)
    } finally {
      setIsSavingCourseInfo(false)
    }
  }

  // Course Attachment Upload & Delete handlers
  const [isUploadingDescription, setIsUploadingDescription] = React.useState(false)
  const [isUploadingStructure, setIsUploadingStructure] = React.useState(false)

  const handleUploadAttachment = async (
    type: 'description' | 'structure',
    fileOrFiles: FileList | File[] | File
  ) => {
    const formData = new FormData()
    formData.append('type', type)

    if (fileOrFiles instanceof File) {
      formData.append('files', fileOrFiles)
    } else {
      const arr = Array.from(fileOrFiles)
      for (const f of arr) {
        formData.append('files', f)
      }
    }

    const setUploading = type === 'description' ? setIsUploadingDescription : setIsUploadingStructure
    setUploading(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/attachments`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ')
      }
      toast.success('อัปโหลดไฟล์แนบเรียบร้อยแล้ว')
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลด'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (type: 'description' | 'structure', fileIndex?: number) => {
    const confirmMsg =
      fileIndex !== undefined
        ? 'ยืนยันลบไฟล์/รูปภาพนี้?'
        : 'ยืนยันลบไฟล์แนบทั้งหมดในส่วนนี้?'
    if (!confirm(confirmMsg)) return

    try {
      const query = fileIndex !== undefined ? `?index=${fileIndex}` : ''
      const res = await fetch(`/api/courses/${courseId}/attachments/${type}${query}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'ลบไฟล์ไม่สำเร็จ')
      }
      toast.success('ลบไฟล์แนบเรียบร้อยแล้ว')
      await loadGradebook()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบไฟล์'
      toast.error(msg)
    }
  }

  // Core AutoSGS exporter for a given target list of students and room label
  const executeAutoSGSExport = (
    mode: AutoSGSExportMode,
    targetStudents: GradebookStudent[],
    roomLabel: string
  ) => {
    if (targetStudents.length === 0) {
      toast.warning(`ไม่มีข้อมูลนักเรียนใน${roomLabel}`)
      return
    }

    if (mode === 'SCORES_MIDTERM') {
      const targetCols = scoreColumns.filter((col) => col.periodType === 1 || col.periodType === 2)
      if (targetCols.length === 0) {
        toast.warning('ไม่พบคอลัมน์คะแนนช่วงก่อนกลางภาคหรือกลางภาค')
        return
      }
      const tsv = formatAutoSGSText('SCORES_MIDTERM', targetStudents, scoreColumns)
      navigator.clipboard.writeText(tsv)
      toast.success(
        `คัดลอกคะแนนก่อนกลางภาค+กลางภาค ${roomLabel} (${targetCols.length} ช่อง, ${targetStudents.length} คน) สำหรับ AutoSGS v1.1.3+ เรียบร้อยแล้ว (เปิดเว็บ SGS แล้วกด F2 ได้ทันที)`
      )
      return
    }

    if (mode === 'SCORES_FINAL') {
      const targetCols = scoreColumns.filter((col) => col.periodType === 3 || col.periodType === 4)
      if (targetCols.length === 0) {
        toast.warning('ไม่พบคอลัมน์คะแนนช่วงหลังกลางภาคหรือปลายภาค')
        return
      }
      const tsv = formatAutoSGSText('SCORES_FINAL', targetStudents, scoreColumns)
      navigator.clipboard.writeText(tsv)
      toast.success(
        `คัดลอกคะแนนหลังกลางภาค+ปลายภาค ${roomLabel} (${targetCols.length} ช่อง, ${targetStudents.length} คน) สำหรับ AutoSGS v1.1.3+ เรียบร้อยแล้ว (เปิดเว็บ SGS แล้วกด F2 ได้ทันที)`
      )
      return
    }

    if (mode === 'DESIRABLE') {
      const tsv = formatAutoSGSText('DESIRABLE', targetStudents, scoreColumns)
      navigator.clipboard.writeText(tsv)
      toast.success(
        `คัดลอกคุณลักษณะ 8 ช่อง ${roomLabel} (${targetStudents.length} คน) สำหรับ AutoSGS v1.1.3+ เรียบร้อยแล้ว (มี 4 Tab ท้ายแถว)`
      )
      return
    }

    if (mode === 'READING') {
      const tsv = formatAutoSGSText('READING', targetStudents, scoreColumns)
      navigator.clipboard.writeText(tsv)
      toast.success(
        `คัดลอกการอ่าน คิดวิเคราะห์ฯ 5 ช่อง ${roomLabel} (${targetStudents.length} คน) สำหรับ AutoSGS v1.1.3+ เรียบร้อยแล้ว (มี 3 Tab ท้ายแถว)`
      )
      return
    }
  }

  // 1-Click Clipboard Export for AutoSGS (Rule 7) with Room Guard
  const handleExportToAutoSGS = (mode: AutoSGSExportMode) => {
    if (selectedRoomTab === 'ALL') {
      // Room Guard: Prompt teacher to pick a specific classroom before copying to SGS
      setPendingAutoSGSMode(mode)
      setIsAutoSGSRoomModalOpen(true)
      return
    }

    executeAutoSGSExport(mode, filteredStudents, `ห้อง ${selectedRoomTab}`)
  }

  const handleSelectRoomForAutoSGS = (roomId: string) => {
    if (!pendingAutoSGSMode) return
    const roomStudents = students.filter((s) => s.roomId === roomId)
    executeAutoSGSExport(pendingAutoSGSMode, roomStudents, `ห้อง ${roomId}`)
    setIsAutoSGSRoomModalOpen(false)
    setPendingAutoSGSMode(null)
  }

  const handleExportAllRoomsForAutoSGS = () => {
    if (!pendingAutoSGSMode) return
    executeAutoSGSExport(pendingAutoSGSMode, students, 'รวมทุกห้อง')
    setIsAutoSGSRoomModalOpen(false)
    setPendingAutoSGSMode(null)
  }

  // Keyboard navigation handler (Tab, Enter, Arrow keys)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      const nextInput = document.getElementById(`cell-${rowIndex + 1}-${colIndex}`)
      nextInput?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevInput = document.getElementById(`cell-${rowIndex - 1}-${colIndex}`)
      prevInput?.focus()
    } else if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart === e.currentTarget.value.length || e.currentTarget.value === '')) {
      const rightInput = document.getElementById(`cell-${rowIndex}-${colIndex + 1}`)
      if (rightInput) {
        e.preventDefault()
        rightInput.focus()
      }
    } else if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart === 0 || e.currentTarget.value === '')) {
      const leftInput = document.getElementById(`cell-${rowIndex}-${colIndex - 1}`)
      if (leftInput) {
        e.preventDefault()
        leftInput.focus()
      }
    }
  }

  // Open Override Modal
  const openOverrideModal = (student: GradebookStudent) => {
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขผลการประเมินห้องนี้')
      return
    }

    setSelectedStudentForOverride(student)
    setOverrideAttendance(student.evaluation?.attendancePercentage ?? 100)
    setOverrideSpecialGrade(student.evaluation?.specialGrade ?? '')
    setOverrideDesirable(student.evaluation?.desirableGrade ?? 3)
    setOverrideReading(student.evaluation?.readingGrade ?? 3)
    setOverrideCompetency(student.evaluation?.competencyGrade ?? 3)
    setOverrideReason(student.evaluation?.overrideReason ?? '')
    setIsOverrideModalOpen(true)
  }

  // Save Override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCurrentRoomEditable) {
      toast.warning('โหมดอ่านอย่างเดียว: คุณไม่มีสิทธิ์แก้ไขผลการประเมินห้องนี้')
      return
    }
    if (!selectedStudentForOverride || !selectedStudentForOverride.evaluation) return

    setIsSavingOverride(true)
    try {
      await fetchApi(
        `/api/courses/${courseId}/evaluations/${selectedStudentForOverride.evaluation.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            attendancePercentage: overrideAttendance,
            specialGrade: overrideSpecialGrade,
            desirableGrade: overrideDesirable,
            readingGrade: overrideReading,
            competencyGrade: overrideCompetency,
            isOverridden: true,
            overrideReason: overrideReason
          })
        }
      )

      toast.success('ปรับแก้ผลการประเมินรายบุคคลสำเร็จ')
      await loadGradebook()
      setIsOverrideModalOpen(false)
    } catch {
      toast.error('ปรับแก้ผลการประเมินไม่สำเร็จ')
    } finally {
      setIsSavingOverride(false)
    }
  }

  // Columns definition based on activeMode
  const columns: ColumnDef<GradebookStudent>[] = React.useMemo(() => {
    const baseCols: ColumnDef<GradebookStudent>[] = [
      {
        accessorKey: 'seatNo',
        header: 'เลขที่',
        cell: (info) => (
          <span className="font-mono text-center block text-xs font-semibold text-muted-foreground">
            {info.getValue() as number}
          </span>
        )
      },
      {
        accessorKey: 'studentCode',
        header: 'รหัส',
        cell: (info) => (
          <span className="font-mono text-xs font-semibold text-foreground text-center block">
            {info.getValue() as string}
          </span>
        )
      },
      {
        id: 'name',
        header: 'ชื่อ - สกุล',
        cell: (info) => {
          const student = info.row.original
          const fullName = `${student.prefix}${student.firstName} ${student.lastName}`
          const isInactive = student.studentStatus && student.studentStatus !== 'ACTIVE'

          return (
            <div className="flex items-center gap-1.5 min-w-0" title={fullName}>
              <span
                className={`font-medium text-xs truncate max-w-[125px] ${
                  isInactive ? 'line-through text-muted-foreground opacity-80' : 'text-foreground'
                }`}
              >
                {fullName}
              </span>
              {student.studentStatus === 'TRANSFERRED' && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
                  ย้ายห้อง
                </span>
              )}
              {student.studentStatus === 'RESIGNED' && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-2xs">
                  ลาออก
                </span>
              )}
              {student.studentStatus === 'SUSPENDED' && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 shadow-2xs">
                  พักเรียน
                </span>
              )}
            </div>
          )
        }
      }
    ]

    // Only show roomId column if ALL rooms are selected
    if (selectedRoomTab === 'ALL') {
      baseCols.push({
        accessorKey: 'roomId',
        header: 'ห้อง',
        cell: (info) => (
          <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-muted text-muted-foreground whitespace-nowrap block text-center">
            {info.getValue() as string}
          </span>
        )
      })
    }

    // Mode 0: ATTENDANCE (บันทึกเวลาเรียน ก่อนกลางภาค / หลังกลางภาค)
    if (activeMode === 'ATTENDANCE') {
      const maxP1 = course?.attendanceMaxPeriod1 ?? 20
      const maxP2 = course?.attendanceMaxPeriod2 ?? 20
      const maxTotal = maxP1 + maxP2

      baseCols.push(
        {
          id: 'attendance_period1',
          header: () => (
            <div className="flex flex-col items-center justify-center p-0.5 text-center w-full" title={`ก่อนกลางภาค (เต็ม ${maxP1} ชม.)`}>
              <span className="font-bold text-foreground text-[11px] truncate block">
                ก่อนกลางภาค
              </span>
              <span className="text-[9px] text-muted-foreground font-mono leading-none">
                เต็ม {maxP1} ชม.
              </span>
            </div>
          ),
          cell: (info) => {
            const rIdx = info.row.index
            const evalData = info.row.original.evaluation
            const p1 = evalData?.attendanceHoursPeriod1 ?? maxP1
            const isInactive = info.row.original.studentStatus && info.row.original.studentStatus !== 'ACTIVE'
            const isP1Locked = isRoundLocked(1)
            const isCellDisabled = Boolean(isInactive || isP1Locked || !isCurrentRoomEditable)

            return (
              <input
                id={`cell-${rIdx}-0`}
                type="number"
                step="any"
                min="0"
                max={maxP1}
                value={p1}
                disabled={isCellDisabled}
                onChange={(e) =>
                  handleAttendanceChange(info.row.original.enrollmentId, 1, e.target.value)
                }
                onKeyDown={(e) => handleKeyDown(e, rIdx, 0)}
                onFocus={(e) => e.target.select()}
                title={
                  isInactive
                    ? 'นักเรียนไม่ได้อยู่ในสถานะปกติ'
                    : !isCurrentRoomEditable
                    ? selectedRoomTab === 'ALL'
                      ? 'โหมดภาพรวม (อ่านอย่างเดียว) — เลือกแท็บห้องเรียนเพื่อแก้ไข'
                      : `โหมดอ่านอย่างเดียว (ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูท่านอื่น'})`
                    : isP1Locked
                    ? `ก่อนกลางภาค: ${p1}/${maxP1} ชม. (🔒 ล็อก - ส่งตรวจระยะที่ 1 แล้ว)`
                    : `ก่อนกลางภาค: ${p1}/${maxP1} ชม.`
                }
                className={`w-16 mx-auto block text-center py-1 px-1 rounded-lg border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-brand-500/50 transition-all text-xs ${
                  isCellDisabled
                    ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border/60 text-muted-foreground'
                    : 'bg-background border-border/80 text-foreground'
                }`}
              />
            )
          }
        },
        {
          id: 'attendance_period2',
          header: () => (
            <div className="flex flex-col items-center justify-center p-0.5 text-center w-full" title={`หลังกลางภาค (เต็ม ${maxP2} ชม.)`}>
              <span className="font-bold text-foreground text-[11px] truncate block">
                หลังกลางภาค
              </span>
              <span className="text-[9px] text-muted-foreground font-mono leading-none">
                เต็ม {maxP2} ชม.
              </span>
            </div>
          ),
          cell: (info) => {
            const rIdx = info.row.index
            const evalData = info.row.original.evaluation
            const p2 = evalData?.attendanceHoursPeriod2 ?? maxP2
            const isInactive = info.row.original.studentStatus && info.row.original.studentStatus !== 'ACTIVE'
            const isP2Locked = isRoundLocked(3)
            const isCellDisabled = Boolean(isInactive || isP2Locked || !isCurrentRoomEditable)

            return (
              <input
                id={`cell-${rIdx}-1`}
                type="number"
                step="any"
                min="0"
                max={maxP2}
                value={p2}
                disabled={isCellDisabled}
                onChange={(e) =>
                  handleAttendanceChange(info.row.original.enrollmentId, 2, e.target.value)
                }
                onKeyDown={(e) => handleKeyDown(e, rIdx, 1)}
                onFocus={(e) => e.target.select()}
                title={
                  isInactive
                    ? 'นักเรียนไม่ได้อยู่ในสถานะปกติ'
                    : !isCurrentRoomEditable
                    ? selectedRoomTab === 'ALL'
                      ? 'โหมดภาพรวม (อ่านอย่างเดียว) — เลือกแท็บห้องเรียนเพื่อแก้ไข'
                      : `โหมดอ่านอย่างเดียว (ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูท่านอื่น'})`
                    : isP2Locked
                    ? `หลังกลางภาค: ${p2}/${maxP2} ชม. (🔒 ล็อก - ส่งตรวจระยะที่ 3 แล้ว)`
                    : `หลังกลางภาค: ${p2}/${maxP2} ชม.`
                }
                className={`w-16 mx-auto block text-center py-1 px-1 rounded-lg border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-brand-500/50 transition-all text-xs ${
                  isCellDisabled
                    ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border/60 text-muted-foreground'
                    : 'bg-background border-border/80 text-foreground'
                }`}
              />
            )
          }
        },
        {
          id: 'attendance_total',
          header: () => (
            <div className="flex flex-col items-center justify-center p-0.5 text-center w-full" title={`รวมเวลาเรียน (เต็ม ${maxTotal} ชม.)`}>
              <span className="font-bold text-foreground text-[11px] truncate block">
                รวมเวลาเรียน
              </span>
              <span className="text-[9px] text-muted-foreground font-mono leading-none">
                เต็ม {maxTotal} ชม.
              </span>
            </div>
          ),
          cell: (info) => {
            const evalData = info.row.original.evaluation
            const p1 = evalData?.attendanceHoursPeriod1 ?? maxP1
            const p2 = evalData?.attendanceHoursPeriod2 ?? maxP2
            const total = Math.round((p1 + p2) * 10) / 10
            return (
              <span className="font-mono font-bold text-xs text-foreground text-center block">
                {total}
              </span>
            )
          }
        },
        {
          id: 'attendance_pct',
          header: 'ร้อยละ (%)',
          cell: (info) => {
            const evalData = info.row.original.evaluation
            const pct = evalData?.attendancePercentage ?? 100
            const isMs = pct < 80
            return (
              <span
                className={`font-mono text-xs text-center block ${
                  isMs ? 'text-red-600 font-extrabold' : 'text-foreground font-bold'
                }`}
              >
                {pct}%
              </span>
            )
          }
        },
        {
          id: 'attendance_status',
          header: 'สถานะเวลาเรียน',
          cell: (info) => {
            const evalData = info.row.original.evaluation
            const pct = evalData?.attendancePercentage ?? 100
            const isMs = pct < 80
            if (isMs) {
              return (
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-center block bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 shadow-2xs">
                  มส (&lt; 80%)
                </span>
              )
            }
            return (
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-center block bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 shadow-2xs">
                ปกติ (≥ 80%)
              </span>
            )
          }
        }
      )
    }

    // Mode 1: SCORES (Academic Gradebook)
    if (activeMode === 'SCORES') {
      scoreColumns.forEach((col, cIdx) => {
        const isColLocked = isPeriodLocked(col.periodType)

        baseCols.push({
          id: `score_${col.id}`,
          header: () => (
            <div
              className="flex flex-col items-center justify-center p-0.5 text-center w-full"
              title={`${col.name} (เต็ม ${col.maxScore}, น้ำหนัก ${col.weight})${isColLocked ? ' - 🔒 ล็อกคะแนน (ส่งตรวจแล้ว)' : ''}`}
            >
              <div className="flex items-center justify-center gap-0.5 max-w-[64px]">
                <span className="font-bold text-foreground text-[11px] truncate block">
                  {col.name}
                </span>
                {isColLocked && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0 inline" />}
              </div>
              <span className="text-[9px] text-muted-foreground font-mono leading-none">
                {col.weight}บ.
              </span>
            </div>
          ),
          cell: (info) => {
            const rIdx = info.row.index
            const rawScore = info.row.original.scores[col.id]
            const isAbsent = info.row.original.absentMap[col.id]
            const isInactive = info.row.original.studentStatus && info.row.original.studentStatus !== 'ACTIVE'
            const displayVal = isAbsent ? 'ข' : rawScore !== undefined ? String(rawScore) : ''
            const isBelow60 = isScoreBelowThreshold(rawScore, col.maxScore, col.periodType, isAbsent) && displayVal !== ''

            const isCellDisabled = Boolean(isInactive || isColLocked || !isCurrentRoomEditable)

            return (
              <input
                id={`cell-${rIdx}-${cIdx}`}
                type="text"
                value={displayVal}
                disabled={isCellDisabled}
                onChange={(e) =>
                  handleScoreChange(info.row.original.enrollmentId, col.id, e.target.value, col.maxScore)
                }
                onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                onFocus={(e) => e.target.select()}
                title={
                  isInactive
                    ? 'นักเรียนไม่ได้อยู่ในสถานะปกติ'
                    : !isCurrentRoomEditable
                    ? selectedRoomTab === 'ALL'
                      ? 'โหมดภาพรวม (อ่านอย่างเดียว) — เลือกแท็บห้องเรียนเพื่อแก้ไข'
                      : `โหมดอ่านอย่างเดียว (ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูท่านอื่น'})`
                    : isColLocked
                    ? `คะแนนถูกล็อกแล้ว (ส่งตรวจระยะที่ ${col.periodType === 1 ? 1 : col.periodType === 2 ? 2 : 3} เรียบร้อย)`
                    : isAbsent
                    ? 'ขาดสอบ (ข)'
                    : isBelow60
                    ? `คะแนนต่ำกว่าเกณฑ์ร้อยละ 60 (${rawScore}/${col.maxScore} คะแนน - เกณฑ์ผ่าน ${(col.maxScore * 0.6).toFixed(1)} คะแนน)`
                    : rawScore !== undefined
                    ? `${rawScore}/${col.maxScore} คะแนน`
                    : undefined
                }
                className={`w-12 mx-auto block text-center py-1 px-0.5 rounded-lg border font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-brand-500/50 transition-all text-xs ${
                  isCellDisabled
                    ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border/60 text-muted-foreground'
                    : isAbsent
                    ? 'text-red-500 font-bold bg-red-50/20 dark:bg-red-950/20 border-red-300 dark:border-red-900'
                    : isBelow60
                    ? 'text-red-600 dark:text-red-400 font-bold bg-red-50/40 dark:bg-red-950/40 border-red-300 dark:border-red-900/60 shadow-2xs'
                    : 'text-foreground bg-background border-border/80 focus:border-brand-500'
                }`}
                placeholder="-"
              />
            )
          }
        })
      })

      // Summary score columns
      baseCols.push(
        {
          id: 'totalScore',
          header: 'รวม',
          cell: (info) => (
            <span className="font-mono font-bold text-xs text-foreground text-center block">
              {info.row.original.evaluation?.totalScore ?? 0}
            </span>
          )
        },
        {
          id: 'grade',
          header: 'เกรด',
          cell: (info) => {
            const evalData = info.row.original.evaluation
            const isMs = evalData?.specialGrade === 'มส' || (evalData?.attendancePercentage ?? 100) < 80
            const isR = evalData?.specialGrade === 'ร'

            if (isMs) return <span className="text-red-600 font-extrabold text-xs block text-center">มส</span>
            if (isR) return <span className="text-amber-600 font-extrabold text-xs block text-center">ร</span>
            return (
              <span className="text-brand-600 dark:text-brand-400 font-bold text-xs block text-center">
                {evalData?.grade ?? '0'}
              </span>
            )
          }
        },
        {
          id: 'attendance',
          header: 'เวลา',
          cell: (info) => {
            const evalData = info.row.original.evaluation
            const pct = evalData?.attendancePercentage ?? 100
            const isMs = pct < 80
            return (
              <span
                className={`font-mono text-[11px] font-semibold text-center block ${
                  isMs ? 'text-red-600 font-bold' : 'text-foreground'
                }`}
              >
                {pct}%
              </span>
            )
          }
        },
        {
          id: 'actions',
          header: 'แก้',
          cell: (info) => {
            const isFinalLocked = isRoundLocked(3)
            const isActionDisabled = Boolean(isFinalLocked || !isCurrentRoomEditable)
            return (
              <button
                type="button"
                disabled={isActionDisabled}
                onClick={() => openOverrideModal(info.row.original)}
                className={`p-1 rounded-lg transition-all mx-auto block ${
                  isActionDisabled
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-brand-600 cursor-pointer'
                }`}
                title={
                  !isCurrentRoomEditable
                    ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                    : isFinalLocked
                    ? 'ผลการประเมินถูกล็อกแล้ว (ส่งตรวจระยะที่ 3 แล้ว)'
                    : 'ปรับแก้เวลาเรียน / เกรดพิเศษ'
                }
              >
                <Edit2 className="w-3.5 h-3.5 shrink-0" />
              </button>
            )
          }
        }
      )
    }

    // Mode 2: DESIRABLE (คุณลักษณะอันพึงประสงค์ - 8 ข้อ)
    if (activeMode === 'DESIRABLE') {
      const isRound3Locked = isRoundLocked(3)

      DESIRABLE_ITEMS.forEach((itemName, itemIdx) => {
        baseCols.push({
          id: `desirable_${itemIdx}`,
          header: () => (
            <div className="flex flex-col items-center justify-center p-0.5 text-center w-full" title={itemName}>
              <span className="font-bold text-foreground text-[11px]">
                ข้อ {itemIdx + 1}
              </span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[48px] leading-none">
                {itemName}
              </span>
            </div>
          ),
          cell: (info) => {
            const rIdx = info.row.index
            const items = info.row.original.parsedDesirableSubscores || [3, 3, 3, 3, 3, 3, 3, 3]
            const scoreVal = items[itemIdx] ?? 3
            const isInactive = info.row.original.studentStatus && info.row.original.studentStatus !== 'ACTIVE'

            const isCellDisabled = Boolean(isInactive || isRound3Locked || !isCurrentRoomEditable)

            return (
              <input
                id={`cell-${rIdx}-${itemIdx}`}
                type="number"
                min="0"
                max="3"
                value={scoreVal}
                disabled={isCellDisabled}
                title={
                  isInactive
                    ? 'นักเรียนไม่ได้อยู่ในสถานะปกติ'
                    : !isCurrentRoomEditable
                    ? selectedRoomTab === 'ALL'
                      ? 'โหมดภาพรวม (อ่านอย่างเดียว) — เลือกแท็บห้องเรียนเพื่อแก้ไข'
                      : `โหมดอ่านอย่างเดียว (ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูท่านอื่น'})`
                    : isRound3Locked
                    ? `${itemName}: ${getDesirableLabel(scoreVal)} (${scoreVal}) - 🔒 ล็อกแล้ว (ส่งตรวจระยะที่ 3 แล้ว)`
                    : `${itemName}: ${getDesirableLabel(scoreVal)} (${scoreVal})`
                }
                onChange={(e) =>
                  handleSubscoreChange(info.row.original.enrollmentId, 'DESIRABLE', itemIdx, e.target.value)
                }
                onKeyDown={(e) => handleKeyDown(e, rIdx, itemIdx)}
                onFocus={(e) => e.target.select()}
                className={`w-10 mx-auto block text-center py-1 rounded-lg border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs ${
                  isCellDisabled
                    ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border/60 text-muted-foreground'
                    : scoreVal === 3
                    ? 'bg-background border-border/80 text-brand-600 dark:text-brand-400'
                    : scoreVal === 2
                    ? 'bg-background border-border/80 text-emerald-600 dark:text-emerald-400'
                    : scoreVal === 1
                    ? 'bg-background border-border/80 text-amber-600 dark:text-amber-400'
                    : 'bg-background border-border/80 text-red-500'
                }`}
              />
            )
          }
        })
      })

      baseCols.push({
        id: 'desirableSummary',
        header: 'สรุปผล',
        cell: (info) => {
          const gradeVal = info.row.original.evaluation?.desirableGrade ?? 3
          const label = `${getDesirableLabel(gradeVal)} (${gradeVal})`
          return (
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold text-center block ${
                gradeVal === 3
                  ? 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                  : gradeVal === 2
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : gradeVal === 1
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950 text-red-600 border border-red-200'
              }`}
            >
              {label}
            </span>
          )
        }
      })
    }

    // Mode 3: READING (การอ่าน คิดวิเคราะห์ และเขียน - 5 ข้อ)
    if (activeMode === 'READING') {
      const isRound3Locked = isRoundLocked(3)

      READING_ITEMS.forEach((itemName, itemIdx) => {
        baseCols.push({
          id: `reading_${itemIdx}`,
          header: () => (
            <div className="flex flex-col items-center justify-center p-0.5 text-center w-full" title={itemName}>
              <span className="font-bold text-foreground text-[11px]">
                ข้อ {itemIdx + 1}
              </span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[56px] leading-none">
                {itemName}
              </span>
            </div>
          ),
          cell: (info) => {
            const rIdx = info.row.index
            const items = info.row.original.parsedReadingSubscores || [3, 3, 3, 3, 3]
            const scoreVal = items[itemIdx] ?? 3
            const isInactive = info.row.original.studentStatus && info.row.original.studentStatus !== 'ACTIVE'
            const isCellDisabled = Boolean(isInactive || isRound3Locked || !isCurrentRoomEditable)

            return (
              <input
                id={`cell-${rIdx}-${itemIdx}`}
                type="number"
                min="0"
                max="3"
                value={scoreVal}
                disabled={isCellDisabled}
                title={
                  isInactive
                    ? 'นักเรียนไม่ได้อยู่ในสถานะปกติ'
                    : !isCurrentRoomEditable
                    ? selectedRoomTab === 'ALL'
                      ? 'โหมดภาพรวม (อ่านอย่างเดียว) — เลือกแท็บห้องเรียนเพื่อแก้ไข'
                      : `โหมดอ่านอย่างเดียว (ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูท่านอื่น'})`
                    : isRound3Locked
                    ? `${itemName}: ${getReadingLabel(scoreVal)} (${scoreVal}) - 🔒 ล็อกแล้ว (ส่งตรวจระยะที่ 3 แล้ว)`
                    : `${itemName}: ${getReadingLabel(scoreVal)} (${scoreVal})`
                }
                onChange={(e) =>
                  handleSubscoreChange(info.row.original.enrollmentId, 'READING', itemIdx, e.target.value)
                }
                onKeyDown={(e) => handleKeyDown(e, rIdx, itemIdx)}
                onFocus={(e) => e.target.select()}
                className={`w-10 mx-auto block text-center py-1 rounded-lg border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs ${
                  isCellDisabled
                    ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border/60 text-muted-foreground'
                    : scoreVal === 3
                    ? 'bg-background border-border/80 text-brand-600 dark:text-brand-400'
                    : scoreVal === 2
                    ? 'bg-background border-border/80 text-emerald-600 dark:text-emerald-400'
                    : scoreVal === 1
                    ? 'bg-background border-border/80 text-amber-600 dark:text-amber-400'
                    : 'bg-background border-border/80 text-red-500'
                }`}
              />
            )
          }
        })
      })

      baseCols.push({
        id: 'readingSummary',
        header: 'สรุปผล',
        cell: (info) => {
          const gradeVal = info.row.original.evaluation?.readingGrade ?? 3
          const label = `${getReadingLabel(gradeVal)} (${gradeVal})`
          return (
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold text-center block ${
                gradeVal === 3
                  ? 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                  : gradeVal === 2
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : gradeVal === 1
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950 text-red-600 border border-red-200'
              }`}
            >
              {label}
            </span>
          )
        }
      })
    }

    // Mode 4: COMPETENCY (สมรรถนะสำคัญของผู้เรียน - 5 ด้าน)
    if (activeMode === 'COMPETENCY') {
      const isRound3Locked = isRoundLocked(3)

      COMPETENCY_ITEMS.forEach((itemName, itemIdx) => {
        baseCols.push({
          id: `competency_${itemIdx}`,
          header: () => (
            <div className="flex flex-col items-center justify-center p-0.5 text-center w-full" title={itemName}>
              <span className="font-bold text-foreground text-[11px]">
                ด้านที่ {itemIdx + 1}
              </span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[56px] leading-none">
                {itemName}
              </span>
            </div>
          ),
          cell: (info) => {
            const rIdx = info.row.index
            const items = info.row.original.parsedCompetencySubscores || [3, 3, 3, 3, 3]
            const scoreVal = items[itemIdx] ?? 3
            const isInactive = info.row.original.studentStatus && info.row.original.studentStatus !== 'ACTIVE'
            const isCellDisabled = Boolean(isInactive || isRound3Locked || !isCurrentRoomEditable)

            return (
              <input
                id={`cell-${rIdx}-${itemIdx}`}
                type="number"
                min="0"
                max="3"
                value={scoreVal}
                disabled={isCellDisabled}
                title={
                  isInactive
                    ? 'นักเรียนไม่ได้อยู่ในสถานะปกติ'
                    : !isCurrentRoomEditable
                    ? selectedRoomTab === 'ALL'
                      ? 'โหมดภาพรวม (อ่านอย่างเดียว) — เลือกแท็บห้องเรียนเพื่อแก้ไข'
                      : `โหมดอ่านอย่างเดียว (ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูท่านอื่น'})`
                    : isRound3Locked
                    ? `${itemName}: ${getCompetencyItemLabel(scoreVal)} (${scoreVal}) - 🔒 ล็อกแล้ว (ส่งตรวจระยะที่ 3 แล้ว)`
                    : `${itemName}: ${getCompetencyItemLabel(scoreVal)} (${scoreVal})`
                }
                onChange={(e) =>
                  handleSubscoreChange(info.row.original.enrollmentId, 'COMPETENCY', itemIdx, e.target.value)
                }
                onKeyDown={(e) => handleKeyDown(e, rIdx, itemIdx)}
                onFocus={(e) => e.target.select()}
                className={`w-10 mx-auto block text-center py-1 rounded-lg border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs ${
                  isCellDisabled
                    ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border/60 text-muted-foreground'
                    : scoreVal === 3
                    ? 'bg-background border-border/80 text-brand-600 dark:text-brand-400'
                    : scoreVal === 2
                    ? 'bg-background border-border/80 text-emerald-600 dark:text-emerald-400'
                    : scoreVal === 1
                    ? 'bg-background border-border/80 text-amber-600 dark:text-amber-400'
                    : 'bg-red-50 dark:bg-red-950 text-red-600 border border-red-200'
                }`}
              />
            )
          }
        })
      })

      baseCols.push({
        id: 'competencySummary',
        header: 'สรุปผล',
        cell: (info) => {
          const gradeVal = info.row.original.evaluation?.competencyGrade ?? 3
          const label = `${getCompetencySummaryLabel(gradeVal)} (${gradeVal})`
          return (
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold text-center block ${
                gradeVal === 3
                  ? 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                  : gradeVal === 2
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : gradeVal === 1
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950 text-red-600 border border-red-200'
              }`}
            >
              {label}
            </span>
          )
        }
      })
    }

    return baseCols
  }, [activeMode, scoreColumns, filteredStudents.length, selectedRoomTab, isCurrentRoomEditable, course?.attendanceMaxPeriod1, course?.attendanceMaxPeriod2])

  // TanStack Table Instance
  const table = useReactTable({
    data: filteredStudents,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  // Calculate Total Weight across all score columns
  const totalWeight = React.useMemo(() => {
    return scoreColumns.reduce((sum, col) => sum + col.weight, 0)
  }, [scoreColumns])

  return (
    <DashboardShell
      title={course ? `${course.courseCode} - ${course.courseName}` : 'สมุดบันทึกคะแนน'}
      description={
        course
          ? `${course.department} • ${course.credits} หน่วยกิต (${course.totalHours} คาบ) • รวม ${students.length} คน`
          : 'ตารางบันทึกคะแนนรายวิชา'
      }
      badge={course ? course.courseCode : 'Gradebook'}
      fullWidth={true}
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold shrink-0">
            {saveStatus === 'saving' && (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                <span className="hidden sm:inline text-amber-600 dark:text-amber-400">กำลังบันทึก...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">บันทึกอัตโนมัติแล้ว</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="hidden sm:inline text-red-600 dark:text-red-400">เกิดข้อผิดพลาด</span>
              </>
            )}
          </div>

          {/* Course Info & Description Button (for ปพ.5) */}
          <button
            type="button"
            onClick={handleOpenCourseInfo}
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer shrink-0"
            title="ข้อมูลรายวิชา คำอธิบายรายวิชา และผลการเรียนรู้สำหรับ ปพ.5"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="hidden lg:inline">คำอธิบายวิชา</span>
          </button>

          {/* Print PP5 Report Button */}
          <Link
            href={`/courses/${courseId}/pp5`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer shrink-0"
            title="พิมพ์เล่ม ปพ.5 ฉบับสมบูรณ์ (7 องค์ประกอบ)"
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="hidden md:inline">พิมพ์ ปพ.5</span>
          </Link>

          {/* Manage Columns Button */}
          <button
            type="button"
            onClick={() => setIsColumnModalOpen(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer shrink-0"
            title="จัดการช่องคะแนนและสัดส่วนคะแนน"
          >
            <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="hidden sm:inline">ช่องคะแนน</span>
          </button>

          {/* Submit Verification Button */}
          <button
            type="button"
            onClick={() => {
              const unsubmitted = [1, 2, 3].find((r) => {
                const v = course?.verifications?.find((cv) => cv.round === r)
                return !v?.teacherSubmitted || v?.deptHeadStatus === 'REVISE' || v?.academicStatus === 'REVISE'
              })
              setSelectedRoundToSubmit(unsubmitted || 1)
              setIsVerificationModalOpen(true)
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
            title="ส่งตรวจคะแนนตามระยะที่วิชาการกำหนด"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">ส่งตรวจคะแนน</span>
            <span className="sm:hidden">ส่งตรวจ</span>
          </button>

          <Link
            href="/courses"
            className="p-1.5 sm:p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
            title="กลับหน้ารายวิชา"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 3-Round Verification Status Tracker Bar */}
        {course?.verifications && course.verifications.length > 0 && (
          <div className="bg-card border border-border/80 rounded-2xl p-3 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>สถานะการส่งตรวจ 3 ระยะ:</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 md:max-w-2xl">
                {[1, 2, 3].map((r) => {
                  const ver = course.verifications?.find((v) => v.round === r)
                  const roundTitle = r === 1 ? '1. ก่อนกลางภาค' : r === 2 ? '2. กลางภาค' : '3. ปลายภาค + SGS'

                  const isSubmitted = ver?.teacherSubmitted
                  const isDeptApproved = ver?.deptHeadStatus === 'APPROVED'
                  const isDeptRevise = ver?.deptHeadStatus === 'REVISE'
                  const isAcademicApproved = ver?.academicStatus === 'APPROVED'
                  const isAcademicRevise = ver?.academicStatus === 'REVISE'

                  let statusText = 'ยังไม่ส่งตรวจ'
                  let badgeClass = 'bg-muted/70 text-muted-foreground border-border/60'

                  if (isAcademicApproved) {
                    statusText = 'วิชาการอนุมัติแล้ว'
                    badgeClass = 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  } else if (isAcademicRevise || isDeptRevise) {
                    statusText = 'ส่งกลับแก้ไข'
                    badgeClass = 'bg-red-50 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                  } else if (isDeptApproved) {
                    statusText = 'หัวหน้ากลุ่มสาระฯ รับรอง'
                    badgeClass = 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                  } else if (ver?.unlockRequested) {
                    statusText = 'ขอปลดล็อกแก้ไข (รออนุมัติ)'
                    badgeClass = 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 animate-pulse'
                  } else if (isSubmitted) {
                    statusText = 'ส่งตรวจแล้ว (รอตรวจ)'
                    badgeClass = 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  }

                  return (
                    <div
                      key={r}
                      className="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-background/50 text-[11px]"
                    >
                      <span className="font-semibold text-foreground truncate">{roundTitle}</span>
                      <span className={`px-2 py-0.5 rounded-lg font-bold border text-[10px] shrink-0 ${badgeClass}`}>
                        {statusText}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Unlock Request Alert Banner */}
        {unlockRequestedRounds.length > 0 && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800/80 rounded-2xl p-4 text-xs space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-sky-800 dark:text-sky-300 text-sm">
              <Clock className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <span>
                กำลังรอการพิจารณาอนุมัติปลดล็อกแก้ไขคะแนน ({unlockRequestedRounds.map((r) => `ระยะที่ ${r.round}`).join(', ')})
              </span>
            </div>
            <div className="space-y-1.5 pl-6">
              {unlockRequestedRounds.map((r) => (
                <div key={r.round} className="p-2.5 rounded-xl bg-background/80 border border-sky-200 dark:border-sky-900/60 text-foreground">
                  <div className="font-bold text-sky-900 dark:text-sky-200 mb-1">
                    ระยะที่ {r.round} ({r.round === 1 ? 'ก่อนกลางภาค' : r.round === 2 ? 'กลางภาค' : 'ปลายภาค + SGS'}):
                  </div>
                  {r.unlockReason && (
                    <div className="text-xs text-foreground/90">
                      <span className="font-semibold text-sky-600 dark:text-sky-400">เหตุผลที่ขอปลดล็อก:</span> {r.unlockReason}
                    </div>
                  )}
                  {r.unlockRequestedAt && (
                    <div className="text-[10px] text-muted-foreground pt-1">
                      ยื่นคำขอเมื่อ {new Date(r.unlockRequestedAt).toLocaleString('th-TH')}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">
                * คำขอปลดล็อกได้รับการบันทึกและแจ้งเตือนไปยังหัวหน้ากลุ่มสาระฯ และฝ่ายวิชาการแล้ว เมื่อได้รับการอนุมัติ ตารางคะแนนจะเปิดให้แก้ไขได้ทันที
              </p>
            </div>
          </div>
        )}

        {/* Revision Alert Banner (When any round is returned for revision) */}
        {revisionRounds.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 text-xs space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>มีรายการส่งกลับให้แก้ไข ({revisionRounds.map((r) => `ระยะที่ ${r.round}`).join(', ')})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRoundToSubmit(revisionRounds[0].round)
                  setIsVerificationModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>เปิดหน้าต่างส่งตรวจอีกครั้ง</span>
              </button>
            </div>
            <div className="space-y-1.5 pl-6">
              {revisionRounds.map((r) => (
                <div key={r.round} className="p-2.5 rounded-xl bg-background/80 border border-amber-200 dark:border-amber-900/60 text-foreground">
                  <div className="font-bold text-amber-900 dark:text-amber-200 mb-1">
                    ระยะที่ {r.round} ({r.round === 1 ? 'ก่อนกลางภาค' : r.round === 2 ? 'กลางภาค' : 'ปลายภาค + SGS'}):
                  </div>
                  {r.deptHeadComment && (
                    <div className="text-xs text-foreground/90">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">หัวหน้ากลุ่มสาระฯ:</span> {r.deptHeadComment}
                    </div>
                  )}
                  {r.academicComment && (
                    <div className="text-xs text-foreground/90">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">ฝ่ายวิชาการ:</span> {r.academicComment}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">
                * ระบบได้ปลดล็อกตารางคะแนนและข้อมูลที่เกี่ยวข้องให้ท่านแก้ไขแล้ว เมื่อแก้ไขเรียบร้อยแล้ว กรุณากดปุ่ม <strong>&quot;ส่งตรวจคะแนน&quot;</strong> เพื่อส่งตรวจใหม่อีกครั้ง
              </p>
            </div>
          </div>
        )}

        {/* Top Assessment Mode Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none border-b border-border bg-card/60 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveMode('ATTENDANCE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeMode === 'ATTENDANCE'
                ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>บันทึกเวลาเรียน (Attendance)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('SCORES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeMode === 'SCORES'
                ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>1. บันทึกคะแนน (Gradebook)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('DESIRABLE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeMode === 'DESIRABLE'
                ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>2. คุณลักษณะอันพึงประสงค์ (8 ข้อ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('READING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeMode === 'READING'
                ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>3. การอ่าน คิดวิเคราะห์ และเขียน (5 ข้อ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('COMPETENCY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeMode === 'COMPETENCY'
                ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>4. สมรรถนะสำคัญ (5 ด้าน)</span>
          </button>
        </div>

        {/* Room Dropdown Selection & Controls Bar */}
        <div className="bg-card border border-border p-3 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Room Dropdown Select (Prompt requirement 1) */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="room-select" className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                ห้องเรียน:
              </label>
              <div className="relative">
                <select
                  id="room-select"
                  value={selectedRoomTab}
                  onChange={(e) => setSelectedRoomTab(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer shadow-xs min-w-44"
                >
                  <option value="ALL">★ รวมทุกห้อง ({students.length} คน) [ภาพรวม]</option>
                  {sortRooms(rooms).map((room) => {
                    const countInRoom = students.filter((s) => s.roomId === room).length
                    const isMyRoom = myAssignedRooms.includes(room)
                    const roomTeacher = courseTeachers.find((t) => parseAssignedRooms(t.assignedRooms).includes(room))
                    const label = hasMultipleTeachers
                      ? isMyRoom
                        ? `ห้อง ม.${room} (ห้องของฉัน - ${countInRoom} คน)`
                        : `ห้อง ม.${room} (${roomTeacher?.user?.name || 'ครูท่านอื่น'} - ${countInRoom} คน)`
                      : `ห้อง ม.${room} (${countInRoom} คน)`

                    return (
                      <option key={room} value={room}>
                        {label}
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Quick Actions according to Active Mode */}
            {activeMode === 'ATTENDANCE' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={handleBatchFillAttendance100}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 text-muted-foreground'
                      : 'bg-card hover:bg-muted text-foreground cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'เติมชั่วโมงเต็ม 100% ให้ทุกคนในห้องนี้'
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>เติมเวลาเรียนเต็ม 100% (ทั้งห้อง)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfigMaxP1(course?.attendanceMaxPeriod1 ?? 20)
                    setConfigMaxP2(course?.attendanceMaxPeriod2 ?? 20)
                    setIsAttendanceConfigOpen(true)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-900 transition-all cursor-pointer shadow-xs"
                  title="กำหนดชั่วโมงเต็มก่อนกลางภาค และหลังกลางภาค"
                >
                  <Settings2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>ตั้งค่าชั่วโมงเต็ม ({course?.attendanceMaxPeriod1 ?? 20} + {course?.attendanceMaxPeriod2 ?? 20} ชม.)</span>
                </button>
              </div>
            )}

            {activeMode === 'SCORES' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportToAutoSGS('SCORES_MIDTERM')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs"
                  title="คัดลอกคะแนนช่วงก่อนกลางภาคและกลางภาคครบทุกคนในห้อง สำหรับนำไปกรอกบน SGS ด้วย AutoSGS (F2)"
                >
                  <ClipboardCopy className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คัดลอกสำหรับ AutoSGS ก่อนกลางภาค+กลางภาค</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportToAutoSGS('SCORES_FINAL')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs"
                  title="คัดลอกคะแนนช่วงหลังกลางภาคและปลายภาคครบทุกคนในห้อง สำหรับนำไปกรอกบน SGS ด้วย AutoSGS (F2)"
                >
                  <ClipboardCopy className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คัดลอกสำหรับ AutoSGS หลังกลางภาค+ปลายภาค</span>
                </button>
                <span
                  className="text-[11px] text-muted-foreground px-2 py-1 rounded-lg bg-muted border border-border/50 select-none"
                  title="รองรับ AutoSGS v1.1.3 ขึ้นไป: คงข้อมูลนักเรียนครบทุกคนในห้อง แม้ยังกรอกคะแนนไม่ถึงคนสุดท้าย"
                >
                  AutoSGS v1.1.3+
                </span>
              </div>
            )}

            {activeMode === 'DESIRABLE' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={handleTriggerAutoCalculate}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border text-muted-foreground'
                      : 'bg-brand-50 dark:bg-brand-950 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-all cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'คำนวณอัตโนมัติจากผลการเรียนตามเกณฑ์ Admin'
                  }
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คำนวณอัตโนมัติจากเกรด</span>
                </button>
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={() => handleBatchFillAllThree('DESIRABLE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 text-muted-foreground'
                      : 'bg-card hover:bg-muted text-foreground cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'เติมระดับ 3 ทั้งห้อง'
                  }
                >
                  <span>เติมระดับ 3 ทั้งห้อง</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportToAutoSGS('DESIRABLE')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                  title="คัดลอก 8 ช่อง + 4 Tab สำหรับ AutoSGS"
                >
                  <ClipboardCopy className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คัดลอก AutoSGS (8 ช่อง)</span>
                </button>
              </div>
            )}

            {activeMode === 'READING' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={handleTriggerAutoCalculate}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border text-muted-foreground'
                      : 'bg-brand-50 dark:bg-brand-950 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-all cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'คำนวณอัตโนมัติจากเกรด'
                  }
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คำนวณอัตโนมัติจากเกรด</span>
                </button>
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={() => handleBatchFillAllThree('READING')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 text-muted-foreground'
                      : 'bg-card hover:bg-muted text-foreground cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'เติมระดับ 3 ทั้งห้อง'
                  }
                >
                  <span>เติมระดับ 3 ทั้งห้อง</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportToAutoSGS('READING')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                  title="คัดลอก 5 ช่อง + 3 Tab สำหรับ AutoSGS"
                >
                  <ClipboardCopy className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คัดลอก AutoSGS (5 ช่อง)</span>
                </button>
              </div>
            )}

            {activeMode === 'COMPETENCY' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={handleTriggerAutoCalculate}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 border-border text-muted-foreground'
                      : 'bg-brand-50 dark:bg-brand-950 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-all cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'คำนวณอัตโนมัติจากเกรด'
                  }
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>คำนวณอัตโนมัติจากเกรด</span>
                </button>
                <button
                  type="button"
                  disabled={!isCurrentRoomEditable}
                  onClick={() => handleBatchFillAllThree('COMPETENCY')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold transition-all shadow-xs ${
                    !isCurrentRoomEditable
                      ? 'opacity-40 cursor-not-allowed bg-muted/50 text-muted-foreground'
                      : 'bg-card hover:bg-muted text-foreground cursor-pointer'
                  }`}
                  title={
                    !isCurrentRoomEditable
                      ? 'โหมดอ่านอย่างเดียว (ไม่มีสิทธิ์แก้ไขห้องนี้)'
                      : 'เติมระดับ 3 ทั้งห้อง'
                  }
                >
                  <span>เติมระดับ 3 ทั้งห้อง</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-60 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>

        {/* Strict Room Isolation / Read-Only Banner */}
        {!isCurrentRoomEditable && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 text-sky-800 dark:text-sky-300 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/60 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1.5 flex-wrap">
                  <span>
                    {selectedRoomTab === 'ALL'
                      ? '📊 โหมดดูภาพรวมทุกห้องเรียน (โหมดอ่านอย่างเดียว)'
                      : `🔒 ห้อง ม.${selectedRoomTab} อยู่ในความรับผิดชอบของ ${currentRoomTeacherName || 'ครูผู้สอนท่านอื่น'}`}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-200/60 dark:bg-sky-900 text-sky-800 dark:text-sky-200 font-bold shrink-0">
                    Read-Only
                  </span>
                </div>
                <div className="text-[11px] text-sky-700/80 dark:text-sky-300/80 mt-0.5">
                  {selectedRoomTab === 'ALL'
                    ? 'เพื่อความถูกต้อง ป้องกันการบันทึกทับข้อมูลข้ามห้อง กรุณาเลือกห้องเรียนที่คุณรับผิดชอบจากเมนูด้านบนเพื่อบันทึกคะแนน'
                    : 'คุณสามารถดูคะแนนและผลการประเมินเพื่อเทียบเคียงได้ แต่ไม่สามารถแก้ไขข้อมูลของห้องเรียนนี้ได้'}
                </div>
              </div>
            </div>
            {myAssignedRooms.length > 0 && selectedRoomTab !== myAssignedRooms[0] && (
              <button
                type="button"
                onClick={() => setSelectedRoomTab(myAssignedRooms[0])}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer self-start sm:self-auto"
              >
                ไปยังห้องของฉัน (ม.{myAssignedRooms[0]})
              </button>
            )}
          </div>
        )}

        {/* Hints and Status bar */}
        <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground flex-wrap">
          {activeMode === 'SCORES' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                น้ำหนักคะแนนรวม:{' '}
                <strong className={totalWeight === 100 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {totalWeight} / 100
                </strong>
              </span>
              {totalWeight !== 100 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  (ควรมีผลรวมน้ำหนัก 100 คะแนน)
                </span>
              )}
              <span className="text-muted-foreground/60 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                <span>ตัวเลขสีแดง: คะแนนไม่ถึงร้อยละ 60 ของคะแนนเต็ม (ก่อนกลาง/กลาง/หลังกลางภาค)</span>
              </span>
            </div>
          ) : activeMode === 'COMPETENCY' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                ระดับคะแนนแต่ละสมรรถนะ: <strong>3: ดีมาก, 2: ดี, 1: ปรับปรุง</strong>
              </span>
              <span className="text-muted-foreground/60 hidden sm:inline">•</span>
              <span>
                สรุปภาพรวม: <strong>3: ดีเยี่ยม, 2: ดี, 1: พอใช้, 0: ปรับปรุง</strong>
              </span>
            </div>
          ) : activeMode === 'DESIRABLE' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                ระดับคะแนน: <strong>3: ดีเยี่ยม, 2: ดี, 1: ผ่าน, 0: ไม่ผ่าน</strong>
              </span>
              <span className="text-muted-foreground/60 hidden sm:inline">•</span>
              <span className="text-brand-600 dark:text-brand-400 font-medium">
                (ข้อ 1, 2, 8 คงไว้ที่ระดับ 3 ดีเยี่ยม ทุกผลการเรียน)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>
                ระดับคะแนน: <strong>3: ดีเยี่ยม, 2: ดี, 1: ผ่าน, 0: ไม่ผ่าน</strong>
              </span>
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 text-[10px] bg-muted/50 px-2.5 py-1 rounded-lg">
            <span>
              ⌨️ กด <kbd className="font-mono bg-card px-1 py-0.5 rounded border border-border">Enter</kbd> หรือ{' '}
              <kbd className="font-mono bg-card px-1 py-0.5 rounded border border-border">↓</kbd> เลื่อนลง,{' '}
              <kbd className="font-mono bg-card px-1 py-0.5 rounded border border-border">Tab</kbd> เลื่อนขวา
              {activeMode === 'SCORES' && ' • ขาดสอบพิมพ์ ข'}
            </span>
          </div>
        </div>

        {/* TanStack Table Grid */}
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/60 text-foreground sticky top-0 z-20 backdrop-blur-md shadow-xs border-b border-border text-[11px]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const isSeat = header.id === 'seatNo'
                      const isCode = header.id === 'studentCode'
                      const isName = header.id === 'name'
                      const isRoom = header.id === 'roomId'
                      const isTotal = header.id === 'totalScore'
                      const isGrade = header.id === 'grade'
                      const isAtt = header.id === 'attendance'
                      const isAction = header.id === 'actions'
                      const isScoreCol = header.id.startsWith('score_')
                      const is3DCol =
                        header.id.startsWith('desirable_') ||
                        header.id.startsWith('reading_') ||
                        header.id.startsWith('competency_')
                      const isSummaryCol = header.id.endsWith('Summary')

                      let widthClass = ''
                      if (isSeat) widthClass = 'w-10 text-center'
                      else if (isCode) widthClass = 'w-16 text-center'
                      else if (isName) widthClass = 'w-36 text-left'
                      else if (isRoom) widthClass = 'w-12 text-center'
                      else if (isScoreCol) widthClass = 'w-14 min-w-[52px] max-w-[64px] text-center'
                      else if (is3DCol) widthClass = 'w-12 min-w-[48px] max-w-[56px] text-center'
                      else if (isTotal) widthClass = 'w-12 text-center'
                      else if (isGrade) widthClass = 'w-10 text-center'
                      else if (isAtt) widthClass = 'w-12 text-center'
                      else if (isAction) widthClass = 'w-9 text-center'
                      else if (isSummaryCol) widthClass = 'w-24 text-center'
                      else widthClass = 'text-center'

                      return (
                        <th
                          key={header.id}
                          className={`p-1.5 font-bold border-r border-border/60 select-none ${widthClass}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-16 text-muted-foreground">
                      <Clock className="w-6 h-6 mx-auto mb-2 animate-spin text-brand-500" />
                      กำลังโหลดข้อมูลตารางคะแนน...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-16 text-muted-foreground">
                      ไม่พบข้อมูลนักเรียนในห้องที่เลือก
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const isInactive = row.original.studentStatus && row.original.studentStatus !== 'ACTIVE'
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isInactive
                            ? 'bg-muted/30 opacity-75 hover:bg-muted/50'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="p-1 border-r border-border/40">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Column Management Modal (Prompt requirement 2: Redesigned 4-Period Cards Layout) */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-card border border-border w-full max-w-4xl rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-950/80 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <Settings2 className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    จัดการโครงสร้างช่องคะแนน (Score Structure)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    กำหนดและปรับแต่งช่องคะแนนแยกตาม 4 ช่วงเวลาการวัดผล
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleCancelAddEdit()
                  setIsColumnModalOpen(false)
                }}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Total Weight Status & Quick Reset Bar */}
            <div className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-xl border font-mono font-extrabold text-sm flex items-center gap-1.5 ${
                    totalWeight === 100
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {totalWeight === 100 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>น้ำหนักรวม: {totalWeight} / 100</span>
                </div>
                <div className="text-xs text-muted-foreground hidden md:block">
                  {totalWeight === 100 ? (
                    <span className="text-emerald-600 font-semibold">สัดส่วนครบ 100 คะแนนเรียบร้อย</span>
                  ) : (
                    <span>ควรมีผลรวมน้ำหนักครบ 100 คะแนน (ก่อน 30 + กลาง 20 + หลัง 30 + ปลาย 20)</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetColumnsToDefault}
                disabled={isSavingColumn || isRoundLocked(1) || isRoundLocked(2) || isRoundLocked(3)}
                title={
                  isRoundLocked(1) || isRoundLocked(2) || isRoundLocked(3)
                    ? 'ไม่สามารถรีเซ็ตได้เนื่องจากมีระยะที่ส่งตรวจแล้วและถูกล็อก'
                    : undefined
                }
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/30 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-xs font-bold text-brand-700 dark:text-brand-300 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>รีเซ็ตเป็นค่าเริ่มต้น (10+10+10 / 20 / 10+10+10 / 20)</span>
              </button>
            </div>

            {/* 4-Period Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[
                {
                  type: 1,
                  title: 'ก่อนกลางภาค',
                  targetWeight: 30,
                  badgeBg: 'bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800'
                },
                {
                  type: 2,
                  title: 'กลางภาค',
                  targetWeight: 20,
                  badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                },
                {
                  type: 3,
                  title: 'หลังกลางภาค',
                  targetWeight: 30,
                  badgeBg: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                },
                {
                  type: 4,
                  title: 'ปลายภาค',
                  targetWeight: 20,
                  badgeBg: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                }
              ].map((period) => {
                const periodCols = scoreColumns.filter((c) => c.periodType === period.type)
                const periodWeightSum = periodCols.reduce((sum, c) => sum + (c.weight || 0), 0)
                const isWeightMatch = periodWeightSum === period.targetWeight
                const isAddingHere = addingToPeriod === period.type
                const isThisPeriodLocked = isPeriodLocked(period.type)

                return (
                  <div
                    key={period.type}
                    className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between shadow-2xs space-y-2.5"
                  >
                    <div>
                      {/* Period Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-border/70">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${period.badgeBg}`}>
                            ช่วงที่ {period.type}
                          </span>
                          <h4 className="font-bold text-xs text-foreground truncate">
                            {period.title}
                          </h4>
                          {isThisPeriodLocked && (
                            <span className="font-bold text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                              <Lock className="w-2.5 h-2.5" /> ล็อกแล้ว
                            </span>
                          )}
                        </div>

                        <span
                          className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-md border ${
                            isWeightMatch
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          }`}
                          title={`เป้าหมาย ${period.targetWeight} คะแนน`}
                        >
                          {periodWeightSum} / {period.targetWeight}
                        </span>
                      </div>

                      {/* Columns in this period */}
                      <div className="mt-2 space-y-1.5 min-h-[50px]">
                        {periodCols.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground/60 italic py-2 text-center">
                            ยังไม่มีช่องคะแนนในส่วนนี้
                          </p>
                        ) : (
                          periodCols.map((col) => {
                            const isBeingEdited = isEditingColumn && columnIdToEdit === col.id
                            if (isBeingEdited) return null

                            return (
                              <div
                                key={col.id}
                                className="p-2 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/60 flex items-center justify-between gap-2 transition-colors text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-foreground truncate block">
                                    {col.name}
                                  </span>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                    <span>เต็ม {col.maxScore}</span>
                                    <span>•</span>
                                    <span className="font-bold text-brand-600 dark:text-brand-400">
                                      น้ำหนัก {col.weight}
                                    </span>
                                  </div>
                                </div>

                                {!isThisPeriodLocked && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditColumn(col)}
                                      className="p-1 rounded-lg hover:bg-card text-muted-foreground hover:text-brand-600 border border-transparent hover:border-border transition-all cursor-pointer"
                                      title="แก้ไขช่องนี้"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 shrink-0" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteColumn(col.id, col.name)}
                                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-all cursor-pointer"
                                      title="ลบช่องนี้"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Inline Form or Add Button */}
                    <div className="pt-2 border-t border-border/70">
                      {isThisPeriodLocked ? (
                        <div className="py-2 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 bg-muted/30 rounded-lg">
                          <Lock className="w-3 h-3 text-amber-500" />
                          <span>ระยะนี้ส่งตรวจแล้ว ถูกล็อกโครงสร้างคะแนน</span>
                        </div>
                      ) : isAddingHere ? (
                        <form onSubmit={handleSaveColumn} className="bg-muted/60 p-2.5 rounded-xl border border-brand-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                              {isEditingColumn ? <Edit2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              <span>{isEditingColumn ? 'แก้ไขช่องคะแนน' : 'เพิ่มช่องคะแนนใหม่'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleCancelAddEdit}
                              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div>
                              <input
                                type="text"
                                value={colName}
                                onChange={(e) => setColName(e.target.value)}
                                placeholder="ชื่อช่อง เช่น ใบงานที่ 1, สอบย่อย"
                                className="w-full px-2.5 py-1 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                                autoFocus
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">
                                  คะแนนเต็ม
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  value={colMaxScore}
                                  onChange={(e) => setColMaxScore(parseFloat(e.target.value) || 10)}
                                  className="w-full px-2 py-1 text-xs rounded-lg bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">
                                  น้ำหนักคะแนน
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={colWeight}
                                  onChange={(e) => setColWeight(parseFloat(e.target.value) || 10)}
                                  className="w-full px-2 py-1 text-xs rounded-lg bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelAddEdit}
                              className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-[11px] font-semibold text-foreground transition-all cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingColumn}
                              className="px-3 py-1 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isSavingColumn ? 'กำลังบันทึก...' : isEditingColumn ? 'บันทึกแก้ไข' : 'เพิ่มช่อง'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartAddColumn(period.type)}
                          className="w-full py-1.5 px-2 rounded-lg border border-dashed border-border hover:border-brand-500/50 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 text-muted-foreground hover:text-brand-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>เพิ่มช่องในส่วนนี้</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  handleCancelAddEdit()
                  setIsColumnModalOpen(false)
                }}
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                เสร็จสิ้น / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Override Modal */}
      {isOverrideModalOpen && selectedStudentForOverride && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="font-bold text-sm text-foreground">
                  ปรับแก้ผลการเรียน:{' '}
                  {selectedStudentForOverride.prefix}
                  {selectedStudentForOverride.firstName} {selectedStudentForOverride.lastName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOverrideModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-all cursor-pointer"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">เวลาเรียน (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={overrideAttendance}
                  onChange={(e) => setOverrideAttendance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <p className="text-[10px] text-muted-foreground">
                  * หากเวลาเรียนต่ำกว่า 80% ระบบจะติด &quot;มส&quot; อัตโนมัติ
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">ผลการเรียนพิเศษ:</label>
                <select
                  value={overrideSpecialGrade}
                  onChange={(e) => setOverrideSpecialGrade(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                >
                  <option value="">- ไม่มี (ตามคะแนนสอบ) -</option>
                  <option value="มส">มส (เวลาเรียนไม่ถึง 80%)</option>
                  <option value="ร">ร (รอการตัดสินผล)</option>
                  <option value="ผ">ผ (ผ่าน)</option>
                  <option value="มผ">มผ (ไม่ผ่าน)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">คุณลักษณะฯ:</label>
                  <select
                    value={overrideDesirable}
                    onChange={(e) => setOverrideDesirable(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                  >
                    <option value={3}>3 - ดีเยี่ยม</option>
                    <option value={2}>2 - ดี</option>
                    <option value={1}>1 - ผ่าน</option>
                    <option value={0}>0 - ไม่ผ่าน</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">การอ่าน คิดวิเคราะห์ฯ:</label>
                  <select
                    value={overrideReading}
                    onChange={(e) => setOverrideReading(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                  >
                    <option value={3}>3 - ดีเยี่ยม</option>
                    <option value={2}>2 - ดี</option>
                    <option value={1}>1 - ผ่าน</option>
                    <option value={0}>0 - ไม่ผ่าน</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">สมรรถนะ (ภาพรวม):</label>
                  <select
                    value={overrideCompetency}
                    onChange={(e) => setOverrideCompetency(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                  >
                    <option value={3}>3 - ดีเยี่ยม</option>
                    <option value={2}>2 - ดี</option>
                    <option value={1}>1 - พอใช้</option>
                    <option value={0}>0 - ปรับปรุง</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">เหตุผลการปรับแก้:</label>
                <input
                  type="text"
                  placeholder="เช่น ป่วยลากิจ, ซ่อมเสริมเรียบร้อย"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingOverride}
                  className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingOverride ? 'กำลังบันทึก...' : 'บันทึกการปรับแก้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Config Modal */}
      {isAttendanceConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    ตั้งค่าเวลาเรียนเต็ม (ก่อน / หลังกลางภาค)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    วิชา {course?.courseCode} ({course?.totalHours} คาบ/ชั่วโมง)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAttendanceConfigOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendanceConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    ก่อนกลางภาค (ชั่วโมงเต็ม):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={configMaxP1}
                    onChange={(e) => setConfigMaxP1(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-background border border-border font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    หลังกลางภาค (ชั่วโมงเต็ม):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={configMaxP2}
                    onChange={(e) => setConfigMaxP2(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-background border border-border font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">รวมเวลาเรียนเต็มทั้งหมด:</span>
                  <span className="font-mono font-bold text-foreground">
                    {(configMaxP1 + configMaxP2).toFixed(1)} ชั่วโมง
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">เกณฑ์เวลาเรียนขั้นต่ำ 80% (มส):</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">
                    {((configMaxP1 + configMaxP2) * 0.8).toFixed(1)} ชั่วโมง
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  * หากนักเรียนมีเวลาเรียนรวมต่ำกว่า 80% ระบบจะตัดเกรดติด &quot;มส&quot; อัตโนมัติ
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAttendanceConfigOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingAttendanceConfig}
                  className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingAttendanceConfig ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Round Verification Submission Modal */}
      {isVerificationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-950/80 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <Send className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    ส่งตรวจคะแนนตามระยะ (Verification Submission)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    วิชา {course?.courseCode} {course?.courseName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVerificationModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Round Selection Cards */}
            <div className="space-y-2">
              <label className="font-bold text-xs text-foreground block">
                เลือกระยะที่ต้องการส่งตรวจ:
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    round: 1,
                    title: 'ระยะที่ 1: ก่อนกลางภาค',
                    desc: 'คะแนนเก็บช่วงก่อนกลางภาค (Period 1) และเวลาเรียนช่วงที่ 1'
                  },
                  {
                    round: 2,
                    title: 'ระยะที่ 2: กลางภาค',
                    desc: 'คะแนนสอบกลางภาค (Period 2)'
                  },
                  {
                    round: 3,
                    title: 'ระยะที่ 3: ปลายภาค + SGS',
                    desc: 'คะแนนหลังกลางภาค (Period 3), ปลายภาค (Period 4), เวลาเรียนทั้งหมด และผลการประเมิน 3 ด้าน'
                  }
                ].map((item) => {
                  const ver = course?.verifications?.find((v) => v.round === item.round)
                  const ms = termMilestones.find((m) => m.round === item.round)
                  const isSelected = selectedRoundToSubmit === item.round

                  const isSubmitted = ver?.teacherSubmitted
                  const isDeptApproved = ver?.deptHeadStatus === 'APPROVED'
                  const isDeptRevise = ver?.deptHeadStatus === 'REVISE'
                  const isAcademicApproved = ver?.academicStatus === 'APPROVED'
                  const isAcademicRevise = ver?.academicStatus === 'REVISE'

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-muted text-muted-foreground border border-border">
                      ยังไม่ส่งตรวจ
                    </span>
                  )
                  if (isAcademicApproved) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        วิชาการอนุมัติแล้ว
                      </span>
                    )
                  } else if (isDeptRevise || isAcademicRevise) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                        ส่งกลับแก้ไข
                      </span>
                    )
                  } else if (isDeptApproved) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                        หัวหน้ากลุ่มสาระฯ รับรองแล้ว
                      </span>
                    )
                  } else if (ver?.unlockRequested) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 animate-pulse">
                        ขอปลดล็อกแก้ไขแล้ว (รออนุมัติ)
                      </span>
                    )
                  } else if (isSubmitted) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        ส่งตรวจแล้ว (รอตรวจ)
                      </span>
                    )
                  }

                  return (
                    <div
                      key={item.round}
                      onClick={() => setSelectedRoundToSubmit(item.round)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/20 ring-2 ring-brand-500/20'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{item.title}</span>
                            {statusBadge}
                          </div>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">{item.desc}</p>
                          {ms?.teacherDeadline && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                              <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                              <span>เดดไลน์ครูผู้สอน: {new Date(ms.teacherDeadline).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                          )}
                        </div>
                        <input
                          type="radio"
                          name="roundSelector"
                          checked={isSelected}
                          onChange={() => setSelectedRoundToSubmit(item.round)}
                          className="mt-1 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>

                      {/* Unlock Request Note if any */}
                      {ver?.unlockRequested && (
                        <div className="mt-2.5 pt-2 border-t border-sky-200 dark:border-sky-800/60 text-[11px] space-y-1 bg-sky-500/10 p-2 rounded-lg">
                          <span className="font-semibold text-sky-700 dark:text-sky-300">
                            ยื่นคำขอปลดล็อกแก้ไขแล้ว:
                          </span>{' '}
                          &quot;{ver.unlockReason}&quot;
                        </div>
                      )}

                      {/* Revision Comments if any */}
                      {(ver?.deptHeadComment || ver?.academicComment) && (
                        <div className="mt-2.5 pt-2 border-t border-border/60 text-[11px] space-y-1 bg-amber-500/10 p-2 rounded-lg">
                          {ver.deptHeadComment && (
                            <div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">หมายเหตุหัวหน้ากลุ่มสาระฯ:</span>{' '}
                              {ver.deptHeadComment}
                            </div>
                          )}
                          {ver.academicComment && (
                            <div>
                              <span className="font-semibold text-purple-600 dark:text-purple-400">หมายเหตุฝ่ายวิชาการ:</span>{' '}
                              {ver.academicComment}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Warning Box */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Info className="w-4 h-4 text-brand-500 shrink-0" />
                <span>ข้อกำหนดและผลของการส่งตรวจ:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>เมื่อยืนยันส่งตรวจแล้ว ตารางคะแนนและข้อมูลในระยะนี้จะถูก <strong>ล็อกเป็น Read-Only ทันที</strong></li>
                <li>หัวหน้ากลุ่มสาระฯ และฝ่ายวิชาการจะได้รับข้อมูลเพื่อตรวจสอบความถูกต้อง</li>
                <li>หากมีข้อผิดพลาด หรือนักเรียนส่งงานย้อนหลัง/แก้ตัว สามารถกดปุ่ม <strong>&quot;ขอปลดล็อกแก้ไขคะแนน&quot;</strong> เพื่อให้หัวหน้ากลุ่มสาระฯ หรือวิชาการพิจารณาปลดล็อก</li>
              </ul>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsVerificationModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              {(() => {
                const currentVer = course?.verifications?.find((v) => v.round === selectedRoundToSubmit)
                const isAcademicApproved = currentVer?.academicStatus === 'APPROVED'
                const isSubmittedPending = currentVer?.teacherSubmitted && currentVer?.deptHeadStatus !== 'REVISE' && currentVer?.academicStatus !== 'REVISE'

                if (isAcademicApproved || isSubmittedPending) {
                  if (currentVer?.unlockRequested) {
                    return (
                      <span className="px-4 py-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 text-xs font-bold animate-pulse">
                        ⏳ ยื่นคำขอปลดล็อกแล้ว (รออนุมัติ)
                      </span>
                    )
                  }

                  return (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 rounded-xl bg-muted text-muted-foreground border border-border text-xs font-semibold">
                        {isAcademicApproved ? 'วิชาการอนุมัติแล้ว' : 'ส่งตรวจแล้ว (รอตรวจรับรอง)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setUnlockRoundToRequest(selectedRoundToSubmit)
                          setUnlockReasonInput('')
                          setIsUnlockModalOpen(true)
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-amber-500/20 transition-all cursor-pointer"
                        title="ขอปลดล็อกเพื่อแก้ไขคะแนน (เช่น นร. ส่งงานย้อนหลัง หรือส่งงานแก้ตัว)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>ขอปลดล็อกแก้ไขคะแนน</span>
                      </button>
                    </div>
                  )
                }

                const isResubmit = currentVer?.deptHeadStatus === 'REVISE' || currentVer?.academicStatus === 'REVISE'

                return (
                  <button
                    type="button"
                    disabled={isSubmittingVerification}
                    onClick={() => handleSubmitVerification(selectedRoundToSubmit)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isSubmittingVerification
                        ? 'กำลังส่งตรวจ...'
                        : isResubmit
                        ? `ยืนยันส่งตรวจอีกครั้ง (ระยะที่ ${selectedRoundToSubmit})`
                        : `ยืนยันส่งตรวจ (ระยะที่ ${selectedRoundToSubmit})`}
                    </span>
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Unlock Request Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <RotateCcw className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    ขอปลดล็อกแก้ไขคะแนน
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    วิชา {course?.courseCode} - ระยะที่ {unlockRoundToRequest} ({unlockRoundToRequest === 1 ? 'ก่อนกลางภาค' : unlockRoundToRequest === 2 ? 'กลางภาค' : 'ปลายภาค + SGS'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleRequestUnlock} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground block">
                  เหตุผลและความจำเป็นในการขอแก้ไขคะแนน: <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={unlockReasonInput}
                  onChange={(e) => setUnlockReasonInput(e.target.value)}
                  placeholder="เช่น นักเรียน ม.4.1 เลขที่ 15, 23 ส่งงานแก้ตัวชิ้นที่ 2 ย้อนหลัง ขอปรับแก้คะแนนจาก 0 เป็น 8"
                  className="w-full p-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none text-xs"
                  required
                />
              </div>

              {/* Special Warning if Round 3 and SGS transferred */}
              {(() => {
                const ver3 = course?.verifications?.find((v) => v.round === 3)
                if (unlockRoundToRequest === 3 && ver3?.sgsTransferred) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>คำเตือน: วิชานี้ได้นำส่งคะแนนเข้า SGS เรียบร้อยแล้ว</span>
                      </div>
                      <p className="leading-relaxed">
                        การขอปลดล็อกระยะนี้จะต้องได้รับการอนุมัติจากฝ่ายวิชาการเท่านั้น และเมื่อแก้ไขเสร็จเรียบร้อย จะต้องทำการส่งออกคะแนนเข้าสู่ระบบ SGS ซ้ำใหม่อีกครั้ง
                      </p>
                    </div>
                  )
                }
                return null
              })()}

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground block">ขั้นตอนหลังยื่นคำขอ:</span>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>คำขอจะส่งไปยังแดชบอร์ดของหัวหน้ากลุ่มสาระฯ และฝ่ายวิชาการ</li>
                  <li>เมื่อได้รับการอนุมัติ ตารางคะแนนระยะนี้จะปลดล็อกให้ท่านแก้ไขได้ทันที</li>
                  <li>หลังจากแก้ไขคะแนนเสร็จเรียบร้อย ให้กดส่งตรวจคะแนนอีกครั้ง</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsUnlockModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUnlock}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSubmittingUnlock ? 'กำลังส่งคำขอ...' : 'ยืนยันยื่นคำขอปลดล็อก'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AutoSGS Room Selector Modal (Room Guard) */}
      {isAutoSGSRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <ClipboardCopy className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    เลือกห้องเรียนสำหรับ AutoSGS
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {pendingAutoSGSMode === 'SCORES_MIDTERM'
                      ? 'โหมด: คะแนนก่อนกลางภาค + กลางภาค'
                      : pendingAutoSGSMode === 'SCORES_FINAL'
                      ? 'โหมด: คะแนนหลังกลางภาค + ปลายภาค'
                      : pendingAutoSGSMode === 'DESIRABLE'
                      ? 'โหมด: คุณลักษณะอันพึงประสงค์ (8 ช่อง)'
                      : 'โหมด: การอ่าน คิดวิเคราะห์ และเขียน (5 ช่อง)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAutoSGSRoomModalOpen(false)
                  setPendingAutoSGSMode(null)
                }}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Warning / Guidance notice */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>คำเตือน: ระบบ SGS บันทึกผลการเรียนทีละห้องเรียน</span>
              </div>
              <p className="leading-relaxed">
                เนื่องจากท่านกำลังเลือกแท็บ <strong>&quot;รวมทุกห้อง (ALL)&quot;</strong> การคัดลอกนักเรียนทั้งหมด ({students.length} คน) จะทำให้คะแนนพิมพ์ล้นออกนอกตารางในเว็บ SGS กรุณาเลือกห้องเรียนที่ท่านเปิดอยู่ใน SGS:
              </p>
            </div>

            {/* Room selection buttons */}
            <div className="space-y-2">
              <label className="font-semibold text-xs text-foreground block">
                คลิกเลือกห้องเรียนเพื่อคัดลอกลง Clipboard ทันที:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                {rooms.map((roomId) => {
                  const roomStudentCount = students.filter((s) => s.roomId === roomId).length
                  return (
                    <button
                      key={roomId}
                      type="button"
                      onClick={() => handleSelectRoomForAutoSGS(roomId)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/40 transition-all cursor-pointer text-center group"
                    >
                      <span className="font-bold text-sm text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        ห้อง {roomId}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {roomStudentCount} คน
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Fallback bulk copy option */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleExportAllRoomsForAutoSGS}
                className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted transition-colors cursor-pointer"
                title="คัดลอกนักเรียนครบทุกคนเพื่อสำรองข้อมูลภายนอก"
              >
                ยืนยันคัดลอกรวมทุกห้อง ({students.length} คน)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAutoSGSRoomModalOpen(false)
                  setPendingAutoSGSMode(null)
                }}
                className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Info & Description Modal (for ปพ.5) */}
      {isCourseInfoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <BookOpen className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    ข้อมูลรายวิชาและคำอธิบายรายวิชา (ปพ.5)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    บันทึกข้อมูลหลักสูตร คำอธิบายรายวิชา และโครงสร้างหน่วยการเรียนรู้สำหรับจัดพิมพ์เล่ม ปพ.5
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCourseInfoModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleSaveCourseInfo} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    รหัสวิชา: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={infoCourseCode}
                    onChange={(e) => setInfoCourseCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    ชื่อวิชา: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={infoCourseName}
                    onChange={(e) => setInfoCourseName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    กลุ่มสาระการเรียนรู้:
                  </label>
                  <input
                    type="text"
                    value={infoDepartment}
                    onChange={(e) => setInfoDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    ประเภทวิชา:
                  </label>
                  <select
                    value={infoCourseType}
                    onChange={(e) => setInfoCourseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="BASIC">รายวิชาพื้นฐาน (BASIC)</option>
                    <option value="ADDITIONAL">รายวิชาเพิ่มเติม (ADDITIONAL)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    จำนวนหน่วยกิต:
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={infoCredits}
                    onChange={(e) => setInfoCredits(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    จำนวนคาบเรียนทั้งหมด (ชม.):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={infoTotalHours}
                    onChange={(e) => setInfoTotalHours(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-mono"
                  />
                </div>
              </div>

              {/* Course Description */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground block">
                    คำอธิบายรายวิชา (Course Description):
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    * พิมพ์ลงในเล่ม ปพ.5 องค์ประกอบที่ 2
                  </span>
                </div>

                {/* File Attachment Status for Description */}
                {(() => {
                  const descFiles = parseAttachmentFiles(
                    course?.descriptionFiles,
                    course?.descriptionFilePath,
                    course?.descriptionFileType
                  )
                  return descFiles.length > 0 ? (
                    <div className="space-y-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          เอกสารแนบ ({descFiles[0].type === 'pdf' ? 'ไฟล์ PDF (แสดงทุกหน้าอัตโนมัติ)' : `รูปภาพ ${descFiles.length} รูป (1 รูป = 1 หน้า)`})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment('description')}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          ลบทั้งหมด
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {descFiles.map((item, idx) => (
                          <div
                            key={idx}
                            className="relative border border-border rounded-lg p-1.5 bg-card flex flex-col justify-between text-xs shadow-2xs"
                          >
                            {item.type === 'image' ? (
                              <div className="w-full h-16 mb-1 rounded overflow-hidden bg-muted flex items-center justify-center">
                                <img src={item.url} alt={`หน้า ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-full h-16 mb-1 rounded bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
                                <FileText className="w-6 h-6 mb-0.5 text-red-500" />
                                <span className="text-[10px] font-semibold">PDF เอกสาร</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/50">
                              <span className="truncate max-w-[80px] text-muted-foreground">
                                {item.name || `หน้า ${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-brand-600 hover:underline"
                                  title="ดูตัวอย่าง"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment('description', idx)}
                                  className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                                  title="ลบเฉพาะไฟล์นี้"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {descFiles[0]?.type === 'image' && (
                        <div className="pt-1 flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploadingDescription ? 'กำลังอัปโหลด...' : '+ แนบรูปภาพเพิ่มเติม'}</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              disabled={isUploadingDescription}
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleUploadAttachment('description', e.target.files)
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingDescription ? 'กำลังอัปโหลด...' : 'แนบไฟล์ PDF หรือรูปภาพ'}</span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={isUploadingDescription}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleUploadAttachment('description', e.target.files)
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-muted-foreground italic">
                        (ไฟล์ PDF แสดงทุกหน้าอัตโนมัติในเล่ม หรือเลือกรูปภาพหลายรูป 1 รูป = 1 หน้า)
                      </span>
                    </div>
                  )
                })()}

                <textarea
                  rows={4}
                  value={infoDescription}
                  onChange={(e) => setInfoDescription(e.target.value)}
                  placeholder="ศึกษาและปฏิบัติเกี่ยวกับ... โดยใช้กระบวนการทางวิทยาศาสตร์/การคิดวิเคราะห์ เพื่อให้เกิดความรู้ความเข้าใจ ทักษะ และเจตคติที่ดี..."
                  className="w-full p-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-y leading-relaxed text-xs"
                />
              </div>

              {/* Learning Outcomes / Unit Structure */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground block">
                    ผลการเรียนรู้ / ตัวชี้วัด / โครงสร้างหน่วยการเรียนรู้:
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    * พิมพ์ลงในเล่ม ปพ.5 องค์ประกอบที่ 3
                  </span>
                </div>

                {/* File Attachment Status for Structure */}
                {(() => {
                  const structFiles = parseAttachmentFiles(
                    course?.structureFiles,
                    course?.structureFilePath,
                    course?.structureFileType
                  )
                  return structFiles.length > 0 ? (
                    <div className="space-y-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          เอกสารแนบ ({structFiles[0].type === 'pdf' ? 'ไฟล์ PDF (แสดงทุกหน้าอัตโนมัติ)' : `รูปภาพ ${structFiles.length} รูป (1 รูป = 1 หน้า)`})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment('structure')}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          ลบทั้งหมด
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {structFiles.map((item, idx) => (
                          <div
                            key={idx}
                            className="relative border border-border rounded-lg p-1.5 bg-card flex flex-col justify-between text-xs shadow-2xs"
                          >
                            {item.type === 'image' ? (
                              <div className="w-full h-16 mb-1 rounded overflow-hidden bg-muted flex items-center justify-center">
                                <img src={item.url} alt={`หน้า ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-full h-16 mb-1 rounded bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
                                <FileText className="w-6 h-6 mb-0.5 text-red-500" />
                                <span className="text-[10px] font-semibold">PDF เอกสาร</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/50">
                              <span className="truncate max-w-[80px] text-muted-foreground">
                                {item.name || `หน้า ${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-brand-600 hover:underline"
                                  title="ดูตัวอย่าง"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment('structure', idx)}
                                  className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                                  title="ลบเฉพาะไฟล์นี้"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {structFiles[0]?.type === 'image' && (
                        <div className="pt-1 flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploadingStructure ? 'กำลังอัปโหลด...' : '+ แนบรูปภาพเพิ่มเติม'}</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              disabled={isUploadingStructure}
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleUploadAttachment('structure', e.target.files)
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingStructure ? 'กำลังอัปโหลด...' : 'แนบไฟล์ PDF หรือรูปภาพ'}</span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={isUploadingStructure}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleUploadAttachment('structure', e.target.files)
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-muted-foreground italic">
                        (ไฟล์ PDF แสดงทุกหน้าอัตโนมัติในเล่ม หรือเลือกรูปภาพหลายรูป 1 รูป = 1 หน้า)
                      </span>
                    </div>
                  )
                })()}

                <textarea
                  rows={3}
                  value={infoStructureData}
                  onChange={(e) => setInfoStructureData(e.target.value)}
                  placeholder="หน่วยที่ 1: การสืบค้นข้อมูล (10 คะแนน, 8 คาบ)&#10;หน่วยที่ 2: การวิเคราะห์ข้อมูล (20 คะแนน, 12 คาบ)..."
                  className="w-full p-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-y leading-relaxed text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCourseInfoModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCourseInfo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-bold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSavingCourseInfo ? 'กำลังบันทึก...' : 'บันทึกข้อมูลรายวิชา'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
