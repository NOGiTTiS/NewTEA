'use client'
import * as React from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { fetchApi, uploadFileApi } from '@/lib/api'
import { sortRooms } from '@/lib/utils'
import {
  Users,
  Search,
  Upload,
  Download,
  Filter,
  Plus,
  ArrowLeft,
  Clock,
  History,
  AlertCircle,
  FileSpreadsheet,
  X,
  FileText,
  GraduationCap,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

interface RolloverPreview {
  m6ActiveCount: number
  m5ActiveCount: number
  m4ActiveCount: number
  graduatedCount: number
  otherStatusCount: number
  activeM6Rooms: string[]
  canPromote: boolean
  promoteBlockReason?: string
}

interface Student {
  id: string
  studentId: string
  nationalId?: string
  prefix: string
  firstName: string
  lastName: string
  roomId: string
  seatNo: number
  languageGroup?: string
  electiveGroup?: string
  status: string
  createdAt: string
  updatedAt: string
}

interface AuditLog {
  id: string
  studentId: string
  action: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
}

const STANDARD_ELECTIVE_CATEGORIES = [
  {
    category: 'หมวดศิลปะ / ดนตรี / นาฏศิลป์',
    items: ['ทัศนศิลป์', 'ดนตรีไทย', 'ดนตรีสากล', 'นาฏศิลป์']
  },
  {
    category: 'หมวดสุขศึกษาและพลศึกษา',
    items: ['ฟุตบอล', 'วอลเลย์บอล', 'แบดมินตัน', 'บาสเกตบอล', 'เทเบิลเทนนิส']
  }
]

const ALL_STANDARD_ELECTIVES = STANDARD_ELECTIVE_CATEGORIES.flatMap((c) => c.items)

export default function StudentsManagementPage() {
  const [students, setStudents] = React.useState<Student[]>([])
  const [rooms, setRooms] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Filters
  const [selectedRoom, setSelectedRoom] = React.useState('')
  const [selectedGrade, setSelectedGrade] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  const totalPages = Math.ceil(students.length / pageSize) || 1
  const paginatedStudents = paginateArray(students, currentPage, pageSize)

  // Upload Modals
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false)
  const [importType, setImportType] = React.useState<'students' | 'advisors'>('students')
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  // Add Student Modal State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = React.useState(false)
  const [newStudentId, setNewStudentId] = React.useState('')
  const [newNationalId, setNewNationalId] = React.useState('')
  const [newPrefix, setNewPrefix] = React.useState('นาย')
  const [newFirstName, setNewFirstName] = React.useState('')
  const [newLastName, setNewLastName] = React.useState('')
  const [newRoomId, setNewRoomId] = React.useState('4.1')
  const [newSeatNo, setNewSeatNo] = React.useState<number>(1)
  const [newLanguageGroup, setNewLanguageGroup] = React.useState('')
  const [newElectiveSelect, setNewElectiveSelect] = React.useState('')
  const [newCustomElective, setNewCustomElective] = React.useState('')
  const [newStatus, setNewStatus] = React.useState('ACTIVE')
  const [isCreatingStudent, setIsCreatingStudent] = React.useState(false)

  // Full Edit Student Modal State
  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null)
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = React.useState(false)
  const [editStudentId, setEditStudentId] = React.useState('')
  const [editNationalId, setEditNationalId] = React.useState('')
  const [editPrefix, setEditPrefix] = React.useState('')
  const [editFirstName, setEditFirstName] = React.useState('')
  const [editLastName, setEditLastName] = React.useState('')
  const [editRoomId, setEditRoomId] = React.useState('')
  const [editSeatNo, setEditSeatNo] = React.useState<number>(1)
  const [editStatus, setEditStatus] = React.useState('')
  const [editLanguage, setEditLanguage] = React.useState('')
  const [editElectiveSelect, setEditElectiveSelect] = React.useState('')
  const [editCustomElective, setEditCustomElective] = React.useState('')
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)

  // Delete Student Modal State
  const [deletingStudent, setDeletingStudent] = React.useState<Student | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Bulk Selection State
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([])
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = React.useState(false)
  const [bulkDeleteReason, setBulkDeleteReason] = React.useState('')
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)

  // Scope Delete Modal State (By Room, Grade, or All)
  const [isScopeModalOpen, setIsScopeModalOpen] = React.useState(false)
  const [scopeType, setScopeType] = React.useState<'ROOM' | 'GRADE' | 'ALL'>('ROOM')
  const [scopeTargetRoom, setScopeTargetRoom] = React.useState('4.1')
  const [scopeTargetGrade, setScopeTargetGrade] = React.useState('4')
  const [scopeReason, setScopeReason] = React.useState('')
  const [scopeConfirmText, setScopeConfirmText] = React.useState('')
  const [isScopeDeleting, setIsScopeDeleting] = React.useState(false)

  // Audit Logs Modal
  const [auditStudent, setAuditStudent] = React.useState<Student | null>(null)
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = React.useState(false)

  // Year-End Rollover Wizard State
  const [isRolloverModalOpen, setIsRolloverModalOpen] = React.useState(false)
  const [rolloverStep, setRolloverStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [rolloverPreview, setRolloverPreview] = React.useState<RolloverPreview | null>(null)
  const [isLoadingRollover, setIsLoadingRollover] = React.useState(false)
  const [isGraduatingM6, setIsGraduatingM6] = React.useState(false)
  const [isPromoting, setIsPromoting] = React.useState(false)
  const [graduationReason, setGraduationReason] = React.useState('จบการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน')
  const [promotionReason, setPromotionReason] = React.useState('เลื่อนชั้นปีการศึกษา (5.x -> 6.x, 4.x -> 5.x)')

  const loadRolloverPreview = async () => {
    setIsLoadingRollover(true)
    try {
      const res = await fetchApi<RolloverPreview>('/api/students/rollover/preview')
      setRolloverPreview(res)
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลสถิติการเลื่อนชั้นได้')
    } finally {
      setIsLoadingRollover(false)
    }
  }

  const handleOpenRollover = () => {
    setIsRolloverModalOpen(true)
    setRolloverStep(1)
    loadRolloverPreview()
  }

  const handleGraduateM6 = async () => {
    setIsGraduatingM6(true)
    try {
      const res = await fetchApi<{ message: string; graduatedCount: number }>(
        '/api/students/rollover/graduate-m6',
        {
          method: 'POST',
          body: JSON.stringify({ reason: graduationReason })
        }
      )
      toast.success(res.message || 'อนุมัติจบการศึกษา ม.6 เรียบร้อยแล้ว')
      await loadRolloverPreview()
      await loadStudents()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอนุมัติจบการศึกษา'
      toast.error(errorMsg)
    } finally {
      setIsGraduatingM6(false)
    }
  }

  const handlePromoteStudents = async () => {
    setIsPromoting(true)
    try {
      const res = await fetchApi<{ message: string; totalPromoted: number }>(
        '/api/students/rollover/promote',
        {
          method: 'POST',
          body: JSON.stringify({ reason: promotionReason })
        }
      )
      toast.success(res.message || 'เลื่อนชั้นปีการศึกษาสำเร็จ เรียบร้อยแล้ว')
      await loadRolloverPreview()
      await loadStudents()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเลื่อนชั้น'
      toast.error(errorMsg)
    } finally {
      setIsPromoting(false)
    }
  }

  // Load Rooms (45 rooms)
  React.useEffect(() => {
    fetchApi<{ rooms: { id: string }[] }>('/api/rooms')
      .then((data) => setRooms(sortRooms(data.rooms.map((r) => r.id))))
      .catch(() => {})
  }, [])

  // Load Students
  const loadStudents = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedRoom) params.set('room_id', selectedRoom)
      if (selectedGrade) params.set('grade_level', selectedGrade)
      if (selectedStatus) params.set('status', selectedStatus)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetchApi<{ students: Student[] }>(`/api/students?${params.toString()}`)
      setStudents(res.students || [])
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลนักเรียนได้')
    } finally {
      setIsLoading(false)
    }
  }, [selectedRoom, selectedGrade, selectedStatus, searchQuery])

  React.useEffect(() => {
    loadStudents()
  }, [loadStudents])

  // Handle Add Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStudentId.trim() || !newFirstName.trim() || !newLastName.trim() || !newRoomId) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน')
      return
    }

    const electiveValue = newElectiveSelect === '__OTHER__' ? newCustomElective.trim() : newElectiveSelect.trim()

    setIsCreatingStudent(true)
    try {
      await fetchApi('/api/students', {
        method: 'POST',
        body: JSON.stringify({
          studentId: newStudentId.trim(),
          nationalId: newNationalId.trim(),
          prefix: newPrefix,
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          roomId: newRoomId,
          seatNo: Number(newSeatNo),
          languageGroup: newLanguageGroup.trim(),
          electiveGroup: electiveValue,
          status: newStatus
        })
      })
      toast.success('เพิ่มข้อมูลนักเรียนสำเร็จ')
      setIsAddStudentModalOpen(false)
      // Reset form
      setNewStudentId('')
      setNewNationalId('')
      setNewFirstName('')
      setNewLastName('')
      setNewSeatNo(1)
      setNewLanguageGroup('')
      setNewElectiveSelect('')
      setNewCustomElective('')
      loadStudents()
    } catch (err) {
      toast.error((err as Error).message || 'เพิ่มข้อมูลนักเรียนไม่สำเร็จ')
    } finally {
      setIsCreatingStudent(false)
    }
  }

  // Open Edit Student Modal
  const openEditModal = (student: Student) => {
    setEditingStudent(student)
    setEditStudentId(student.studentId)
    setEditNationalId(student.nationalId || '')
    setEditPrefix(student.prefix)
    setEditFirstName(student.firstName)
    setEditLastName(student.lastName)
    setEditRoomId(student.roomId)
    setEditSeatNo(student.seatNo)
    setEditStatus(student.status)
    setEditLanguage(student.languageGroup || '')

    const currentElective = (student.electiveGroup || '').trim()
    if (!currentElective) {
      setEditElectiveSelect('')
      setEditCustomElective('')
    } else if (ALL_STANDARD_ELECTIVES.includes(currentElective)) {
      setEditElectiveSelect(currentElective)
      setEditCustomElective('')
    } else {
      setEditElectiveSelect('__OTHER__')
      setEditCustomElective(currentElective)
    }

    setIsEditStudentModalOpen(true)
  }

  // Handle Save Edit Student
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent) return

    const electiveValue = editElectiveSelect === '__OTHER__' ? editCustomElective.trim() : editElectiveSelect.trim()

    setIsSavingEdit(true)
    try {
      await fetchApi(`/api/students/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          studentId: editStudentId,
          nationalId: editNationalId,
          prefix: editPrefix,
          firstName: editFirstName,
          lastName: editLastName,
          roomId: editRoomId,
          seatNo: Number(editSeatNo),
          status: editStatus,
          languageGroup: editLanguage,
          electiveGroup: electiveValue
        })
      })
      toast.success('แก้ไขข้อมูลนักเรียนสำเร็จ')
      setIsEditStudentModalOpen(false)
      setEditingStudent(null)
      loadStudents()
    } catch (err) {
      toast.error((err as Error).message || 'แก้ไขข้อมูลนักเรียนไม่สำเร็จ')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Handle Delete Student
  const handleDeleteStudent = async () => {
    if (!deletingStudent) return

    setIsDeleting(true)
    try {
      await fetchApi(`/api/students/${deletingStudent.id}`, {
        method: 'DELETE'
      })
      toast.success('ลบข้อมูลนักเรียนสำเร็จ')
      setIsDeleteModalOpen(false)
      setDeletingStudent(null)
      loadStudents()
    } catch (err) {
      toast.error((err as Error).message || 'ลบข้อมูลนักเรียนไม่สำเร็จ')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle Toggle Select Student
  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Handle Select All Visible on current page
  const handleSelectAllVisible = () => {
    const visibleIds = paginatedStudents.map((s) => s.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.includes(id))
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // Handle Bulk Delete Selected
  const handleBulkDeleteSelected = async () => {
    if (selectedStudentIds.length === 0) return
    setIsBulkDeleting(true)
    try {
      const res = await fetchApi<{ message: string; deletedCount: number }>(
        '/api/students/bulk-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            studentIds: selectedStudentIds,
            reason: bulkDeleteReason.trim() || 'ลบข้อมูลนักเรียนแบบกลุ่ม'
          })
        }
      )
      toast.success(res.message || 'ลบข้อมูลนักเรียนสำเร็จ')
      setIsBulkDeleteModalOpen(false)
      setSelectedStudentIds([])
      setBulkDeleteReason('')
      loadStudents()
    } catch (err) {
      toast.error((err as Error).message || 'ลบข้อมูลนักเรียนไม่สำเร็จ')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Handle Delete By Scope
  const handleDeleteByScope = async () => {
    let target = ''
    if (scopeType === 'ROOM') target = scopeTargetRoom
    else if (scopeType === 'GRADE') target = scopeTargetGrade

    if (
      scopeType === 'ALL' &&
      scopeConfirmText !== 'CONFIRM_DELETE' &&
      scopeConfirmText !== 'ลบข้อมูลทั้งหมด'
    ) {
      toast.error('กรุณาพิมพ์ข้อความยืนยันความปลอดภัยให้ถูกต้อง')
      return
    }

    setIsScopeDeleting(true)
    try {
      const res = await fetchApi<{ message: string; deletedCount: number }>(
        '/api/students/delete-by-scope',
        {
          method: 'POST',
          body: JSON.stringify({
            scope: scopeType,
            target,
            reason: scopeReason.trim() || 'ลบข้อมูลตามขอบเขต'
          })
        }
      )
      toast.success(res.message || 'ลบข้อมูลนักเรียนสำเร็จ')
      setIsScopeModalOpen(false)
      setSelectedStudentIds([])
      setScopeConfirmText('')
      setScopeReason('')
      loadStudents()
    } catch (err) {
      toast.error((err as Error).message || 'ลบข้อมูลนักเรียนไม่สำเร็จ')
    } finally {
      setIsScopeDeleting(false)
    }
  }

  // Handle File Upload Import
  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('กรุณาเลือกไฟล์เพื่ออัปโหลด')
      return
    }

    setIsUploading(true)
    try {
      const endpoint = importType === 'students' ? '/api/students/import' : '/api/advisors/import'
      const res = await uploadFileApi<{ message: string }>(endpoint, uploadFile)
      toast.success(res.message || 'นำเข้าข้อมูลสำเร็จ!')
      setIsImportModalOpen(false)
      setUploadFile(null)
      loadStudents()
    } catch (err) {
      toast.error((err as Error).message || 'การนำเข้าไฟล์ล้มเหลว')
    } finally {
      setIsUploading(false)
    }
  }

  // Load Audit Trail
  const openAuditLogs = async (student: Student) => {
    setAuditStudent(student)
    setIsLoadingLogs(true)
    try {
      const res = await fetchApi<{ logs: AuditLog[] }>(`/api/students/${student.studentId}`)
      setAuditLogs(res.logs || [])
    } catch {
      toast.error('ไม่สามารถโหลดประวัติได้')
    } finally {
      setIsLoadingLogs(false)
    }
  }

  return (
    <DashboardShell
      title="จัดการบัญชีนักเรียน (Student Roster)"
      description="ระบบจัดการข้อมูลหลัก ม.4 - ม.6 (NewTEA Master Data)"
      badge={`${students.length} คน`}
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleOpenRollover}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-purple-600/20 transition-all cursor-pointer shrink-0"
            title="ดำเนินการเปลี่ยนปีการศึกษา: จบการศึกษา ม.6, เลื่อนชั้น ม.4-ม.5, และรับ ม.4 ใหม่"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden md:inline">เลื่อนชั้นปีการศึกษา</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddStudentModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">เพิ่มนักเรียน</span>
            <span className="sm:hidden">เพิ่ม</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setImportType('students')
              setIsImportModalOpen(true)
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer shrink-0"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-brand-500" />
            <span className="hidden sm:inline">นำเข้าไฟล์</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScopeConfirmText('')
              setScopeReason('')
              setIsScopeModalOpen(true)
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold transition-all cursor-pointer shrink-0"
            title="ลบข้อมูลนักเรียนตามห้อง ระดับชั้น หรือล้างระบบ"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden lg:inline">ล้างระบบ</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Floating Action Bar when students are selected */}
        {selectedStudentIds.length > 0 && (
          <div className="bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-xs transition-all">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
              <CheckCircle2 className="w-4 h-4 text-brand-500" />
              <span>เลือกแล้ว {selectedStudentIds.length} คน (จากที่แสดงอยู่ {students.length} คน)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-medium cursor-pointer"
              >
                ยกเลิกการเลือก
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบที่เลือก ({selectedStudentIds.length} คน)</span>
              </button>
            </div>
          </div>
        )}
        {/* Search & Filter Bar */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหาด้วยรหัส, ชื่อ, วิชาเลือก, หรือกลุ่มภาษา..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>

            {/* Room Filter */}
            <div>
              <select
                value={selectedRoom}
                onChange={(e) => {
                  setSelectedRoom(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              >
                <option value="">ทุกห้องเรียน (45 ห้อง)</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    ห้อง ม.{r}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Filter */}
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              >
                <option value="">ทุกระดับชั้น</option>
                <option value="4">มัธยมศึกษาปีที่ 4</option>
                <option value="5">มัธยมศึกษาปีที่ 5</option>
                <option value="6">มัธยมศึกษาปีที่ 6</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              >
                <option value="">ทุกสถานะ</option>
                <option value="ACTIVE">ปกติ (ACTIVE)</option>
                <option value="TRANSFERRED">ย้ายห้อง (TRANSFERRED)</option>
                <option value="RESIGNED">พ้นสภาพ/ลาออก (RESIGNED)</option>
                <option value="GRADUATED">จบการศึกษา (GRADUATED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500 shrink-0" />
              <h2 className="font-bold text-sm text-foreground">รายชื่อนักเรียนในระบบ</h2>
              <span className="text-xs text-muted-foreground">({students.length} คน)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedStudents.length > 0 &&
                        paginatedStudents.every((s) => selectedStudentIds.includes(s.id))
                      }
                      onChange={handleSelectAllVisible}
                      className="rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                      title="เลือกทั้งหมดในหน้านี้"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">ห้อง/เลขที่</th>
                  <th className="px-4 py-3 font-semibold">รหัสนักเรียน</th>
                  <th className="px-4 py-3 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="px-4 py-3 font-semibold">ภาษาที่ 3</th>
                  <th className="px-4 py-3 font-semibold">วิชาเลือก</th>
                  <th className="px-4 py-3 font-semibold">สถานะ</th>
                  <th className="px-4 py-3 font-semibold text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedStudents.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      selectedStudentIds.includes(s.id) ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s.id)}
                        onChange={() => handleToggleSelectStudent(s.id)}
                        className="rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <span className="font-bold text-brand-600 dark:text-brand-400">ม.{s.roomId}</span>
                      <span className="text-muted-foreground ml-1.5">#{s.seatNo}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{s.studentId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {s.prefix} {s.firstName} {s.lastName}
                      </div>
                      {s.nationalId && (
                        <div className="text-[10px] text-muted-foreground">
                          ปชช: {s.nationalId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.languageGroup ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {s.languageGroup}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.electiveGroup ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          {s.electiveGroup}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : s.status === 'TRANSFERRED'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : s.status === 'GRADUATED'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {s.status === 'ACTIVE' && 'ปกติ'}
                        {s.status === 'TRANSFERRED' && 'ย้ายห้อง'}
                        {s.status === 'GRADUATED' && 'จบการศึกษา'}
                        {s.status === 'RESIGNED' && 'พ้นสภาพ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(s)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="แก้ไขข้อมูลนักเรียน"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingStudent(s)
                          setIsDeleteModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-all cursor-pointer"
                        title="ลบนักเรียน"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openAuditLogs(s)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="ดูประวัติการเปลี่ยนแปลง"
                      >
                        <History className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </td>
                  </tr>
                ))}

                {students.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลนักเรียนที่ค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-border p-3 sm:p-4 bg-muted/20">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={students.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-500 shrink-0" />
                เพิ่มข้อมูลนักเรียนใหม่
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">รหัสนักเรียน *</label>
                  <input
                    type="text"
                    placeholder="เช่น 54101"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">เลขประจำตัวประชาชน</label>
                  <input
                    type="text"
                    placeholder="13 หลัก"
                    value={newNationalId}
                    onChange={(e) => setNewNationalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">คำนำหน้า *</label>
                  <select
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="เด็กชาย">เด็กชาย</option>
                    <option value="เด็กหญิง">เด็กหญิง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ชื่อ *</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">นามสกุล *</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ห้องเรียน *</label>
                  <select
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {rooms.map((r) => (
                      <option key={r} value={r}>
                        ห้อง ม.{r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">เลขที่</label>
                  <input
                    type="number"
                    value={newSeatNo}
                    onChange={(e) => setNewSeatNo(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">กลุ่มภาษาที่ 3</label>
                  <select
                    value={newLanguageGroup}
                    onChange={(e) => setNewLanguageGroup(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">ไม่มี / ไม่ระบุ</option>
                    <option value="ญี่ปุ่น">ญี่ปุ่น</option>
                    <option value="ฝรั่งเศส">ฝรั่งเศส</option>
                    <option value="เกาหลี">เกาหลี</option>
                    <option value="จีน">จีน</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">วิชาเลือกเฉพาะ</label>
                  <select
                    value={newElectiveSelect}
                    onChange={(e) => setNewElectiveSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">ไม่มี / ไม่ระบุ</option>
                    {STANDARD_ELECTIVE_CATEGORIES.map((cat) => (
                      <optgroup key={cat.category} label={cat.category}>
                        {cat.items.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__OTHER__">+ อื่นๆ (ระบุวิชาเลือกเอง)...</option>
                  </select>
                  {newElectiveSelect === '__OTHER__' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="พิมพ์ชื่อวิชาเลือกใหม่ เช่น หุ่นยนต์, ดาราศาสตร์"
                        value={newCustomElective}
                        onChange={(e) => setNewCustomElective(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-background border border-brand-500/50 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-xs"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">สถานะ</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  <option value="ACTIVE">ปกติ (ACTIVE)</option>
                  <option value="TRANSFERRED">ย้ายห้อง (TRANSFERRED)</option>
                  <option value="RESIGNED">พ้นสภาพ/ลาออก (RESIGNED)</option>
                  <option value="GRADUATED">จบการศึกษา (GRADUATED)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreatingStudent}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  {isCreatingStudent ? 'กำลังบันทึก...' : 'บันทึกข้อมูลนักเรียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditStudentModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500 shrink-0" />
                แก้ไขข้อมูลนักเรียน ({editingStudent.studentId})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditStudentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">รหัสนักเรียน</label>
                  <input
                    type="text"
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">เลขประจำตัวประชาชน</label>
                  <input
                    type="text"
                    value={editNationalId}
                    onChange={(e) => setEditNationalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">คำนำหน้า</label>
                  <select
                    value={editPrefix}
                    onChange={(e) => setEditPrefix(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="เด็กชาย">เด็กชาย</option>
                    <option value="เด็กหญิง">เด็กหญิง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ชื่อ</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">นามสกุล</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ห้องเรียน</label>
                  <select
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {rooms.map((r) => (
                      <option key={r} value={r}>
                        ห้อง ม.{r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">เลขที่</label>
                  <input
                    type="number"
                    value={editSeatNo}
                    onChange={(e) => setEditSeatNo(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">กลุ่มภาษาที่ 3</label>
                  <select
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">ไม่มี / ไม่ระบุ</option>
                    <option value="ญี่ปุ่น">ญี่ปุ่น</option>
                    <option value="ฝรั่งเศส">ฝรั่งเศส</option>
                    <option value="เกาหลี">เกาหลี</option>
                    <option value="จีน">จีน</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">วิชาเลือกเฉพาะ</label>
                  <select
                    value={editElectiveSelect}
                    onChange={(e) => setEditElectiveSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">ไม่มี / ไม่ระบุ</option>
                    {STANDARD_ELECTIVE_CATEGORIES.map((cat) => (
                      <optgroup key={cat.category} label={cat.category}>
                        {cat.items.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__OTHER__">+ อื่นๆ (ระบุวิชาเลือกเอง)...</option>
                  </select>
                  {editElectiveSelect === '__OTHER__' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="พิมพ์ชื่อวิชาเลือกใหม่ เช่น หุ่นยนต์, ดาราศาสตร์"
                        value={editCustomElective}
                        onChange={(e) => setEditCustomElective(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-background border border-brand-500/50 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-xs"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">สถานะ</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  <option value="ACTIVE">ปกติ (ACTIVE)</option>
                  <option value="TRANSFERRED">ย้ายห้อง (TRANSFERRED)</option>
                  <option value="RESIGNED">พ้นสภาพ/ลาออก (RESIGNED)</option>
                  <option value="GRADUATED">จบการศึกษา (GRADUATED)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      {isDeleteModalOpen && deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 shrink-0" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-foreground">ยืนยันการลบนักเรียน?</h3>
              <p className="text-xs text-muted-foreground">
                คุณต้องการลบข้อมูลของ{' '}
                <span className="font-bold text-foreground">
                  {deletingStudent.prefix} {deletingStudent.firstName} {deletingStudent.lastName}
                </span>{' '}
                (รหัส {deletingStudent.studentId} ห้อง ม.{deletingStudent.roomId}) หรือไม่?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDeletingStudent(null)
                }}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-brand-500 shrink-0" />
                ประวัติการแก้ไขข้อมูล: {auditStudent.prefix} {auditStudent.firstName} {auditStudent.lastName}
              </h3>
              <button
                type="button"
                onClick={() => setAuditStudent(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {isLoadingLogs ? (
                <div className="p-8 text-center text-muted-foreground">กำลังโหลดประวัติ...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">ยังไม่มีประวัติการเปลี่ยนแปลง</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-brand-600 dark:text-brand-400">
                        {log.action}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.changedAt).toLocaleString('th-TH')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-muted-foreground block text-[10px]">ค่าเดิม:</span>
                        <span className="font-medium text-foreground">{log.oldValue || '-'}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-muted-foreground block text-[10px]">ค่าใหม่:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {log.newValue || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-1">
                      ดำเนินการโดย: <span className="font-medium text-foreground">{log.changedBy}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Excel / CSV Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-500 shrink-0" />
                นำเข้าข้อมูลหลัก (Excel / CSV)
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Type Switcher */}
            <div className="flex items-center gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setImportType('students')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  importType === 'students'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                บัญชีนักเรียน (45 ห้อง)
              </button>
              <button
                type="button"
                onClick={() => setImportType('advisors')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  importType === 'advisors'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ครูที่ปรึกษา (1-3 ท่าน/ห้อง)
              </button>
            </div>

            {/* Template Download Section */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Download className="w-4 h-4 text-brand-500 shrink-0" />
                ดาวน์โหลดไฟล์ตัวอย่าง (Template)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {importType === 'students'
                  ? 'ไฟล์แม่แบบประกอบด้วย: student_id, national_id, prefix, first_name, last_name, room, seat_no, language_group, elective_group, status'
                  : 'ไฟล์แม่แบบตามโครงสร้างเดิมของเตรียมฯ เหนือ: ห้อง, ชื่อครูที่ปรึกษาคนที่ 1, ห้อง, ชื่อคนที่ 2, ห้อง, ชื่อคนที่ 3'}
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href={
                    importType === 'students'
                      ? '/api/templates/students.xlsx'
                      : '/api/templates/advisors.xlsx'
                  }
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-xs transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  ดาวน์โหลด Excel (.xlsx) แนะนำ
                </a>
                <a
                  href={
                    importType === 'students'
                      ? '/api/templates/students'
                      : '/api/templates/advisors'
                  }
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-card text-foreground font-medium text-[11px] transition-all"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                  ดาวน์โหลด CSV (UTF-8)
                </a>
              </div>
            </div>

            {/* File Drag / Select */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground">เลือกไฟล์ที่ต้องการนำเข้า</label>
              <div className="border-2 border-dashed border-border hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-background">
                <input
                  type="file"
                  id="importFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="importFileInput" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-brand-500 mx-auto" />
                  <div className="text-xs font-semibold text-foreground">
                    {uploadFile ? uploadFile.name : 'คลิกเพื่อเลือกไฟล์ Excel (.xlsx) หรือ CSV'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    รองรับไฟล์นามสกุล .xlsx, .xls, .csv ขนาดไม่เกิน 20MB
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {isUploading ? 'กำลังประมวลผลไฟล์...' : 'เริ่มนำเข้าข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5 shrink-0" />
                ยืนยันการลบนักเรียนที่เลือก ({selectedStudentIds.length} คน)
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                ข้อควรระวัง: ไม่สามารถย้อนกลับได้
              </p>
              <p className="text-muted-foreground leading-relaxed">
                ระบบจะลบข้อมูลนักเรียนที่เลือกจำนวน <span className="font-bold text-foreground">{selectedStudentIds.length}</span> คน พร้อมทั้งข้อมูลคะแนนเก็บ ผลการประเมิน 3 ด้าน และประวัติ Audit Log ที่เกี่ยวข้องทั้งหมด
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-muted-foreground font-medium">ระบุเหตุผลในการลบ (ทางเลือก)</label>
              <input
                type="text"
                placeholder="เช่น ข้อมูลซ้ำซ้อน / นำเข้าไฟล์ผิดพลาด"
                value={bulkDeleteReason}
                onChange={(e) => setBulkDeleteReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteSelected}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-98 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isBulkDeleting ? 'กำลังลบข้อมูล...' : `ยืนยันลบ ${selectedStudentIds.length} คน`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scope Delete Modal (By Room, Grade, or Clear All Roster) */}
      {isScopeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-destructive shrink-0" />
                ลบข้อมูลนักเรียนเป็นกลุ่ม / ล้างข้อมูลระบบ
              </h3>
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Scope Type Selector */}
            <div className="space-y-1.5 text-xs">
              <label className="block text-muted-foreground font-medium">เลือกรูปแบบการลบข้อมูล</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScopeType('ROOM')}
                  className={`p-2.5 rounded-2xl border text-center font-medium transition-all ${
                    scopeType === 'ROOM'
                      ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  ลบรายห้องเรียน
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType('GRADE')}
                  className={`p-2.5 rounded-2xl border text-center font-medium transition-all ${
                    scopeType === 'GRADE'
                      ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  ลบรายระดับชั้น
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType('ALL')}
                  className={`p-2.5 rounded-2xl border text-center font-medium transition-all ${
                    scopeType === 'ALL'
                      ? 'border-destructive bg-destructive/10 text-destructive font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  ล้างทั้งโรงเรียน
                </button>
              </div>
            </div>

            {/* Scope Specific Inputs */}
            {scopeType === 'ROOM' && (
              <div className="space-y-3 p-4 rounded-2xl bg-muted/40 border border-border text-xs">
                <div>
                  <label className="block text-foreground font-semibold mb-1">เลือกห้องเรียนที่ต้องการลบ</label>
                  <select
                    value={scopeTargetRoom}
                    onChange={(e) => setScopeTargetRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {rooms.map((room) => (
                      <option key={room} value={room}>
                        ห้อง ม.{room}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  จะลบข้อมูลนักเรียนทุกคนที่สังกัดห้อง ม.{scopeTargetRoom} พร้อมคะแนนและผลประเมินที่เกี่ยวข้องทั้งหมด
                </p>
              </div>
            )}

            {scopeType === 'GRADE' && (
              <div className="space-y-3 p-4 rounded-2xl bg-muted/40 border border-border text-xs">
                <div>
                  <label className="block text-foreground font-semibold mb-1.5">เลือกระดับชั้นที่ต้องการลบ</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['4', '5', '6'].map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setScopeTargetGrade(grade)}
                        className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                          scopeTargetGrade === grade
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        มัธยมศึกษาปีที่ {grade}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  จะลบข้อมูลนักเรียนทุกห้องในระดับชั้น ม.{scopeTargetGrade} (เช่น ม.{scopeTargetGrade}.1 ถึง ม.{scopeTargetGrade}.15) ทั้งหมด
                </p>
              </div>
            )}

            {scopeType === 'ALL' && (
              <div className="space-y-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs">
                <div className="flex items-start gap-2 text-destructive">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">คำเตือนความปลอดภัยขั้นสูงสุด!</h4>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                      การกระทำนี้จะล้างบัญชีรายชื่อนักเรียน <span className="font-bold text-destructive">ทั้งหมดทั้งโรงเรียน</span> (ม.4, ม.5, ม.6) พร้อมทั้งคะแนนเก็บทั้งหมด เพื่อเตรียมฐานข้อมูลใหม่
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-destructive/20 space-y-1.5">
                  <label className="block text-destructive font-semibold">
                    เพื่อยืนยัน ให้พิมพ์คำว่า <span className="underline font-mono">CONFIRM_DELETE</span> หรือ <span className="underline font-mono">ลบข้อมูลทั้งหมด</span>
                  </label>
                  <input
                    type="text"
                    value={scopeConfirmText}
                    onChange={(e) => setScopeConfirmText(e.target.value)}
                    placeholder="CONFIRM_DELETE"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-destructive/40 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  />
                </div>
              </div>
            )}

            {/* Optional Reason Input */}
            <div className="space-y-1.5 text-xs">
              <label className="block text-muted-foreground font-medium">ระบุเหตุผลในการลบ (ทางเลือก)</label>
              <input
                type="text"
                placeholder="เช่น เตรียมการเปิดภาคเรียนใหม่ / ล้างข้อมูลที่นำเข้าผิดพลาด"
                value={scopeReason}
                onChange={(e) => setScopeReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(false)}
                disabled={isScopeDeleting}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteByScope}
                disabled={
                  isScopeDeleting ||
                  (scopeType === 'ALL' &&
                    scopeConfirmText !== 'CONFIRM_DELETE' &&
                    scopeConfirmText !== 'ลบข้อมูลทั้งหมด')
                }
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-98 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isScopeDeleting
                  ? 'กำลังดำเนินการ...'
                  : scopeType === 'ALL'
                  ? 'ยืนยันล้างข้อมูลทั้งหมด'
                  : scopeType === 'GRADE'
                  ? `ยืนยันลบระดับชั้น ม.${scopeTargetGrade}`
                  : `ยืนยันลบห้อง ม.${scopeTargetRoom}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Year-End Rollover Wizard Modal */}
      {isRolloverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    ระบบเลื่อนชั้นปีการศึกษา (Year-End Rollover Wizard)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ดำเนินการเปลี่ยนผ่านปีการศึกษา: ม.6 จบการศึกษา, เลื่อนชั้น ม.4-ม.5, และรับ ม.4 ใหม่
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRolloverModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Step Navigation Tabs */}
            <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRolloverStep(1)}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  rolloverStep === 1
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                1. จบ ม.6
              </button>
              <button
                type="button"
                onClick={() => setRolloverStep(2)}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  rolloverStep === 2
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                2. เลื่อน ม.4-ม.5
              </button>
              <button
                type="button"
                onClick={() => setRolloverStep(3)}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  rolloverStep === 3
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                3. รับ ม.4 ใหม่
              </button>
              <button
                type="button"
                onClick={() => setRolloverStep(4)}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  rolloverStep === 4
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                4. เปิดปีใหม่
              </button>
            </div>

            {/* Step 1: Graduate M.6 */}
            {rolloverStep === 1 && (
              <div className="space-y-4 text-xs">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-1">
                    <span className="text-[11px] text-muted-foreground block">ม.6 ในห้องปกติ</span>
                    <span className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
                      {rolloverPreview?.m6ActiveCount ?? '...'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">คน (รอจบการศึกษา)</span>
                  </div>
                  <div className="p-3 rounded-2xl border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">ม.5 ในห้องปกติ</span>
                    <span className="text-xl font-bold font-mono text-foreground">
                      {rolloverPreview?.m5ActiveCount ?? '...'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">คน (รอขึ้น ม.6)</span>
                  </div>
                  <div className="p-3 rounded-2xl border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">ม.4 ในห้องปกติ</span>
                    <span className="text-xl font-bold font-mono text-foreground">
                      {rolloverPreview?.m4ActiveCount ?? '...'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">คน (รอขึ้น ม.5)</span>
                  </div>
                  <div className="p-3 rounded-2xl border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">จบการศึกษาแล้ว</span>
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {rolloverPreview?.graduatedCount ?? '...'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">คน (ศิษย์เก่า)</span>
                  </div>
                </div>

                {/* Graduation Action Box */}
                {(rolloverPreview?.m6ActiveCount ?? 0) > 0 ? (
                  <div className="space-y-3 p-4 rounded-2xl border border-purple-500/30 bg-purple-500/5">
                    <div className="flex items-start gap-2.5">
                      <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-foreground">
                          อนุมัติจบการศึกษานักเรียนชั้น ม.6 ทั้งหมด ({rolloverPreview?.m6ActiveCount} คน)
                        </h4>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          เมื่ออนุมัติ นักเรียน ม.6 ทั้งหมดจะเปลี่ยนสถานะเป็น <span className="font-semibold text-purple-600 dark:text-purple-400">จบการศึกษา (GRADUATED)</span> โดยประวัติผลการเรียนตลอด 3 ปี (ม.4 - ม.6) จะถูกเก็บรักษาไว้อย่างสมบูรณ์ 100% และห้อง 6.1 - 6.15 จะว่างลงเพื่อรองรับนักเรียน ม.5 ที่จะเลื่อนชั้นขึ้นมา
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-purple-500/20 space-y-1.5">
                      <label className="block text-foreground font-semibold">ระบุหมายเหตุการจบการศึกษา:</label>
                      <input
                        type="text"
                        value={graduationReason}
                        onChange={(e) => setGraduationReason(e.target.value)}
                        placeholder="จบการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน"
                        className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleGraduateM6}
                      disabled={isGraduatingM6}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-semibold flex items-center justify-center gap-2 shadow-xs shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>{isGraduatingM6 ? 'กำลังบันทึกการจบการศึกษา...' : `ยืนยันอนุมัติจบการศึกษา ม.6 ทั้งหมด (${rolloverPreview?.m6ActiveCount} คน)`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>นักเรียนชั้น ม.6 จบการศึกษาเรียบร้อยแล้ว</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      ห้อง ม.6.1 ถึง ม.6.15 ว่างเรียบร้อยแล้ว พร้อมสำหรับเลื่อนนักเรียนชั้น ม.5 ขึ้นเป็น ม.6
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setRolloverStep(2)}
                        className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <span>ไปขั้นตอนที่ 2: เลื่อนชั้น ม.4 และ ม.5</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Promote M.5 & M.4 */}
            {rolloverStep === 2 && (
              <div className="space-y-4 text-xs">
                {!rolloverPreview?.canPromote ? (
                  <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span>ไม่สามารถเลื่อนชั้นได้ในขณะนี้</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {rolloverPreview?.promoteBlockReason || 'ยังมีนักเรียน ม.6 ค้างอยู่ในห้องเรียนปกติ กรุณาดำเนินการอนุมัติจบการศึกษา ม.6 ในขั้นตอนที่ 1 ให้เรียบร้อยก่อน'}
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setRolloverStep(1)}
                        className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted font-semibold cursor-pointer"
                      >
                        กลับไปขั้นตอนที่ 1: จบ ม.6
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-1">
                        <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                          เลื่อน ม.5 ➔ ม.6 (15 ห้อง)
                        </span>
                        <span className="text-2xl font-bold font-mono text-brand-600 dark:text-brand-400 block">
                          {rolloverPreview.m5ActiveCount} คน
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ห้อง 5.1-5.15 ปรับเป็น 6.1-6.15
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-1">
                        <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                          เลื่อน ม.4 ➔ ม.5 (15 ห้อง)
                        </span>
                        <span className="text-2xl font-bold font-mono text-brand-600 dark:text-brand-400 block">
                          {rolloverPreview.m4ActiveCount} คน
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ห้อง 4.1-4.15 ปรับเป็น 5.1-5.15
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-border bg-muted/40 space-y-3">
                      <div className="space-y-1">
                        <h4 className="font-bold text-foreground">
                          การเลื่อนชั้นปีการศึกษาแบบ 1-to-1 (ห้องเดิม)
                        </h4>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          ระบบจะเลื่อนห้องเรียนให้อัตโนมัติในฐานข้อมูลแบบ Transaction ที่ปลอดภัย:
                          <br />• ม.5.1 ถึง ม.5.15 ➔ เลื่อนเป็น ม.6.1 ถึง ม.6.15
                          <br />• ม.4.1 ถึง ม.4.15 ➔ เลื่อนเป็น ม.5.1 ถึง ม.5.15
                          <br />• คงเลขที่, วิชาเลือก, และกลุ่มภาษาเดิม พร้อมบันทึกประวัติ Audit Trail
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border space-y-1.5">
                        <label className="block text-foreground font-semibold">หมายเหตุการเลื่อนชั้น:</label>
                        <input
                          type="text"
                          value={promotionReason}
                          onChange={(e) => setPromotionReason(e.target.value)}
                          placeholder="เลื่อนชั้นปีการศึกษา (5.x -> 6.x, 4.x -> 5.x)"
                          className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-xs"
                        />
                      </div>

                      {rolloverPreview.m5ActiveCount > 0 || rolloverPreview.m4ActiveCount > 0 ? (
                        <button
                          type="button"
                          onClick={handlePromoteStudents}
                          disabled={isPromoting}
                          className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>{isPromoting ? 'กำลังดำเนินการเลื่อนชั้น...' : `ยืนยันเลื่อนชั้นปีการศึกษา (${rolloverPreview.m5ActiveCount + rolloverPreview.m4ActiveCount} คน)`}</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <span className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            เลื่อนชั้นเรียบร้อยแล้ว หรือไม่มีนักเรียนที่ต้องเลื่อน
                          </span>
                          <button
                            type="button"
                            onClick={() => setRolloverStep(3)}
                            className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>ไปขั้นตอนที่ 3: รับ ม.4 ใหม่</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: New Intake M.4 */}
            {rolloverStep === 3 && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>ห้องเรียน ม.4.1 ถึง ม.4.15 ว่างพร้อมรับนักเรียนใหม่แล้ว!</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    ขณะนี้นักเรียน ม.4 เดิมได้เลื่อนขึ้นไปอยู่ ม.5 เรียบร้อยแล้ว ฝ่ายทะเบียนสามารถนำเข้าไฟล์รายชื่อนักเรียนใหม่ ม.4.1 ถึง ม.4.15 (~450 คน) เข้าสู่ระบบ NewTEA ได้ทันที
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Download className="w-4 h-4 text-brand-500" />
                        แม่แบบไฟล์ Excel สำหรับ ม.4 ใหม่
                      </span>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        ดาวน์โหลดเทมเพลตรายชื่อนักเรียน พร้อมคอลัมน์เลขประจำตัว, คำนำหน้า, ชื่อ-สกุล, ห้อง (4.1-4.15), เลขที่, ภาษาที่ 3, และวิชาเลือก
                      </p>
                    </div>
                    <a
                      href="/api/students/template.xlsx"
                      download="Template_นักเรียน_NewTEA.xlsx"
                      className="w-full py-2 px-3 rounded-xl border border-border hover:bg-muted font-semibold flex items-center justify-center gap-1.5 text-center text-foreground transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดาวน์โหลดแม่แบบ Excel</span>
                    </a>
                  </div>

                  <div className="p-4 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-brand-500" />
                        นำเข้าไฟล์รายชื่อนักเรียน ม.4
                      </span>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        เปิดหน้าต่างอัปโหลดไฟล์ Excel/CSV เพื่อนำเข้านักเรียนใหม่ ม.4 เข้าสู่ระบบทันที
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImportType('students')
                        setIsImportModalOpen(true)
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>เปิดหน้าต่างนำเข้าไฟล์นักเรียน</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRolloverStep(4)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>ไปขั้นตอนที่ 4: แต่งตั้งครูที่ปรึกษา & เปิดปีใหม่</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Finalize Year & Term */}
            {rolloverStep === 4 && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-1">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    ขั้นตอนสุดท้ายในการเปลี่ยนปีการศึกษา
                  </h4>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    หลังจากเลื่อนชั้นและนำเข้านักเรียนเรียบร้อยแล้ว ให้ดำเนินการ 2 ส่วนนี้เพื่อเริ่มปีการศึกษาใหม่อย่างสมบูรณ์:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="/admin/advisors"
                    className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-all space-y-2 block"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand-500" />
                        1. แต่งตั้งครูที่ปรึกษา 45 ห้อง
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      อัปเดตคำสั่งแต่งตั้งครูที่ปรึกษาประจำห้อง 4.1 ถึง 6.15 (1-3 ท่านต่อห้อง) สำหรับปีการศึกษาใหม่
                    </p>
                  </a>

                  <a
                    href="/admin/terms"
                    className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-all space-y-2 block"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-purple-500" />
                        2. เปิดปีการศึกษาใหม่ (Activate)
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      สร้างปีการศึกษาใหม่ เช่น 2569 ภาคเรียนที่ 1 และกด &quot;ตั้งเป็นภาคเรียนปัจจุบัน&quot; เพื่อให้ครูเริ่มสร้างรายวิชาได้ทันที
                    </p>
                  </a>
                </div>

                <div className="pt-3 border-t border-border flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsRolloverModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all cursor-pointer shadow-xs"
                  >
                    เสร็จสิ้นการเลื่อนชั้นปีการศึกษา
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
