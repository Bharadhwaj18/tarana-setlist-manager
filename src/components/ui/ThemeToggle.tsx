'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_KEY, applyTheme, readStoredTheme, type Theme } from '@/lib/theme'

const CHANGE_EVENT = 'tarana-theme-change'

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystem = () => { if (readStoredTheme() === 'system') applyTheme('system') }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  media.addEventListener('change', onSystem)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
    media.removeEventListener('change', onSystem)
  }
}

function useTheme() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => 'system' as Theme)
  const setTheme = (next: Theme) => {
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    applyTheme(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  return [theme, setTheme] as const
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Light / Dark / System choice, for the Settings page. */
export function ThemePicker() {
  const [theme, setTheme] = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-brand-200 bg-white p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            theme === value ? 'bg-brand-400 text-white' : 'text-gray-600 hover:bg-brand-100'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

/** Compact button that flips between light and dark, for the sidebar. */
export function ThemeIconButton({ className }: { className?: string }) {
  const [, setTheme] = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')}
      aria-label="Toggle light and dark mode"
      className={className}
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  )
}
