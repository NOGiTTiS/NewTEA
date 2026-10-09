'use client'

import * as React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebarStore } from '@/lib/sidebar-store'
import { useBrandingStore } from '@/lib/branding-store'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface DashboardShellProps {
  children: React.ReactNode
  title?: string
  description?: string
  badge?: string
  actions?: React.ReactNode
  fullWidth?: boolean
}

export function DashboardShell({
  children,
  title,
  description,
  badge,
  actions,
  fullWidth = false
}: DashboardShellProps) {
  const { isCollapsed, toggleCollapsed } = useSidebarStore()
  const { systemName, siteCopyright } = useBrandingStore()

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground transition-colors">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ease-in-out">
        {title && (
          <header className="sticky top-0 z-20 bg-card/85 backdrop-blur-md border-b border-border transition-colors">
            <div
              className={`${
                fullWidth ? 'w-full' : 'max-w-7xl mx-auto'
              } px-3 sm:px-6 lg:px-8 min-h-14 sm:min-h-16 py-2.5 sm:py-0 sm:h-16 flex items-center justify-between gap-2.5 sm:gap-3`}
            >
              <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-2.5">
                {/* Desktop Toggle Button in Header */}
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden lg:flex items-center justify-center p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                  title={isCollapsed ? 'ขยายแถบเมนู (Ctrl+B)' : 'ย่อแถบเมนู (Ctrl+B)'}
                  aria-label="สลับแถบเมนูข้าง"
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4 shrink-0" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h1 className="font-bold text-sm sm:text-base lg:text-lg tracking-tight truncate sm:whitespace-normal">
                      {title}
                    </h1>
                    {badge && (
                      <span className="text-[10px] font-semibold bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800 shrink-0">
                        {badge}
                      </span>
                    )}
                  </div>
                  {description && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block truncate mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">{actions}</div>}
            </div>
          </header>
        )}
        <main
          className={`flex-1 ${
            fullWidth
              ? 'w-full px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6'
              : 'max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8'
          }`}
        >
          {children}
        </main>
        <footer className="border-t border-border/50 py-3.5 sm:py-4 px-3 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground/80 transition-colors mt-auto bg-card/30">
          <div
            className={`${
              fullWidth ? 'w-full' : 'max-w-7xl mx-auto'
            } flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2`}
          >
            <p className="text-[11px] text-muted-foreground">
              {siteCopyright || '© 2026 โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ. All rights reserved.'}
            </p>
            <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              {systemName || 'NewTEA - Triam Evaluation & Assessment'}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
