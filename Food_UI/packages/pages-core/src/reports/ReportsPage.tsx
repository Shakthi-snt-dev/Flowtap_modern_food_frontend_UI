import React, { useCallback, useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  DollarSign, ShoppingBag, BarChart2, Package, AlertTriangle, Download, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { StatCard, Card, CardHeader, CardBody, Badge, Table, Button } from '@flowtap/ui-core'
import { useAppSelector } from '@flowtap/store'
import { reportsApi } from '@flowtap/api-core'

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface SalesReport {
  totalRevenue: number
  totalTax: number
  totalTransactions: number
  dailySummary: { date: string; revenue: number; transactions: number }[]
}

interface TopProduct { productName: string; quantitySold: number; revenue: number }

interface InventoryReport {
  totalProducts: number
  lowStockItems: number
  outOfStockItems: number
  totalInventoryValue: number
  items: { productName: string; sku: string; quantity: number }[]
}

interface ExpensesReport {
  totalExpenses: number
  items: { id: string; description: string; amount: number; category?: string; date?: string }[]
}

const formatCurrencyWith = (currency: string) => (v: number) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  } catch {
    return v.toLocaleString('en-IN')
  }
}

const todayIso = () => new Date().toISOString().split('T')[0]
const nDaysAgoIso = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const stockStatus = (qty: number) => {
  if (qty <= 0) return { label: 'Out', variant: 'danger' as const }
  if (qty <= 5) return { label: 'Low', variant: 'warning' as const }
  return { label: 'OK', variant: 'success' as const }
}

export const ReportsPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const formatCurrency = formatCurrencyWith(tenant?.currency ?? 'INR')

  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'expenses'>('sales')
  const [startDate, setStartDate] = useState(nDaysAgoIso(30))
  const [endDate, setEndDate] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null)
  const [inventoryLoaded, setInventoryLoaded] = useState(false)
  const [expensesReport, setExpensesReport] = useState<ExpensesReport | null>(null)
  const [expensesLoaded, setExpensesLoaded] = useState(false)

  const fetchSalesData = useCallback(async (from: string, to: string) => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const fromIso = new Date(from).toISOString()
      const toIso = new Date(to + 'T23:59:59').toISOString()
      const locationId = currentStoreId ?? undefined
      const [salesRes, topRes] = await Promise.allSettled([
        reportsApi.getSalesReport({ companyId: tenant.id, from: fromIso, to: toIso, locationId }),
        reportsApi.getTopProducts({ companyId: tenant.id, from: fromIso, to: toIso, top: 10, locationId }),
      ])
      if (salesRes.status === 'fulfilled') setSalesReport(salesRes.value.data.data)
      if (topRes.status === 'fulfilled') setTopProducts(topRes.value.data.data?.products ?? [])
    } catch {
      toast.error('Failed to load sales report')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, currentStoreId])

  const fetchInventory = useCallback(async () => {
    if (!tenant?.id || inventoryLoaded) return
    try {
      const res = await reportsApi.getInventoryReport({ companyId: tenant.id, locationId: currentStoreId ?? undefined })
      setInventoryReport(res.data.data)
      setInventoryLoaded(true)
    } catch {
      toast.error('Failed to load inventory report')
    }
  }, [tenant?.id, inventoryLoaded])

  const fetchExpenses = useCallback(async (from: string, to: string) => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const fromIso = new Date(from).toISOString()
      const toIso = new Date(to + 'T23:59:59').toISOString()
      const res = await reportsApi.getExpensesReport({ companyId: tenant.id, from: fromIso, to: toIso })
      const raw = res.data.data ?? {}
      setExpensesReport({
        totalExpenses: Number(raw.totalExpenses ?? raw.total ?? 0),
        items: Array.isArray(raw.items) ? raw.items.map((e: Record<string, unknown>) => ({
          id: String(e.id ?? Math.random()),
          description: String(e.description ?? e.name ?? ''),
          amount: Number(e.amount ?? 0),
          category: e.category ? String(e.category) : undefined,
          date: e.date ?? e.createdAt ? new Date(String(e.date ?? e.createdAt)).toLocaleDateString('en-IN') : undefined,
        })) : [],
      })
      setExpensesLoaded(true)
    } catch {
      toast.error('Failed to load expenses report')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchSalesData(startDate, endDate) }, [fetchSalesData])

  useEffect(() => {
    if (activeTab === 'inventory') fetchInventory()
    if (activeTab === 'expenses' && !expensesLoaded) fetchExpenses(startDate, endDate)
  }, [activeTab, fetchInventory, fetchExpenses, expensesLoaded, startDate, endDate])

  const handleGenerate = () => {
    if (!startDate || !endDate) { toast.error('Select both dates'); return }
    if (startDate > endDate) { toast.error('Start date must be before end date'); return }
    if (activeTab === 'sales') fetchSalesData(startDate, endDate)
    if (activeTab === 'inventory') { setInventoryLoaded(false); fetchInventory() }
    if (activeTab === 'expenses') { setExpensesLoaded(false); fetchExpenses(startDate, endDate) }
  }

  const handleExportCsv = () => {
    if (activeTab === 'sales') {
      if (!salesReport && topProducts.length === 0) {
        toast.error('No data to export')
        return
      }
      // Daily summary sheet
      if (salesReport?.dailySummary?.length) {
        const rows = salesReport.dailySummary.map((d) => [
          new Date(d.date).toLocaleDateString('en-IN'),
          String(d.revenue),
          String(d.transactions),
        ])
        downloadCsv(
          `sales-report-${startDate}-to-${endDate}.csv`,
          rows,
          ['Date', 'Revenue', 'Transactions'],
        )
        toast.success('Sales report exported')
        return
      }
      // Top products fallback
      if (topProducts.length > 0) {
        const rows = topProducts.map((p) => [p.productName, String(p.quantitySold), String(p.revenue)])
        downloadCsv(`top-products-${startDate}-to-${endDate}.csv`, rows, ['Product', 'Units Sold', 'Revenue'])
        toast.success('Top products exported')
        return
      }
      toast.error('No data to export')
    } else if (activeTab === 'inventory') {
      if (!inventoryReport?.items?.length) { toast.error('No inventory data to export'); return }
      const rows = inventoryReport.items.map((item) => [
        item.productName, item.sku, String(item.quantity),
        item.quantity <= 0 ? 'Out of Stock' : item.quantity <= 5 ? 'Low Stock' : 'OK',
      ])
      downloadCsv('inventory-report.csv', rows, ['Product', 'SKU', 'Quantity', 'Status'])
      toast.success('Inventory report exported')
    } else if (activeTab === 'expenses') {
      if (!expensesReport?.items?.length) { toast.error('No expenses data to export'); return }
      const rows = expensesReport.items.map((e) => [
        e.description, e.category ?? '', String(e.amount), e.date ?? '',
      ])
      downloadCsv(`expenses-${startDate}-to-${endDate}.csv`, rows, ['Description', 'Category', 'Amount', 'Date'])
      toast.success('Expenses exported')
    }
  }

  // Group daily summary into monthly buckets for the bar chart
  const monthlyData = React.useMemo(() => {
    if (!salesReport?.dailySummary?.length) return []
    const map = new Map<string, number>()
    for (const d of salesReport.dailySummary) {
      const key = new Date(d.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      map.set(key, (map.get(key) ?? 0) + d.revenue)
    }
    return Array.from(map.entries()).map(([month, revenue]) => ({ month, revenue }))
  }, [salesReport])

  const salesProductColumns = [
    { key: 'productName', header: 'Product Name' },
    { key: 'quantitySold', header: 'Units Sold',
      render: (row: TopProduct) => <span className="font-medium">{row.quantitySold}</span> },
    { key: 'revenue', header: 'Revenue',
      render: (row: TopProduct) => (
        <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(row.revenue)}</span>
      )},
  ]

  const inventoryColumns = [
    { key: 'productName', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    { key: 'quantity', header: 'Stock',
      render: (row: { quantity: number }) => (
        <span className={row.quantity <= 0 ? 'text-red-500 font-semibold' : ''}>{row.quantity}</span>
      )},
    { key: 'status', header: 'Status',
      render: (row: { quantity: number }) => {
        const s = stockStatus(row.quantity)
        return <Badge variant={s.variant}>{s.label}</Badge>
      }},
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />}
          onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'sales', label: 'Sales Report' },
          { key: 'inventory', label: 'Inventory' },
          { key: 'expenses', label: 'Expenses' },
        ] as const).map(({ key, label: tabLabel }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
            ].join(' ')}>
            {tabLabel}
          </button>
        ))}
      </div>

      {/* Date range */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <Button variant="primary" icon={<RefreshCw className="w-4 h-4" />} onClick={handleGenerate} loading={loading}>
              Generate
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Revenue" value={formatCurrency(salesReport?.totalRevenue ?? 0)}
              icon={<DollarSign className="w-5 h-5" />} color="green" />
            <StatCard title="Total Orders" value={(salesReport?.totalTransactions ?? 0).toLocaleString('en-IN')}
              icon={<ShoppingBag className="w-5 h-5" />} color="blue" />
            <StatCard title="Avg. Order Value"
              value={formatCurrency(salesReport?.totalTransactions
                ? Math.round((salesReport.totalRevenue ?? 0) / salesReport.totalTransactions)
                : 0)}
              icon={<BarChart2 className="w-5 h-5" />} color="purple" />
          </div>

          <Card>
            <CardHeader title="Revenue by Period" subtitle="Grouped by month" />
            <CardBody>
              {monthlyData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
                  {loading ? 'Loading...' : 'No sales data for this period'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '0.8125rem' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Top 10 Products" subtitle="By revenue in selected period" />
            <CardBody className="p-0">
              {topProducts.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
                  {loading ? 'Loading...' : 'No product data'}
                </div>
              ) : (
                <Table data={topProducts} columns={salesProductColumns} />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total SKUs" value={inventoryReport?.totalProducts ?? 0}
              icon={<Package className="w-5 h-5" />} color="blue" />
            <StatCard title="Low Stock" value={inventoryReport?.lowStockItems ?? 0}
              icon={<AlertTriangle className="w-5 h-5" />} color="orange" />
            <StatCard title="Out of Stock" value={inventoryReport?.outOfStockItems ?? 0}
              icon={<AlertTriangle className="w-5 h-5" />} color="red" />
          </div>

          <Card>
            <CardHeader title="Stock Status" subtitle="All products" />
            <CardBody className="p-0">
              {!inventoryReport ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : inventoryReport.items.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">No inventory data</div>
              ) : (
                <Table data={inventoryReport.items} columns={inventoryColumns} />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Total Expenses"
              value={formatCurrency(expensesReport?.totalExpenses ?? 0)}
              icon={<DollarSign className="w-5 h-5" />} color="red" />
            <StatCard title="Expense Entries"
              value={(expensesReport?.items?.length ?? 0).toLocaleString('en-IN')}
              icon={<BarChart2 className="w-5 h-5" />} color="orange" />
          </div>

          <Card>
            <CardHeader title="Expense Breakdown" subtitle="All recorded expenses in the selected period" />
            <CardBody className="p-0">
              {loading ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
              ) : !expensesReport?.items?.length ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">No expenses recorded for this period</div>
              ) : (
                <Table
                  data={expensesReport.items}
                  columns={[
                    { key: 'description', header: 'Description' },
                    {
                      key: 'category', header: 'Category',
                      render: (row: ExpensesReport['items'][0]) => (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {row.category ?? 'General'}
                        </span>
                      ),
                    },
                    { key: 'date', header: 'Date', render: (row: ExpensesReport['items'][0]) => row.date ?? '—' },
                    {
                      key: 'amount', header: 'Amount',
                      render: (row: ExpensesReport['items'][0]) => (
                        <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(row.amount)}</span>
                      ),
                    },
                  ]}
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
