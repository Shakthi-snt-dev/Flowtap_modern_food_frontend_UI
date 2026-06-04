import React, { useState, useEffect, useCallback } from 'react'
import { useAppSelector } from '@flowtap/store'
import { reportsApi } from '@flowtap/api-core'
import { employeesApi } from '@flowtap/api-core'
import { cn } from '@flowtap/shared'
import { useCurrency } from '@flowtap/shared'
import {
  Store, Users, ShoppingCart, Package, RefreshCw,
  TrendingUp, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react'

interface StoreStat {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}

interface Employee {
  id: string
  name: string
  jobTitle?: string
  status: string
  phone?: string
}

export const StoreAdminPage: React.FC = () => {
  const user = useAppSelector((s) => s.auth.user)
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const stores = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const { format } = useCurrency()

  // Use employee's default location, or fall back to currently selected store
  const locationId = user?.defaultLocationId ?? currentStoreId

  const storeName = stores.find(s => s.id === locationId)?.name ?? 'My Store'

  const [stats, setStats] = useState<{ revenueToday: number; openTickets: number; lowStockAlerts: number; dailyTransactions: number } | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadStats = useCallback(async () => {
    if (!tenant?.id || !locationId) return
    setStatsLoading(true)
    try {
      const res = await reportsApi.getDashboardStats({ companyId: tenant.id, locationId })
      const d = res.data?.data
      setStats({
        revenueToday: d?.revenueToday ?? 0,
        openTickets: d?.openTickets ?? 0,
        lowStockAlerts: d?.lowStockAlerts ?? 0,
        dailyTransactions: d?.dailyTransactions ?? d?.salesCount ?? 0,
      })
    } catch { /* non-fatal */ }
    finally { setStatsLoading(false) }
  }, [tenant?.id, locationId])

  const loadEmployees = useCallback(async () => {
    if (!tenant?.id || !locationId) return
    setEmpLoading(true)
    try {
      const res = await employeesApi.getEmployees({ companyId: tenant.id, locationId, isActive: true, pageSize: 50 })
      const raw: Record<string, unknown>[] = res.data?.data?.items ?? res.data?.data ?? []
      setEmployees(raw.map((e) => ({
        id: String(e.id ?? ''),
        name: String(e.name ?? ''),
        jobTitle: e.jobTitle ? String(e.jobTitle) : undefined,
        status: String(e.status ?? 'Active'),
        phone: e.phone ? String(e.phone) : undefined,
      })))
    } catch { /* non-fatal */ }
    finally { setEmpLoading(false) }
  }, [tenant?.id, locationId])

  const handleRefresh = () => {
    loadStats()
    loadEmployees()
    setLastRefresh(new Date())
  }

  useEffect(() => {
    loadStats()
    loadEmployees()
  }, [loadStats, loadEmployees])

  const statCards: StoreStat[] = [
    {
      label: 'Revenue Today',
      value: format(stats?.revenueToday ?? 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Today\'s Sales',
      value: stats?.dailyTransactions ?? 0,
      icon: <ShoppingCart className="w-5 h-5" />,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Open Tickets',
      value: stats?.openTickets ?? 0,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Low Stock Alerts',
      value: stats?.lowStockAlerts ?? 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Store Overview</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{storeName}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={statsLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', statsLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Last refresh note */}
      <p className="text-xs text-gray-400">
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </p>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4"
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', card.color)}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {statsLoading ? (
                <span className="inline-block w-16 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Team Section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">My Team</h2>
            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
              {employees.length}
            </span>
          </div>
          {user?.permissions?.['Employees'] && (
            <a
              href="/employees"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage employees →
            </a>
          )}
        </div>

        {empLoading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading team…</div>
        ) : employees.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No employees assigned to this store
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {employees.map((emp) => (
              <div key={emp.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-semibold text-blue-700 dark:text-blue-300">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                    {emp.jobTitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{emp.jobTitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {emp.phone && (
                    <span className="text-xs text-gray-400 hidden sm:block">{emp.phone}</span>
                  )}
                  <span className={cn(
                    'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                    emp.status === 'Active'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  )}>
                    {emp.status === 'Active' && <CheckCircle2 className="w-3 h-3" />}
                    {emp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
