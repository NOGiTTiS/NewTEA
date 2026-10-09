'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'

interface ThemeToggleProps {
  compact?: boolean
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={compact ? 'w-10 h-10 rounded-xl bg-muted animate-pulse' : 'w-9 h-9 rounded-xl bg-muted animate-pulse'} />
    )
  }

  // Cycle through themes in compact mode: light -> dark -> system -> light
  const handleCycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  if (compact) {
    const currentIcon =
      theme === 'dark' ? (
        <Moon className="w-4 h-4 text-brand-400" />
      ) : theme === 'light' ? (
        <Sun className="w-4 h-4 text-brand-600" />
      ) : (
        <Monitor className="w-4 h-4 text-brand-500" />
      )

    const tooltipLabel =
      theme === 'dark'
        ? 'ธีม: มืด (คลิกเพื่อเปลี่ยน)'
        : theme === 'light'
        ? 'ธีม: สว่าง (คลิกเพื่อเปลี่ยน)'
        : 'ธีม: ระบบ (คลิกเพื่อเปลี่ยน)'

    return (
      <button
        type="button"
        onClick={handleCycleTheme}
        className="w-10 h-10 rounded-xl border border-border bg-card/80 hover:bg-muted text-foreground flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
        title={tooltipLabel}
        aria-label={tooltipLabel}
      >
        {currentIcon}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`p-2 rounded-lg transition-all ${
          theme === 'light'
            ? 'bg-card text-brand-600 shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Light Mode"
        aria-label="Light Mode"
      >
        <Sun className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-lg transition-all ${
          theme === 'dark'
            ? 'bg-card text-brand-400 shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Dark Mode"
        aria-label="Dark Mode"
      >
        <Moon className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`p-2 rounded-lg transition-all ${
          theme === 'system'
            ? 'bg-card text-brand-500 shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="System Theme"
        aria-label="System Theme"
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  )
}
