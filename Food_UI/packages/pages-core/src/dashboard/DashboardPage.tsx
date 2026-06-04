import React, { useCallback, useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  TrendingUp, Ticket, AlertTriangle, Users, CreditCard, Banknote, Globe, RefreshCw,
} from 'lucide-react'
import { StatCard, Card, CardHeader, CardBody, Badge } from '@flowtap/ui-core'
import { useAppSelector } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'
import { reportsApi } from '@flowtap/api-core'
import { salesApi } from '@flowtap/api-core'
import { ticketsApi } from '@flowtap/api-core'
import { notificationsApi } from '@flowtap/api-core'

const BAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc']

interface DashboardStats {
  totalRevenueToday: number
  transactionsToday: number
  openTickets: number
  lowStockAlerts: number
  newClientsThisMonth: number
  totalRevenueThisMonth: number
}

interface ChartPoint { day: string; amount: number }
interface TopProduct { productName: string; quantitySold: number; revenue: number }
interface RecentSale {
  id: string
  transactionNumber?: string
  totalAmount: number
  createdAt: string
  payments?: { method: string }[]
}

const methodBadge = (method: string) => {
  const m = (method ?? '').toLowerCase()
  if (m === 'cash') return <Badge variant="success">Cash</Badge>
  if (m === 'card') return <Badge variant="info">Card</Badge>
  return <Badge variant="purple">{method || 'Other'}</Badge>
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const DashboardPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const { format: formatCurrencyRaw, currency } = useCurrency()
  const formatCurrency = (v: number) => {
    try {
      return formatCurrencyRaw(v)
    } catch {
      return v.toLocaleString()
    }
  }

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [recentTickets, setRecentTickets] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!tenant?.id) return
    if (isRefresh) setRefreshing(true)

    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const [statsRes, salesRes, topRes, recentRes] = await Promise.allSettled([
      reportsApi.getDashboardStats({ companyId: tenant.id, locationId: currentStoreId ?? undefined }),
      reportsApi.getSalesReport({
        companyId: tenant.id,
        locationId: currentStoreId ?? undefined,
        from: sevenDaysAgo.toISOString(),
        to: today.toISOString(),
      }),
      reportsApi.getTopProducts({
        companyId: tenant.id,
        locationId: currentStoreId ?? undefined,
        from: sevenDaysAgo.toISOString(),
        to: today.toISOString(),
        top: 5,
      }),
      salesApi.getSales({ companyId: tenant.id, locationId: currentStoreId ?? undefined, pageSize: 5, page: 1 }),
    ])

    if (statsRes.status === 'fulfilled') {
      const raw = statsRes.value.data.data ?? {}
      setStats({
        // Normalize: backend may send totalRevenueToday or totalRevenueTodayCount
        totalRevenueToday: raw.totalRevenueToday ?? raw.totalRevenueTodayCount ?? 0,
        transactionsToday:     raw.transactionsToday     ?? 0,
        openTickets:           raw.openTickets           ?? 0,
        lowStockAlerts:        raw.lowStockAlerts        ?? 0,
        newClientsThisMonth:   raw.newClientsThisMonth   ?? 0,
        totalRevenueThisMonth: raw.totalRevenueThisMonth ?? 0,
      })
    }

    if (salesRes.status === 'fulfilled') {
      const daily: { date: string; revenue: number }[] = salesRes.value.data.data?.dailySummary ?? []
      setChartData(
        daily.map((d) => ({
          day: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
          amount: d.revenue ?? 0,
        }))
      )
    }

    if (topRes.status === 'fulfilled') setTopProducts(topRes.value.data.data?.products ?? [])

    if (recentRes.status === 'fulfilled') {
      const raw = recentRes.value.data.data
      const list: RecentSale[] = Array.isArray(raw) ? raw : (raw?.items ?? [])
      setRecentSales(list.slice(0, 5))
    }

    // RepairShop — always load recent tickets
    try {
      const ticketRes = await ticketsApi.getTickets({ companyId: tenant.id, locationId: currentStoreId ?? undefined, pageSize: 5 })
      const raw = ticketRes.data.data
      const list = Array.isArray(raw) ? raw : (raw?.items ?? [])
      setRecentTickets(list)
    } catch {}

    setInitialLoading(false)
    setRefreshing(false)
  }, [tenant?.id, currentStoreId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Load Notification-type announcements for dashboard cards
  useEffect(() => {
    if (!tenant?.id) return
    notificationsApi
      .getAnnouncements({ companyId: tenant.id, type: 'Notification', locationId: currentStoreId ?? undefined, activeOnly: true, limit: 5 })
      .then(res => setAnnouncements(res.data?.data ?? []))
      .catch(() => {})
  }, [tenant?.id, currentStoreId])

  if (initialLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="lg:col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="md">Today: {todayLabel()}</Badge>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notification-type Announcement Cards */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a: any) => {
            const priority = String(a.priority ?? 'Normal')
            const style =
              priority === 'Critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' :
              priority === 'High'     ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200' :
              priority === 'Low'      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300' :
                                        'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            return (
              <div key={String(a.id)} className={`flex items-start gap-3 p-3 rounded-xl border ${style}`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-70" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{String(a.subject ?? '')}</p>
                  {a.message && <p className="text-xs mt-0.5 opacity-80">{String(a.message)}</p>}
                </div>
                <span className="text-[10px] opacity-60 flex-shrink-0">{String(a.sentBy ?? '')}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats?.totalRevenueToday ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Open Tickets"
          value={stats?.openTickets ?? 0}
          icon={<Ticket className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          title="Low Stock Alerts"
          value={stats?.lowStockAlerts ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <StatCard
          title="New Clients (Month)"
          value={stats?.newClientsThisMonth ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Chart + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader title="Sales — Last 7 Days" subtitle="Daily revenue trend" />
            <CardBody>
              {chartData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
                  No sales data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Sales']}
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '0.8125rem' }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader title="Recent Sales" subtitle="Last 5 transactions" />
            <CardBody className="p-0">
              {recentSales.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                  No recent sales
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recentSales.map((sale) => {
                    const method = sale.payments?.[0]?.method ?? ''
                    return (
                      <li key={sale.id} className="flex items-center justify-between px-6 py-3.5 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            {method.toLowerCase() === 'cash' ? (
                              <Banknote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : method.toLowerCase() === 'card' ? (
                              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {sale.transactionNumber ?? `#${sale.id.slice(-6).toUpperCase()}`}
                            </p>
                            <p className="text-xs text-gray-400">{timeAgo(sale.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(sale.totalAmount ?? 0)}
                          </span>
                          {methodBadge(method)}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Recent Repair Tickets */}
      {recentTickets.length > 0 && (
        <Card>
          <CardHeader title="Recent Repair Tickets" subtitle="Active service requests" />
          <CardBody className="p-0">
             {recentTickets.length === 0 ? (
               <div className="p-8 text-center text-gray-400 text-sm">No active tickets</div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                     <tr>
                       <th className="px-6 py-3 font-semibold">Ticket #</th>
                       <th className="px-6 py-3 font-semibold">Customer</th>
                       <th className="px-6 py-3 font-semibold">Issue</th>
                       <th className="px-6 py-3 font-semibold">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                     {recentTickets.map(t => (
                       <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                         <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400">
                           {t.ticketNumber || `#${t.id.slice(-6).toUpperCase()}`}
                         </td>
                         <td className="px-6 py-4">{t.customerName || 'Walk-in'}</td>
                         <td className="px-6 py-4 truncate max-w-[200px]">{t.problemDescription}</td>
                         <td className="px-6 py-4">
                           <Badge variant={
                             t.status === 'Completed' ? 'success' :
                             t.status === 'Pending' ? 'warning' : 'info'
                           }>{t.status}</Badge>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </CardBody>
        </Card>
      )}

      {/* Top Products */}
      <Card>
        <CardHeader title="Top Products" subtitle="By revenue — last 7 days" />
        <CardBody>
          {topProducts.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
              No product sales data yet
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="productName" width={160}
                    tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [v, 'Units']}
                    contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '0.8125rem' }} />
                  <Bar dataKey="quantitySold" radius={[0, 4, 4, 0]} barSize={18}>
                    {topProducts.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.productName} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="h-1.5 rounded-full" style={{
                          width: `${(p.quantitySold / (topProducts[0]?.quantitySold || 1)) * 100}%`,
                          backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                          minWidth: '8px',
                        }} />
                        <span className="text-xs text-gray-400 flex-shrink-0">{p.quantitySold} units</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
