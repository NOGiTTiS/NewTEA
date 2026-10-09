'use client'

import * as React from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard-shell'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { fetchApi } from '@/lib/api'
import { sortRooms } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import {
  BookOpen,
  Plus,
  Search,
  Users,
  GraduationCap,
  Clock,
  Sparkles,
  Edit2,
  Trash2,
  UserPlus,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  ArrowRight,
  Check,
  Eye,
  Printer,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface AcademicTerm {
  id: string
  year: number
  semester: number
  isActive: boolean
}

interface TeacherUser {
  id: string
  name: string
  email: string
  department?: string
}

interface CourseTeacher {
  id: string
  courseId: string
  userId: string
  user: TeacherUser
  isPrimary: boolean
  assignedRooms?: string
}

interface CourseSummary {
  id: string
  courseCode: string
  courseName: string
  credits: number
  totalHours: number
  courseType: string
  department: string
  description?: string
  targetGroupType: string
  targetRooms?: string
  targetSubgroup?: string
  teachers?: CourseTeacher[]
  enrolledCount: number
  rooms: string[]
  createdAt: string
  isOwner?: boolean
  isTeacher?: boolean
  canEdit?: boolean
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

const STANDARD_ELECTIVES = [
  'ทัศนศิลป์',
  'ดนตรีไทย',
  'ดนตรีสากล',
  'นาฏศิลป์',
  'ฟุตบอล',
  'วอลเลย์บอล',
  'แบดมินตัน',
  'บาสเกตบอล',
  'เทเบิลเทนนิส'
]

export default function CoursesManagementPage() {
  const { data: session } = useSession()
  const [courses, setCourses] = React.useState<CourseSummary[]>([])
  const [allTeachers, setAllTeachers] = React.useState<TeacherUser[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Scope: 'my' (วิชาของฉัน) vs 'all' (วิชาทั้งหมดในโรงเรียน)
  const [scope, setScope] = React.useState<'my' | 'all'>('my')
  const [myCount, setMyCount] = React.useState(0)
  const [allCount, setAllCount] = React.useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedDept, setSelectedDept] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(12)

  const totalPages = Math.ceil(courses.length / pageSize) || 1
  const paginatedCourses = paginateArray(courses, currentPage, pageSize)

  // Create Course Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)

  // Form Fields
  const [courseCode, setCourseCode] = React.useState('')
  const [courseName, setCourseName] = React.useState('')
  const [credits, setCredits] = React.useState<number>(1.0)
  const [totalHours, setTotalHours] = React.useState<number>(40)
  const [courseType, setCourseType] = React.useState('BASIC')
  const [department, setDepartment] = React.useState(DEPARTMENTS[0])
  const [description, setDescription] = React.useState('')

  // Target Group Settings
  const [targetGrade, setTargetGrade] = React.useState('4')
  const [targetGroupType, setTargetGroupType] = React.useState('ALL_ROOMS')
  const [selectedRooms, setSelectedRooms] = React.useState<string[]>([])
  const [targetSubgroup, setTargetSubgroup] = React.useState('')

  // Edit Course Modal State
  const [editingCourse, setEditingCourse] = React.useState<CourseSummary | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [editCourseCode, setEditCourseCode] = React.useState('')
  const [editCourseName, setEditCourseName] = React.useState('')
  const [editCredits, setEditCredits] = React.useState<number>(1.0)
  const [editTotalHours, setEditTotalHours] = React.useState<number>(40)
  const [editCourseType, setEditCourseType] = React.useState('BASIC')
  const [editDepartment, setEditDepartment] = React.useState(DEPARTMENTS[0])
  const [editDescription, setEditDescription] = React.useState('')

  // Co-Teachers Modal State
  const [selectedCourseForCoTeachers, setSelectedCourseForCoTeachers] = React.useState<CourseSummary | null>(null)
  const [isCoTeacherModalOpen, setIsCoTeacherModalOpen] = React.useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = React.useState('')
  const [assignAllRooms, setAssignAllRooms] = React.useState(true)
  const [assignedTeacherRooms, setAssignedTeacherRooms] = React.useState<string[]>([])
  const [autoAdjustPrimary, setAutoAdjustPrimary] = React.useState(true)

  // Edit Teacher Rooms State in Modal
  const [editingTeacherAssignmentId, setEditingTeacherAssignmentId] = React.useState<string | null>(null)
  const [editTeacherName, setEditTeacherName] = React.useState('')
  const [editTeacherIsPrimary, setEditTeacherIsPrimary] = React.useState(false)
  const [editTeacherAllRooms, setEditTeacherAllRooms] = React.useState(false)
  const [editTeacherRooms, setEditTeacherRooms] = React.useState<string[]>([])
  const [isSavingTeacherRooms, setIsSavingTeacherRooms] = React.useState(false)

  // Delete Modal State
  const [deletingCourse, setDeletingCourse] = React.useState<CourseSummary | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Terms & Academic Year Filter
  const [terms, setTerms] = React.useState<AcademicTerm[]>([])
  const [selectedTermId, setSelectedTermId] = React.useState<string>('')

  // Load Terms
  React.useEffect(() => {
    fetchApi<{ terms: AcademicTerm[] }>('/api/terms')
      .then((data) => {
        const fetched = data.terms || []
        setTerms(fetched)
        const active = fetched.find((t) => t.isActive) || fetched[0]
        if (active) {
          setSelectedTermId(active.id)
        }
      })
      .catch(() => {})
  }, [])

  // Load Courses
  const loadCourses = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('scope', scope)
      if (selectedTermId) params.set('term_id', selectedTermId)
      if (searchQuery) params.set('search', searchQuery)
      if (selectedDept) params.set('department', selectedDept)

      const res = await fetchApi<{
        courses: CourseSummary[]
        myCount?: number
        allCount?: number
      }>(`/api/courses?${params.toString()}`)
      setCourses(res.courses || [])
      if (typeof res.myCount === 'number') setMyCount(res.myCount)
      if (typeof res.allCount === 'number') setAllCount(res.allCount)
    } catch {
      toast.error('ไม่สามารถโหลดรายวิชาได้')
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, selectedDept, scope, selectedTermId])

  React.useEffect(() => {
    loadCourses()
  }, [loadCourses])

  // Load Teachers for suggestions
  React.useEffect(() => {
    fetchApi<{ teachers: TeacherUser[] }>('/api/advisors')
      .then((data) => setAllTeachers(data.teachers || []))
      .catch(() => {})
  }, [])

  // Load all system rooms dynamically
  const [allSystemRooms, setAllSystemRooms] = React.useState<string[]>([])
  React.useEffect(() => {
    fetchApi<{ rooms: { id: string }[] }>('/api/rooms')
      .then((data) => {
        if (data && data.rooms) {
          setAllSystemRooms(sortRooms(data.rooms.map((r) => r.id)))
        }
      })
      .catch(() => {})
  }, [])

  // Auto update total hours when credits change
  React.useEffect(() => {
    setTotalHours(Math.round(credits * 40))
  }, [credits])

  // System rooms for the selected grade (fallback to 15 if not loaded)
  const gradeRooms = React.useMemo(() => {
    const matched = allSystemRooms.filter((r) => r.startsWith(`${targetGrade}.`))
    if (matched.length > 0) {
      return sortRooms(matched)
    }
    return Array.from({ length: 15 }, (_, i) => `${targetGrade}.${i + 1}`)
  }, [allSystemRooms, targetGrade])

  // Handle Target Grade change
  const handleGradeChange = (g: string) => {
    setTargetGrade(g)
    const gRooms = allSystemRooms.filter((r) => r.startsWith(`${g}.`))
    const fallbackRooms = gRooms.length > 0 ? gRooms : Array.from({ length: 15 }, (_, i) => `${g}.${i + 1}`)
    if (targetGroupType === 'ALL_ROOMS') {
      setSelectedRooms(sortRooms(fallbackRooms))
    } else {
      setSelectedRooms([])
    }
  }

  // Handle Target Group Type change
  const handleTargetGroupTypeChange = (type: string) => {
    setTargetGroupType(type)
    if (type === 'ALL_ROOMS') {
      setSelectedRooms([...gradeRooms])
    } else if (type === 'LANGUAGE_GROUP' && !targetSubgroup) {
      setTargetSubgroup('ญี่ปุ่น')
      setSelectedRooms([...gradeRooms])
    } else if (type === 'ELECTIVE_GROUP' && !targetSubgroup) {
      setTargetSubgroup('ทัศนศิลป์')
      const electives = gradeRooms.filter((r) => r.endsWith('.13') || r.endsWith('.14'))
      setSelectedRooms(electives.length > 0 ? electives : [`${targetGrade}.13`, `${targetGrade}.14`])
    }
  }

  // Toggle specific room
  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : sortRooms([...prev, room])
    )
  }

  // Handle Create Course Submit
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseCode.trim() || !courseName.trim()) {
      toast.error('กรุณาระบุรหัสวิชาและชื่อวิชา')
      return
    }

    let finalRooms = selectedRooms
    if (targetGroupType === 'ALL_ROOMS' && finalRooms.length === 0) {
      finalRooms = gradeRooms
    }

    if (finalRooms.length === 0) {
      toast.error('กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง')
      return
    }

    setIsCreating(true)
    try {
      const payload = {
        termId: selectedTermId,
        courseCode: courseCode.trim(),
        courseName: courseName.trim(),
        credits: Number(credits),
        totalHours: Number(totalHours),
        courseType,
        department,
        description: description.trim(),
        targetGroupType,
        targetRooms: finalRooms,
        targetSubgroup: (targetGroupType === 'LANGUAGE_GROUP' || targetGroupType === 'ELECTIVE_GROUP') ? targetSubgroup : ''
      }

      const res = await fetchApi<{ message: string; enrolledCount: number }>('/api/courses', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      toast.success(res.message || 'สร้างรายวิชาสำเร็จ')
      setIsCreateModalOpen(false)
      // Reset form
      setCourseCode('')
      setCourseName('')
      setDescription('')
      loadCourses()
    } catch (err) {
      toast.error((err as Error).message || 'สร้างรายวิชาไม่สำเร็จ')
    } finally {
      setIsCreating(false)
    }
  }

  // Handle Delete Course
  const handleDeleteCourse = async () => {
    if (!deletingCourse) return
    setIsDeleting(true)
    try {
      await fetchApi(`/api/courses/${deletingCourse.id}`, {
        method: 'DELETE'
      })
      toast.success('ลบรายวิชาสำเร็จ')
      setIsDeleteModalOpen(false)
      setDeletingCourse(null)
      loadCourses()
    } catch (err) {
      toast.error((err as Error).message || 'ลบรายวิชาไม่สำเร็จ')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle Open Edit Modal
  const handleOpenEditModal = (course: CourseSummary) => {
    setEditingCourse(course)
    setEditCourseCode(course.courseCode)
    setEditCourseName(course.courseName)
    setEditCredits(course.credits)
    setEditTotalHours(course.totalHours)
    setEditCourseType(course.courseType || 'BASIC')
    setEditDepartment(course.department || DEPARTMENTS[0])
    setEditDescription(course.description || '')
    setIsEditModalOpen(true)
  }

  // Handle Update Course Submit
  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCourse) return
    if (!editCourseCode.trim() || !editCourseName.trim()) {
      toast.error('กรุณาระบุรหัสวิชาและชื่อวิชา')
      return
    }

    setIsUpdating(true)
    try {
      await fetchApi(`/api/courses/${editingCourse.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          courseCode: editCourseCode.trim(),
          courseName: editCourseName.trim(),
          credits: Number(editCredits),
          totalHours: Number(editTotalHours),
          courseType: editCourseType,
          department: editDepartment,
          description: editDescription.trim()
        })
      })

      toast.success('แก้ไขข้อมูลรายวิชาสำเร็จ')
      setIsEditModalOpen(false)
      setEditingCourse(null)
      loadCourses()
    } catch (err) {
      toast.error((err as Error).message || 'แก้ไขข้อมูลรายวิชาไม่สำเร็จ')
    } finally {
      setIsUpdating(false)
    }
  }

  // Helper to get active rooms for a course with multi-tier fallback
  const getCourseActiveRooms = React.useCallback((course?: CourseSummary | null) => {
    if (!course) return []
    if (course.rooms && course.rooms.length > 0) {
      return sortRooms(course.rooms)
    }
    if (course.targetRooms) {
      try {
        const parsed = JSON.parse(course.targetRooms)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortRooms(parsed)
        }
      } catch {}
    }
    const match = course.courseCode ? course.courseCode.match(/[^\d]*(\d)/) : null
    const grade = match ? match[1] : '4'
    return Array.from({ length: 15 }, (_, i) => `${grade}.${i + 1}`)
  }, [])

  // Helper to compute remaining rooms not assigned to other teachers
  const getRemainingRooms = React.useCallback((course: CourseSummary, excludeTeacherId?: string) => {
    const courseRooms = getCourseActiveRooms(course)
    const takenRooms = new Set(
      (course.teachers || [])
        .filter((t) => t.id !== excludeTeacherId)
        .flatMap((t) => {
          try {
            const arr = JSON.parse(t.assignedRooms || '[]')
            return Array.isArray(arr) ? arr : []
          } catch {
            return []
          }
        })
    )
    return courseRooms.filter((r) => !takenRooms.has(r))
  }, [getCourseActiveRooms])

  // Open Co-Teacher Modal with room initialization
  const openCoTeacherModal = (course: CourseSummary) => {
    setSelectedCourseForCoTeachers(course)
    setSelectedTeacherId('')
    setEditingTeacherAssignmentId(null)
    setAssignAllRooms(true)
    setAssignedTeacherRooms(getCourseActiveRooms(course))
    setAutoAdjustPrimary(true)
    setIsCoTeacherModalOpen(true)
  }

  // Toggle assigned room for co-teacher
  const toggleCoTeacherRoom = (room: string) => {
    setAssignedTeacherRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : sortRooms([...prev, room])
    )
  }

  // Toggle assigned room when editing teacher
  const toggleEditTeacherRoom = (room: string) => {
    setEditTeacherRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : sortRooms([...prev, room])
    )
  }

  // Helper to parse and display teacher's assigned rooms
  const getTeacherRoomsText = (teacher: CourseTeacher, course: CourseSummary) => {
    let assigned: string[] = []
    if (teacher.assignedRooms) {
      try {
        const parsed = JSON.parse(teacher.assignedRooms)
        if (Array.isArray(parsed)) assigned = parsed
      } catch {}
    }

    if (assigned.length > 0) {
      return `รับผิดชอบ: ม.${sortRooms(assigned).join(', ม.')} (${assigned.length} ห้อง)`
    }

    const allRooms = getCourseActiveRooms(course)

    // If assigned is empty array:
    // Check if other co-teachers have specific rooms
    const otherTeachersWithRooms = (course.teachers || []).filter(
      (t) => t.id !== teacher.id && t.assignedRooms && t.assignedRooms !== '[]'
    )

    if (otherTeachersWithRooms.length > 0 && teacher.isPrimary) {
      const remaining = getRemainingRooms(course, teacher.id)
      if (remaining.length > 0 && remaining.length < allRooms.length) {
        return `รับผิดชอบ: ม.${sortRooms(remaining).join(', ม.')} (${remaining.length} ห้องที่เหลือ)`
      }
    }

    return `รับผิดชอบทุกห้อง (${allRooms.length} ห้อง)`
  }

  // Start editing existing teacher rooms
  const startEditingTeacherRooms = (ct: CourseTeacher) => {
    setEditingTeacherAssignmentId(ct.id)
    setEditTeacherName(ct.user.name)
    setEditTeacherIsPrimary(ct.isPrimary)

    let parsed: string[] = []
    if (ct.assignedRooms) {
      try {
        const arr = JSON.parse(ct.assignedRooms)
        if (Array.isArray(arr)) parsed = arr
      } catch {}
    }

    if (parsed.length === 0) {
      setEditTeacherAllRooms(true)
      setEditTeacherRooms(getCourseActiveRooms(selectedCourseForCoTeachers))
    } else {
      setEditTeacherAllRooms(false)
      setEditTeacherRooms(sortRooms(parsed))
    }
  }

  // Save edited teacher rooms
  const handleSaveTeacherRooms = async () => {
    if (!selectedCourseForCoTeachers || !editingTeacherAssignmentId) return

    const roomsToSave = editTeacherAllRooms ? [] : editTeacherRooms
    if (!editTeacherAllRooms && roomsToSave.length === 0) {
      toast.error('กรุณาเลือกห้องเรียนที่รับผิดชอบอย่างน้อย 1 ห้อง')
      return
    }

    setIsSavingTeacherRooms(true)
    try {
      await fetchApi(
        `/api/courses/${selectedCourseForCoTeachers.id}/teachers/${editingTeacherAssignmentId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            assignedRooms: roomsToSave
          })
        }
      )
      toast.success(`อัปเดตห้องเรียนของ ${editTeacherName} สำเร็จ`)
      setEditingTeacherAssignmentId(null)
      loadCourses()

      // Reload modal course details
      const res = await fetchApi<{ course: CourseSummary }>(
        `/api/courses/${selectedCourseForCoTeachers.id}`
      )
      if (res.course) {
        setSelectedCourseForCoTeachers(res.course)
      }
    } catch (err) {
      toast.error((err as Error).message || 'อัปเดตห้องเรียนไม่สำเร็จ')
    } finally {
      setIsSavingTeacherRooms(false)
    }
  }

  // Handle Add Co-Teacher with assigned rooms
  const handleAddCoTeacher = async () => {
    if (!selectedCourseForCoTeachers || !selectedTeacherId) {
      toast.error('กรุณาเลือกครูผู้สอน')
      return
    }

    const roomsToAssign = assignAllRooms ? [] : assignedTeacherRooms
    if (!assignAllRooms && roomsToAssign.length === 0) {
      toast.error('กรุณาเลือกห้องเรียนที่รับผิดชอบอย่างน้อย 1 ห้อง')
      return
    }

    try {
      await fetchApi(`/api/courses/${selectedCourseForCoTeachers.id}/co-teachers`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedTeacherId,
          isPrimary: false,
          assignedRooms: roomsToAssign,
          autoAdjustPrimary: autoAdjustPrimary
        })
      })
      toast.success('เพิ่ม/อัปเดตครูร่วมสอนสำเร็จ')
      setSelectedTeacherId('')
      setAssignAllRooms(true)
      loadCourses()

      // Reload modal course details
      const res = await fetchApi<{ course: CourseSummary }>(
        `/api/courses/${selectedCourseForCoTeachers.id}`
      )
      if (res.course) {
        setSelectedCourseForCoTeachers(res.course)
      }
    } catch (err) {
      toast.error((err as Error).message || 'เพิ่มครูร่วมสอนไม่สำเร็จ')
    }
  }

  // Handle Remove Co-Teacher
  const handleRemoveCoTeacher = async (courseId: string, teacherAssignmentId: string) => {
    if (!confirm('ยืนยันถอนครูร่วมสอนท่านนี้ออกจากรายวิชา?')) return
    try {
      await fetchApi(`/api/courses/${courseId}/co-teachers/${teacherAssignmentId}`, {
        method: 'DELETE'
      })
      toast.success('ถอนครูร่วมสอนเรียบร้อยแล้ว')
      loadCourses()

      // Reload modal course details
      const res = await fetchApi<{ course: CourseSummary }>(
        `/api/courses/${courseId}`
      )
      if (res.course) {
        setSelectedCourseForCoTeachers(res.course)
      }
    } catch (err) {
      toast.error((err as Error).message || 'ถอนครูร่วมสอนไม่สำเร็จ')
    }
  }

  return (
    <DashboardShell
      title="รายวิชาและบันทึกคะแนน"
      description="ระบบจัดการรายวิชา ตารางกรอกคะแนนแยกแท็บรายห้อง และคำนวณเกรดอัตโนมัติ"
      badge={`${courses.length} วิชา`}
      actions={
        <button
          type="button"
          onClick={() => {
            setSelectedRooms(Array.from({ length: 15 }, (_, i) => `4.${i + 1}`))
            setIsCreateModalOpen(true)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">สร้างรายวิชาใหม่</span>
          <span className="sm:hidden">สร้างวิชา</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Scope Switcher Tabs & Academic Term Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setScope('my')
                setCurrentPage(1)
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                scope === 'my'
                  ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/25 ring-2 ring-brand-500/20'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>รายวิชาของฉัน</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  scope === 'my'
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {myCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScope('all')
                setCurrentPage(1)
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                scope === 'all'
                  ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/25 ring-2 ring-brand-500/20'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>รายวิชาทั้งหมดในโรงเรียน</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  scope === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {allCount}
              </span>
            </button>
          </div>

          {/* Academic Term Selector Dropdown */}
          {terms.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card shadow-2xs self-start sm:self-auto">
              <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
              <label htmlFor="term-select" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                ภาคเรียน:
              </label>
              <select
                id="term-select"
                value={selectedTermId}
                onChange={(e) => {
                  setSelectedTermId(e.target.value)
                  setCurrentPage(1)
                }}
                className="text-xs font-bold text-foreground bg-transparent focus:outline-none cursor-pointer"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.semester}/{t.year} {t.isActive ? '★ (ปัจจุบัน)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search & Department Filter Bar */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหารหัสวิชา, ชื่อวิชา..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />
          </div>

          <div>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            >
              <option value="">ทุกกลุ่มสาระการเรียนรู้</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Courses Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedCourses.map((course) => {
            const canEdit = course.canEdit ?? false
            return (
              <div
                key={course.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-xs hover:border-brand-500/40 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Header: Code & Credits */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-800">
                        {course.courseCode}
                      </span>
                      <h3 className="font-bold text-base text-foreground mt-2 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {course.courseName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!canEdit && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          ดูอย่างเดียว
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground">
                        {course.courseType === 'BASIC' ? 'พื้นฐาน' : 'เพิ่มเติม'}
                      </span>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                    <span className="truncate">{course.department || 'ไม่ระบุกลุ่มสาระ'}</span>
                  </div>

                  {/* Target Rooms & Students Count */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-brand-500" />
                        {course.credits} หน่วยกิต ({course.totalHours} คาบ)
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <Users className="w-3.5 h-3.5 text-brand-500" />
                        {course.enrolledCount} คน
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-[10px] font-medium text-muted-foreground">ห้องเรียน:</span>
                      {(() => {
                        const activeRooms = getCourseActiveRooms(course)
                        return activeRooms.length > 0 ? (
                          <>
                            {activeRooms.slice(0, 6).map((r) => (
                              <span
                                key={r}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-card border border-border text-brand-600 dark:text-brand-400"
                              >
                                ม.{r}
                              </span>
                            ))}
                            {activeRooms.length > 6 && (
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                +{activeRooms.length - 6} ห้อง
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">ยังไม่มีนักเรียน</span>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Teachers */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                    <span className="text-muted-foreground text-[11px] truncate">
                      {course.teachers && course.teachers.length > 0
                        ? `ผู้สอน: ${course.teachers.map((t) => t.user.name).join(', ')}`
                        : 'ยังไม่กำหนดผู้สอน'}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openCoTeacherModal(course)}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="จัดการครูร่วมสอนและห้องที่รับผิดชอบ"
                      >
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-4 mt-3 border-t border-border">
                  <Link
                    href={`/courses/${course.id}`}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                      canEdit
                        ? 'bg-brand-500 hover:bg-brand-600 active:scale-98 text-white shadow-brand-500/20'
                        : 'border border-border bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    <span>{canEdit ? 'บันทึกคะแนน' : 'ดูตารางคะแนน'}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>

                  <Link
                    href={`/courses/${course.id}/pp5`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-all cursor-pointer"
                    title="พิมพ์เล่ม ปพ.5 (PDF)"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                  </Link>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(course)}
                        className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="แก้ไขข้อมูลรายวิชา"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeletingCourse(course)
                          setIsDeleteModalOpen(true)
                        }}
                        className="p-2 rounded-xl border border-border hover:bg-red-500/10 hover:border-red-500/30 text-muted-foreground hover:text-red-600 transition-all cursor-pointer"
                        title="ลบรายวิชา"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {courses.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={courses.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[6, 12, 24, 48]}
            />
          </div>
        )}

        {/* Empty State */}
        {courses.length === 0 && !isLoading && (
          <div className="bg-card border border-border rounded-3xl p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-foreground">
                {scope === 'my'
                  ? 'ยังไม่มีรายวิชาที่ท่านสอนในภาคเรียนนี้'
                  : 'ไม่พบรายวิชาที่ตรงกับเงื่อนไขการค้นหา'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                {scope === 'my'
                  ? 'เริ่มต้นสร้างรายวิชาใหม่ กำหนดห้องเรียนและสัดส่วนคะแนน หรือขอให้ครูผู้สอนท่านอื่นเพิ่มท่านเป็นครูร่วมสอน'
                  : 'ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองกลุ่มสาระการเรียนรู้อื่น'}
              </p>
            </div>
            {scope === 'my' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRooms(Array.from({ length: 15 }, (_, i) => `4.${i + 1}`))
                  setIsCreateModalOpen(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>สร้างรายวิชาใหม่</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-500 shrink-0" />
                สร้างรายวิชาใหม่ (New Course Setup)
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              {/* Row 1: Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">รหัสวิชา *</label>
                  <input
                    type="text"
                    placeholder="เช่น ท31101, ค32101"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-muted-foreground mb-1 font-medium">ชื่อรายวิชา *</label>
                  <input
                    type="text"
                    placeholder="เช่น ภาษาไทยพื้นฐาน 1, ฟุตบอล"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Credits & Hours & Type */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">หน่วยกิต *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="4.0"
                    value={credits}
                    onChange={(e) => setCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">คาบเรียนรวม *</label>
                  <input
                    type="number"
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ประเภทรายวิชา *</label>
                  <select
                    value={courseType}
                    onChange={(e) => setCourseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="BASIC">รายวิชาพื้นฐาน</option>
                    <option value="ADDITIONAL">รายวิชาเพิ่มเติม</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Department */}
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">กลุ่มสาระการเรียนรู้ *</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section: Target Group Selection */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-500" />
                    การจัดกลุ่มนักเรียนที่เข้าเรียน
                  </span>
                  <div className="flex items-center gap-1">
                    {['4', '5', '6'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGradeChange(g)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          targetGrade === g
                            ? 'bg-brand-500 text-white shadow-xs'
                            : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ม.{g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ALL_ROOMS', label: `ทุกห้อง (${gradeRooms.length} ห้อง)` },
                    { id: 'SPECIFIC_ROOMS', label: 'เลือกเฉพาะบางห้อง' },
                    { id: 'LANGUAGE_GROUP', label: 'กลุ่มภาษาที่ 3' },
                    { id: 'ELECTIVE_GROUP', label: 'กลุ่มวิชาเลือก' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleTargetGroupTypeChange(mode.id)}
                      className={`p-2 rounded-xl text-center transition-all cursor-pointer text-[11px] font-medium border ${
                        targetGroupType === mode.id
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 font-bold'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Subgroup select for Language or Elective */}
                {targetGroupType === 'LANGUAGE_GROUP' && (
                  <div className="pt-1">
                    <label className="block text-muted-foreground mb-1 font-medium">เลือกภาษาที่ 3 ที่เข้าเรียน:</label>
                    <select
                      value={targetSubgroup}
                      onChange={(e) => setTargetSubgroup(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      <option value="ญี่ปุ่น">ภาษาญี่ปุ่น</option>
                      <option value="ฝรั่งเศส">ภาษาฝรั่งเศส</option>
                      <option value="เกาหลี">ภาษาเกาหลี</option>
                      <option value="จีน">ภาษาจีน</option>
                    </select>
                  </div>
                )}

                {targetGroupType === 'ELECTIVE_GROUP' && (
                  <div className="pt-1">
                    <label className="block text-muted-foreground mb-1 font-medium">เลือกกลุ่มวิชาเลือกที่เข้าเรียน:</label>
                    <select
                      value={targetSubgroup}
                      onChange={(e) => setTargetSubgroup(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      {STANDARD_ELECTIVES.map((el) => (
                        <option key={el} value={el}>
                          {el}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Rooms Checkbox Selector */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-muted-foreground font-medium text-[11px]">
                      ห้องเรียนเป้าหมาย ({selectedRooms.length} ห้อง):
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRooms((prev) =>
                          prev.length === gradeRooms.length ? [] : [...gradeRooms]
                        )
                      }
                      className="text-brand-600 dark:text-brand-400 font-semibold hover:underline text-[10px] cursor-pointer"
                    >
                      {selectedRooms.length === gradeRooms.length ? 'ยกเลิกทั้งหมด' : `เลือกทั้งหมด ${gradeRooms.length} ห้อง`}
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {gradeRooms.map((room) => {
                      const isChecked = selectedRooms.includes(room)
                      return (
                        <button
                          key={room}
                          type="button"
                          onClick={() => toggleRoom(room)}
                          className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all cursor-pointer border ${
                            isChecked
                              ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                              : 'bg-card border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          ม.{room}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">คำอธิบายรายวิชา (ถ้ามี)</label>
                <textarea
                  rows={2}
                  placeholder="รายละเอียดสังเขปของรายวิชา"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? 'กำลังดึงนักเรียนและสร้างรายวิชา...' : 'สร้างรายวิชา'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Co-Teachers Management Modal */}
      {isCoTeacherModalOpen && selectedCourseForCoTeachers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-500 shrink-0" />
                ครูผู้สอนร่วม ({selectedCourseForCoTeachers.courseCode})
              </h3>
              <button
                type="button"
                onClick={() => setIsCoTeacherModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* List current teachers */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">ครูที่รับผิดชอบวิชานี้:</span>
              <div className="divide-y divide-border border border-border rounded-xl bg-background overflow-hidden text-xs">
                {selectedCourseForCoTeachers.teachers && selectedCourseForCoTeachers.teachers.length > 0 ? (
                  selectedCourseForCoTeachers.teachers.map((ct) => (
                    <div key={ct.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{ct.user.name}</span>
                          {ct.isPrimary && (
                            <span className="text-[10px] bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 px-1.5 py-0.2 rounded font-semibold">
                              ผู้สอนหลัก
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{ct.user.email}</div>
                        <div className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                          {getTeacherRoomsText(ct, selectedCourseForCoTeachers)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditingTeacherRooms(ct)}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            editingTeacherAssignmentId === ct.id
                              ? 'bg-brand-500 text-white shadow-xs'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                          title="แก้ไขห้องที่รับผิดชอบ"
                        >
                          <Edit2 className="w-3.5 h-3.5 shrink-0" />
                        </button>

                        {!ct.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCoTeacher(selectedCourseForCoTeachers.id, ct.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-all cursor-pointer"
                            title="ถอนครูร่วมสอน"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">ยังไม่มีครูผู้สอน</div>
                )}
              </div>
            </div>

            {/* Edit Teacher Rooms Section */}
            {editingTeacherAssignmentId ? (
              <div className="space-y-3 pt-3 border-t border-border text-xs bg-muted/20 p-3.5 rounded-2xl border border-brand-500/20">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                    <Edit2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span>แก้ไขห้องของ: {editTeacherName}</span>
                    {editTeacherIsPrimary && (
                      <span className="text-[10px] bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 px-1.5 py-0.2 rounded font-semibold">
                        ผู้สอนหลัก
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTeacherAssignmentId(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="block text-muted-foreground font-medium">ขอบเขตห้องเรียนที่รับผิดชอบ:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditTeacherAllRooms(true)}
                      className={`py-1.5 px-2 rounded-xl text-center text-[11px] font-semibold border transition-all cursor-pointer ${
                        editTeacherAllRooms
                          ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      รับผิดชอบทุกห้อง
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTeacherAllRooms(false)}
                      className={`py-1.5 px-2 rounded-xl text-center text-[11px] font-semibold border transition-all cursor-pointer ${
                        !editTeacherAllRooms
                          ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      เลือกห้องเฉพาะ
                    </button>
                  </div>

                  {!editTeacherAllRooms && (
                    <div className="p-2.5 rounded-xl bg-card border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          เลือกห้อง ({editTeacherRooms.length} ห้อง):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const rem = getRemainingRooms(selectedCourseForCoTeachers, editingTeacherAssignmentId)
                            setEditTeacherRooms(rem)
                          }}
                          className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                        >
                          ⚡ เฉพาะห้องที่ว่าง ({getRemainingRooms(selectedCourseForCoTeachers, editingTeacherAssignmentId).length} ห้อง)
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {getCourseActiveRooms(selectedCourseForCoTeachers).map((room) => {
                          const isChecked = editTeacherRooms.includes(room)
                          return (
                            <button
                              key={room}
                              type="button"
                              onClick={() => toggleEditTeacherRoom(room)}
                              className={`py-1 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer border ${
                                isChecked
                                  ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              ม.{room}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingTeacherAssignmentId(null)}
                    disabled={isSavingTeacherRooms}
                    className="flex-1 py-2 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all cursor-pointer text-xs"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTeacherRooms}
                    disabled={isSavingTeacherRooms}
                    className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 text-xs"
                  >
                    {isSavingTeacherRooms ? 'กำลังบันทึก...' : 'บันทึกห้องเรียน'}
                  </button>
                </div>
              </div>
            ) : (
              /* Add new teacher */
              <div className="space-y-3 pt-2 border-t border-border text-xs">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">เลือกครูร่วมสอนใหม่:</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">เลือกครูจากระบบ...</option>
                    {allTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room assignment toggle */}
                <div className="space-y-2">
                  <span className="block text-muted-foreground font-medium">ขอบเขตห้องเรียนที่รับผิดชอบ:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignAllRooms(true)}
                      className={`py-1.5 px-2 rounded-xl text-center text-[11px] font-semibold border transition-all cursor-pointer ${
                        assignAllRooms
                          ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      รับผิดชอบทุกห้อง
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignAllRooms(false)
                        const rem = getRemainingRooms(selectedCourseForCoTeachers)
                        if (rem.length > 0) setAssignedTeacherRooms(rem)
                      }}
                      className={`py-1.5 px-2 rounded-xl text-center text-[11px] font-semibold border transition-all cursor-pointer ${
                        !assignAllRooms
                          ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      เลือกห้องเฉพาะ
                    </button>
                  </div>

                  {!assignAllRooms && (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium block">
                          เลือกห้องที่ครูท่านนี้สอน ({assignedTeacherRooms.length} ห้อง):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const rem = getRemainingRooms(selectedCourseForCoTeachers)
                            setAssignedTeacherRooms(rem)
                          }}
                          className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                        >
                          ⚡ เฉพาะห้องที่ว่าง ({getRemainingRooms(selectedCourseForCoTeachers).length} ห้อง)
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {getCourseActiveRooms(selectedCourseForCoTeachers).map((room) => {
                          const isChecked = assignedTeacherRooms.includes(room)
                          return (
                            <button
                              key={room}
                              type="button"
                              onClick={() => toggleCoTeacherRoom(room)}
                              className={`py-1 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer border ${
                                isChecked
                                  ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                                  : 'bg-card border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              ม.{room}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Auto adjust primary teacher option */}
                  {!assignAllRooms && (
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={autoAdjustPrimary}
                        onChange={(e) => setAutoAdjustPrimary(e.target.checked)}
                        className="rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <span>ปรับห้องที่เหลือให้ผู้สอนหลักอัตโนมัติ</span>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddCoTeacher}
                  disabled={!selectedTeacherId}
                  className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  บันทึกครูร่วมสอน
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {isEditModalOpen && editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500 shrink-0" />
                แก้ไขข้อมูลรายวิชา ({editingCourse.courseCode})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourse} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">รหัสวิชา *</label>
                  <input
                    type="text"
                    value={editCourseCode}
                    onChange={(e) => setEditCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-muted-foreground mb-1 font-medium">ชื่อรายวิชา *</label>
                  <input
                    type="text"
                    value={editCourseName}
                    onChange={(e) => setEditCourseName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">หน่วยกิต *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="4.0"
                    value={editCredits}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setEditCredits(val)
                      setEditTotalHours(Math.round(val * 40))
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">คาบเรียนรวม *</label>
                  <input
                    type="number"
                    value={editTotalHours}
                    onChange={(e) => setEditTotalHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ประเภทรายวิชา *</label>
                  <select
                    value={editCourseType}
                    onChange={(e) => setEditCourseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="BASIC">รายวิชาพื้นฐาน</option>
                    <option value="ADDITIONAL">รายวิชาเพิ่มเติม</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">กลุ่มสาระการเรียนรู้ *</label>
                <select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">คำอธิบายรายวิชา</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      {isDeleteModalOpen && deletingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 shrink-0" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-foreground">ยืนยันการลบรายวิชา</h3>
              <p className="text-xs text-muted-foreground">
                ต้องการลบรายวิชา <span className="font-bold text-foreground">{deletingCourse.courseCode} ({deletingCourse.courseName})</span> ใช่หรือไม่?
              </p>
              <p className="text-[11px] text-red-600 font-medium pt-1">
                * ข้อมูลการลงทะเบียน คะแนน และการประเมินทั้งหมดในวิชานี้จะถูกลบถาวร
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteCourse}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบรายวิชา'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
