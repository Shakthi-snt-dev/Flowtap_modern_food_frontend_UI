import React, { useEffect } from 'react'
import { X, Printer, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceSaleItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  taxPercent: number
  discountPercent: number
  total: number
}

export interface InvoicePayment {
  id: string
  amount: number
  method: string
  purpose: string
  paidAt: string
  externalReference?: string
  comment?: string
}

export interface InvoiceSale {
  id: string
  transactionNumber?: string
  subTotal: number
  taxAmount: number
  totalAmount: number
  discountAmount?: number
  status: string
  notes?: string
  createdAt: string
  locationId?: string
  items: InvoiceSaleItem[]
  payments: InvoicePayment[]
}

interface SaleInvoicePrintProps {
  sale: InvoiceSale
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const PRINT_STYLE_ID = 'flowtap-invoice-print-style'

// ─── Component ────────────────────────────────────────────────────────────────

export const SaleInvoicePrint: React.FC<SaleInvoicePrintProps> = ({ sale, onClose }) => {
  const { format }     = useCurrency()
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const stores         = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const store          = stores.find((s) => s.id === (sale.locationId ?? currentStoreId))
                      ?? stores.find((s) => s.id === currentStoreId)

  const totalPaid  = sale.payments.reduce((acc, p) => acc + p.amount, 0)
  const balanceDue = Math.max(0, sale.totalAmount - totalPaid)
  const isPaid     = balanceDue === 0 && sale.payments.length > 0
  const isCancelled = sale.status === 'Cancelled'

  // ── Inject print-isolation CSS ────────────────────────────────────────────
  useEffect(() => {
    const style       = document.createElement('style')
    style.id          = PRINT_STYLE_ID
    style.textContent = `
      @media print {
        @page { size: A4; margin: 10mm 14mm; }
        body > * { visibility: hidden !important; }
        #ft-invoice-doc, #ft-invoice-doc * { visibility: visible !important; }
        #ft-invoice-doc {
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          background: #fff !important;
          z-index: 99999 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .ft-no-print { display: none !important; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(PRINT_STYLE_ID)?.remove() }
  }, [])

  const handlePrint = () => window.print()

  // ── Build store address line ──────────────────────────────────────────────
  const addressParts = [
    store?.address,
    store?.city,
    store?.state,
    store?.postalCode,
  ].filter(Boolean)
  const addressLine = addressParts.join(', ')

  // ── Total discount across all line items ─────────────────────────────────
  const lineDiscount = sale.discountAmount
    ?? sale.items.reduce((acc, it) => {
        const gross = it.unitPrice * it.quantity
        return acc + (gross * (it.discountPercent / 100))
      }, 0)

  return (
    /* ── Backdrop ── */
    <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center overflow-y-auto py-8 px-4">

      {/* ── Floating toolbar (screen only) ── */}
      <div className="ft-no-print sticky top-0 z-10 flex items-center gap-2 mb-5 w-full max-w-2xl justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-sm font-semibold shadow-lg transition-all"
        >
          <Printer className="w-4 h-4" />
          Print Invoice
        </button>
        <button
          onClick={onClose}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ══════════════════════════════════════════
          INVOICE DOCUMENT  (this is what prints)
      ══════════════════════════════════════════ */}
      <div
        id="ft-invoice-doc"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: '#111827' }}
      >

        {/* ── Header band ── */}
        <div
          className="relative overflow-hidden px-8 pt-7 pb-6"
          style={{ background: 'linear-gradient(135deg, var(--sidebar-logo-bg, #FF8A24) 0%, var(--sidebar-active-bg, #E87400) 100%)' }}
        >
          {/* decorative circles */}
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10" style={{ background: '#fff' }} />
          <div className="absolute -bottom-10 right-20 w-24 h-24 rounded-full opacity-10" style={{ background: '#fff' }} />

          <div className="relative flex justify-between items-start gap-4">
            {/* Left — company */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                {tenant?.logoUrl ? (
                  <img src={tenant.logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                )}
                <h1 className="text-lg font-bold text-white leading-tight">
                  {tenant?.title ?? 'Business'}
                </h1>
              </div>
              <div className="text-xs text-blue-100 space-y-0.5 leading-relaxed">
                {store?.name && <p className="font-medium text-blue-50">{store.name}</p>}
                {addressLine && <p>{addressLine}</p>}
                {(store?.phone || tenant?.phone) && (
                  <p>Tel: {store?.phone ?? tenant?.phone}</p>
                )}
                {(store?.email || tenant?.email) && (
                  <p>Email: {store?.email ?? tenant?.email}</p>
                )}
              </div>
            </div>

            {/* Right — invoice meta */}
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black text-white tracking-tight">INVOICE</p>
              <p className="mt-1 font-mono text-sm font-bold text-blue-100">
                {sale.transactionNumber ?? '—'}
              </p>
              <p className="text-xs text-blue-200 mt-1">
                {fmtDate(sale.createdAt)} · {fmtTime(sale.createdAt)}
              </p>
              {/* status pill */}
              <span
                className={`inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-semibold ${
                  isCancelled  ? 'bg-red-500/30 text-red-100'
                : isPaid       ? 'bg-green-500/30 text-green-100'
                :                'bg-yellow-400/30 text-yellow-100'
                }`}
              >
                {isCancelled ? 'Cancelled' : isPaid ? 'Paid' : 'Draft / Partial'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Balance-due alert strip (only when not paid) ── */}
        {!isPaid && !isCancelled && (
          <div className="flex items-center justify-between px-8 py-2.5 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              Balance Due
            </div>
            <span className="text-amber-800 font-bold text-sm">{format(balanceDue)}</span>
          </div>
        )}

        {/* ── Line items ── */}
        <div className="px-8 pt-6 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['#', 'Description', 'Qty', 'Unit Price', 'Tax', 'Amount'].map((h, i) => (
                  <th
                    key={h}
                    className="pb-2.5 font-semibold text-gray-400 text-xs uppercase tracking-wider"
                    style={{ textAlign: i < 2 ? 'left' : 'right', paddingLeft: i === 0 ? 0 : 8, paddingRight: 8 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                >
                  <td className="py-3 text-gray-400 text-xs align-top pr-2">{idx + 1}</td>
                  <td className="py-3 align-top" style={{ paddingRight: 8 }}>
                    <p className="font-medium text-gray-900 leading-snug">{item.productName}</p>
                    {item.discountPercent > 0 && (
                      <p className="text-xs text-rose-500 mt-0.5">
                        −{item.discountPercent}% discount
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-right text-gray-700 align-top" style={{ paddingRight: 8 }}>
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right text-gray-700 align-top" style={{ paddingRight: 8 }}>
                    {format(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right align-top" style={{ paddingRight: 8 }}>
                    {item.taxPercent > 0
                      ? <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.taxPercent}%</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="py-3 text-right font-semibold text-gray-900 align-top">
                    {format(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals block ── */}
        <div className="px-8 pb-6 flex justify-end">
          <div className="w-56 text-sm">
            <div className="space-y-1.5 pt-3" style={{ borderTop: '1px dashed #e5e7eb' }}>
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{format(sale.subTotal)}</span>
              </div>
              {lineDiscount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Discount</span>
                  <span>−{format(lineDiscount)}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>{format(sale.taxAmount)}</span>
                </div>
              )}
            </div>
            <div
              className="flex justify-between font-bold text-base text-gray-900 mt-3 pt-3"
              style={{ borderTop: '2px solid #111827' }}
            >
              <span>Total</span>
              <span>{format(sale.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-8" style={{ borderTop: '1px dashed #d1d5db' }} />

        {/* ── Payment history ── */}
        {sale.payments.length > 0 && (
          <div className="px-8 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Payment History
            </p>

            <div className="space-y-2">
              {sale.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-semibold text-gray-800">{p.method}</span>
                    <span className="text-xs text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">
                      {p.purpose}
                    </span>
                    {p.externalReference && (
                      <span className="text-xs text-gray-400">Ref: {p.externalReference}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-5 text-right">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(p.paidAt)}</span>
                    <span className="font-bold text-emerald-700 w-20 text-right">{format(p.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment summary */}
            <div className="mt-3 pt-3 space-y-1.5 text-sm" style={{ borderTop: '1px solid #e5e7eb' }}>
              <div className="flex justify-end gap-16">
                <span className="text-gray-500">Total Paid</span>
                <span className="font-semibold text-gray-900 w-20 text-right">{format(totalPaid)}</span>
              </div>
              <div className="flex justify-end gap-16">
                <span className={balanceDue > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}>
                  Balance Due
                </span>
                <span
                  className={`font-semibold w-20 text-right ${
                    balanceDue > 0 ? 'text-rose-600' : 'text-gray-400'
                  }`}
                >
                  {format(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── PAID / Cancelled stamp ── */}
        {(isPaid || isCancelled) && (
          <div className="px-8 pb-5">
            <div
              className={`flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 ${
                isCancelled
                  ? 'border-red-300 bg-red-50'
                  : 'border-emerald-400 bg-emerald-50'
              }`}
            >
              {isCancelled ? (
                <>
                  <X className="w-5 h-5 text-red-600" strokeWidth={2.5} />
                  <span className="font-black tracking-widest text-sm text-red-700">CANCELLED</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
                  <span className="font-black tracking-widest text-sm text-emerald-700">PAID IN FULL</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {sale.notes && (
          <div className="mx-8 mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">Note</p>
            <p className="text-sm text-blue-800">{sale.notes}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className="px-8 py-5 text-center"
          style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}
        >
          <p className="text-sm font-semibold text-gray-700">Thank you for your business!</p>
          <p className="text-xs text-gray-400 mt-1">
            {[tenant?.title, store?.name && store.name !== tenant?.title ? store.name : null, tenant?.country]
              .filter(Boolean).join(' · ')}
          </p>
          {tenant?.phone && (
            <p className="text-xs text-gray-400 mt-0.5">
              {tenant.phone}{tenant.email ? ` · ${tenant.email}` : ''}
            </p>
          )}
        </div>

      </div>

      {/* bottom padding for scroll */}
      <div className="h-8 ft-no-print" />
    </div>
  )
}
