import React, { useEffect, useState, useCallback } from 'react'
import {
  Receipt, Search, Filter, ChevronDown, X, Eye,
  Ban, Plus, Clock, CheckCircle2, XCircle, FileText,
  CreditCard, Banknote, Smartphone, ArrowRight, Printer,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { salesApi } from '@flowtap/api-core'
import { useCurrency } from '@flowtap/shared'
import { formatDateTime } from '@flowtap/shared'
import toast from 'react-hot-toast'
import { cn } from '@flowtap/shared'
import { SaleInvoicePrint } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleItem {
  id: string
  productId: string
  productName: string
  type: string
  quantity: number
  unitPrice: number
  taxPercent: number
  discountPercent: number
  total: number
}

interface Payment {
  id: string
  amount: number
  method: string
  purpose: string
  paidAt: string
  externalReference?: string
}

interface Sale {
  id: string
  transactionNumber?: string
  source: string
  subTotal: number
  taxAmount: number
  totalAmount: number
  status: string
  notes?: string
  createdAt: string
  locationId: string
  clientId: string
  items: SaleItem[]
  payments: Payment[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Draft:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Refunded:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'Completed') return <CheckCircle2 className="w-3.5 h-3.5" />
  if (status === 'Cancelled') return <XCircle className="w-3.5 h-3.5" />
  if (status === 'Draft')     return <Clock className="w-3.5 h-3.5" />
  return <FileText className="w-3.5 h-3.5" />
}

const PaymentMethodIcon: React.FC<{ method: string }> = ({ method }) => {
  if (method === 'Cash')  return <Banknote className="w-4 h-4 text-green-600" />
  if (method === 'Card')  return <CreditCard className="w-4 h-4 text-blue-600" />
  if (method === 'UPI')   return <Smartphone className="w-4 h-4 text-purple-600" />
  return <CreditCard className="w-4 h-4 text-gray-500" />
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────

const AddPaymentModal: React.FC<{
  sale: Sale
  onClose: () => void
  onSuccess: () => void
}> = ({ sale, onClose, onSuccess }) => {
  const { format } = useCurrency()
  const tenant = useAppSelector((s) => s.tenant.tenant)

  const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, sale.totalAmount - totalPaid)

  const [method, setMethod]   = useState('Cash')
  const [amount, setAmount]   = useState(remaining.toFixed(2))
  const [purpose, setPurpose] = useState('Final')
  const [ref, setRef]         = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setLoading(true)
    try {
      await salesApi.addPayment(sale.id, {
        companyId: tenant!.id,
        amount: amt,
        method,
        purpose,
        externalReference: ref || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      toast.success('Payment recorded')
      onSuccess()
      onClose()
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Add Payment</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm">
            <span className="text-gray-500">Sale Total</span>
            <span className="font-bold">{format(sale.totalAmount)}</span>
          </div>
          <div className="flex justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm">
            <span className="text-amber-700 dark:text-amber-400">Remaining</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">{format(remaining)}</span>
          </div>

          {/* Method */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Method</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {['Cash', 'Card', 'UPI'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                    method === m
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {['Advance', 'Partial', 'Final'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPurpose(p)}
                  className={cn(
                    'py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                    purpose === p
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reference / Transaction ID (optional)</label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. UPI Ref No."
              className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sale Detail Drawer ───────────────────────────────────────────────────────

const SaleDetailDrawer: React.FC<{
  sale: Sale | null
  onClose: () => void
  onVoid: (sale: Sale) => void
  onAddPayment: (sale: Sale) => void
  onPrint: (sale: Sale) => void
}> = ({ sale, onClose, onVoid, onAddPayment, onPrint }) => {
  const { format } = useCurrency()
  if (!sale) return null

  const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0)
  const isDraft   = sale.status === 'Draft'

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
              {sale.transactionNumber ?? 'Sale'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(sale.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', STATUS_STYLE[sale.status] ?? STATUS_STYLE.Draft)}>
              <StatusIcon status={sale.status} /> {sale.status}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Items */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</h3>
            <div className="space-y-2">
              {sale.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(item.unitPrice)} × {item.quantity}
                      {item.taxPercent > 0 && ` · Tax ${item.taxPercent}%`}
                      {item.discountPercent > 0 && ` · Disc ${item.discountPercent}%`}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white ml-3">{format(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{format(sale.subTotal)}</span>
            </div>
            {sale.taxAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax</span><span>{format(sale.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2 text-base">
              <span>Total</span><span>{format(sale.totalAmount)}</span>
            </div>
          </div>

          {/* Payments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payments</h3>
              {isDraft && (
                <button
                  onClick={() => onAddPayment(sale)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Payment
                </button>
              )}
            </div>
            {sale.payments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <PaymentMethodIcon method={p.method} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {p.method} · <span className="text-xs text-gray-400">{p.purpose}</span>
                      </p>
                      {p.externalReference && (
                        <p className="text-xs text-gray-400">Ref: {p.externalReference}</p>
                      )}
                      <p className="text-xs text-gray-400">{formatDateTime(p.paidAt)}</p>
                    </div>
                    <span className="font-semibold text-green-600">{format(p.amount)}</span>
                  </div>
                ))}
                {/* Payment summary */}
                <div className="flex justify-between px-3 py-2 text-sm font-medium">
                  <span className="text-gray-500">Total Paid</span>
                  <span className={totalPaid >= sale.totalAmount ? 'text-green-600' : 'text-amber-600'}>
                    {format(totalPaid)}
                  </span>
                </div>
                {totalPaid < sale.totalAmount && (
                  <div className="flex justify-between px-3 py-2 text-sm font-medium bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <span className="text-amber-700 dark:text-amber-400">Remaining</span>
                    <span className="text-amber-700 dark:text-amber-400">{format(sale.totalAmount - totalPaid)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {sale.notes && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Notes</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          {isDraft && (
            <button
              onClick={() => { onAddPayment(sale); onClose() }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Payment
            </button>
          )}
          <button
            onClick={() => onPrint(sale)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          {sale.status !== 'Cancelled' && (
            <button
              onClick={() => onVoid(sale)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-semibold transition-colors"
            >
              <Ban className="w-4 h-4" /> Void
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SalesPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const { format }     = useCurrency()

  const [sales, setSales]           = useState<Sale[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(false)

  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  const [selectedSale, setSelectedSale]       = useState<Sale | null>(null)
  const [addPaymentSale, setAddPaymentSale]   = useState<Sale | null>(null)
  const [printSale, setPrintSale]             = useState<Sale | null>(null)

  const PAGE_SIZE = 20

  const loadSales = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await salesApi.getSales({
        companyId:  tenant.id,
        locationId: currentStoreId ?? undefined,
        status:     statusFilter || undefined,
        startDate:  dateFrom || undefined,
        endDate:    dateTo || undefined,
        page,
        pageSize:   PAGE_SIZE,
      })
      const d = res.data?.data ?? res.data
      setSales(d?.items ?? d ?? [])
      setTotal(d?.totalCount ?? d?.total ?? 0)
    } catch {
      toast.error('Failed to load sales')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, currentStoreId, statusFilter, dateFrom, dateTo, page])

  useEffect(() => { loadSales() }, [loadSales])

  const handleVoid = async (sale: Sale) => {
    const reason = window.prompt(`Void sale ${sale.transactionNumber}? Enter reason:`)
    if (reason === null) return
    try {
      await salesApi.voidSale(sale.id, reason)
      toast.success('Sale voided')
      setSelectedSale(null)
      loadSales()
    } catch {
      toast.error('Failed to void sale')
    }
  }

  // Filter client-side by search (transaction number / client)
  const displayed = search
    ? sales.filter((s) =>
        s.transactionNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : sales

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sales</h1>
            <p className="text-sm text-gray-500">{total} transactions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none appearance-none"
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Refunded">Refunded</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {(statusFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setStatus(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No sales found</p>
            <p className="text-sm mt-1">Complete a sale from the POS to see it here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Invoice</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Items</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Payments</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Total</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {displayed.map((sale) => {
                  const paid = sale.payments.reduce((s, p) => s + p.amount, 0)
                  const methods = [...new Set(sale.payments.map((p) => p.method))]
                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSale(sale)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {sale.transactionNumber ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {methods.map((m) => (
                            <span key={m} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
                              <PaymentMethodIcon method={m} />
                              {m}
                            </span>
                          ))}
                          {methods.length === 0 && <span className="text-gray-400 text-xs italic">None</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{format(sale.totalAmount)}</p>
                          {paid < sale.totalAmount && paid > 0 && (
                            <p className="text-xs text-amber-500">Paid {format(paid)}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', STATUS_STYLE[sale.status] ?? STATUS_STYLE.Draft)}>
                          <StatusIcon status={sale.status} /> {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedSale(sale) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Next <ArrowRight className="inline w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {/* Detail drawer */}
      <SaleDetailDrawer
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onVoid={handleVoid}
        onAddPayment={(s) => { setAddPaymentSale(s); setSelectedSale(null) }}
        onPrint={(s) => { setPrintSale(s); setSelectedSale(null) }}
      />

      {/* Add payment modal */}
      {addPaymentSale && (
        <AddPaymentModal
          sale={addPaymentSale}
          onClose={() => setAddPaymentSale(null)}
          onSuccess={loadSales}
        />
      )}

      {/* Invoice print preview */}
      {printSale && (
        <SaleInvoicePrint
          sale={printSale}
          onClose={() => setPrintSale(null)}
        />
      )}
    </div>
  )
}
