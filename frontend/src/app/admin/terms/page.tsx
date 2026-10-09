'use client'

import * as React from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { fetchApi } from '@/lib/api'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Save,
  Plus,
  ArrowLeft,
  CalendarDays,
  ShieldAlert,
  Edit2,
  Trash2,
  RotateCcw,
  X
} from 'lucide-react'
import { toast } from 'sonner'

interface AcademicTerm {
  id: string
  year: number
  semester: number
  isActive: boolean
  startDate: string
  endDate: string
}

interface Milestone {
  id: string
  termId: string
  round: number
  title: string
  teacherDeadline: string
  academicDeadline: string
}

export default function AcademicTermsPage() {
  const [terms, setTerms] = React.useState<AcademicTerm[]>([])
  const [selectedTermId, setSelectedTermId] = React.useState<string>('')
  const [milestones, setMilestones] = React.useState<Milestone[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  // Create Term Form State
  const [newYear, setNewYear] = React.useState<number>(2568)
  const [newSemester, setNewSemester] = React.useState<number>(1)
  const [newStartDate, setNewStartDate] = React.useState('2026-05-16')
  const [newEndDate, setNewEndDate] = React.useState('2026-10-10')
  const [isCreatingTerm, setIsCreatingTerm] = React.useState(false)

  // Edit Term Modal State
  const [editingTerm, setEditingTerm] = React.useState<AcademicTerm | null>(null)
  const [isEditTermModalOpen, setIsEditTermModalOpen] = React.useState(false)

  // Delete Term Confirmation State
  const [deletingTerm, setDeletingTerm] = React.useState<AcademicTerm | null>(null)
  const [isDeleteTermModalOpen, setIsDeleteTermModalOpen] = React.useState(false)

  // Add Milestone Modal State
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = React.useState(false)
  const [newMilestoneTitle, setNewMilestoneTitle] = React.useState('')
  const [newMilestoneTeacherDeadline, setNewMilestoneTeacherDeadline] = React.useState('')
  const [newMilestoneAcademicDeadline, setNewMilestoneAcademicDeadline] = React.useState('')

  // Load Terms
  const loadTerms = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchApi<{ terms: AcademicTerm[] }>('/api/terms')
      const fetched = res.terms || []
      setTerms(fetched)
      if (fetched.length > 0) {
        const active = fetched.find((t) => t.isActive) || fetched[0]
        setSelectedTermId(active.id)
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลปีการศึกษาได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadTerms()
  }, [loadTerms])

  // Load Milestones when term changes
  const loadMilestones = React.useCallback(async (termId: string) => {
    if (!termId) return
    try {
      const res = await fetchApi<{ milestones: Milestone[] }>(`/api/terms/${termId}/milestones`)
      setMilestones(res.milestones || [])
    } catch {
      toast.error('ไม่สามารถโหลดกำหนดการตรวจได้')
    }
  }, [])

  React.useEffect(() => {
    if (selectedTermId) {
      loadMilestones(selectedTermId)
    }
  }, [selectedTermId, loadMilestones])

  // Handle Term Activation
  const handleActivateTerm = async (id: string) => {
    try {
      await fetchApi(`/api/terms/${id}/activate`, { method: 'PATCH' })
      toast.success('ตั้งค่าภาคเรียนปัจจุบันสำเร็จ')
      loadTerms()
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเปิดใช้งานภาคเรียน')
    }
  }

  // Handle Create Term
  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingTerm(true)
    try {
      const res = await fetchApi<{ term: AcademicTerm }>('/api/terms', {
        method: 'POST',
        body: JSON.stringify({
          year: newYear,
          semester: newSemester,
          isActive: true,
          startDate: newStartDate,
          endDate: newEndDate
        })
      })
      toast.success('สร้างปีการศึกษาและสร้างกำหนดการ 3 ระยะเริ่มต้นสำเร็จ')
      await loadTerms()
      if (res.term) {
        setSelectedTermId(res.term.id)
      }
    } catch (err) {
      toast.error((err as Error).message || 'สร้างปีการศึกษาไม่สำเร็จ')
    } finally {
      setIsCreatingTerm(false)
    }
  }

  // Handle Edit Term
  const handleUpdateTerm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTerm) return

    try {
      await fetchApi(`/api/terms/${editingTerm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          year: editingTerm.year,
          semester: editingTerm.semester,
          startDate: editingTerm.startDate ? editingTerm.startDate.split('T')[0] : '',
          endDate: editingTerm.endDate ? editingTerm.endDate.split('T')[0] : '',
          isActive: editingTerm.isActive
        })
      })
      toast.success('แก้ไขข้อมูลปีการศึกษาสำเร็จ')
      setIsEditTermModalOpen(false)
      loadTerms()
    } catch (err) {
      toast.error((err as Error).message || 'แก้ไขข้อมูลปีการศึกษาไม่สำเร็จ')
    }
  }

  // Handle Delete Term
  const handleDeleteTerm = async () => {
    if (!deletingTerm) return

    try {
      await fetchApi(`/api/terms/${deletingTerm.id}`, { method: 'DELETE' })
      toast.success('ลบปีการศึกษาสำเร็จ')
      setIsDeleteTermModalOpen(false)
      setDeletingTerm(null)
      loadTerms()
    } catch (err) {
      toast.error((err as Error).message || 'ลบปีการศึกษาไม่สำเร็จ')
    }
  }

  // Handle Update Milestones
  const handleSaveMilestones = async () => {
    if (!selectedTermId) return
    setIsSaving(true)
    try {
      const payload = {
        milestones: milestones.map((m) => ({
          id: m.id,
          round: m.round,
          title: m.title,
          teacherDeadline: m.teacherDeadline ? m.teacherDeadline.split('T')[0] : '',
          academicDeadline: m.academicDeadline ? m.academicDeadline.split('T')[0] : ''
        }))
      }
      await fetchApi(`/api/terms/${selectedTermId}/milestones`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      toast.success('บันทึกกำหนดการตรวจสำเร็จ')
    } catch {
      toast.error('ไม่สามารถบันทึกกำหนดการตรวจได้')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Add Custom Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTermId || !newMilestoneTitle.trim()) return

    try {
      await fetchApi(`/api/terms/${selectedTermId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          title: newMilestoneTitle.trim(),
          teacherDeadline: newMilestoneTeacherDeadline,
          academicDeadline: newMilestoneAcademicDeadline
        })
      })
      toast.success('เพิ่มกำหนดการตรวจสำเร็จ')
      setIsAddMilestoneModalOpen(false)
      setNewMilestoneTitle('')
      setNewMilestoneTeacherDeadline('')
      setNewMilestoneAcademicDeadline('')
      loadMilestones(selectedTermId)
    } catch (err) {
      toast.error((err as Error).message || 'เพิ่มกำหนดการตรวจไม่สำเร็จ')
    }
  }

  // Handle Delete Single Milestone
  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('ต้องการลบช่วงเวลากำหนดการส่งตรวจนี้ใช่หรือไม่?')) return

    try {
      await fetchApi(`/api/terms/${selectedTermId}/milestones/${milestoneId}`, {
        method: 'DELETE'
      })
      toast.success('ลบกำหนดการตรวจสำเร็จ')
      if (selectedTermId) {
        loadMilestones(selectedTermId)
      }
    } catch {
      toast.error('ลบกำหนดการตรวจไม่สำเร็จ')
    }
  }

  // Handle Reset to Standard 3 Milestones
  const handleResetMilestones = async () => {
    if (!selectedTermId) return
    if (!confirm('ต้องการรีเซ็ตกำหนดการตรวจให้เป็น 3 ระยะมาตรฐาน (ก่อนกลางภาค, กลางภาค, ปลายภาค) ใช่หรือไม่?')) return

    try {
      await fetchApi(`/api/terms/${selectedTermId}/milestones/reset`, {
        method: 'POST'
      })
      toast.success('รีเซ็ตเป็น 3 ระยะมาตรฐานสำเร็จ')
      loadMilestones(selectedTermId)
    } catch {
      toast.error('รีเซ็ตกำหนดการตรวจไม่สำเร็จ')
    }
  }

  const handleDeadlineChange = (index: number, field: 'teacherDeadline' | 'academicDeadline' | 'title', val: string) => {
    setMilestones((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [field]: val
      }
      return next
    })
  }

  const selectedTerm = terms.find((t) => t.id === selectedTermId)

  return (
    <DashboardShell
      title="ปีการศึกษาและกำหนดการตรวจ 3 ระยะ"
      description="กำหนดเดดไลน์การส่งและตรวจสอบคะแนน (TEA68 Milestone)"
      badge={`${terms.length} ภาคเรียน`}
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {selectedTerm && (
            <button
              type="button"
              onClick={handleSaveMilestones}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">{isSaving ? 'กำลังบันทึก...' : 'บันทึกกำหนดการ'}</span>
              <span className="sm:hidden">{isSaving ? 'บันทึก...' : 'บันทึก'}</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Terms Management */}
          <div className="space-y-6">
            {/* Active Term Selector */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-brand-500 shrink-0" />
                  เลือกภาคเรียนที่ต้องการจัดการ
                </h2>
                <span className="text-xs text-muted-foreground">{terms.length} ภาคเรียน</span>
              </div>

              <div className="space-y-2">
                {terms.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTermId(t.id)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      selectedTermId === t.id
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 shadow-xs'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">
                          ภาคเรียนที่ {t.semester}/{t.year}
                        </span>
                        {t.isActive ? (
                          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            ภาคเรียนปัจจุบัน
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleActivateTerm(t.id)
                            }}
                            className="text-[10px] text-muted-foreground hover:text-brand-600 underline cursor-pointer shrink-0"
                          >
                            ตั้งเป็นปัจจุบัน
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                          {t.startDate ? t.startDate.split('T')[0] : '-'} ถึง {t.endDate ? t.endDate.split('T')[0] : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTerm(t)
                          setIsEditTermModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="แก้ไขภาคเรียน"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingTerm(t)
                          setIsDeleteTermModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-all cursor-pointer"
                        title="ลบภาคเรียน"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                ))}

                {terms.length === 0 && !isLoading && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    ยังไม่มีข้อมูลปีการศึกษา กรุณาสร้างใหม่ด้านล่าง
                  </div>
                )}
              </div>
            </div>

            {/* Create New Term Form */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-500 shrink-0" />
                เพิ่มปีการศึกษา / ภาคเรียนใหม่
              </h2>

              <form onSubmit={handleCreateTerm} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">ปีการศึกษา (พ.ศ.)</label>
                    <input
                      type="number"
                      value={newYear}
                      onChange={(e) => setNewYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">ภาคเรียน</label>
                    <select
                      value={newSemester}
                      onChange={(e) => setNewSemester(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      <option value={1}>ภาคเรียนที่ 1</option>
                      <option value={2}>ภาคเรียนที่ 2</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">วันเริ่มต้น</label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">วันสิ้นสุด</label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingTerm}
                  className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white font-semibold transition-all shadow-xs shadow-brand-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingTerm ? 'กำลังสร้าง...' : 'สร้างปีการศึกษาและตั้งค่ากำหนดการ'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: 3-Round Verification Milestones Config */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Clock className="w-5 h-5 text-brand-500 shrink-0" />
                    กำหนดการส่งและตรวจสอบคะแนน
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedTerm
                      ? `ภาคเรียนที่ ${selectedTerm.semester}/${selectedTerm.year} (${milestones.length} ช่วงเวลา)`
                      : 'กรุณาเลือกภาคเรียน'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleResetMilestones}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-all cursor-pointer"
                    title="คืนค่าเป็น 3 ระยะมาตรฐาน"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">รีเซ็ต 3 ระยะ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddMilestoneModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/50 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    เพิ่มช่วงเวลา
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMilestones}
                    disabled={isSaving || milestones.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 shrink-0" />
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกกำหนดการ'}
                  </button>
                </div>
              </div>

              {/* Milestones Cards */}
              <div className="space-y-4">
                {milestones.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 hover:border-brand-500/30 transition-all space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-7 h-7 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {m.round || idx + 1}
                        </span>
                        <input
                          type="text"
                          value={m.title}
                          onChange={(e) => handleDeadlineChange(idx, 'title', e.target.value)}
                          className="font-bold text-sm bg-transparent border-b border-transparent hover:border-border focus:border-brand-500 focus:outline-none px-1 py-0.5 text-foreground flex-1 min-w-0"
                          placeholder="หัวข้อกำหนดการส่งตรวจ"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-all cursor-pointer shrink-0"
                        title="ลบช่วงเวลานี้"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Teacher Deadline */}
                      <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          เดดไลน์ครูผู้สอนกด “ส่งตรวจ”
                        </span>
                        <input
                          type="date"
                          value={m.teacherDeadline ? m.teacherDeadline.split('T')[0] : ''}
                          onChange={(e) => handleDeadlineChange(idx, 'teacherDeadline', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          หลังจากวันนี้ ระบบจะแจ้งเตือนสถานะส่งล่าช้า
                        </p>
                      </div>

                      {/* Academic & Dept Head Deadline */}
                      <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          เดดไลน์หัวหน้ากลุ่มสาระฯ / ฝ่ายวิชาการ
                        </span>
                        <input
                          type="date"
                          value={m.academicDeadline ? m.academicDeadline.split('T')[0] : ''}
                          onChange={(e) => handleDeadlineChange(idx, 'academicDeadline', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          กำหนดเวลาตรวจรับรองผลและล็อกคะแนนขั้นสุดท้าย
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {milestones.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl space-y-2">
                    <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto shrink-0" />
                    <p>ยังไม่มีกำหนดการตรวจสำหรับภาคเรียนนี้</p>
                    <button
                      type="button"
                      onClick={handleResetMilestones}
                      className="px-3 py-1.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-all cursor-pointer"
                    >
                      สร้างกำหนดการ 3 ระยะมาตรฐานทันที
                    </button>
                  </div>
                )}
              </div>

              {/* Data Locking Rule Notice */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <span className="font-bold">กฎการล็อกคะแนนอัตโนมัติ:</span>
                  <p>
                    เมื่อครูประจำวิชากด “ส่งตรวจ” ในช่วงเวลาดังกล่าว ระบบจะล็อกคะแนนเป็น
                    Read-Only ทันที จนกว่าหัวหน้ากลุ่มสาระฯ หรือฝ่ายวิชาการจะกด “อนุมัติ (เรียบร้อย)” หรือ “ส่งกลับให้แก้ไข”
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Term Modal */}
      {isEditTermModalOpen && editingTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-500 shrink-0" />
                แก้ไขข้อมูลปีการศึกษา / ภาคเรียน
              </h3>
              <button
                type="button"
                onClick={() => setIsEditTermModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleUpdateTerm} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ปีการศึกษา (พ.ศ.)</label>
                  <input
                    type="number"
                    value={editingTerm.year}
                    onChange={(e) => setEditingTerm({ ...editingTerm, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">ภาคเรียน</label>
                  <select
                    value={editingTerm.semester}
                    onChange={(e) => setEditingTerm({ ...editingTerm, semester: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value={1}>ภาคเรียนที่ 1</option>
                    <option value={2}>ภาคเรียนที่ 2</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">วันเริ่มต้น</label>
                  <input
                    type="date"
                    value={editingTerm.startDate ? editingTerm.startDate.split('T')[0] : ''}
                    onChange={(e) => setEditingTerm({ ...editingTerm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">วันสิ้นสุด</label>
                  <input
                    type="date"
                    value={editingTerm.endDate ? editingTerm.endDate.split('T')[0] : ''}
                    onChange={(e) => setEditingTerm({ ...editingTerm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="termIsActive"
                  checked={editingTerm.isActive}
                  onChange={(e) => setEditingTerm({ ...editingTerm, isActive: e.target.checked })}
                  className="rounded border-border text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="termIsActive" className="text-foreground cursor-pointer font-medium">
                  ตั้งเป็นภาคเรียนปัจจุบัน (Active Term)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditTermModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Term Confirmation Modal */}
      {isDeleteTermModalOpen && deletingTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 shrink-0" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-foreground">ยืนยันการลบปีการศึกษา?</h3>
              <p className="text-xs text-muted-foreground">
                คุณแน่ใจหรือไม่ว่าต้องการลบ ภาคเรียนที่ {deletingTerm.semester}/{deletingTerm.year}?
                กำหนดการตรวจทั้งหมดในภาคเรียนนี้จะถูกลบไปด้วย
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteTermModalOpen(false)
                  setDeletingTerm(null)
                }}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteTerm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {isAddMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-500 shrink-0" />
                เพิ่มช่วงเวลากำหนดการส่งตรวจ
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMilestoneModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">ชื่อหัวข้อกำหนดการส่งตรวจ</label>
                <input
                  type="text"
                  placeholder="เช่น ตรวจสอบคะแนนจิตพิสัย / งานกลุ่มพิเศษ"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">เดดไลน์ครูผู้สอน</label>
                  <input
                    type="date"
                    value={newMilestoneTeacherDeadline}
                    onChange={(e) => setNewMilestoneTeacherDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">เดดไลน์ฝ่ายวิชาการ</label>
                  <input
                    type="date"
                    value={newMilestoneAcademicDeadline}
                    onChange={(e) => setNewMilestoneAcademicDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddMilestoneModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs transition-all"
                >
                  เพิ่มกำหนดการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
