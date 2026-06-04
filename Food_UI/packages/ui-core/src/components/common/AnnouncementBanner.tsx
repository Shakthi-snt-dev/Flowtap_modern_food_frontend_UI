import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Info, Zap, X, Megaphone } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { notificationsApi } from '@flowtap/api-core'
import { cn } from '@flowtap/shared'

const SIDEBAR_OFFSET = {
  open:   'lg:left-64',
  closed: 'lg:left-16',
}

interface Announcement {
  id: string
  subject: string
  message: string
  priority: 'Low' | 'Normal' | 'High' | 'Critical'
  sentBy: string
}

const PRIORITY_STYLE: Record<string, { bar: string; icon: React.ReactNode; close: string }> = {
  Critical: {
    bar:   'bg-red-600 dark:bg-red-700',
    icon:  <Zap className="w-4 h-4 flex-shrink-0" />,
    close: 'hover:bg-red-700',
  },
  High: {
    bar:   'bg-amber-500 dark:bg-amber-600',
    icon:  <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
    close: 'hover:bg-amber-600',
  },
  Normal: {
    bar:   'bg-blue-600 dark:bg-blue-700',
    icon:  <Info className="w-4 h-4 flex-shrink-0" />,
    close: 'hover:bg-blue-700',
  },
  Low: {
    bar:   'bg-gray-500 dark:bg-gray-600',
    icon:  <Megaphone className="w-4 h-4 flex-shrink-0" />,
    close: 'hover:bg-gray-600',
  },
}

const DISMISSED_KEY = 'dismissed-announcement-banner-'

export const AnnouncementBanner: React.FC = () => {
  const tenant         = useAppSelector(s => s.tenant.tenant)
  const currentStoreId = useAppSelector(s => s.tenant.currentStoreId)
  const sidebarOpen    = useAppSelector(s => s.ui.sidebarOpen)

  const [items, setItems] = useState<Announcement[]>([])

  // Dismiss key is per-store so closing a banner in store A doesn't affect store B
  const dismissKey = (id: string) => DISMISSED_KEY + (currentStoreId ?? 'global') + '-' + id

  const fetchBanners = useCallback(() => {
    if (!tenant?.id) return
    notificationsApi
      .getAnnouncements({ companyId: tenant.id, type: 'Banner', locationId: currentStoreId ?? undefined, activeOnly: true, limit: 5 })
      .then((res) => {
        const raw: any[] = res.data?.data ?? []
        const storeKey = currentStoreId ?? 'global'
        const filtered = raw
          .filter((a: any) => !sessionStorage.getItem(DISMISSED_KEY + storeKey + '-' + String(a.id)))
          .map((a: any) => ({
            id:       String(a.id),
            subject:  String(a.subject ?? ''),
            message:  String(a.message ?? ''),
            priority: (a.priority ?? 'Normal') as Announcement['priority'],
            sentBy:   String(a.sentBy ?? ''),
          }))
        setItems(filtered)
      })
      .catch(() => {})
  }, [tenant?.id, currentStoreId])

  // Fetch on mount / store change
  useEffect(() => { fetchBanners() }, [fetchBanners])

  // Re-fetch when a new broadcast arrives via SignalR
  useEffect(() => {
    window.addEventListener('signalr:new-broadcast', fetchBanners)
    return () => window.removeEventListener('signalr:new-broadcast', fetchBanners)
  }, [fetchBanners])

  const dismiss = (id: string) => {
    sessionStorage.setItem(dismissKey(id), '1')
    setItems(prev => prev.filter(a => a.id !== id))
  }

  if (items.length === 0) return null

  return (
    <div className={cn(
      'fixed top-16 right-0 z-[55] flex flex-col left-0 transition-all duration-300',
      sidebarOpen ? SIDEBAR_OFFSET.open : SIDEBAR_OFFSET.closed,
    )}>
      {items.map((a) => {
        const s = PRIORITY_STYLE[a.priority] ?? PRIORITY_STYLE.Normal
        return (
          <div
            key={a.id}
            className={cn('flex items-center gap-3 px-4 py-2.5 text-white text-sm', s.bar)}
          >
            {s.icon}
            <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold whitespace-nowrap">{a.subject}</span>
              {a.message && (
                <span className="opacity-90 text-xs truncate">{a.message}</span>
              )}
              {a.sentBy && (
                <span className="opacity-60 text-[11px] whitespace-nowrap">— {a.sentBy}</span>
              )}
            </div>
            <button
              onClick={() => dismiss(a.id)}
              className={cn('flex-shrink-0 p-1 rounded transition-colors', s.close)}
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
