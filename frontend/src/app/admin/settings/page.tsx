'use client'

import * as React from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { RoleGuard } from '@/components/role-guard'
import { fetchApi, uploadApi } from '@/lib/api'
import {
  DEFAULT_DAY_COLORS,
  resolveEffectiveThemeColor,
  applyThemeColors
} from '@/components/dynamic-branding'
import {
  AssessmentCriteriaConfig,
  DEFAULT_ASSESSMENT_CRITERIA,
  calculateAuto3DAssessment,
  DESIRABLE_ITEMS,
  READING_ITEMS,
  COMPETENCY_ITEMS,
  getDesirableLabel,
  getReadingLabel,
  getCompetencyItemLabel,
  getCompetencySummaryLabel
} from '@/lib/calculation-engine'
import {
  Sliders,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Award,
  BookOpen,
  Compass,
  Building2,
  Palette,
  Sun,
  Check,
  RefreshCw,
  UploadCloud,
  Globe,
  Image as ImageIcon,
  GraduationCap
} from 'lucide-react'
import { toast } from 'sonner'

type ActiveTab = 'general' | 'theme' | 'criteria'

interface GeneralSettings {
  system_name: string
  school_name: string
  school_address: string
  director_name: string
  director_title: string
  site_copyright: string
  site_logo: string
  site_favicon: string
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  system_name: 'NewTEA - Triam Evaluation & Assessment',
  school_name: 'โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ',
  school_address: 'ตำบลหัวรอ อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก',
  director_name: 'นายยงค์ยุทธ รุ่งแจ้ง',
  director_title: 'ผู้อำนวยการโรงเรียนเตรียมอุดมศึกษา ภาคเหนือ',
  site_copyright: '© 2026 โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ. All rights reserved.',
  site_logo: '',
  site_favicon: ''
}

const COLOR_PRESETS = [
  { name: 'ม่วงพระเกี้ยว (TUNorth)', hex: '#5f06c4' },
  { name: 'น้ำเงินเตรียม', hex: '#1e40af' },
  { name: 'ฟ้าสดใส', hex: '#0284c7' },
  { name: 'เขียวมรกต', hex: '#059669' },
  { name: 'ส้มสดใส', hex: '#ea580c' },
  { name: 'ชมพูกุหลาบ', hex: '#ec4899' },
  { name: 'แดงทับทิม', hex: '#dc2626' }
]

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('general')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  // General settings state
  const [generalSettings, setGeneralSettings] = React.useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS)
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false)
  const [isUploadingFavicon, setIsUploadingFavicon] = React.useState(false)

  // Theme settings state
  const [autoThemeEnabled, setAutoThemeEnabled] = React.useState(false)
  const [primaryColor, setPrimaryColor] = React.useState('#5f06c4')
  const [dayColors, setDayColors] = React.useState<Record<string, string>>({
    theme_day_color_sun: '#dc2626',
    theme_day_color_mon: '#eab308',
    theme_day_color_tue: '#ec4899',
    theme_day_color_wed: '#059669',
    theme_day_color_thu: '#ea580c',
    theme_day_color_fri: '#0284c7',
    theme_day_color_sat: '#7c3aed'
  })

  // Criteria settings state
  const [criteriaConfig, setCriteriaConfig] = React.useState<AssessmentCriteriaConfig>(DEFAULT_ASSESSMENT_CRITERIA)

  // Simulation test state
  const [testGrade, setTestGrade] = React.useState<string>('3.5')
  const [testSpecialGrade, setTestSpecialGrade] = React.useState<string>('')

  // Current day index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const todayIndex = React.useMemo(() => new Date().getDay(), [])
  const todayConfig = DEFAULT_DAY_COLORS[todayIndex]

  // Load all settings from backend
  const loadAllSettings = React.useCallback(async () => {
    setIsLoading(true)
    try {
      // 1. Fetch system settings
      const settingsRes = await fetchApi<{ settings?: Record<string, string>, data?: Record<string, string> }>('/api/settings')
      const s = settingsRes?.settings || settingsRes?.data || {}

      setGeneralSettings({
        system_name: s.system_name || DEFAULT_GENERAL_SETTINGS.system_name,
        school_name: s.school_name || DEFAULT_GENERAL_SETTINGS.school_name,
        school_address: s.school_address || DEFAULT_GENERAL_SETTINGS.school_address,
        director_name: s.director_name || DEFAULT_GENERAL_SETTINGS.director_name,
        director_title: s.director_title || DEFAULT_GENERAL_SETTINGS.director_title,
        site_copyright: s.site_copyright || DEFAULT_GENERAL_SETTINGS.site_copyright,
        site_logo: s.site_logo || '',
        site_favicon: s.site_favicon || ''
      })

      setAutoThemeEnabled(s.theme_auto_color_enabled === 'true')
      setPrimaryColor(s.theme_primary_color || '#5f06c4')
      setDayColors({
        theme_day_color_sun: s.theme_day_color_sun || DEFAULT_DAY_COLORS[0].defaultHex,
        theme_day_color_mon: s.theme_day_color_mon || DEFAULT_DAY_COLORS[1].defaultHex,
        theme_day_color_tue: s.theme_day_color_tue || DEFAULT_DAY_COLORS[2].defaultHex,
        theme_day_color_wed: s.theme_day_color_wed || DEFAULT_DAY_COLORS[3].defaultHex,
        theme_day_color_thu: s.theme_day_color_thu || DEFAULT_DAY_COLORS[4].defaultHex,
        theme_day_color_fri: s.theme_day_color_fri || DEFAULT_DAY_COLORS[5].defaultHex,
        theme_day_color_sat: s.theme_day_color_sat || DEFAULT_DAY_COLORS[6].defaultHex
      })

      // 2. Fetch assessment criteria
      const criteriaRes = await fetchApi<{ criteria: AssessmentCriteriaConfig }>('/api/settings/assessment-criteria')
      if (criteriaRes?.criteria) {
        setCriteriaConfig(criteriaRes.criteria)
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลการตั้งค่าได้ ใช้ค่ามาตรฐานแทน')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadAllSettings()
  }, [loadAllSettings])

  // Save General Settings
  const handleSaveGeneral = async () => {
    setIsSaving(true)
    try {
      await fetchApi('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(generalSettings)
      })
      window.dispatchEvent(new CustomEvent('branding-updated'))
      toast.success('บันทึกข้อมูลทั่วไปและสถานศึกษาเรียบร้อยแล้ว')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Upload Logo or Favicon image file
  const handleUploadBranding = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์มีขนาดเกิน 5MB กรุณาเลือกไฟล์ขนาดเล็กกว่า 5MB')
      return
    }

    if (type === 'logo') {
      setIsUploadingLogo(true)
    } else {
      setIsUploadingFavicon(true)
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const res = await uploadApi<{ url: string; path: string }>('/api/settings/upload-image', formData)
      if (res?.url) {
        if (type === 'logo') {
          setGeneralSettings(prev => ({ ...prev, site_logo: res.url }))
        } else {
          setGeneralSettings(prev => ({ ...prev, site_favicon: res.url }))
        }
        toast.success(`อัปโหลด${type === 'logo' ? 'ตราสัญลักษณ์ / Logo' : 'ไอคอน Favicon'} เรียบร้อย (อย่าลืมกดบันทึกข้อมูล)`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'อัปโหลดไฟล์ไม่สำเร็จ'
      toast.error(msg)
    } finally {
      if (type === 'logo') {
        setIsUploadingLogo(false)
      } else {
        setIsUploadingFavicon(false)
      }
      e.target.value = ''
    }
  }

  // Save Theme Settings & Broadcast
  const handleSaveTheme = async () => {
    setIsSaving(true)
    try {
      const payload: Record<string, string> = {
        theme_auto_color_enabled: autoThemeEnabled ? 'true' : 'false',
        theme_primary_color: primaryColor,
        ...dayColors
      }

      await fetchApi('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      })

      // Calculate effective color and apply immediately
      const effective = resolveEffectiveThemeColor(payload)
      applyThemeColors(effective)

      // Broadcast branding update event to current and other tabs
      window.dispatchEvent(new CustomEvent('branding-updated', { detail: { themeColor: effective } }))

      toast.success('บันทึกธีมสีและระบบ Auto Theme เรียบร้อยแล้ว')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Save Assessment Criteria
  const handleSaveCriteria = async () => {
    setIsSaving(true)
    try {
      await fetchApi('/api/settings/assessment-criteria', {
        method: 'PUT',
        body: JSON.stringify(criteriaConfig)
      })
      toast.success('บันทึกเกณฑ์การประเมิน 3 ด้านเรียบร้อยแล้ว')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Reset 7-Day Colors to Defaults
  const handleResetDayColors = () => {
    setDayColors({
      theme_day_color_sun: DEFAULT_DAY_COLORS[0].defaultHex,
      theme_day_color_mon: DEFAULT_DAY_COLORS[1].defaultHex,
      theme_day_color_tue: DEFAULT_DAY_COLORS[2].defaultHex,
      theme_day_color_wed: DEFAULT_DAY_COLORS[3].defaultHex,
      theme_day_color_thu: DEFAULT_DAY_COLORS[4].defaultHex,
      theme_day_color_fri: DEFAULT_DAY_COLORS[5].defaultHex,
      theme_day_color_sat: DEFAULT_DAY_COLORS[6].defaultHex
    })
    toast.info('คืนค่าสีมาตรฐาน 7 วันแล้ว (อย่าลืมกดบันทึกการตั้งค่า)')
  }

  // Reset Assessment Criteria
  const handleResetCriteria = () => {
    setCriteriaConfig(DEFAULT_ASSESSMENT_CRITERIA)
    toast.info('คืนค่าเกณฑ์เริ่มต้นของโรงเรียนแล้ว (อย่าลืมกดบันทึก)')
  }

  // Simulated mapping based on current criteria config
  const simulatedResult = React.useMemo(() => {
    return calculateAuto3DAssessment(testGrade, testSpecialGrade || undefined, criteriaConfig)
  }, [testGrade, testSpecialGrade, criteriaConfig])

  // Current effective color preview in Theme tab
  const currentEffectiveColor = React.useMemo(() => {
    if (autoThemeEnabled) {
      const dayKey = todayConfig.key
      return dayColors[dayKey] || todayConfig.defaultHex
    }
    return primaryColor
  }, [autoThemeEnabled, todayConfig, dayColors, primaryColor])

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <DashboardShell
        title="การตั้งค่าระบบ (System Settings)"
        description="จัดการข้อมูลทั่วไป อัตลักษณ์สถานศึกษา ธีมสีประจำวันอัตโนมัติ และเกณฑ์ประเมิน 3 ด้าน"
        badge="ตั้งค่าระบบ"
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={loadAllSettings}
              disabled={isLoading || isSaving}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl border border-border overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>1. ข้อมูลทั่วไปและสถานศึกษา</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'theme'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Palette className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>2. ธีมสี & Auto Theme ประจำวัน</span>
              {autoThemeEnabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('criteria')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'criteria'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>3. เกณฑ์การประเมิน 3 ด้าน</span>
            </button>
          </div>

          {isLoading ? (
            <div className="p-16 text-center text-xs text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
              กำลังโหลดข้อมูลการตั้งค่า...
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* TAB 1: General & School Info                              */}
              {/* ========================================================= */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <h2 className="text-sm font-bold text-foreground">ข้อมูลพื้นฐานของระบบและสถานศึกษา</h2>
                        <p className="text-xs text-muted-foreground">
                          ข้อมูลเหล่านี้จะถูกแสดงผลบนหัวเว็บ รายงานผลสัมฤทธิ์ และส่วนลงนามอนุมัติในเอกสาร ปพ.5
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveGeneral}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั่วไป'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ชื่อระบบ (System Name)</label>
                        <input
                          type="text"
                          value={generalSettings.system_name}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, system_name: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="NewTEA - Triam Evaluation & Assessment"
                        />
                        <p className="text-[10px] text-muted-foreground">แสดงผลบนแท็บเบราว์เซอร์และแถบชื่อระบบ</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ชื่อสถานศึกษา (School Name)</label>
                        <input
                          type="text"
                          value={generalSettings.school_name}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, school_name: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ"
                        />
                        <p className="text-[10px] text-muted-foreground">แสดงในหัวเอกสารและใบรายงานผล ปพ.5</p>
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ที่อยู่สถานศึกษา (School Address)</label>
                        <input
                          type="text"
                          value={generalSettings.school_address}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, school_address: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="ตำบลหัวรอ อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ชื่อ-สกุล ผู้อำนวยการโรงเรียน (Director Name)</label>
                        <input
                          type="text"
                          value={generalSettings.director_name}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, director_name: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="นายยงค์ยุทธ รุ่งแจ้ง"
                        />
                        <p className="text-[10px] text-muted-foreground">สำหรับพิมพ์ในช่องลงนามอนุมัติเอกสาร ปพ.5</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ตำแหน่งผู้บริหาร (Director Title)</label>
                        <input
                          type="text"
                          value={generalSettings.director_title}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, director_title: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="ผู้อำนวยการโรงเรียนเตรียมอุดมศึกษา ภาคเหนือ"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ข้อความลิขสิทธิ์ท้ายกระดาษ (Site Copyright)</label>
                        <input
                          type="text"
                          value={generalSettings.site_copyright}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, site_copyright: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="© 2026 โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ. All rights reserved."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branding: Logo & Favicon Management Card */}
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <h2 className="text-sm font-bold text-foreground">รูปภาพและอัตลักษณ์ของระบบ (Logo & Favicon)</h2>
                        <p className="text-xs text-muted-foreground">
                          กำหนดตราสัญลักษณ์ระบบเพื่อแสดงบนแถบเมนู (Sidebar), หน้าเข้าสู่ระบบ (Login) และไอคอนบนแท็บเบราว์เซอร์
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveGeneral}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกรูปภาพ'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Logo Section */}
                      <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            <h3 className="text-xs font-bold text-foreground">ตราสัญลักษณ์ระบบ / โรงเรียน (System Logo)</h3>
                          </div>
                          {generalSettings.site_logo && (
                            <button
                              type="button"
                              onClick={() => setGeneralSettings(prev => ({ ...prev, site_logo: '' }))}
                              className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              รีเซ็ตโลโก้
                            </button>
                          )}
                        </div>

                        {/* Preview Box */}
                        <div className="flex items-center gap-4 p-3 rounded-xl bg-background border border-border">
                          <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center overflow-hidden bg-muted/40 shrink-0">
                            {generalSettings.site_logo ? (
                              <img
                                src={generalSettings.site_logo}
                                alt="Logo Preview"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <GraduationCap className="w-8 h-8 opacity-40 text-brand-600" />
                                <span className="text-[9px] mt-0.5">ดีฟอลต์</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold text-foreground">การแสดงผล: หัวเมนูหลัก & หน้า Login</p>
                            <p className="text-[11px] text-muted-foreground">
                              {generalSettings.site_logo ? 'กำลังใช้โลโก้ที่กำหนดเอง' : 'กำลังใช้ไอคอนมาตรฐานระบบ NewTEA'}
                            </p>
                          </div>
                        </div>

                        {/* Upload & URL input */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground cursor-pointer transition-colors shadow-xs">
                              <UploadCloud className={`w-3.5 h-3.5 text-brand-600 ${isUploadingLogo ? 'animate-bounce' : ''}`} />
                              <span>{isUploadingLogo ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปภาพ Logo'}</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                disabled={isUploadingLogo}
                                onChange={(e) => handleUploadBranding(e, 'logo')}
                              />
                            </label>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              หรือระบุ URL รูปภาพโดยตรง
                            </label>
                            <input
                              type="text"
                              value={generalSettings.site_logo}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, site_logo: e.target.value })}
                              placeholder="เช่น /uploads/branding/logo.png หรือ https://..."
                              className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                          </div>

                          <p className="text-[10px] text-muted-foreground">
                            รองรับไฟล์ PNG, SVG, WEBP, JPG (แนะนำไฟล์โปร่งใส ขนาดไม่เกิน 5MB)
                          </p>
                        </div>
                      </div>

                      {/* Favicon Section */}
                      <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            <h3 className="text-xs font-bold text-foreground">ไอคอนบนแท็บเบราว์เซอร์ (Browser Favicon)</h3>
                          </div>
                          {generalSettings.site_favicon && (
                            <button
                              type="button"
                              onClick={() => setGeneralSettings(prev => ({ ...prev, site_favicon: '' }))}
                              className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              รีเซ็ต Favicon
                            </button>
                          )}
                        </div>

                        {/* Browser Tab Mockup Preview */}
                        <div className="p-2.5 rounded-xl bg-background border border-border space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">จำลองการแสดงผลบนแท็บเบราว์เซอร์</p>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-lg border border-border max-w-xs shadow-xs">
                            <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center overflow-hidden">
                              {generalSettings.site_favicon ? (
                                <img
                                  src={generalSettings.site_favicon}
                                  alt="Favicon Preview"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-foreground truncate">
                              {generalSettings.system_name || 'NewTEA'}
                            </span>
                          </div>
                        </div>

                        {/* Upload & URL input */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground cursor-pointer transition-colors shadow-xs">
                              <UploadCloud className={`w-3.5 h-3.5 text-brand-600 ${isUploadingFavicon ? 'animate-bounce' : ''}`} />
                              <span>{isUploadingFavicon ? 'กำลังอัปโหลด...' : 'อัปโหลดไฟล์ Favicon'}</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/x-icon,image/png,image/svg+xml,image/vnd.microsoft.icon,image/webp"
                                disabled={isUploadingFavicon}
                                onChange={(e) => handleUploadBranding(e, 'favicon')}
                              />
                            </label>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              หรือระบุ URL Favicon โดยตรง
                            </label>
                            <input
                              type="text"
                              value={generalSettings.site_favicon}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, site_favicon: e.target.value })}
                              placeholder="เช่น /uploads/branding/favicon.ico หรือ https://..."
                              className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                          </div>

                          <p className="text-[10px] text-muted-foreground">
                            รองรับไฟล์ .ico, .png, .svg (แนะนำขนาด 32×32 หรือ 64×64 พิกเซล)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: Theme & Auto Theme by Day                          */}
              {/* ========================================================= */}
              {activeTab === 'theme' && (
                <div className="space-y-6">
                  {/* Auto Theme Switch Banner */}
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-foreground">ระบบธีมสีประจำวันอัตโนมัติ (Auto Theme by Day)</h2>
                          {autoThemeEnabled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                              เปิดใช้งาน Auto Theme
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                              กำหนดสีหลักเอง (Manual)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          เมื่อเปิดใช้งาน ระบบจะสลับสีหลักของเว็บไซต์ตามสีประจำวัน 7 วันตามวัฒนธรรมไทยอัตโนมัติ (อาทิตย์-แดง ถึง เสาร์-ม่วง) พร้อมสลับสีเที่ยงคืนแบบเรียลไทม์
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoThemeEnabled}
                            onChange={(e) => setAutoThemeEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-12 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        <button
                          type="button"
                          onClick={handleSaveTheme}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5 shrink-0" />
                          <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าธีม'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Today's Color Status Card */}
                    <div className="p-4 rounded-xl border border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl shadow-xs flex items-center justify-center text-white shrink-0 border border-black/10"
                          style={{ backgroundColor: currentEffectiveColor }}
                        >
                          <Sun className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              วันนี้คือ {todayConfig.name} ({todayConfig.enName})
                            </span>
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              สีที่ระบบใช้งานขณะนี้
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            รหัสสี: <span className="font-bold text-foreground">{currentEffectiveColor}</span>
                            {autoThemeEnabled ? ' (โหมดสีประจำวันอัตโนมัติ)' : ' (โหมดสีที่เลือกเอง)'}
                          </p>
                        </div>
                      </div>

                      {/* Live Interactive UI Preview Snippet */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-all"
                          style={{ backgroundColor: currentEffectiveColor }}
                        >
                          ปุ่มสีแบรนด์
                        </button>
                        <span
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                          style={{
                            borderColor: currentEffectiveColor,
                            color: currentEffectiveColor
                          }}
                        >
                          Badge ตัวอย่าง
                        </span>
                      </div>
                    </div>

                    {/* Sub-view: When Auto Theme is Enabled (7 Days Palette Grid) */}
                    {autoThemeEnabled && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xs font-bold text-foreground">
                              กำหนดรหัสสีประจำวันทั้ง 7 วัน (Day-of-Week Palette)
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                              ปรับแต่งเฉดสีของแต่ละวันได้ตามต้องการ หรือกดคืนค่ามาตรฐานตามขนบประเพณีไทย
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleResetDayColors}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 text-muted-foreground" />
                            <span>คืนค่าสีมาตรฐาน 7 วัน</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                          {Object.values(DEFAULT_DAY_COLORS).map((day) => {
                            const isToday = day.dayIndex === todayIndex
                            const hex = dayColors[day.key] || day.defaultHex

                            return (
                              <div
                                key={day.key}
                                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                                  isToday
                                    ? 'bg-card border-brand-500 shadow-xs ring-2 ring-brand-500/20'
                                    : 'bg-card border-border'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-foreground">
                                    {day.name}
                                  </span>
                                  {isToday && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
                                      วันนี้
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {day.enName}
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={hex}
                                    onChange={(e) =>
                                      setDayColors({ ...dayColors, [day.key]: e.target.value })
                                    }
                                    className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0 bg-transparent shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={hex}
                                    onChange={(e) =>
                                      setDayColors({ ...dayColors, [day.key]: e.target.value })
                                    }
                                    maxLength={7}
                                    className="w-full px-2 py-1 text-[11px] font-mono rounded-lg bg-background border border-border text-foreground uppercase"
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sub-view: When Auto Theme is Disabled (Manual Primary Color Selection) */}
                    {!autoThemeEnabled && (
                      <div className="space-y-5 pt-2">
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold text-foreground">
                            กำหนดสีหลักของระบบ (Primary Theme Color)
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            เลือกสีหลักประจำโรงเรียน หรือเลือกจากจานสียอดนิยม
                          </p>
                        </div>

                        {/* Color Picker Box */}
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-12 h-12 rounded-xl border border-border cursor-pointer p-0 bg-transparent shrink-0"
                          />
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              maxLength={7}
                              className="px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-background border border-border text-foreground uppercase"
                              placeholder="#5F06C4"
                            />
                            <p className="text-[10px] text-muted-foreground">
                              สีหลักเริ่มต้นคือ #5f06c4 (ม่วงพระเกี้ยว โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ)
                            </p>
                          </div>
                        </div>

                        {/* Presets List */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            จานสียอดนิยม (Color Presets):
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {COLOR_PRESETS.map((p) => {
                              const isSelected = primaryColor.toLowerCase() === p.hex.toLowerCase()
                              return (
                                <button
                                  key={p.hex}
                                  type="button"
                                  onClick={() => setPrimaryColor(p.hex)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-card border-brand-500 shadow-xs ring-2 ring-brand-500/20 font-bold text-foreground'
                                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                                    style={{ backgroundColor: p.hex }}
                                  />
                                  <span>{p.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-600" />}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: Assessment Criteria (3D)                           */}
              {/* ========================================================= */}
              {activeTab === 'criteria' && (
                <div className="space-y-6">
                  {/* Top Bar Actions */}
                  <div className="flex items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-xs">
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        เกณฑ์การแปลงผลการเรียน 3 ด้านอัตโนมัติ (Assessment Engine)
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        กำหนดคะแนนเกรดขั้นต่ำในการประเมินคุณลักษณะอันพึงประสงค์ การอ่านคิดวิเคราะห์ และสมรรถนะสำคัญ
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetCriteria}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="hidden sm:inline">คืนค่าเริ่มต้น</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCriteria}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-semibold shadow-xs shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกเกณฑ์'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner Notice */}
                  <div className="bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 p-4 rounded-2xl flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <h3 className="font-bold text-brand-900 dark:text-brand-200">
                        ระบบ Auto-map ผลการประเมิน 3 ด้านจากผลการเรียน
                      </h3>
                      <p className="text-brand-700 dark:text-brand-300">
                        เมื่อครูผู้สอนบันทึกคะแนนในรายวิชา ระบบจะคำนวณตัดเกรด 0-4 และแปลงเป็นระดับคุณภาพ: คุณลักษณะฯ และการอ่านฯ (ดีเยี่ยม 3, ดี 2, ผ่าน 1, ไม่ผ่าน 0), สมรรถนะรายข้อ (ดีมาก 3, ดี 2, ปรับปรุง 1) และสมรรถนะภาพรวม (ดีเยี่ยม 3, ดี 2, พอใช้ 1, ปรับปรุง 0) พร้อมกระจายลงข้อย่อยให้อัตโนมัติ โดยคุณครูสามารถคลิกปรับแก้รายบุคคลได้เสมอ
                      </p>
                    </div>
                  </div>

                  {/* 3 Aspects Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Aspect 1: คุณลักษณะอันพึงประสงค์ (8 ข้อย่อย) */}
                    <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                            <Award className="w-4 h-4 shrink-0" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground">คุณลักษณะอันพึงประสงค์</h3>
                            <p className="text-[11px] text-muted-foreground">8 ข้อย่อย (AutoSGS โหมด 2)</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 border border-brand-200 dark:border-brand-800">
                          8 ข้อ
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 3 (ดีเยี่ยม) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.desirable.excellentMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.desirable.excellentMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                desirable: { ...prev.desirable, excellentMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อย 3-7 ได้รับคะแนน 3 (ข้อ 1, 2, 8 คงไว้ที่ 3 ดีเยี่ยม)</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 2 (ดี) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.desirable.goodMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.desirable.goodMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                desirable: { ...prev.desirable, goodMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อย 3-7 ได้รับคะแนน 2 (ข้อ 1, 2, 8 คงไว้ที่ 3 ดีเยี่ยม)</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 1 (ผ่าน) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.desirable.passMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.desirable.passMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                desirable: { ...prev.desirable, passMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อย 3-7 ได้รับคะแนน 1 (ข้อ 1, 2, 8 คงไว้ที่ 3 ดีเยี่ยม)</p>
                        </div>
                      </div>

                      {/* Sub-item Reference */}
                      <div className="pt-2 border-t border-border/80">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          รายการตัวชี้วัด 8 ข้อ:
                        </span>
                        <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                          {DESIRABLE_ITEMS.map((item, idx) => (
                            <li key={idx}>
                              ข้อ {idx + 1}: {item}
                              {(idx === 0 || idx === 1 || idx === 7) && (
                                <span className="ml-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
                                  (คงไว้ที่ 3 ดีเยี่ยม ทุกผลการเรียน)
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Aspect 2: การอ่าน คิดวิเคราะห์ และเขียน (5 ข้อย่อย) */}
                    <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                            <BookOpen className="w-4 h-4 shrink-0" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground">การอ่าน คิดวิเคราะห์ และเขียน</h3>
                            <p className="text-[11px] text-muted-foreground">5 ข้อย่อย (AutoSGS โหมด 3)</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 border border-brand-200 dark:border-brand-800">
                          5 ข้อ
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 3 (ดีเยี่ยม) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.reading.excellentMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.reading.excellentMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                reading: { ...prev.reading, excellentMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อยทั้ง 5 ข้อจะได้รับคะแนน 3</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 2 (ดี) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.reading.goodMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.reading.goodMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                reading: { ...prev.reading, goodMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อยทั้ง 5 ข้อจะได้รับคะแนน 2</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 1 (ผ่าน) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.reading.passMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.reading.passMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                reading: { ...prev.reading, passMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อยทั้ง 5 ข้อจะได้รับคะแนน 1</p>
                        </div>
                      </div>

                      {/* Sub-item Reference */}
                      <div className="pt-2 border-t border-border/80">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          รายการตัวชี้วัด 5 ข้อ:
                        </span>
                        <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                          {READING_ITEMS.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Aspect 3: สมรรถนะสำคัญของผู้เรียน (5 ด้าน) */}
                    <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                            <Compass className="w-4 h-4 shrink-0" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground">สมรรถนะสำคัญของผู้เรียน</h3>
                            <p className="text-[11px] text-muted-foreground">5 ด้านหลักตามหลักสูตรแกนกลาง</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 border border-brand-200 dark:border-brand-800">
                          5 ด้าน
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 3 (ดีมาก) / ภาพรวม (ดีเยี่ยม) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.competency.excellentMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.competency.excellentMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                competency: { ...prev.competency, excellentMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อยทั้ง 5 ด้านจะได้รับคะแนน 3 (ดีมาก)</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 2 (ดี) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.competency.goodMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.competency.goodMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                competency: { ...prev.competency, goodMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อยทั้ง 5 ด้านจะได้รับคะแนน 2 (ดี)</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>ระดับ 1 (ปรับปรุง) / ภาพรวม (พอใช้) เมื่อได้เกรดตั้งแต่</span>
                            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                              &ge; {criteriaConfig.competency.passMinGrade}
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="4"
                            value={criteriaConfig.competency.passMinGrade}
                            onChange={(e) =>
                              setCriteriaConfig((prev) => ({
                                ...prev,
                                competency: { ...prev.competency, passMinGrade: parseFloat(e.target.value) || 0 }
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <p className="text-[10px] text-muted-foreground">ข้อย่อยทั้ง 5 ด้านจะได้รับคะแนน 1 (ปรับปรุง)</p>
                        </div>
                      </div>

                      {/* Sub-item Reference */}
                      <div className="pt-2 border-t border-border/80">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          รายการสมรรถนะ 5 ด้าน:
                        </span>
                        <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                          {COMPETENCY_ITEMS.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Live Simulation Preview */}
                  <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-border pb-3">
                      <Sliders className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <h3 className="font-bold text-sm text-foreground">
                        ทดสอบจำลองผลการคำนวณ (Live Preview Simulation)
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          จำลองเกรดที่ได้ (0 - 4):
                        </label>
                        <select
                          value={testGrade}
                          onChange={(e) => setTestGrade(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        >
                          {['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'].map((g) => (
                            <option key={g} value={g}>
                              เกรด {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          ผลการเรียนพิเศษ (ถ้ามี):
                        </label>
                        <select
                          value={testSpecialGrade}
                          onChange={(e) => setTestSpecialGrade(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        >
                          <option value="">- ไม่มี (ปกติ) -</option>
                          <option value="มส">มส (เวลาเรียนไม่ถึง 80%)</option>
                          <option value="ร">ร (รอการตัดสินผล)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 flex items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border">
                        <div className="space-y-1 text-xs flex-1">
                          <span className="font-bold text-foreground">ผลการประเมินที่ระบบจะคำนวณ:</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg bg-card border border-border font-bold text-xs text-brand-600 dark:text-brand-400">
                              คุณลักษณะฯ: {getDesirableLabel(simulatedResult.desirableGrade)} ({simulatedResult.desirableGrade})
                              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                [ข้อ 1, 2, 8 = 3]
                              </span>
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-card border border-border font-bold text-xs text-brand-600 dark:text-brand-400">
                              การอ่านฯ: {getReadingLabel(simulatedResult.readingGrade)} ({simulatedResult.readingGrade})
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-card border border-border font-bold text-xs text-brand-600 dark:text-brand-400">
                              สมรรถนะฯ: แต่ละข้อ {getCompetencyItemLabel(simulatedResult.competencyGrade)} / ภาพรวม {getCompetencySummaryLabel(simulatedResult.competencyGrade)} ({simulatedResult.competencyGrade})
                            </span>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DashboardShell>
    </RoleGuard>
  )
}
