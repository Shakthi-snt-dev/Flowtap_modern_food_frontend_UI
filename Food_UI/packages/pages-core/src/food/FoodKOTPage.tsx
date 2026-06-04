import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Clock, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { foodApi, type KitchenOrder, type KOTStatus } from '@flowtap/api-core'
import { Badge, Spinner } from '@flowtap/ui-core'

// ─── Config ───────────────────────────────────────────────────────────────────

const TABS: { label: string; value: KOTStatus | 'All' }[] = [
  { label: 'All',       value: 'All'       },
  { label: 'New',       value: 'New'       },
  { label: 'Preparing', value: 'Preparing' },
  { label: 'Ready',     value: 'Ready'     },
  { label: 'Served',    value: 'Served'    },
]

const STATUS_NEXT: Partial<Record<KOTStatus, KOTStatus>> = {
  New:       'Preparing',
  Preparing: 'Ready',
  Ready:     'Served',
}

const STATUS_COLORS: Record<KOTStatus, string> = {
  New:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Preparing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Ready:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Served:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const AUTO_REFRESH_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeElapsed(createdAt?: string) {
  if (!createdAt) return '—'
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (diff < 60)  return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FoodKOTPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [orders, setOrders]     = useState<KitchenOrder[]>([])
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState<KOTStatus | 'All'>('All')
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [, forceRefresh]        = useState(0)

  const companyId  = tenant?.id ?? ''
  const locationId = currentStoreId ?? ''

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadOrders = useCallback(async () => {
    if (!companyId || !locationId) return
    setLoading(true)
    try {
      const res = await foodApi.getOrders({ companyId, locationId })
      setOrders(res.data?.data ?? res.data ?? [])
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [companyId, locationId])

  useEffect(() => {
    loadOrders()
    timerRef.current = setInterval(() => {
      loadOrders()
      forceRefresh((n) => n + 1) // also update elapsed times
    }, AUTO_REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadOrders])

  // Tick elapsed times every second
  useEffect(() => {
    const id = setInterval(() => forceRefresh((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const handleAdvance = async (order: KitchenOrder) => {
    const next = STATUS_NEXT[order.status as KOTStatus]
    if (!next) return
    setAdvancing(order.id)
    try {
      await foodApi.updateOrderStatus(order.id, next)
      toast.success(`KOT ${order.kotNumber} → ${next}`)
      loadOrders()
    } catch {
      toast.error('Failed to update order')
    } finally {
      setAdvancing(null)
    }
  }

  const displayed = tab === 'All' ? orders : orders.filter((o) => o.status === tab)

  const tabCounts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.value] = t.value === 'All' ? orders.length : orders.filter((o) => o.status === t.value).length
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kitchen Orders (KOT)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Auto-refreshes every 30 seconds</p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400
                     border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800
                     transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
            {tabCounts[t.value] > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                {tabCounts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">No orders found.</div>
      ) : (
        <div className="space-y-3">
          {displayed.map((order) => {
            const nextStatus = STATUS_NEXT[order.status as KOTStatus]
            return (
              <div
                key={order.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {order.kotNumber ?? 'KOT-????'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status as KOTStatus] ?? ''}`}>
                        {order.status}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {order.orderType}
                      </span>
                      {order.table && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {order.table.name}
                        </span>
                      )}
                    </div>

                    {/* Items */}
                    <ul className="mt-2 space-y-0.5">
                      {order.items.map((item) => (
                        <li key={item.id} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                          <span className="font-medium text-gray-500 dark:text-gray-400 w-6 shrink-0">×{item.quantity}</span>
                          <span>{item.productName}</span>
                          {item.notes && <span className="text-gray-400 italic">({item.notes})</span>}
                        </li>
                      ))}
                    </ul>

                    {order.notes && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 italic">Note: {order.notes}</p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      {timeElapsed(order.createdAt)}
                    </div>
                    {nextStatus && (
                      <button
                        onClick={() => handleAdvance(order)}
                        disabled={advancing === order.id}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                                   text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {advancing === order.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            {nextStatus}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
