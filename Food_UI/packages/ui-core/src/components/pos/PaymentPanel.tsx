import React, { useEffect, useState } from 'react'
import { Banknote, CreditCard, Smartphone, Building2, Wallet, X, Plus, CheckCircle2 } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '@flowtap/store'
import type { CartPayment } from '@flowtap/store'
import { addPayment, removePayment } from '@flowtap/store'
import { cn } from '@flowtap/shared'
import { useCurrency } from '@flowtap/shared'
import { salesApi } from '@flowtap/api-core'

// ─── Payment method config ────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  Cash:       <Banknote   className="w-4 h-4" />,
  Card:       <CreditCard className="w-4 h-4" />,
  UPI:        <Smartphone className="w-4 h-4" />,
  NetBanking: <Building2  className="w-4 h-4" />,
  Wallet:     <Wallet     className="w-4 h-4" />,
}

const ALL_METHODS = [
  { id: 'Cash',       label: 'Cash',        accountName: '' },
  { id: 'Card',       label: 'Card',        accountName: '' },
  { id: 'UPI',        label: 'UPI/Online',  accountName: '' },
  { id: 'NetBanking', label: 'Net Banking', accountName: '' },
  { id: 'Wallet',     label: 'Wallet',      accountName: '' },
]

interface PaymentMethod { id: string; label: string; accountName: string }

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentPanelProps {
  total: number
  onCharge: () => void
  loading: boolean
  /** When true the charge/draft button is hidden — parent renders it in a sticky footer */
  hideChargeButton?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PaymentPanel: React.FC<PaymentPanelProps> = ({ total, onCharge, loading, hideChargeButton }) => {
  const dispatch       = useAppDispatch()
  const payments       = useAppSelector((s) => s.cart.payments)
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [selectedMethod, setSelectedMethod] = useState('Cash')
  const [amount, setAmount]                 = useState('')
  const [methods, setMethods]               = useState<PaymentMethod[]>(ALL_METHODS)
  const { format, currency }                = useCurrency()

  const paid           = payments.reduce((acc, p) => acc + p.amount, 0)
  const balance        = Math.max(0, total - paid)
  const isAdvanceFull  = total <= 0.01          // advance already covers everything — no payment entry needed
  const isPaidFull     = isAdvanceFull || paid >= total - 0.01

  const handleAmountChange = (val: string) => setAmount(val)

  // Load configured payment methods for this store
  useEffect(() => {
    if (!tenant?.id || !currentStoreId) return
    salesApi.getMethodMappings(tenant.id, currentStoreId)
      .then((res) => {
        const mappings: { method: string; accountName: string }[] = res.data?.data ?? res.data ?? []
        if (!Array.isArray(mappings) || mappings.length === 0) {
          setMethods(ALL_METHODS)
        } else {
          setMethods(mappings.map((m) => ({
            id:          m.method,
            label:       m.method === 'UPI'        ? 'UPI/Online'
                       : m.method === 'NetBanking' ? 'Net Banking'
                       : m.method,
            accountName: m.accountName,
          })))
          setSelectedMethod((prev) =>
            mappings.some((m) => m.method === prev) ? prev : (mappings[0]?.method ?? 'Cash')
          )
        }
      })
      .catch(() => setMethods(ALL_METHODS))
  }, [tenant?.id, currentStoreId])

  const handleAddPayment = () => {
    const val = parseFloat(amount) || balance
    if (val <= 0) return
    const autoPurpose: CartPayment['purpose'] = val >= balance - 0.01 ? 'Final' : 'Partial'
    dispatch(addPayment({ method: selectedMethod, amount: val, purpose: autoPurpose }))
    setAmount('')
  }

  const currencySymbol = (
    { USD: '$', GBP: '£', EUR: '€', INR: '₹', CAD: '$', AUD: '$', SGD: '$', NGN: '₦', PKR: '₨', AED: 'د.إ' } as Record<string, string>
  )[currency] ?? currency

  // ── Charge button state ─────────────────────────────────────────────────────
  // Allow saving the sale:
  //  - advance covers full (total=0) → immediate Complete Sale, no entry needed
  //  - payments added but not full   → saves as Draft (balance due)
  //  - fully paid                    → saves as Completed
  // Block only when: cart has items but zero payments AND nothing typed AND total > 0
  const canCharge = isAdvanceFull || payments.length > 0 || (parseFloat(amount) > 0)

  return (
    <div className="space-y-4">

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total</p>
          <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{format(total)}</p>
        </div>
        <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <p className="text-[10px] text-green-500 uppercase font-bold tracking-wider">Paid</p>
          <p className="text-sm font-black text-green-700 dark:text-green-300 mt-0.5">{format(paid)}</p>
        </div>
        <div className={cn('p-2.5 rounded-xl', balance > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/50')}>
          <p className={cn('text-[10px] uppercase font-bold tracking-wider', balance > 0 ? 'text-red-500' : 'text-gray-400')}>
            Balance
          </p>
          <p className={cn('text-sm font-black mt-0.5', balance > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-400')}>
            {format(balance)}
          </p>
        </div>
      </div>

      {/* ── Added payments list ── */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map((p, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl animate-in fade-in slide-in-from-left-2 duration-200"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                  {ICON_MAP[p.method] ?? <Banknote className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-none">
                    {p.method === 'UPI' ? 'UPI/Online' : p.method === 'NetBanking' ? 'Net Banking' : p.method}
                  </p>
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    p.purpose === 'Advance' ? 'bg-amber-100 text-amber-700'
                  : p.purpose === 'Partial' ? 'bg-blue-100 text-blue-700'
                  :                           'bg-green-100 text-green-700'
                  )}>
                    {p.purpose}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">{format(p.amount)}</span>
                <button
                  onClick={() => dispatch(removePayment(idx))}
                  className="p-1 hover:text-red-500 transition-colors text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add payment form (hidden once fully paid) ── */}
      {!isPaidFull && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">

          {/* Method selector */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1.5">Method</p>
            <div className={cn('grid gap-1.5', methods.length <= 3 ? 'grid-cols-3' : 'grid-cols-5')}>
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border-2 text-[10px] font-bold uppercase tracking-tight transition-all',
                    selectedMethod === m.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-100 text-gray-500 hover:border-blue-200 dark:border-gray-700 dark:text-gray-400'
                  )}
                >
                  {ICON_MAP[m.id] ?? <Wallet className="w-4 h-4" />}
                  <span className="truncate w-full text-center leading-tight">{m.label}</span>
                  {m.accountName && (
                    <span className={cn(
                      'text-[9px] font-normal normal-case truncate w-full text-center',
                      selectedMethod === m.id ? 'text-blue-100' : 'text-gray-400'
                    )}>
                      {m.accountName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPayment()}
                placeholder={balance.toFixed(2)}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddPayment}
              className="px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Computed hint — shows what this payment will do */}
          {amount && parseFloat(amount) > 0 && (
            <p className="text-[10px] text-center italic -mt-1">
              {parseFloat(amount) >= balance - 0.01
                ? <span className="text-green-600">Full payment — sale will be Completed</span>
                : <span className="text-amber-600">
                    Partial — {format(Math.max(0, balance - parseFloat(amount)))} remaining, saved as Draft
                  </span>
              }
            </p>
          )}

          {/* Quick-fill shortcuts */}
          <div className="flex gap-2">
            <button
              onClick={() => setAmount(balance.toFixed(2))}
              className="flex-1 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
            >
              Full {format(balance)}
            </button>
            {balance > 0 && paid === 0 && (
              <button
                onClick={() => {
                  const half = parseFloat((total / 2).toFixed(2))
                  setAmount(String(half))
                }}
                className="flex-1 py-1.5 text-xs font-semibold text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
              >
                50%
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Charge / Save button (hidden when parent renders its own sticky button) ── */}
      {!hideChargeButton && <div className="space-y-2">
        {isPaidFull ? (
          /* Fully paid (or advance covers everything) — green Complete Sale */
          <button
            onClick={onCharge}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-base font-black uppercase tracking-widest transition-all shadow-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white shadow-green-500/20 disabled:opacity-70"
          >
            {loading
              ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              : isAdvanceFull
                ? <span className="flex flex-col items-center leading-tight">
                    <span className="text-sm">Complete Sale</span>
                    <span className="text-xs font-medium opacity-80">Fully covered by advance</span>
                  </span>
                : <span className="flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Complete Sale</span>
            }
          </button>
        ) : canCharge ? (
          /* Partial — amber Save as Draft */
          <button
            onClick={onCharge}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-base font-black uppercase tracking-widest transition-all shadow-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white shadow-amber-500/20 disabled:opacity-70"
          >
            {loading
              ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              : <span className="flex flex-col items-center leading-tight">
                  <span className="text-sm">Save as Draft</span>
                  <span className="text-xs font-medium opacity-80">Balance due: {format(balance)}</span>
                </span>
            }
          </button>
        ) : (
          /* Nothing added yet — disabled */
          <button
            disabled
            className="w-full py-4 rounded-2xl text-base font-black uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
          >
            Add a Payment
          </button>
        )}

        {/* Helper note for draft saves */}
        {canCharge && !isPaidFull && (
          <p className="text-[11px] text-center text-gray-400">
            Sale will be saved as <span className="font-semibold text-amber-600">Draft</span> — you can collect the remaining {format(balance)} later from Sales History.
          </p>
        )}
      </div>}
    </div>
  )
}
