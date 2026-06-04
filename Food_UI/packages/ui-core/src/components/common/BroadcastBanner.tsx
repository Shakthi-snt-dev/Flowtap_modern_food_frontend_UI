import React, { useEffect, useState } from 'react'
import { AlertTriangle, Info, Zap, X } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { notificationsApi } from '@flowtap/api-core'
import { cn } from '@flowtap/shared'

// mirrors the same offset classes used by AppLayout's <main>
const SIDEBAR_OFFSET = {
  open:   'lg:left-64',
  closed: 'lg:left-16',
}

interface BroadcastItem {
  id: string
  subject: string
  message: string
  severity: 'Information' | 'Warning' | 'Alert'
  sentBy: string
}

const STYLE = {
  Alert: {
    bar:    'bg-red-600 dark:bg-red-700',
    icon:   <Zap className="w-4 h-4 flex-shrink-0" />,
    close:  'hover:bg-red-700 dark:hover:bg-red-600',
  },
  Warning: {
    bar:    'bg-amber-500 dark:bg-amber-600',
    icon:   <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
    close:  'hover:bg-amber-600 dark:hover:bg-amber-500',
  },
  Information: {
    bar:    'bg-blue-600 dark:bg-blue-700',
    icon:   <Info className="w-4 h-4 flex-shrink-0" />,
    close:  'hover:bg-blue-700 dark:hover:bg-blue-600',
  },
}

export const BroadcastBanner: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const sidebarOpen    = useAppSelector((s) => s.ui.sidebarOpen)

  const [items, setItems] = useState<BroadcastItem[]>([])

  useEffect(() => {
    if (!tenant?.id) return
    notificationsApi
      .getBroadcasts({ companyId: tenant.id, locationId: currentStoreId ?? undefined, limit: 5 })
      .then((res) => {
        const raw: any[] = res.data?.data ?? []
        setItems(
          raw.map((b: any) => ({
            id:       String(b.id),
            subject:  String(b.subject ?? ''),
            message:  String(b.message ?? ''),
            severity: (b.severity ?? 'Information') as BroadcastItem['severity'],
            sentBy:   String(b.sentBy ?? ''),
          }))
        )
      })
      .catch(() => {})
  }, [tenant?.id, currentStoreId])

  const dismiss = (id: string) => {
    notificationsApi.dismissBroadcast(id).catch(() => {})
    setItems((prev) => prev.filter((b) => b.id !== id))
  }

  if (items.length === 0) return null

  return (
    <div className={cn(
      'fixed top-16 right-0 z-[60] flex flex-col left-0 transition-all duration-300',
      sidebarOpen ? SIDEBAR_OFFSET.open : SIDEBAR_OFFSET.closed,
    )}>
      {items.map((b) => {
        const s = STYLE[b.severity] ?? STYLE.Information
        return (
          <div
            key={b.id}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 text-white text-sm',
              s.bar,
            )}
          >
            {s.icon}
            <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold whitespace-nowrap">{b.subject}</span>
              {b.message && (
                <span className="opacity-90 text-xs truncate">{b.message}</span>
              )}
              {b.sentBy && (
                <span className="opacity-60 text-[11px] whitespace-nowrap">— {b.sentBy}</span>
              )}
            </div>
            <button
              onClick={() => dismiss(b.id)}
              className={cn(
                'flex-shrink-0 p-1 rounded transition-colors',
                s.close,
              )}
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
