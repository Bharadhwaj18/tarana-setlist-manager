'use client'

import * as Toast from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map(t => (
          <Toast.Root
            key={t.id}
            open={true}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg px-4 py-3 shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out',
              'data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-4',
              t.type === 'success' && 'bg-brand-200 text-brand-700 border border-brand-300',
              t.type === 'error' && 'bg-red-600 text-white',
              t.type === 'info' && 'bg-brand-700 text-brand-50'
            )}
          >
            <Toast.Description className="text-sm font-medium">{t.message}</Toast.Description>
            <Toast.Close className="rounded p-0.5 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}
