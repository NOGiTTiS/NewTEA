'use client'

import * as React from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { RoleGuard } from '@/components/role-guard'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { fetchApi } from '@/lib/api'
import { compareRooms, sortRooms } from '@/lib/utils'
import {
  DoorOpen,
  Plus,
  Trash2,
  Users,
  UserCheck,
  Search,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  X,
  Layers,
  GraduationCap
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface RoomItem {
  id: string
  gradeLevel: number
  roomNumber: number
  studentCount: number
  advisorCount: number
  createdAt?: string
}

export default function RoomsManagementPage() {
  const [rooms, setRooms] = React.useState<RoomItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Filters
  const [selectedGrade, setSelectedGrade] = React.useState<string>('ALL')
  const [searchQuery, setSearchQuery] = React.useState<string>('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(15)

  // Add Room Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [newGradeLevel, setNewGradeLevel] = React.useState<number>(4)
  const [newRoomNumber, setNewRoomNumber] = React.useState<number>(16)
  const [isSubmittingAdd, setIsSubmittingAdd] = React.useState(false)

  // Delete Room Modal State
  const [deletingRoom, setDeletingRoom] = React.useState<RoomItem | null>(null)
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false)

  // Load Rooms
  const loadRooms = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchApi<{ total: number, rooms: RoomItem[] }>('/api/rooms')
      if (res && res.rooms) {
        // Natural sort by grade and room number
        const sorted = [...res.rooms].sort((a, b) => compareRooms(a.id, b.id))
        setRooms(sorted)
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลห้องเรียนได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadRooms()
  }, [loadRooms])

  // Suggest next room number when grade changes
  React.useEffect(() => {
    const gradeRooms = rooms.filter((r) => r.gradeLevel === newGradeLevel)
    if (gradeRooms.length > 0) {
      const maxRoomNum = Math.max(...gradeRooms.map((r) => r.roomNumber))
      setNewRoomNumber(maxRoomNum + 1)
    } else {
      setNewRoomNumber(1)
    }
  }, [newGradeLevel, rooms])

  // Handle Add Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newRoomNumber < 1 || newRoomNumber > 99) {
      toast.error('เลขที่ห้องเรียนต้องอยู่ระหว่าง 1 ถึง 99')
      return
    }

    const roomId = `${newGradeLevel}.${newRoomNumber}`
    if (rooms.some((r) => r.id === roomId)) {
      toast.error(`ห้องเรียน ม.${roomId} มีอยู่ในระบบแล้ว`)
      return
    }

    setIsSubmittingAdd(true)
    try {
      await fetchApi('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          gradeLevel: newGradeLevel,
          roomNumber: newRoomNumber
        })
      })

      toast.success(`เปิดห้องเรียน ม.${roomId} เรียบร้อยแล้ว`)
      setIsAddModalOpen(false)
      loadRooms()
    } catch (err) {
      toast.error((err as Error).message || 'ไม่สามารถสร้างห้องเรียนได้')
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Handle Delete Room
  const handleDeleteRoom = async () => {
    if (!deletingRoom) return
    setIsSubmittingDelete(true)
    try {
      await fetchApi(`/api/rooms/${deletingRoom.id}`, {
        method: 'DELETE'
      })

      toast.success(`ลบห้องเรียน ม.${deletingRoom.id} สำเร็จ`)
      setDeletingRoom(null)
      loadRooms()
    } catch (err) {
      toast.error((err as Error).message || 'ไม่สามารถลบห้องเรียนได้')
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  // Filtered rooms
  const filteredRooms = React.useMemo(() => {
    return rooms.filter((room) => {
      if (selectedGrade !== 'ALL' && room.gradeLevel.toString() !== selectedGrade) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchId = room.id.toLowerCase().includes(q)
        const matchNum = room.roomNumber.toString().includes(q)
        return matchId || matchNum
      }
      return true
    })
  }, [rooms, selectedGrade, searchQuery])

  // Pagination
  const paginatedRooms = React.useMemo(() => {
    return paginateArray(filteredRooms, currentPage, pageSize)
  }, [filteredRooms, currentPage, pageSize])

  // Summary counts
  const m4Rooms = rooms.filter((r) => r.gradeLevel === 4)
  const m5Rooms = rooms.filter((r) => r.gradeLevel === 5)
  const m6Rooms = rooms.filter((r) => r.gradeLevel === 6)
  const totalStudents = rooms.reduce((acc, r) => acc + (r.studentCount || 0), 0)

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <DashboardShell
        title="จัดการห้องเรียน (Classrooms)"
        description="บริหารจัดการโครงสร้างห้องเรียน (เปิดห้องเรียนเพิ่ม หรือลดห้องเรียน) โรงเรียนเตรียมอุดมศึกษาภาคเหนือ"
        badge={`${rooms.length} ห้องเรียน`}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">เปิดห้องเรียนใหม่</span>
              <span className="sm:hidden">เพิ่มห้อง</span>
            </button>
          </div>
        }
      >
        {/* Stat Cards Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>ห้องเรียนทั้งหมด</span>
              <DoorOpen className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {rooms.length} <span className="text-xs font-normal text-muted-foreground">ห้อง</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              นักเรียนทั้งหมด {totalStudents.toLocaleString()} คน
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>มัธยมศึกษาปีที่ 4</span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                ม.4
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {m4Rooms.length} <span className="text-xs font-normal text-muted-foreground">ห้อง</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              นร. {m4Rooms.reduce((acc, r) => acc + (r.studentCount || 0), 0)} คน
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>มัธยมศึกษาปีที่ 5</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                ม.5
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {m5Rooms.length} <span className="text-xs font-normal text-muted-foreground">ห้อง</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              นร. {m5Rooms.reduce((acc, r) => acc + (r.studentCount || 0), 0)} คน
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>มัธยมศึกษาปีที่ 6</span>
              <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                ม.6
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {m6Rooms.length} <span className="text-xs font-normal text-muted-foreground">ห้อง</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              นร. {m6Rooms.reduce((acc, r) => acc + (r.studentCount || 0), 0)} คน
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-card border border-border p-3.5 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap mr-1">ระดับชั้น:</span>
            {[
              { id: 'ALL', label: `ทั้งหมด (${rooms.length})` },
              { id: '4', label: `ม.4 (${m4Rooms.length})` },
              { id: '5', label: `ม.5 (${m5Rooms.length})` },
              { id: '6', label: `ม.6 (${m6Rooms.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedGrade(tab.id)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedGrade === tab.id
                    ? 'bg-brand-500 text-white shadow-2xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาห้องเรียน เช่น 4.1 หรือ 16..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>

        {/* Room Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">รหัสห้องเรียน</th>
                  <th className="px-4 py-3">ระดับชั้น</th>
                  <th className="px-4 py-3">เลขที่ห้อง</th>
                  <th className="px-4 py-3">นักเรียนในห้อง (Active)</th>
                  <th className="px-4 py-3">ครูที่ปรึกษา</th>
                  <th className="px-4 py-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      กำลังโหลดข้อมูลห้องเรียน...
                    </td>
                  </tr>
                ) : paginatedRooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      ไม่พบห้องเรียนที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  paginatedRooms.map((room) => {
                    const hasStudents = room.studentCount > 0
                    return (
                      <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold font-mono">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20 text-xs">
                            <DoorOpen className="w-3.5 h-3.5" />
                            ม.{room.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          มัธยมศึกษาปีที่ {room.gradeLevel}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          ห้อง {room.roomNumber}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/students?room_id=${room.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-background border border-border hover:border-brand-500/40 text-foreground font-medium transition-all group"
                          >
                            <Users className="w-3.5 h-3.5 text-muted-foreground group-hover:text-brand-500" />
                            <span>{room.studentCount} คน</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href="/admin/advisors"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-background border border-border hover:border-brand-500/40 text-foreground font-medium transition-all group"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-muted-foreground group-hover:text-brand-500" />
                            <span>{room.advisorCount} ท่าน</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={hasStudents}
                            onClick={() => setDeletingRoom(room)}
                            title={hasStudents ? 'มีนักเรียนสังกัดอยู่ ไม่สามารถลบได้' : 'ลบห้องเรียนนี้'}
                            className={`p-1.5 rounded-lg border transition-all ${
                              hasStudents
                                ? 'opacity-40 border-border text-muted-foreground cursor-not-allowed'
                                : 'border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-border">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredRooms.length / pageSize) || 1}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setCurrentPage(1)
              }}
              totalItems={filteredRooms.length}
              pageSizeOptions={[15, 30, 45, 60]}
            />
          </div>
        </div>

        {/* Helpful SOP Notice */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <AlertCircle className="w-4 h-4 text-brand-500 shrink-0" />
            <span>คำแนะนำการเปิดหรือลดห้องเรียน (Standard Operating Procedure)</span>
          </div>
          <p className="leading-relaxed">
            • <strong>กรณีเปิดห้องเรียนเพิ่ม:</strong> กดปุ่ม &quot;เปิดห้องเรียนใหม่&quot; ด้านบน หรืออัปโหลดไฟล์ Excel บัญชีนักเรียนที่มีเลขห้องใหม่ในหน้า <Link href="/admin/students" className="text-brand-600 underline">บัญชีนักเรียน</Link> ซึ่งระบบจะสร้างห้องให้อัตโนมัติทันที
          </p>
          <p className="leading-relaxed">
            • <strong>กรณีลด/ยุบห้องเรียน:</strong> เพื่อความปลอดภัยของฐานข้อมูล ระบบจะ<strong>บล็อกไม่อนุญาตให้ลบห้อง</strong>หากยังมีนักเรียนค้างอยู่ในห้องนั้น ให้เข้าไปย้ายนักเรียนหรือปรับสถานะนักเรียนก่อนเสมอ
          </p>
        </div>

        {/* Modal: Add Room */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">เปิดห้องเรียนใหม่</h3>
                    <p className="text-xs text-muted-foreground">เพิ่มโครงสร้างห้องเรียนเข้าสู่ระบบฐานข้อมูล NewTEA</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-5 h-5 shrink-0" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-1.5 text-xs">
                  <label className="block text-foreground font-semibold">เลือกระดับชั้น</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[4, 5, 6].map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setNewGradeLevel(grade)}
                        className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                          newGradeLevel === grade
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        มัธยมศึกษาปีที่ {grade}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="block text-foreground font-semibold">
                    เลขที่ห้องเรียน (1 - 99)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">รหัสห้องที่จะถูกสร้าง:</span>
                  <span className="font-bold font-mono text-brand-600 dark:text-brand-400 text-sm">
                    ม.{newGradeLevel}.{newRoomNumber}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isSubmittingAdd}
                    className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdd}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-xs transition-all active:scale-98 disabled:opacity-50"
                  >
                    {isSubmittingAdd ? 'กำลังบันทึก...' : 'ยืนยันเปิดห้องเรียน'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Room Confirmation */}
        {deletingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-base">ยืนยันการลบห้องเรียน</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingRoom(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-5 h-5 shrink-0" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <p>
                  คุณกำลังจะลบห้องเรียน{' '}
                  <span className="font-bold font-mono text-foreground text-sm">ม.{deletingRoom.id}</span>{' '}
                  ออกจากระบบฐานข้อมูล
                </p>

                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                  <p className="font-semibold">• ห้องนี้ไม่มีนักเรียนสังกัดอยู่ (0 คน)</p>
                  <p>• การลบห้องจะปลดการแต่งตั้งครูที่ปรึกษาประจำห้องนี้ออกโดยอัตโนมัติ</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingRoom(null)}
                  disabled={isSubmittingDelete}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  disabled={isSubmittingDelete}
                  className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold shadow-xs transition-all active:scale-98 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {isSubmittingDelete ? 'กำลังดำเนินการ...' : `ยืนยันลบห้อง ม.${deletingRoom.id}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
    </RoleGuard>
  )
}
