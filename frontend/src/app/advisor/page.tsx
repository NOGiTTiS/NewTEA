'use client'

import * as React from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { fetchApi } from '@/lib/api'
import {
  Users,
  Search,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  BookOpen,
  Award,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface RoomAdvisor {
  id: string
  roomId: string
  advisorOrder: number
  user: {
    name: string
    email: string
  }
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
}

interface RoomDashboardData {
  room: {
    id: string
    gradeLevel: number
    roomNumber: number
  }
  advisors: RoomAdvisor[]
  totalStudents: number
  activeStudents: number
  languageGroups: Record<string, number>
  electiveGroups: Record<string, number>
  students: Student[]
}

const DEFAULT_45_ROOMS = [
  '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12', '4.13', '4.14', '4.15',
  '5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9', '5.10', '5.11', '5.12', '5.13', '5.14', '5.15',
  '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8', '6.9', '6.10', '6.11', '6.12', '6.13', '6.14', '6.15'
]

export default function AdvisorDashboardPage() {
  const [assignedRooms, setAssignedRooms] = React.useState<string[]>([])
  const [allRooms, setAllRooms] = React.useState<string[]>(DEFAULT_45_ROOMS)
  const [selectedRoom, setSelectedRoom] = React.useState<string>('4.1')
  const [dashboardData, setDashboardData] = React.useState<RoomDashboardData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  // Load available rooms (45 rooms and advisor's assigned rooms)
  React.useEffect(() => {
    fetchApi<{ rooms?: string[], assignedRooms?: string[], allRooms?: string[] }>('/api/advisor/my-rooms')
      .then((res) => {
        const full = res.allRooms && res.allRooms.length > 0 ? res.allRooms : (res.rooms && res.rooms.length > 0 ? res.rooms : DEFAULT_45_ROOMS)
        const assigned = res.assignedRooms || []
        setAllRooms(full)
        setAssignedRooms(assigned)
        if (assigned.length > 0 && !assigned.includes(selectedRoom)) {
          setSelectedRoom(assigned[0])
        }
      })
      .catch(() => {
        // Fallback to rooms endpoint or default
        fetchApi<{ rooms: { id: string }[] }>('/api/rooms')
          .then((data) => {
            if (data.rooms && data.rooms.length > 0) {
              setAllRooms(data.rooms.map((r) => r.id))
            }
          })
          .catch(() => {
            setAllRooms(DEFAULT_45_ROOMS)
          })
      })
  }, [selectedRoom])

  // Load Room Dashboard
  const loadRoomData = React.useCallback(() => {
    if (!selectedRoom) return

    setIsLoading(true)
    fetchApi<RoomDashboardData>(`/api/advisor/room/${selectedRoom}`)
      .then((data) => {
        setDashboardData(data)
      })
      .catch(() => {
        toast.error('ไม่สามารถโหลดข้อมูลห้องเรียนได้')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [selectedRoom])

  React.useEffect(() => {
    loadRoomData()
  }, [loadRoomData])

  // Filtered Students
  const filteredStudents = React.useMemo(() => {
    if (!dashboardData) return []
    if (!searchQuery) return dashboardData.students

    const q = searchQuery.toLowerCase()
    return dashboardData.students.filter(
      (s) =>
        s.studentId.includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)
    )
  }, [dashboardData, searchQuery])

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1
  const paginatedStudents = paginateArray(filteredStudents, currentPage, pageSize)

  return (
    <DashboardShell
      title="แดชบอร์ดครูที่ปรึกษา"
      description="ข้อมูลภาพรวมนักเรียนในความดูแลและที่ปรึกษาประจำห้อง"
      badge={`ห้อง ม.${selectedRoom}`}
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={loadRoomData}
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
        {/* Room Switcher Bar */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
              เลือกห้องเรียน:
            </span>
            <select
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-background border border-border text-brand-600 dark:text-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all cursor-pointer"
            >
              {assignedRooms.length > 0 && (
                <optgroup label="★ ห้องในความดูแลของท่าน">
                  {assignedRooms.map((r) => (
                    <option key={`my-${r}`} value={r}>
                      ★ ห้อง ม.{r} (ห้องที่ปรึกษา)
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="มัธยมศึกษาปีที่ 4 (4.1 - 4.15)">
                {allRooms
                  .filter((r) => r.startsWith('4.'))
                  .map((r) => (
                    <option key={r} value={r}>
                      ห้อง ม.{r}
                    </option>
                  ))}
              </optgroup>

              <optgroup label="มัธยมศึกษาปีที่ 5 (5.1 - 5.15)">
                {allRooms
                  .filter((r) => r.startsWith('5.'))
                  .map((r) => (
                    <option key={r} value={r}>
                      ห้อง ม.{r}
                    </option>
                  ))}
              </optgroup>

              <optgroup label="มัธยมศึกษาปีที่ 6 (6.1 - 6.15)">
                {allRooms
                  .filter((r) => r.startsWith('6.'))
                  .map((r) => (
                    <option key={r} value={r}>
                      ห้อง ม.{r}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Advisory Teachers Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              ครูที่ปรึกษาประจำห้อง:
            </span>
            {dashboardData?.advisors && dashboardData.advisors.length > 0 ? (
              dashboardData.advisors.map((adv) => (
                <span
                  key={adv.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-muted border border-border text-xs text-foreground font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                  {adv.user.name}
                  <span className="text-[10px] text-muted-foreground">
                    (คนที่ {adv.advisorOrder})
                  </span>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">ยังไม่มีข้อมูลครูที่ปรึกษา</span>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">นักเรียนทั้งหมด</span>
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {dashboardData?.totalStudents ?? 0}{' '}
              <span className="text-xs font-normal text-muted-foreground">คน</span>
            </div>
          </div>

          {/* Card 2: Active */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">สถานะปกติ</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {dashboardData?.activeStudents ?? 0}{' '}
              <span className="text-xs font-normal text-muted-foreground">คน</span>
            </div>
          </div>

          {/* Card 3: Other Status */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">ย้าย/ลาออก</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {(dashboardData?.totalStudents ?? 0) - (dashboardData?.activeStudents ?? 0)}{' '}
              <span className="text-xs font-normal text-muted-foreground">คน</span>
            </div>
          </div>

          {/* Card 4: Languages count */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">ภาษาที่ 3</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {Object.keys(dashboardData?.languageGroups ?? {}).length}{' '}
              <span className="text-xs font-normal text-muted-foreground">กลุ่มภาษา</span>
            </div>
          </div>
        </div>

        {/* Group Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Language Groups */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
              จำแนกตามภาษาที่ 3 (แผนการเรียน)
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {dashboardData?.languageGroups &&
              Object.keys(dashboardData.languageGroups).length > 0 ? (
                Object.entries(dashboardData.languageGroups).map(([lang, count]) => (
                  <div
                    key={lang}
                    className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-3 flex-1 min-w-[140px]"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-foreground">{lang}</div>
                      <div className="text-[11px] text-muted-foreground">{count} คน</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic p-2">ไม่มีข้อมูลภาษาที่ 3</div>
              )}
            </div>
          </div>

          {/* Elective Groups */}
          <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-500 shrink-0" />
              จำแนกตามกลุ่มวิชาเลือกเฉพาะ
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {dashboardData?.electiveGroups &&
              Object.keys(dashboardData.electiveGroups).length > 0 ? (
                Object.entries(dashboardData.electiveGroups).map(([elec, count]) => (
                  <div
                    key={elec}
                    className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-3 flex-1 min-w-[140px]"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-foreground">{elec}</div>
                      <div className="text-[11px] text-muted-foreground">{count} คน</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic p-2">ไม่มีข้อมูลวิชาเลือกเฉพาะ</div>
              )}
            </div>
          </div>
        </div>

        {/* Student Roster Section */}
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-500 shrink-0" />
                รายชื่อนักเรียนห้อง ม.{selectedRoom}
              </h3>
              <p className="text-xs text-muted-foreground">
                แสดงผลทั้งหมด {filteredStudents.length} คน
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหารหัส หรือชื่อนักเรียน..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">เลขที่</th>
                  <th className="px-4 py-2.5 font-semibold">รหัสนักเรียน</th>
                  <th className="px-4 py-2.5 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="px-4 py-2.5 font-semibold">ภาษาที่ 3</th>
                  <th className="px-4 py-2.5 font-semibold">วิชาเลือก</th>
                  <th className="px-4 py-2.5 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-brand-600 dark:text-brand-400">
                      #{s.seatNo}
                    </td>
                    <td className="px-4 py-2.5 font-mono">{s.studentId}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {s.prefix} {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.languageGroup ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {s.languageGroup}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.electiveGroup ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          {s.electiveGroup}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : s.status === 'TRANSFERRED'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {s.status === 'ACTIVE' && 'ปกติ'}
                        {s.status === 'TRANSFERRED' && 'ย้ายห้อง'}
                        {s.status === 'RESIGNED' && 'พ้นสภาพ'}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredStudents.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลนักเรียนในห้องนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredStudents.length > 0 && (
            <div className="pt-3 border-t border-border">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredStudents.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
