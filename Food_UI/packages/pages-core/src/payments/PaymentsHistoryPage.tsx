import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Banknote, CreditCard, Smartphone, Building2, Wallet,
  ArrowRight, ReceiptText, Ticket, ChevronLeft, ChevronRight,
  Filter, RefreshCw, Printer,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { salesApi } from '@flowtap/api-core'
import { Badge, Button, Spinner, SaleInvoicePrint } from '@flowtap/ui-core'
import type { InvoiceSale } from '@flowtap/ui-core'
import { cn } from '@flowtap/shared'
import { useCurrency } from '@flowtap/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string
  amount: number
  method: string
  purpose: string
  accountName: string
  accountType: string
  ticketId?: string
  ticketNumber?: string
  saleId?: string
  saleTransactionNumber?: string
  externalReference?: string
  comment?: string
  paidAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_ICON: Record<string, React.ReactNode> = {
  Cash:       <Banknote className="w-4 h-4" />,
  Card:       <CreditCard className="w-4 h-4" />,
  UPI:        <Smartphone className="w-4 h-4" />,
  NetBanking: <Building2 className="w-4 h-4" />,
  Wallet:     <Wallet className="w-4 h-4" />,
}

const PURPOSE_BADGE: Record<string, 'warning' | 'success' | 'info' | 'default'> = {
  Advance: 'warning',
  Final:   'success',
  Partial: 'info',
}

const METHODS  = ['All', 'Cash', 'Card', 'UPI', 'NetBanking', 'Wallet']
const PURPOSES = ['All', 'Advance', 'Partial', 'Final']
const PAGE_SIZE = 25

// ─── Page ─────────────────────────────────────────────────────────────────────

export const PaymentsHistoryPage: React.FC = () => {
  const navigate   = useNavigate()
  const tenant         = useAppSelector(s => s.tenant.tenant)
  const currentStoreId = useAppSelector(s => s.tenant.currentStoreId)
  const { format }     = useCurrency()

  const [payments, setPayments]       = useState<Payment[]>([])
  const [loading, setLoading]         = useState(false)
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [printSale, setPrintSale]     = useState<InvoiceSale | null>(null)
  const [fetchingId, setFetchingId]   = useState<string | null>(null)

  // Filters
  const [method,  setMethod]  = useState('All')
  const [purpose, setPurpose] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const load = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await salesApi.getPayments({
        companyId:  tenant.id,
        locationId: currentStoreId || undefined,
        method:     method  !== 'All' ? method  : undefined,
        purpose:    purpose !== 'All' ? purpose : undefined,
        dateFrom:   dateFrom || undefined,
        dateTo:     dateTo   || undefined,
        page,
        pageSize:   PAGE_SIZE,
      })
      const data = res.data?.data ?? res.data
      const items: any[] = data?.items ?? data ?? []
      setPayments(items.map((p: any) => ({
        id:                   String(p.id),
        amount:               Number(p.amount),
        method:               String(p.method ?? ''),
        purpose:              String(p.purpose ?? ''),
        accountName:          String(p.accountName ?? ''),
        accountType:          String(p.accountType ?? ''),
        ticketId:             p.ticketId ? String(p.ticketId) : undefined,
        ticketNumber:         p.ticketNumber ?? undefined,
        saleId:               p.saleId ? String(p.saleId) : undefined,
        saleTransactionNumber: p.saleTransactionNumber ?? undefined,
        externalReference:    p.externalReference ?? undefined,
        comment:              p.comment ?? undefined,
        paidAt:               String(p.paidAt ?? ''),
      })))
      setTotal(data?.totalCount ?? data?.total ?? items.length)
    } catch {
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, currentStoreId, method, purpose, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])

  // Reset page when filters or store changes
  useEffect(() => { setPage(1) }, [method, purpose, dateFrom, dateTo, currentStoreId])

  const handlePrintSale = useCallback(async (saleId: string) => {
    setFetchingId(saleId)
    try {
      const res = await salesApi.getSale(saleId)
      const s   = res.data?.data ?? res.data
      if (!s) { toast.error('Sale not found'); return }
      setPrintSale({
        id:              String(s.id),
        transactionNumber: s.transactionNumber ?? undefined,
        subTotal:        Number(s.subTotal ?? 0),
        taxAmount:       Number(s.taxAmount ?? 0),
        totalAmount:     Number(s.totalAmount ?? 0),
        status:          String(s.status ?? ''),
        notes:           s.notes ?? undefined,
        createdAt:       String(s.createdAt ?? ''),
        locationId:      s.locationId ? String(s.locationId) : undefined,
        items: (s.items ?? []).map((it: any) => ({
          id:              String(it.id),
          productName:     String(it.productName ?? ''),
          quantity:        Number(it.quantity ?? 0),
          unitPrice:       Number(it.unitPrice ?? 0),
          taxPercent:      Number(it.taxPercent ?? 0),
          discountPercent: Number(it.discountPercent ?? 0),
          total:           Number(it.total ?? 0),
        })),
        payments: (s.payments ?? []).map((p: any) => ({
          id:                String(p.id),
          amount:            Number(p.amount ?? 0),
          method:            String(p.method ?? ''),
          purpose:           String(p.purpose ?? ''),
          paidAt:            String(p.paidAt ?? ''),
          externalReference: p.externalReference ?? undefined,
          comment:           p.comment ?? undefined,
        })),
      })
    } catch {
      toast.error('Failed to load invoice')
    } finally {
      setFetchingId(null)
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Summary totals
  const grandTotal   = payments.reduce((s, p) => s + p.amount, 0)
  const advanceTotal = payments.filter(p => p.purpose === 'Advance').reduce((s, p) => s + p.amount, 0)
  const finalTotal   = payments.filter(p => p.purpose === 'Final').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment History</h1>
          <p className="text-sm text-gray-500 mt-0.5">All advances and payments across tickets and sales</p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Shown Total</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">{format(grandTotal)}</p>
        </div>
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-500">Advances</p>
          <p className="text-xl font-black text-orange-700 dark:text-orange-300 mt-1">{format(advanceTotal)}</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
          <p className="text-xs font-bold uppercase tracking-wider text-green-600">Final / Full</p>
          <p className="text-xl font-black text-green-700 dark:text-green-300 mt-1">{format(finalTotal)}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
        <Filter className="w-4 h-4 text-gray-400 self-center shrink-0" />

        {/* Method filter */}
        <div className="flex gap-1 flex-wrap">
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
                method === m
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300'
              )}>
              {m}
            </button>
          ))}
        </div>

        <div className="w-px bg-gray-200 dark:bg-gray-700 self-stretch" />

        {/* Purpose filter */}
        <div className="flex gap-1 flex-wrap">
          {PURPOSES.map(p => (
            <button key={p} onClick={() => setPurpose(p)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
                purpose === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300'
              )}>
              {p}
            </button>
          ))}
        </div>

        <div className="w-px bg-gray-200 dark:bg-gray-700 self-stretch" />

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <ReceiptText className="w-12 h-12 opacity-30" />
            <p className="font-medium">No payments found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="px-4 py-3 text-left font-medium">Date & Time</th>
                    <th className="px-4 py-3 text-left font-medium">Method</th>
                    <th className="px-4 py-3 text-left font-medium">Purpose</th>
                    <th className="px-4 py-3 text-left font-medium">Account</th>
                    <th className="px-4 py-3 text-left font-medium">Linked To</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {new Date(p.paidAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(p.paidAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      {/* Method */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <span className="text-gray-400">{METHOD_ICON[p.method] ?? <Banknote className="w-4 h-4" />}</span>
                          <span className="font-medium">{p.method}</span>
                        </div>
                      </td>

                      {/* Purpose */}
                      <td className="px-4 py-3">
                        <Badge variant={PURPOSE_BADGE[p.purpose] ?? 'default'} size="sm">
                          {p.purpose}
                        </Badge>
                      </td>

                      {/* Account */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{p.accountName}</p>
                        {p.externalReference && (
                          <p className="text-[11px] text-gray-400">Ref: {p.externalReference}</p>
                        )}
                        {p.comment && (
                          <p className="text-[11px] text-gray-400 italic">{p.comment}</p>
                        )}
                      </td>

                      {/* Linked To */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {p.ticketId && (
                            <button
                              onClick={() => navigate(`/tickets/${p.ticketId}`)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors"
                            >
                              <Ticket className="w-3.5 h-3.5" />
                              {p.ticketNumber ?? p.ticketId.slice(0, 8)}
                              <ArrowRight className="w-3 h-3 opacity-50" />
                            </button>
                          )}
                          {p.saleId && (
                            <button
                              onClick={() => navigate(`/sales/${p.saleId}`)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
                            >
                              <ReceiptText className="w-3.5 h-3.5" />
                              {p.saleTransactionNumber ?? p.saleId.slice(0, 8)}
                              <ArrowRight className="w-3 h-3 opacity-50" />
                            </button>
                          )}
                          {!p.ticketId && !p.saleId && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Amount + print */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{format(p.amount)}</span>
                          {p.saleId && (
                            <button
                              onClick={() => handlePrintSale(p.saleId!)}
                              disabled={fetchingId === p.saleId}
                              title="Print Invoice"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40"
                            >
                              {fetchingId === p.saleId
                                ? <span className="block w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                : <Printer className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500">
                {total} total · page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={cn(
                        'w-7 h-7 rounded-lg text-xs font-semibold transition-colors',
                        p === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}>
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

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
