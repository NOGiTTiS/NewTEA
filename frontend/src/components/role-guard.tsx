'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { ShieldAlert, ArrowLeft, LogIn, RefreshCw } from 'lucide-react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  // 1. Loading State
  if (isPending) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
        <span className="text-xs text-muted-foreground font-medium">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</span>
      </div>
    )
  }

  // 2. Unauthenticated State
  if (!session?.user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-lg">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <LogIn className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              กรุณาเข้าสู่ระบบก่อนเข้าใช้งาน
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              หน้านี้สงวนสิทธิ์เฉพาะครูและบุคลากรที่เข้าสู่ระบบ NewTEA เรียบร้อยแล้ว
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-all shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบ (@tn.ac.th)
            </Link>
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Role Authorization Check
  const userRole = (session.user as { role?: string }).role || 'TEACHER'

  // ADMIN always passes
  if (userRole.toUpperCase() === 'ADMIN') {
    return <>{children}</>
  }

  // Check if user role matches allowed roles
  if (allowedRoles && allowedRoles.length > 0) {
    const isAllowed = allowedRoles.some((r) => r.toUpperCase() === userRole.toUpperCase())
    if (!isAllowed) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-lg">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                403 ไม่ได้รับสิทธิ์เข้าถึง (Forbidden)
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                บัญชีของท่านมีบทบาทเป็น <span className="font-semibold text-foreground">[{userRole}]</span> ซึ่งไม่ได้รับอนุญาตให้เข้าถึงหน้านี้ (เฉพาะสิทธิ์ {allowedRoles.join(', ')})
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-all shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                กลับหน้าหลัก
              </Link>
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all"
              >
                <LogIn className="w-4 h-4" />
                สลับบัญชีผู้ใช้
              </Link>
            </div>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
