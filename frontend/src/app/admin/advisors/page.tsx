'use client'

import * as React from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { RoleGuard } from '@/components/role-guard'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { fetchApi, uploadFileApi } from '@/lib/api'
import {
  UserCheck,
  Search,
  Plus,
  Upload,
  Download,
  ShieldCheck,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  FileText,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface AdvisorItem {
  id: string
  order: number
  name: string
  email: string
  userId: string
}

interface RoomItem {
  id: string
  gradeLevel: number
  roomNumber: number
}

interface TeacherItem {
  id: string
  name: string
  email: string
}

export default function AdvisorsManagementPage() {
  const [rooms, setRooms] = React.useState<RoomItem[]>([])
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([])
  const [advisorsByRoom, setAdvisorsByRoom] = React.useState<Record<string, AdvisorItem[]>>({})
  const [isLoading, setIsLoading] = React.useState(true)

  // Filters
  const [selectedGrade, setSelectedGrade] = React.useState<string>('')
  const [searchQuery, setSearchQuery] = React.useState<string>('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(15)

  // Add / Assign Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [assignRoomId, setAssignRoomId] = React.useState('4.1')
  const [assignOrder, setAssignOrder] = React.useState<number>(1)
  const [assignName, setAssignName] = React.useState('')
  const [assignEmail, setAssignEmail] = React.useState('')
  const [isSubmittingAssign, setIsSubmittingAssign] = React.useState(false)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [editingAdvisorId, setEditingAdvisorId] = React.useState<string>('')
  const [editRoomId, setEditRoomId] = React.useState('')
  const [editOrder, setEditOrder] = React.useState<number>(1)
  const [editName, setEditName] = React.useState('')
  const [editEmail, setEditEmail] = React.useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false)

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [deletingAdvisor, setDeletingAdvisor] = React.useState<{ id: string, name: string, room: string } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false)
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  // Load advisors data
  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchApi<{
        advisorsByRoom: Record<string, AdvisorItem[]>
        rooms: RoomItem[]
        teachers: TeacherItem[]
      }>('/api/advisors')

      setAdvisorsByRoom(res.advisorsByRoom || {})
      setRooms(res.rooms || [])
      setTeachers(res.teachers || [])
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลครูที่ปรึกษาได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered Rooms
  const filteredRooms = React.useMemo(() => {
    return rooms.filter((r) => {
      // Grade filter
      if (selectedGrade && String(r.gradeLevel) !== selectedGrade) {
        return false
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const roomMatch = r.id.toLowerCase().includes(q)
        const advs = advisorsByRoom[r.id] || []
        const teacherMatch = advs.some(
          (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
        )
        return roomMatch || teacherMatch
      }
      return true
    })
  }, [rooms, selectedGrade, searchQuery, advisorsByRoom])

  const totalPages = Math.ceil(filteredRooms.length / pageSize) || 1
  const paginatedRooms = paginateArray(filteredRooms, currentPage, pageSize)

  // Open Add modal with defaults
  const handleOpenAddModal = (roomId?: string, order?: number) => {
    setAssignRoomId(roomId || '4.1')
    setAssignOrder(order || 1)
    setAssignName('')
    setAssignEmail('')
    setIsAddModalOpen(true)
  }

  // Handle Add/Assign Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignRoomId || !assignName.trim()) {
      toast.error('กรุณาระบุห้องเรียนและชื่อครูที่ปรึกษา')
      return
    }

    setIsSubmittingAssign(true)
    try {
      await fetchApi('/api/advisors', {
        method: 'POST',
        body: JSON.stringify({
          roomId: assignRoomId,
          advisorOrder: Number(assignOrder),
          name: assignName.trim(),
          email: assignEmail.trim()
        })
      })
      toast.success('มอบหมายครูที่ปรึกษาสำเร็จ')
      setIsAddModalOpen(false)
      loadData()
    } catch (err) {
      toast.error((err as Error).message || 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSubmittingAssign(false)
    }
  }

  // Open Edit Modal
  const handleOpenEditModal = (adv: AdvisorItem, roomId: string) => {
    setEditingAdvisorId(adv.id)
    setEditRoomId(roomId)
    setEditOrder(adv.order)
    setEditName(adv.name)
    setEditEmail(adv.email || '')
    setIsEditModalOpen(true)
  }

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAdvisorId || !editName.trim()) {
      return
    }

    setIsSubmittingEdit(true)
    try {
      await fetchApi(`/api/advisors/${editingAdvisorId}`, {
        method: 'PUT',
        body: JSON.stringify({
          roomId: editRoomId,
          advisorOrder: Number(editOrder),
          name: editName.trim(),
          email: editEmail.trim()
        })
      })
      toast.success('แก้ไขข้อมูลครูที่ปรึกษาสำเร็จ')
      setIsEditModalOpen(false)
      loadData()
    } catch (err) {
      toast.error((err as Error).message || 'แก้ไขไม่สำเร็จ')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Handle Delete Advisor
  const handleDeleteAdvisor = async () => {
    if (!deletingAdvisor) return

    setIsDeleting(true)
    try {
      await fetchApi(`/api/advisors/${deletingAdvisor.id}`, { method: 'DELETE' })
      toast.success('ลบครูที่ปรึกษาออกจากห้องสำเร็จ')
      setIsDeleteModalOpen(false)
      setDeletingAdvisor(null)
      loadData()
    } catch (err) {
      toast.error((err as Error).message || 'ลบไม่สำเร็จ')
    } finally {
      setIsDeleting(false)
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
      const res = await uploadFileApi<{ message: string }>('/api/advisors/import', uploadFile)
      toast.success(res.message || 'นำเข้าข้อมูลครูที่ปรึกษาสำเร็จ')
      setIsImportModalOpen(false)
      setUploadFile(null)
      loadData()
    } catch (err) {
      toast.error((err as Error).message || 'การนำเข้าไฟล์ล้มเหลว')
    } finally {
      setIsUploading(false)
    }
  }

  // Total Advisor Count
  const totalAssigned = React.useMemo(() => {
    return Object.values(advisorsByRoom).reduce((acc, list) => acc + list.length, 0)
  }, [advisorsByRoom])

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <DashboardShell
        title="จัดการข้อมูลครูที่ปรึกษา (Advisory Teachers)"
        description="กำหนดครูที่ปรึกษาประจำห้อง 45 ห้อง (1-3 ท่าน/ห้อง) โรงเรียนเตรียมอุดมศึกษาภาคเหนือ"
        badge={`${totalAssigned} ท่าน`}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">เพิ่มครูที่ปรึกษา</span>
              <span className="sm:hidden">เพิ่ม</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-brand-500" />
              <span className="hidden sm:inline">นำเข้าไฟล์</span>
            </button>
          </div>
        }
      >
      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหาชื่อครูที่ปรึกษา หรือเลขห้องเรียน (เช่น 4.1, 5.14)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>

            {/* Grade Level Filter */}
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              >
                <option value="">ทุกระดับชั้น (45 ห้อง)</option>
                <option value="4">มัธยมศึกษาปีที่ 4 (4.1 - 4.15)</option>
                <option value="5">มัธยมศึกษาปีที่ 5 (5.1 - 5.15)</option>
                <option value="6">มัธยมศึกษาปีที่ 6 (6.1 - 6.15)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 45 Rooms Advisory Teachers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedRooms.map((room) => {
            const advs = advisorsByRoom[room.id] || []
            const adv1 = advs.find((a) => a.order === 1)
            const adv2 = advs.find((a) => a.order === 2)
            const adv3 = advs.find((a) => a.order === 3)

            return (
              <div
                key={room.id}
                className="bg-card border border-border rounded-2xl p-4 shadow-xs hover:border-brand-500/30 transition-all space-y-3"
              >
                {/* Room Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                      ม.{room.id}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        ห้อง ม.{room.id}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        ชั้น ม.{room.gradeLevel} ห้อง {room.roomNumber}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                    {advs.length}/3 ท่าน
                  </span>
                </div>

                {/* Advisors Slots */}
                <div className="space-y-2 text-xs">
                  {/* Slot 1 */}
                  {adv1 ? (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                            คนที่ 1:
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {adv1.name}
                          </span>
                        </div>
                        {adv1.email && (
                          <div className="text-[10px] text-muted-foreground truncate pl-7">
                            {adv1.email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(adv1, room.id)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingAdvisor({ id: adv1.id, name: adv1.name, room: room.id })
                            setIsDeleteModalOpen(true)
                          }}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(room.id, 1)}
                      className="w-full p-2 rounded-xl border border-dashed border-border hover:border-brand-500/40 hover:bg-brand-50/20 text-muted-foreground hover:text-brand-600 transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มครูที่ปรึกษาคนที่ 1
                    </button>
                  )}

                  {/* Slot 2 */}
                  {adv2 ? (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                            คนที่ 2:
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {adv2.name}
                          </span>
                        </div>
                        {adv2.email && (
                          <div className="text-[10px] text-muted-foreground truncate pl-7">
                            {adv2.email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(adv2, room.id)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingAdvisor({ id: adv2.id, name: adv2.name, room: room.id })
                            setIsDeleteModalOpen(true)
                          }}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(room.id, 2)}
                      className="w-full p-2 rounded-xl border border-dashed border-border hover:border-brand-500/40 hover:bg-brand-50/20 text-muted-foreground hover:text-brand-600 transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มครูที่ปรึกษาคนที่ 2
                    </button>
                  )}

                  {/* Slot 3 */}
                  {adv3 ? (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                            คนที่ 3:
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {adv3.name}
                          </span>
                        </div>
                        {adv3.email && (
                          <div className="text-[10px] text-muted-foreground truncate pl-7">
                            {adv3.email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(adv3, room.id)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingAdvisor({ id: adv3.id, name: adv3.name, room: room.id })
                            setIsDeleteModalOpen(true)
                          }}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(room.id, 3)}
                      className="w-full p-2 rounded-xl border border-dashed border-border hover:border-brand-500/40 hover:bg-brand-50/20 text-muted-foreground hover:text-brand-600 transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มครูที่ปรึกษาคนที่ 3 (ถ้ามี)
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {filteredRooms.length === 0 && !isLoading && (
            <div className="col-span-full p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
              ไม่พบห้องเรียนหรือครูที่ปรึกษาตามเงื่อนไขที่ค้นหา
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredRooms.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredRooms.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[15, 30, 45]}
            />
          </div>
        )}
      </div>

      {/* Add / Assign Advisor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand-500 shrink-0" />
                เพิ่ม/มอบหมายครูที่ปรึกษา
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ห้องเรียน *</label>
                  <select
                    value={assignRoomId}
                    onChange={(e) => setAssignRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        ห้อง ม.{r.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ลำดับที่ปรึกษา *</label>
                  <select
                    value={assignOrder}
                    onChange={(e) => setAssignOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value={1}>คนที่ 1</option>
                    <option value={2}>คนที่ 2</option>
                    <option value={3}>คนที่ 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  ชื่อ - นามสกุลครูที่ปรึกษา *
                </label>
                <input
                  type="text"
                  placeholder="เช่น นางประภาพรรณ คำรังษี"
                  value={assignName}
                  onChange={(e) => {
                    const name = e.target.value
                    setAssignName(name)
                    const matched = teachers.find((t) => t.name === name)
                    if (matched && matched.email) {
                      setAssignEmail(matched.email)
                    }
                  }}
                  list="teacher-suggestions"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  required
                />
                <datalist id="teacher-suggestions">
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.email}
                    </option>
                  ))}
                </datalist>
                <p className="text-[10px] text-muted-foreground mt-1">
                  พิมพ์ชื่อครู หรือเลือกจากรายชื่อครูที่มีในระบบ (ระบบจะดึงอีเมลอัตโนมัติ)
                </p>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  อีเมลโรงเรียน (ถ้ามี)
                </label>
                <input
                  type="email"
                  placeholder="เช่น teacher@tn.ac.th"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmittingAssign ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Advisor Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500 shrink-0" />
                แก้ไขข้อมูลครูที่ปรึกษา
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ห้องเรียน</label>
                  <select
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        ห้อง ม.{r.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ลำดับที่ปรึกษา</label>
                  <select
                    value={editOrder}
                    onChange={(e) => setEditOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value={1}>คนที่ 1</option>
                    <option value={2}>คนที่ 2</option>
                    <option value={3}>คนที่ 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  ชื่อ - นามสกุล *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    const name = e.target.value
                    setEditName(name)
                    const matched = teachers.find((t) => t.name === name)
                    if (matched && matched.email) {
                      setEditEmail(matched.email)
                    }
                  }}
                  list="teacher-suggestions-edit"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  required
                />
                <datalist id="teacher-suggestions-edit">
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.email}
                    </option>
                  ))}
                </datalist>
                <p className="text-[10px] text-muted-foreground mt-1">
                  พิมพ์ชื่อครู หรือเลือกจากรายชื่อครูที่มีในระบบ (ระบบจะดึงอีเมลอัตโนมัติ)
                </p>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  อีเมลโรงเรียน
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
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
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingAdvisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 shrink-0" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-foreground">ยืนยันการลบครูที่ปรึกษา?</h3>
              <p className="text-xs text-muted-foreground">
                คุณแน่ใจหรือไม่ว่าต้องการถอดถอน{' '}
                <span className="font-bold text-foreground">{deletingAdvisor.name}</span>{' '}
                ออกจากการเป็นที่ปรึกษาห้อง ม.{deletingAdvisor.room}?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDeletingAdvisor(null)
                }}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteAdvisor}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-500 shrink-0" />
                นำเข้าบัญชีครูที่ปรึกษา (Excel / CSV)
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Template Download Section */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Download className="w-4 h-4 text-brand-500 shrink-0" />
                ดาวน์โหลดไฟล์ตัวอย่าง (Template)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ไฟล์แม่แบบตามโครงสร้างเดิมของเตรียมฯ เหนือ: ห้อง, ชื่อครูที่ปรึกษาคนที่ 1, ห้อง, ชื่อคนที่ 2, ห้อง, ชื่อคนที่ 3
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href="/api/templates/advisors.xlsx"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-xs transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  ดาวน์โหลด Excel (.xlsx) แนะนำ
                </a>
                <a
                  href="/api/templates/advisors"
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
                  id="importAdvisorFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="importAdvisorFileInput" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-brand-500 mx-auto" />
                  <div className="text-xs font-semibold text-foreground">
                    {uploadFile ? uploadFile.name : 'คลิกเพื่อเลือกไฟล์ Excel (.xlsx) หรือ CSV'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    รองรับไฟล์นามสกุล .xlsx, .xls, .csv
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
    </DashboardShell>
  </RoleGuard>
)
}
