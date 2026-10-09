'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { useSidebarStore } from '@/lib/sidebar-store'
import { useBrandingStore } from '@/lib/branding-store'
import { useSession, signOut } from '@/lib/auth-client'
import {
  GraduationCap,
  Users,
  CalendarDays,
  UserCheck,
  LayoutDashboard,
  BookOpen,
  Menu,
  X,
  LogIn,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  ClipboardCheck,
  FileSpreadsheet,
  DoorOpen
} from 'lucide-react'
import { toast } from 'sonner'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  isExternal?: boolean
}

interface NavGroup {
  groupTitle: string
  items: NavItem[]
}

export function AppSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarStore()
  const { data: session } = useSession()
  const { systemName, schoolName, siteLogo, siteCopyright } = useBrandingStore()

  const displaySystemName = (systemName && systemName.split(' - ')[0]) || 'NewTEA'
  const userRole = ((session?.user as { role?: string })?.role || '').toUpperCase()

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Global keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCollapsed])

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('ออกจากระบบเรียบร้อยแล้ว')
      window.location.href = '/'
    } catch {
      toast.error('เกิดข้อผิดพลาดในการออกจากระบบ')
    }
  }

  // Dynamic navigation groups based on authenticated user role
  const navGroups = React.useMemo<NavGroup[]>(() => {
    // 1. Overview group (Everyone)
    const overviewGroup: NavGroup = {
      groupTitle: 'ภาพรวมระบบ',
      items: [
        {
          title: 'หน้าหลัก',
          href: '/',
          icon: LayoutDashboard
        }
      ]
    }

    // 2. Assessment group
    const assessmentItems: NavItem[] = []

    // Show advisor dashboard for ADMIN, ACADEMIC, ADVISOR, or any logged in user
    if (userRole === 'ADMIN' || userRole === 'ACADEMIC' || userRole === 'ADVISOR' || session?.user) {
      assessmentItems.push({
        title: 'แดชบอร์ดครูที่ปรึกษา',
        href: '/advisor',
        icon: ShieldCheck
      })
    }

    assessmentItems.push({
      title: 'รายวิชาและบันทึกคะแนน',
      href: '/courses',
      icon: BookOpen
    })

    // Show Dept Head Verification for ADMIN and DEPT_HEAD
    if (userRole === 'ADMIN' || userRole === 'DEPT_HEAD') {
      assessmentItems.push({
        title: 'ตรวจรับรองกลุ่มสาระฯ',
        href: '/dept-head',
        icon: ClipboardCheck
      })
    }

    // Show Academic Overview for ADMIN and ACADEMIC
    if (userRole === 'ADMIN' || userRole === 'ACADEMIC') {
      assessmentItems.push({
        title: 'ติดตามภาพรวมวิชาการ (TEA68)',
        href: '/academic',
        icon: FileSpreadsheet
      })
    }

    const assessmentGroup: NavGroup = {
      groupTitle: 'การวัดและประเมินผล',
      items: assessmentItems
    }

    // 3. Admin Groups
    if (userRole === 'ADMIN') {
      const adminGroup: NavGroup = {
        groupTitle: 'การจัดการข้อมูลหลัก (Admin)',
        items: [
          {
            title: 'จัดการผู้ใช้และสิทธิ์ (RBAC)',
            href: '/admin/users',
            icon: Users
          },
          {
            title: 'บัญชีนักเรียน',
            href: '/admin/students',
            icon: GraduationCap
          },
          {
            title: 'จัดการห้องเรียน',
            href: '/admin/rooms',
            icon: DoorOpen
          },
          {
            title: 'ครูที่ปรึกษา',
            href: '/admin/advisors',
            icon: UserCheck
          },
          {
            title: 'ปีการศึกษา & เดดไลน์',
            href: '/admin/terms',
            icon: CalendarDays
          },
          {
            title: 'การตั้งค่าระบบ',
            href: '/admin/settings',
            icon: Sliders
          }
        ]
      }
      return [overviewGroup, adminGroup, assessmentGroup]
    }

    // 4. Academic Affairs Groups
    if (userRole === 'ACADEMIC') {
      const academicGroup: NavGroup = {
        groupTitle: 'งานฝ่ายวิชาการ',
        items: [
          {
            title: 'ติดตามภาพรวมวิชาการ (TEA68)',
            href: '/academic',
            icon: FileSpreadsheet
          },
          {
            title: 'บัญชีนักเรียน',
            href: '/admin/students',
            icon: GraduationCap
          },
          {
            title: 'ปีการศึกษา & เดดไลน์',
            href: '/admin/terms',
            icon: CalendarDays
          }
        ]
      }
      return [overviewGroup, academicGroup, assessmentGroup]
    }

    // Default for TEACHER or Guest
    return [overviewGroup, assessmentGroup]
  }, [userRole, session?.user])

  const renderNavLinks = (collapsed: boolean) => (
    <div className={collapsed ? 'space-y-4' : 'space-y-6'}>
      {navGroups.map((group, groupIdx) => (
        <div key={group.groupTitle} className={collapsed ? 'space-y-1.5' : 'space-y-1.5'}>
          {collapsed ? (
            groupIdx > 0 && <div className="h-px bg-border/60 mx-1.5 my-2" />
          ) : (
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">
              {group.groupTitle}
            </div>
          )}

          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/')

              if (collapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    className={`relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-150 group ${
                      isActive
                        ? 'bg-brand-500 text-white font-semibold shadow-sm shadow-brand-500/25 ring-2 ring-brand-500/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                    {item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
                    )}
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 group ${
                    isActive
                      ? 'bg-brand-500 text-white font-semibold shadow-sm shadow-brand-500/25 ring-2 ring-brand-500/20'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive
                          ? 'text-white'
                          : 'text-muted-foreground group-hover:text-brand-500'
                      }`}
                    />
                    <span className="truncate">{item.title}</span>
                  </div>

                  {item.badge ? (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full justify-between select-none">
      <div className="space-y-4">
        {/* Brand Header */}
        {collapsed ? (
          <div className="p-3 border-b border-border/80 flex flex-col items-center gap-2">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-bold shadow-md shadow-brand-500/25 shrink-0 group transition-transform hover:scale-105 overflow-hidden p-1.5"
              title={`${systemName} - ${schoolName}`}
            >
              {siteLogo ? (
                <img
                  src={siteLogo}
                  alt={displaySystemName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none'
                  }}
                />
              ) : (
                <GraduationCap className="w-5 h-5 shrink-0" />
              )}
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="ขยายแถบเมนู (Ctrl+B)"
              aria-label="ขยายแถบเมนู"
            >
              <PanelLeftOpen className="w-4 h-4 shrink-0" />
            </button>
          </div>
        ) : (
          <div className="p-4 border-b border-border/80 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-3 group min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-bold shadow-md shadow-brand-500/25 shrink-0 transition-transform group-hover:scale-105 overflow-hidden p-1.5">
                {siteLogo ? (
                  <img
                    src={siteLogo}
                    alt={displaySystemName}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <GraduationCap className="w-6 h-6 shrink-0" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-brand-600 dark:text-brand-400 truncate">
                    {displaySystemName}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 shrink-0">
                    TUNorth
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate leading-tight">
                  {schoolName}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:flex p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
              title="ย่อแถบเมนู (Ctrl+B)"
              aria-label="ย่อแถบเมนู"
            >
              <PanelLeftClose className="w-4 h-4 shrink-0" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <div className={`overflow-y-auto max-h-[calc(100vh-230px)] ${collapsed ? 'px-2' : 'px-3'}`}>
          {renderNavLinks(collapsed)}
        </div>
      </div>

      {/* Bottom: User Profile & Theme Controller */}
      <div className={`border-t border-border/80 bg-card/40 ${collapsed ? 'p-2 space-y-2' : 'p-3 space-y-2'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle compact={true} />
            {session?.user ? (
              <button
                type="button"
                onClick={handleSignOut}
                title={`ออกจากระบบ (${session.user.name})`}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-border hover:bg-rose-500/10 hover:border-rose-500/30 text-muted-foreground hover:text-rose-600 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </button>
            ) : (
              <Link
                href="/login"
                title="เข้าสู่ระบบ (@tn.ac.th)"
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-border hover:bg-muted text-foreground transition-all"
              >
                <LogIn className="w-4 h-4 text-brand-500 shrink-0" />
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] text-muted-foreground font-medium">ธีมการแสดงผล</span>
              <ThemeToggle />
            </div>

            {session?.user ? (
              <div className="p-2 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {session.user.name ? session.user.name.charAt(0) : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {session.user.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                        {userRole || 'TEACHER'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all group"
              >
                <div className="flex items-center gap-2 truncate">
                  <LogIn className="w-4 h-4 text-brand-500 shrink-0" />
                  <span className="truncate">เข้าสู่ระบบ (@tn.ac.th)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
            {siteCopyright && (
              <p className="px-1 pt-1 text-[9px] text-muted-foreground/60 text-center truncate leading-relaxed select-none">
                {siteCopyright}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sticky Sidebar (Width animates between w-64 and w-20) */}
      <aside
        className={`hidden lg:flex flex-col h-screen sticky top-0 border-r border-border bg-card/60 backdrop-blur-md z-30 shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20 min-w-[5rem]' : 'w-64 min-w-[16rem]'
        }`}
      >
        {renderSidebarContent(isCollapsed)}
      </aside>

      {/* Mobile Top Navigation Bar with Drawer Toggle */}
      <div className="lg:hidden sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-xl hover:bg-muted text-foreground transition-all shrink-0 cursor-pointer"
            aria-label="เปิดเมนูนำทาง"
          >
            <Menu className="w-5 h-5 shrink-0" />
          </button>

          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 overflow-hidden p-1">
              {siteLogo ? (
                <img
                  src={siteLogo}
                  alt={displaySystemName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none'
                  }}
                />
              ) : (
                <GraduationCap className="w-5 h-5 shrink-0" />
              )}
            </div>
            <span className="font-extrabold text-sm tracking-tight text-brand-600 dark:text-brand-400 truncate">
              {displaySystemName}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Slide-Over Drawer (Always expanded view) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden p-1">
                  {siteLogo ? (
                    <img
                      src={siteLogo}
                      alt={displaySystemName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <GraduationCap className="w-5 h-5 shrink-0" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-sm text-brand-600 dark:text-brand-400 truncate block">
                    {displaySystemName}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {schoolName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                aria-label="ปิดเมนู"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">{renderNavLinks(false)}</div>

            <div className="p-3 border-t border-border space-y-2 bg-card/40">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] text-muted-foreground font-medium">ธีมการแสดงผล</span>
                <ThemeToggle />
              </div>

              {session?.user ? (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {session.user.name ? session.user.name.charAt(0) : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {session.user.name}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                        {userRole || 'TEACHER'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                    title="ออกจากระบบ"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center justify-center w-full px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold shadow-xs"
                >
                  เข้าสู่ระบบ (@tn.ac.th)
                </Link>
              )}
              {siteCopyright && (
                <div className="px-2 pt-1 text-[9px] text-muted-foreground/60 text-center truncate">
                  {siteCopyright}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
