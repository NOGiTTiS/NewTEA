'use client'

import * as React from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient, signIn, signUp } from '@/lib/auth-client'
import { useBrandingStore } from '@/lib/branding-store'
import { GraduationCap, Mail, Lock, User, LogIn, UserPlus, ArrowRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
  const { systemName, schoolName, siteLogo, siteCopyright } = useBrandingStore()
  const displaySystemName = (systemName && systemName.split(' - ')[0]) || 'NewTEA'

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }

    setIsLoading(true)
    try {
      if (mode === 'signin') {
        const res = await signIn.email({
          email,
          password
        })
        if (res.error) {
          toast.error(res.error.message || 'เข้าสู่ระบบไม่สำเร็จ')
        } else {
          toast.success('เข้าสู่ระบบสำเร็จ')
          window.location.href = '/'
        }
      } else {
        if (!name.trim()) {
          toast.error('กรุณาระบุชื่อ-นามสกุล')
          setIsLoading(false)
          return
        }
        const res = await signUp.email({
          name: name.trim(),
          email: email.trim(),
          password
        })
        if (res.error) {
          toast.error(res.error.message || 'ลงทะเบียนไม่สำเร็จ')
        } else {
          toast.success('ลงทะเบียนและเข้าสู่ระบบสำเร็จ')
          window.location.href = '/'
        }
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/'
      })

      if (res?.error) {
        if (
          res.error.code === 'PROVIDER_NOT_FOUND' ||
          res.error.message?.toLowerCase().includes('provider')
        ) {
          toast.error(
            'ยังไม่ได้เปิดใช้งาน Google SSO ในระบบ (ต้องการ GOOGLE_CLIENT_ID) กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน'
          )
        } else {
          toast.error(res.error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google SSO')
        }
        setIsGoogleLoading(false)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ Google SSO')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      {/* Header */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-border bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-brand-500/25 overflow-hidden p-1.5">
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
              <GraduationCap className="w-6 h-6" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg tracking-tight">
              {displaySystemName}
            </h1>
            <p className="text-xs text-muted-foreground">{schoolName}</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-300 mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {mode === 'signin' ? `เข้าสู่ระบบ ${displaySystemName}` : 'ลงทะเบียนใช้งานครั้งแรก'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {schoolName}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-muted/60 border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              เข้าสู่ระบบ (Sign In)
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ลงทะเบียน (Sign Up)
            </button>
          </div>

          {/* Google SSO Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border-2 border-border hover:border-brand-500 bg-background hover:bg-brand-50/50 dark:hover:bg-brand-950/30 text-foreground font-semibold text-sm transition-all shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isGoogleLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>กำลังเชื่อมต่อ Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>เข้าสู่ระบบด้วย Google (@tn.ac.th)</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase font-medium">หรือใช้อีเมลโรงเรียน</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  ชื่อ - นามสกุล (เช่น นายสมชาย ใจดี)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อ - สกุล"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-sm transition-all"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                อีเมลโรงเรียน (@tn.ac.th)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@tn.ac.th"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-sm transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-sm transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white font-semibold text-sm transition-all shadow-md shadow-brand-500/25 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <span>กำลังดำเนินการ...</span>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>สร้างบัญชีและเข้าใช้งาน</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            สำหรับครูและบุคลากร {schoolName}
          </p>
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border/40 bg-card/20 transition-colors">
        {siteCopyright || '© 2026 โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ. All rights reserved.'}
      </footer>
    </div>
  )
}
