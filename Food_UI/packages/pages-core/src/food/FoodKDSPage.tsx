import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { foodApi, type KitchenOrder, type KOTStatus } from '@flowtap/api-core'

// ─── Config ───────────────────────────────────────────────────────────────────

const AUTO_REFRESH_MS = 15_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeElapsed(createdAt?: string): { display: string; isUrgent: boolean } {
  if (!createdAt) return { display: '—', isUrgent: false }
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  const mins = Math.floor(secs / 60)
  const display = mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`
  return { display, isUrgent: mins >= 15 }
}

// ─── KDS Card ─────────────────────────────────────────────────────────────────

interface KDSCardProps {
  order: KitchenOrder
  onAdvance: (order: KitchenOrder) => void
  advancing: string | null
}

const KDSCard: React.FC<KDSCardProps> = ({ order, onAdvance, advancing }) => {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const { display, isUrgent } = timeElapsed(order.createdAt)
  const isNew       = order.status === 'New'
  const isAdvancing = advancing === order.id

  const nextLabel = isNew ? 'START COOKING' : 'MARK READY'

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all ${
        isNew
          ? 'bg-gray-900 border-blue-500'
          : 'bg-gray-800 border-orange-500'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-black tracking-wide text-white">
            {order.kotNumber ?? '—'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {order.table && (
              <span className="text-sm font-semibold text-gray-300">{order.table.name}</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
              {order.orderType}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-bold ${isUrgent ? 'text-red-400' : 'text-gray-400'}`}>
          <Clock className="w-4 h-4" />
          {display}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-baseline gap-3">
            <span className="text-2xl font-black text-white leading-none">×{item.quantity}</span>
            <span className="text-lg font-semibold text-white leading-snug">{item.productName}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="text-sm text-amber-300 font-medium italic border-t border-gray-700 pt-2">
          {order.notes}
        </p>
      )}

      {/* Action */}
      <button
        onClick={() => onAdvance(order)}
        disabled={isAdvancing}
        className={`w-full py-3 rounded-xl text-sm font-black tracking-wider uppercase transition-all
                   disabled:opacity-50 active:scale-95 ${
          isNew
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-orange-600 hover:bg-orange-500 text-white'
        }`}
      >
        {isAdvancing ? '...' : nextLabel}
      </button>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FoodKDSPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [orders, setOrders]     = useState<KitchenOrder[]>([])
  const [loading, setLoading]   = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const companyId  = tenant?.id ?? ''
  const locationId = currentStoreId ?? ''

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadOrders = useCallback(async () => {
    if (!companyId || !locationId) return
    setLoading(true)
    try {
      const res = await foodApi.getOrders({ companyId, locationId })
      const all: KitchenOrder[] = res.data?.data ?? res.data ?? []
      // KDS shows only New and Preparing
      setOrders(all.filter((o) => o.status === 'New' || o.status === 'Preparing'))
      setLastRefresh(new Date())
    } catch {
      // silent fail on auto-refresh
    } finally {
      setLoading(false)
    }
  }, [companyId, locationId])

  useEffect(() => {
    loadOrders()
    timerRef.current = setInterval(loadOrders, AUTO_REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadOrders])

  const handleAdvance = async (order: KitchenOrder) => {
    const next: KOTStatus = order.status === 'New' ? 'Preparing' : 'Ready'
    setAdvancing(order.id)
    try {
      await foodApi.updateOrderStatus(order.id, next)
      loadOrders()
    } catch {
      toast.error('Failed to update order')
    } finally {
      setAdvancing(null)
    }
  }

  const newOrders      = orders.filter((o) => o.status === 'New')
  const preparingOrders = orders.filter((o) => o.status === 'Preparing')

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black tracking-tight text-white">KITCHEN DISPLAY</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 border border-gray-700
                       rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Counts */}
      <div className="flex gap-4 mb-6">
        <div className="px-4 py-2 bg-blue-900/40 border border-blue-700 rounded-xl">
          <span className="text-2xl font-black text-blue-400">{newOrders.length}</span>
          <span className="text-sm text-blue-400 ml-2 font-semibold">NEW</span>
        </div>
        <div className="px-4 py-2 bg-orange-900/40 border border-orange-700 rounded-xl">
          <span className="text-2xl font-black text-orange-400">{preparingOrders.length}</span>
          <span className="text-sm text-orange-400 ml-2 font-semibold">PREPARING</span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-24 text-gray-600 text-xl font-semibold">
          Kitchen is clear — no active orders
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* New Orders Column */}
          <div>
            <h2 className="text-lg font-black text-blue-400 tracking-widest uppercase mb-4 border-b border-blue-900 pb-2">
              New Orders
            </h2>
            {newOrders.length === 0 ? (
              <p className="text-gray-700 text-sm">No new orders</p>
            ) : (
              <div className="space-y-4">
                {newOrders.map((o) => (
                  <KDSCard key={o.id} order={o} onAdvance={handleAdvance} advancing={advancing} />
                ))}
              </div>
            )}
          </div>

          {/* Preparing Column */}
          <div>
            <h2 className="text-lg font-black text-orange-400 tracking-widest uppercase mb-4 border-b border-orange-900 pb-2">
              Preparing
            </h2>
            {preparingOrders.length === 0 ? (
              <p className="text-gray-700 text-sm">Nothing in progress</p>
            ) : (
              <div className="space-y-4">
                {preparingOrders.map((o) => (
                  <KDSCard key={o.id} order={o} onAdvance={handleAdvance} advancing={advancing} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
