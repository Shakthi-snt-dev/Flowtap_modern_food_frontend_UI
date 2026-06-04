import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Info, Zap, X, Megaphone } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { notificationsApi } from '@flowtap/api-core'
import { cn } from '@flowtap/shared'

interface Announcement {
  id: string
  subject: string
  message: string
  priority: 'Low' | 'Normal' | 'High' | 'Critical'
  sentBy: string
  startDate: string | null
  endDate: string | null
}

const PRIORITY_STYLE: Record<string, { header: string; icon: React.ReactNode; btn: string }> = {
  Critical: {
    header: 'bg-red-600 text-white',
    icon:   <Zap className="w-5 h-5" />,
    btn:    'bg-red-600 hover:bg-red-700 text-white',
  },
  High: {
    header: 'bg-amber-500 text-white',
    icon:   <AlertTriangle className="w-5 h-5" />,
    btn:    'bg-amber-500 hover:bg-amber-600 text-white',
  },
  Normal: {
    header: 'bg-blue-600 text-white',
    icon:   <Info className="w-5 h-5" />,
    btn:    'bg-blue-600 hover:bg-blue-700 text-white',
  },
  Low: {
    header: 'bg-gray-600 text-white',
    icon:   <Megaphone className="w-5 h-5" />,
    btn:    'bg-gray-600 hover:bg-gray-700 text-white',
  },
}

const DISMISSED_KEY = 'dismissed-popup-'

export const AnnouncementPopup: React.FC = () => {
  const tenant         = useAppSelector(s => s.tenant.tenant)
  const currentStoreId = useAppSelector(s => s.tenant.currentStoreId)

  const [current, setCurrent] = useState<Announcement | null>(null)
  const [queue,   setQueue]   = useState<Announcement[]>([])

  // Dismiss key is per-store so closing a popup in store A doesn't affect store B
  const dismissKey = (id: string) => DISMISSED_KEY + (currentStoreId ?? 'global') + '-' + id

  const fetchPopups = useCallback(() => {
    if (!tenant?.id) return
    notificationsApi
      .getAnnouncements({ companyId: tenant.id, type: 'Popup', locationId: currentStoreId ?? undefined, activeOnly: true, limit: 10 })
      .then((res) => {
        const raw: any[] = res.data?.data ?? []
        const storeKey = currentStoreId ?? 'global'
        const pending = raw
          .filter((a: any) => !sessionStorage.getItem(DISMISSED_KEY + storeKey + '-' + String(a.id)))
          .map((a: any) => ({
            id:        String(a.id),
            subject:   String(a.subject ?? ''),
            message:   String(a.message ?? ''),
            priority:  (a.priority ?? 'Normal') as Announcement['priority'],
            sentBy:    String(a.sentBy ?? ''),
            startDate: a.startDate ?? null,
            endDate:   a.endDate ?? null,
          }))
        if (pending.length > 0) {
          setCurrent(prev => prev ?? pending[0])   // don't overwrite if one is already open
          setQueue(pending.slice(1))
        }
      })
      .catch(() => {})
  }, [tenant?.id, currentStoreId])

  // Fetch on mount / store change
  useEffect(() => { fetchPopups() }, [fetchPopups])

  // Re-fetch when a new broadcast arrives via SignalR
  useEffect(() => {
    window.addEventListener('signalr:new-broadcast', fetchPopups)
    return () => window.removeEventListener('signalr:new-broadcast', fetchPopups)
  }, [fetchPopups])

  const dismiss = () => {
    if (current) {
      sessionStorage.setItem(dismissKey(current.id), '1')
    }
    if (queue.length > 0) {
      setCurrent(queue[0])
      setQueue(prev => prev.slice(1))
    } else {
      setCurrent(null)
    }
  }

  if (!current) return null

  const s = PRIORITY_STYLE[current.priority] ?? PRIORITY_STYLE.Normal

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={cn('flex items-center gap-3 px-6 py-4', s.header)}>
          {s.icon}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base leading-tight">{current.subject}</h3>
            {current.sentBy && (
              <p className="text-xs opacity-75 mt-0.5">from {current.sentBy}</p>
            )}
          </div>
          {queue.length > 0 && (
            <span className="text-xs opacity-75 bg-white/20 rounded-full px-2 py-0.5">
              1 of {queue.length + 1}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {current.message}
          </p>

          {(current.startDate || current.endDate) && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {current.startDate && (
                <p>Starts: {new Date(current.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
              )}
              {current.endDate && (
                <p>Ends: {new Date(current.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={dismiss}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', s.btn)}
          >
            Got it
          </button>
          {queue.length > 0 && (
            <button
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Next ({queue.length})
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
