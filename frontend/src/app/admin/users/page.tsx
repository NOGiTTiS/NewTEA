'use client'

import * as React from 'react'
import { fetchApi, uploadFileApi } from '@/lib/api'
import { RoleGuard } from '@/components/role-guard'
import { DashboardShell } from '@/components/dashboard-shell'
import { Pagination } from '@/components/pagination'
import { paginateArray } from '@/lib/pagination'
import { useSession } from '@/lib/auth-client'
import {
  Users,
  Shield,
  Search,
  Filter,
  Check,
  AlertCircle,
  GraduationCap,
  Sparkles,
  BookOpen,
  UserCheck,
  ShieldAlert,
  Building,
  RefreshCw,
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  X,
  Lock,
  Mail,
  User as UserIcon,
  HelpCircle,
  Upload,
  Download,
  FileSpreadsheet,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  department: string
  advisorRooms?: string[]
  createdAt?: string
}

interface UserListResponse {
  users: UserItem[]
  total: number
  roleStats: Record<string, number>
  adminCount: number
}

const ROLE_OPTIONS = [
  { value: 'TEACHER', label: 'ครูผู้สอน (TEACHER)', color: 'text-muted-foreground bg-muted border-border' },
  { value: 'ADVISOR', label: 'ครูที่ปรึกษา (ADVISOR)', color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' },
  { value: 'DEPT_HEAD', label: 'หัวหน้ากลุ่มสาระฯ (DEPT_HEAD)', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  { value: 'ACADEMIC', label: 'ฝ่ายวิชาการ (ACADEMIC)', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  { value: 'ADMIN', label: 'ผู้ดูแลระบบ (ADMIN)', color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800' }
]

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

export default function UserManagementPage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const currentUserEmail = session?.user?.email

  const [users, setUsers] = React.useState<UserItem[]>([])
  const [roleStats, setRoleStats] = React.useState<Record<string, number>>({})
  const [adminCount, setAdminCount] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [selectedRole, setSelectedRole] = React.useState<string>('ALL')
  const [selectedDept, setSelectedDept] = React.useState<string>('ALL')
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<UserItem | null>(null)
  const [resetTarget, setResetTarget] = React.useState<UserItem | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<UserItem | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false)
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [importResult, setImportResult] = React.useState<{
    totalProcessed: number
    createdCount: number
    updatedCount: number
    errors: string[]
  } | null>(null)

  // Form states
  const [createForm, setCreateForm] = React.useState({
    name: '',
    email: '',
    role: 'TEACHER',
    department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    password: 'Tunorth@2026'
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [editForm, setEditForm] = React.useState({
    name: '',
    email: '',
    role: 'TEACHER',
    department: ''
  })

  const [resetPasswordValue, setResetPasswordValue] = React.useState('Tunorth@2026')

  const loadUsers = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (selectedRole !== 'ALL') params.set('role', selectedRole)
      if (selectedDept !== 'ALL') params.set('department', selectedDept)

      const queryStr = params.toString() ? `?${params.toString()}` : ''
      const res = await fetchApi<UserListResponse>(`/api/users${queryStr}`)
      setUsers(res.users || [])
      setRoleStats(res.roleStats || {})
      setAdminCount(res.adminCount || 0)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedRole, selectedDept])

  React.useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Quick inline role change
  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId)
    try {
      await fetchApi<{ message: string; user: UserItem }>(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      })
      toast.success('อัปเดตสิทธิ์ผู้ใช้เรียบร้อยแล้ว')
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
      loadUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์'
      toast.error(message)
    } finally {
      setUpdatingId(null)
    }
  }

  // Quick inline department change
  const handleDeptChange = async (userId: string, newDept: string) => {
    setUpdatingId(userId)
    try {
      await fetchApi<{ message: string; user: UserItem }>(`/api/users/${userId}/department`, {
        method: 'PATCH',
        body: JSON.stringify({ department: newDept })
      })
      toast.success('อัปเดตกลุ่มสาระการเรียนรู้เรียบร้อยแล้ว')
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, department: newDept } : u))
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปเดตกลุ่มสาระฯ'
      toast.error(message)
    } finally {
      setUpdatingId(null)
    }
  }

  // Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error('กรุณาระบุชื่อ-นามสกุล และอีเมลให้ครบถ้วน')
      return
    }
    if (createForm.password.length < 8) {
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร')
      return
    }

    setIsSubmitting(true)
    try {
      await fetchApi('/api/users', {
        method: 'POST',
        body: JSON.stringify(createForm)
      })
      toast.success(`สร้างบัญชีผู้ใช้ ${createForm.name} สำเร็จเรียบร้อย`)
      setIsCreateOpen(false)
      setCreateForm({
        name: '',
        email: '',
        role: 'TEACHER',
        department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
        password: 'Tunorth@2026'
      })
      loadUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างผู้ใช้'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Edit Modal
  const openEditModal = (user: UserItem) => {
    setEditTarget(user)
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || ''
    })
  }

  // Update User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return

    setIsSubmitting(true)
    try {
      await fetchApi(`/api/users/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      })
      toast.success('บันทึกการแก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว')
      setEditTarget(null)
      loadUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    if (resetPasswordValue.length < 8) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร')
      return
    }

    setIsSubmitting(true)
    try {
      await fetchApi(`/api/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPasswordValue })
      })
      toast.success(`รีเซ็ตรหัสผ่านสำหรับ ${resetTarget.name} สำเร็จ`)
      setResetTarget(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete User Submit
  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return

    setIsSubmitting(true)
    try {
      await fetchApi(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE'
      })
      toast.success(`ลบบัญชี ${deleteTarget.name} เรียบร้อยแล้ว`)
      setDeleteTarget(null)
      loadUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบบัญชี'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle File Upload Import
  const handleImportUsers = async () => {
    if (!uploadFile) {
      toast.error('กรุณาเลือกไฟล์เพื่ออัปโหลด')
      return
    }

    setIsUploading(true)
    setImportResult(null)
    try {
      const res = await uploadFileApi<{
        message: string
        result: {
          totalProcessed: number
          createdCount: number
          updatedCount: number
          errors: string[]
        }
      }>('/api/users/import', uploadFile)

      toast.success(res.message || 'นำเข้าข้อมูลผู้ใช้สำเร็จ')
      if (res.result?.errors && res.result.errors.length > 0) {
        setImportResult(res.result)
      } else {
        setIsImportModalOpen(false)
        setUploadFile(null)
      }
      loadUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'การนำเข้าไฟล์ล้มเหลว'
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  // Generate random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
    let result = 'Tn@'
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const getRoleBadge = (role: string) => {
    const opt = ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[0]
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${opt.color}`}
      >
        <Shield className="w-3 h-3" />
        {opt.label.split(' ')[0]}
      </span>
    )
  }

  const totalPages = Math.ceil(users.length / pageSize) || 1
  const paginatedUsers = paginateArray(users, currentPage, pageSize)

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <DashboardShell
        title="จัดการบัญชีผู้ใช้และกำหนดสิทธิ์ (RBAC)"
        description="กำหนดบทบาทครูผู้สอน หัวหน้ากลุ่มสาระฯ ฝ่ายวิชาการ และผู้ดูแลระบบ NewTEA"
        badge={`${users.length} บัญชี`}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={loadUsers}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">รีเฟรช</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(true)
                setUploadFile(null)
                setImportResult(null)
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
              title="นำเข้าไฟล์ Excel/CSV"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500 shrink-0" />
              <span className="hidden sm:inline">นำเข้าไฟล์</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-xs font-semibold text-white shadow-xs shadow-brand-500/25 transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline">เพิ่มผู้ใช้</span>
              <span className="xs:hidden">เพิ่ม</span>
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Role Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('ALL')
                setCurrentPage(1)
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedRole === 'ALL'
                  ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 ring-1 ring-brand-500'
                  : 'border-border bg-card hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">ผู้ใช้ทั้งหมด</span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-foreground tracking-tight">
                {users.length}
              </div>
            </button>

            {ROLE_OPTIONS.map((opt) => {
              const count = roleStats[opt.value] || 0
              const isSelected = selectedRole === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedRole(opt.value)
                    setCurrentPage(1)
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 ring-1 ring-brand-500'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {opt.value}
                    </span>
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-foreground tracking-tight">
                    {count}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Search and Filters Bar */}
          <div className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="ค้นหาชื่อผู้ใช้ หรืออีเมล (@tn.ac.th)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <div className="flex items-center gap-2 min-w-[200px]">
                <Building className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                >
                  <option value="ALL">กลุ่มสาระการเรียนรู้ทั้งหมด</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {(search || selectedRole !== 'ALL' || selectedDept !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setSelectedRole('ALL')
                    setSelectedDept('ALL')
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="border border-border rounded-3xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4 min-w-[220px]">ชื่อ - นามสกุล / อีเมล</th>
                    <th className="py-3.5 px-4 min-w-[200px]">กลุ่มสาระการเรียนรู้</th>
                    <th className="py-3.5 px-4 min-w-[170px]">บทบาทและสิทธิ์ (Role)</th>
                    <th className="py-3.5 px-4 text-right min-w-[120px]">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                        <span>กำลังโหลดข้อมูลผู้ใช้...</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <span>ไม่พบข้อมูลผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u, idx) => {
                      const isSelf = u.id === currentUserId || u.email === currentUserEmail
                      const isLastAdmin = u.role === 'ADMIN' && adminCount <= 1
                      const isRowUpdating = updatingId === u.id
                      const globalIdx = (currentPage - 1) * pageSize + idx + 1

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isSelf ? 'bg-brand-50/20 dark:bg-brand-950/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center text-muted-foreground font-mono">
                            {globalIdx}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded-md bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-[10px] font-bold">
                                  คุณ
                                </span>
                              )}
                              {u.advisorRooms && u.advisorRooms.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-semibold">
                                  <UserCheck className="w-3 h-3" />
                                  ที่ปรึกษา {u.advisorRooms.map((r) => `ม.${r}`).join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="font-mono">{u.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={u.department || ''}
                              onChange={(e) => handleDeptChange(u.id, e.target.value)}
                              disabled={isRowUpdating}
                              className="w-full max-w-[240px] px-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer disabled:opacity-50"
                            >
                              <option value="">-- ยังไม่ได้ระบุ --</option>
                              {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={isRowUpdating}
                              className="px-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer disabled:opacity-50"
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTarget(u)
                                  setResetPasswordValue('Tunorth@2026')
                                }}
                                className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                title="รีเซ็ตรหัสผ่าน"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit User Info */}
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                title="แก้ไขข้อมูลผู้ใช้"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete User */}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                disabled={isSelf || isLastAdmin}
                                className="p-1.5 rounded-lg border border-border bg-card hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={
                                  isSelf
                                    ? 'ไม่สามารถลบบัญชีของตนเองได้'
                                    : isLastAdmin
                                    ? 'ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้'
                                    : 'ลบบัญชีผู้ใช้'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col gap-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={users.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
              <div className="flex items-center justify-end text-xs text-muted-foreground pt-2 border-t border-border/50">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-brand-500" />
                  <span>ผู้ดูแลระบบ (ADMIN) ในระบบ: <strong>{adminCount}</strong> ท่าน</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Create User */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">เพิ่มผู้ใช้งานใหม่</h3>
                    <p className="text-xs text-muted-foreground">สร้างบัญชีครูหรือบุคลากรในระบบ NewTEA</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    ชื่อ - นามสกุล (เช่น นายสมชาย ใจดี)
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="ระบุชื่อและนามสกุล"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    อีเมลโรงเรียน (@tn.ac.th)
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="teacher@tn.ac.th"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      บทบาทและสิทธิ์ (Role)
                    </label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-muted-foreground" />
                      กลุ่มสาระการเรียนรู้
                    </label>
                    <select
                      value={createForm.department}
                      onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัวอักษร)
                    </label>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, password: generateRandomPassword() })}
                      className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                    >
                      สุ่มรหัสผ่าน
                    </button>
                  </div>
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    minLength={8}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    ผู้ใช้สามารถใช้รหัสผ่านนี้เข้าสู่ระบบ หรือล็อกอินผ่าน Google SSO ด้วยอีเมลโรงเรียน
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? 'กำลังสร้าง...' : 'สร้างบัญชีผู้ใช้'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit User */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">แก้ไขข้อมูลผู้ใช้</h3>
                    <p className="text-xs text-muted-foreground">ปรับปรุงข้อมูลบัญชีและบทบาทการใช้งาน</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    ชื่อ - นามสกุล
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    อีเมล (@tn.ac.th)
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      บทบาทและสิทธิ์ (Role)
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-muted-foreground" />
                      กลุ่มสาระการเรียนรู้
                    </label>
                    <select
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reset Password */}
        {resetTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">รีเซ็ตรหัสผ่าน</h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                      สำหรับ {resetTarget.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border text-xs space-y-1">
                  <div className="text-muted-foreground">ผู้ใช้งาน:</div>
                  <div className="font-semibold text-foreground">{resetTarget.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{resetTarget.email}</div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetPasswordValue(generateRandomPassword())}
                      className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                    >
                      สุ่มรหัสผ่าน
                    </button>
                  </div>
                  <input
                    type="text"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    minLength={8}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setResetTarget(null)}
                    className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-semibold text-white shadow-sm shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรีเซ็ตรหัสผ่าน'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">ยืนยันการลบบัญชีผู้ใช้</h3>
                  <p className="text-xs text-muted-foreground">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-xs space-y-1.5">
                <div className="font-semibold text-foreground">{deleteTarget.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{deleteTarget.email}</div>
                <div className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                  ระบบจะลบบัญชีผู้ใช้ สิทธิ์การเข้าถึง เซสชัน และข้อมูลการเป็นครูที่ปรึกษาของผู้ใช้นี้อย่างถาวร
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-sm shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? 'กำลังลบ...' : 'ยืนยันลบบัญชี'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Import Users (Excel / CSV) */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">
                      นำเข้าข้อมูลผู้ใช้และครูผู้สอน (Excel / CSV)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      อัปโหลดไฟล์รายชื่อครูและบุคลากรเพื่อสร้างหรืออัปเดตบัญชีผู้ใช้ในคราวเดียว
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
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
                  หัวตารางที่รองรับ: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">name</code>, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">email</code>, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">department</code>, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">role</code>, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">password</code> (รองรับภาษาไทย)
                </p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <a
                    href="/api/templates/users.xlsx"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-xs transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    ดาวน์โหลด Excel (.xlsx) แนะนำ
                  </a>
                  <a
                    href="/api/templates/users"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-card text-foreground font-medium text-[11px] transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                    ดาวน์โหลด CSV (UTF-8)
                  </a>
                </div>
              </div>

              {/* File Drag / Select */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">เลือกไฟล์ที่ต้องการนำเข้า</label>
                <div className="border-2 border-dashed border-border hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-background">
                  <input
                    type="file"
                    id="importUserFileInput"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      setUploadFile(e.target.files?.[0] || null)
                      setImportResult(null)
                    }}
                    className="hidden"
                  />
                  <label htmlFor="importUserFileInput" className="cursor-pointer space-y-2 block">
                    <Upload className="w-8 h-8 text-brand-500 mx-auto" />
                    <div className="text-xs font-semibold text-foreground">
                      {uploadFile ? uploadFile.name : 'คลิกเพื่อเลือกไฟล์ Excel (.xlsx) หรือ CSV'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      รองรับไฟล์นามสกุล .xlsx, .xls, .csv (ขนาดไม่เกิน 10MB)
                    </div>
                  </label>
                </div>
              </div>

              {/* Notes & Guide */}
              <div className="p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/50 dark:border-brand-900/40 text-[11px] text-muted-foreground space-y-1">
                <div className="font-semibold text-brand-700 dark:text-brand-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  ข้อแนะนำการนำเข้าข้อมูล:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                  <li>หากพบอีเมลเดิมในระบบ ระบบจะอัปเดตชื่อ กลุ่มสาระฯ และสิทธิ์ให้ โดยไม่เขียนทับรหัสผ่านเดิม</li>
                  <li>หากไม่ระบุรหัสผ่าน ระบบจะตั้งรหัสผ่านเริ่มต้นเป็น <code className="font-mono text-[10px] px-1 bg-muted rounded">Tunorth@2026</code> ให้อัตโนมัติ</li>
                  <li>ผู้ใช้สามารถเข้าสู่ระบบผ่าน Google Workspace (@tn.ac.th) หรืออีเมลและรหัสผ่านได้ทันที</li>
                </ul>
              </div>

              {/* Import Results / Errors Report */}
              {importResult && (
                <div className="space-y-3 p-3.5 rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground">ผลการประมวลผลไฟล์:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      เพิ่มใหม่ {importResult.createdCount} คน / อัปเดต {importResult.updatedCount} คน (รวม {importResult.totalProcessed} แถว)
                    </span>
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        ข้อผิดพลาดที่ไม่สามารถนำเข้าได้ ({importResult.errors.length} รายการ):
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {importResult.errors.map((err, idx) => (
                          <div key={idx} className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg">
                            {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false)
                    setUploadFile(null)
                    setImportResult(null)
                  }}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  {importResult ? 'ปิด' : 'ยกเลิก'}
                </button>
                <button
                  type="button"
                  onClick={handleImportUsers}
                  disabled={!uploadFile || isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>เริ่มนำเข้าข้อมูล</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
    </RoleGuard>
  )
}
