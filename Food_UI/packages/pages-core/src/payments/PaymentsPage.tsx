import React, { useEffect, useState, useCallback } from 'react'
import {
  Wallet, Plus, Pencil, Trash2, Banknote, CreditCard,
  Building2, Smartphone, CheckCircle2, X, Link2, RefreshCw,
} from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { salesApi } from '@flowtap/api-core'
import { tenantApi } from '@flowtap/api-core'
import toast from 'react-hot-toast'
import { cn } from '@flowtap/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentAccount {
  id: string
  name: string
  type: string          // 'Cash' | 'Bank' | 'Gateway'
  locationId?: string
  isActive: boolean
}

interface MethodMapping {
  id: string
  method: string
  paymentAccountId: string
  accountName: string
  accountType: string
}

interface Store { id: string; title: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  Cash:    { label: 'Cash',    icon: <Banknote   className="w-5 h-5" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  Bank:    { label: 'Bank / Card Terminal', icon: <Building2 className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  Gateway: { label: 'Gateway (UPI/Online)', icon: <Smartphone className="w-5 h-5" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

const ALL_METHODS = [
  { id: 'Cash',       label: 'Cash',         icon: <Banknote   className="w-4 h-4" /> },
  { id: 'Card',       label: 'Card',         icon: <CreditCard className="w-4 h-4" /> },
  { id: 'UPI',        label: 'UPI/Online',   icon: <Smartphone className="w-4 h-4" /> },
  { id: 'NetBanking', label: 'Net Banking',  icon: <Building2  className="w-4 h-4" /> },
  { id: 'Wallet',     label: 'Wallet',       icon: <Wallet     className="w-4 h-4" /> },
]

// ─── Account Modal ────────────────────────────────────────────────────────────

const AccountModal: React.FC<{
  account?: PaymentAccount
  onClose: () => void
  onCreate: (data: { name: string; type: string }) => Promise<void>
  onUpdate: (id: string, data: { name: string; isActive: boolean }) => Promise<void>
}> = ({ account, onClose, onCreate, onUpdate }) => {
  const [name, setName]       = useState(account?.name ?? '')
  const [type, setType]       = useState(account?.type ?? 'Cash')
  const [isActive, setIsActive] = useState(account?.isActive ?? true)
  const [loading, setLoading] = useState(false)

  const isEdit = !!account

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Enter a name'); return }
    setLoading(true)
    try {
      if (isEdit) {
        await onUpdate(account.id, { name: name.trim(), isActive })
      } else {
        await onCreate({ name: name.trim(), type })
      }
      onClose()
    } catch {
      toast.error('Failed to save account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Account' : 'New Payment Account'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Type selector — only for create */}
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Type</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {Object.entries(TYPE_META).map(([t, meta]) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-medium',
                      type === t
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    {meta.icon}
                    <span className="text-center leading-tight">{meta.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={
                type === 'Cash' ? 'e.g. Main Cash Drawer' :
                type === 'Bank' ? 'e.g. HDFC POS Terminal' :
                'e.g. Razorpay / Google Pay'
              }
              className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Active toggle — only for edit */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors',
                  isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  isActive ? 'translate-x-5' : 'translate-x-1'
                )} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
          )}

          {!isEdit && (
            <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
              <p className="font-medium text-gray-500 mb-1">How this is used</p>
              {type === 'Cash'    && 'Mapped to Cash payments. Money physically collected at the counter.'}
              {type === 'Bank'    && 'Mapped to Card / Net Banking payments. Settlement via bank account.'}
              {type === 'Gateway' && 'Mapped to UPI / Wallet payments. Processed via payment gateway.'}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PaymentsPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [activeTab, setActiveTab] = useState<'accounts' | 'mappings'>('accounts')

  // ── Accounts state ──
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [modal, setModal]       = useState<'create' | PaymentAccount | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Method Mappings state ──
  const [stores, setStores]         = useState<Store[]>([])
  const [mappingStoreId, setMappingStoreId] = useState<string>('')
  const [mappings, setMappings]     = useState<MethodMapping[]>([])
  const [loadingMappings, setLoadingMappings] = useState(false)
  const [savingMethod, setSavingMethod] = useState<string | null>(null)

  // ── Load accounts ──
  const loadAccounts = useCallback(async () => {
    if (!tenant?.id) return
    setLoadingAccounts(true)
    try {
      const res = await salesApi.getPaymentAccounts(tenant.id)
      const data = res.data?.data ?? res.data ?? []
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load payment accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }, [tenant?.id])

  // ── Load stores ──
  const loadStores = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const res = await tenantApi.getStores(tenant.id)
      const data = res.data?.data ?? res.data ?? []
      const list = Array.isArray(data) ? data : []
      setStores(list)
      // Default to current store
      const defaultId = currentStoreId || (list[0]?.id ?? '')
      setMappingStoreId(defaultId)
    } catch { /* ignore */ }
  }, [tenant?.id, currentStoreId])

  // ── Load method mappings for selected store ──
  const loadMappings = useCallback(async () => {
    if (!tenant?.id || !mappingStoreId) return
    setLoadingMappings(true)
    try {
      const res = await salesApi.getMethodMappings(tenant.id, mappingStoreId)
      const data = res.data?.data ?? res.data ?? []
      setMappings(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load method mappings')
    } finally {
      setLoadingMappings(false)
    }
  }, [tenant?.id, mappingStoreId])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadStores() }, [loadStores])
  useEffect(() => {
    if (activeTab === 'mappings' && mappingStoreId) loadMappings()
  }, [activeTab, mappingStoreId, loadMappings])

  // ── Account handlers ──
  const handleCreate = async (data: { name: string; type: string }) => {
    await salesApi.createPaymentAccount({ companyId: tenant!.id, name: data.name, type: data.type })
    toast.success('Payment account created')
    loadAccounts()
  }

  const handleUpdate = async (id: string, data: { name: string; isActive: boolean }) => {
    await salesApi.updatePaymentAccount(id, data)
    toast.success('Account updated')
    loadAccounts()
  }

  const handleDelete = async (acc: PaymentAccount) => {
    if (!confirm(`Delete "${acc.name}"? This cannot be undone.`)) return
    setDeletingId(acc.id)
    try {
      await salesApi.deletePaymentAccount(acc.id)
      toast.success('Account deleted')
      loadAccounts()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Failed to delete account'
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Mapping handlers ──
  const handleSetMapping = async (method: string, accountId: string) => {
    if (!tenant?.id || !mappingStoreId) return
    setSavingMethod(method)
    try {
      if (!accountId) {
        // Remove mapping for this method
        const existing = mappings.find((m) => m.method === method)
        if (existing) {
          await salesApi.deleteMethodMapping(existing.id)
          toast.success(`Removed mapping for ${method}`)
          loadMappings()
        }
      } else {
        await salesApi.createMethodMapping({
          companyId: tenant.id,
          locationId: mappingStoreId,
          method,
          paymentAccountId: accountId,
        })
        toast.success(`${method} → ${accounts.find((a) => a.id === accountId)?.name}`)
        loadMappings()
      }
    } catch {
      toast.error('Failed to save mapping')
    } finally {
      setSavingMethod(null)
    }
  }

  // ── Group accounts by type ──
  const grouped = Object.entries(TYPE_META).map(([type, meta]) => ({
    type, meta,
    accounts: accounts.filter((a) => a.type === type && a.isActive),
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payments</h1>
            <p className="text-sm text-gray-500">Configure accounts and method mappings per store</p>
          </div>
        </div>
        {activeTab === 'accounts' && (
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> New Account
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('accounts')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'accounts'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          Accounts
        </button>
        <button
          onClick={() => setActiveTab('mappings')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'mappings'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Link2 className="w-3.5 h-3.5" /> Method Mappings
        </button>
      </div>

      {/* ── Accounts Tab ── */}
      {activeTab === 'accounts' && (
        <>
          {/* How it works banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">How Payment Accounts Work</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-700 dark:text-blue-400">
              <div className="flex items-start gap-2">
                <Banknote className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span><strong>Cash</strong> — linked to Cash payments at POS. One per store is typical.</span>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span><strong>Bank</strong> — linked to Card / Net Banking. Settlements go to bank.</span>
              </div>
              <div className="flex items-start gap-2">
                <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span><strong>Gateway</strong> — linked to UPI / Wallets. Razorpay, Google Pay etc.</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              After creating accounts, go to <strong>Method Mappings</strong> to connect each payment method to the right account per store.
            </p>
          </div>

          {loadingAccounts ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {grouped.map(({ type, meta, accounts: typeAccounts }) => (
                <div key={type} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                  {/* Type header */}
                  <div className={cn('flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-700', meta.color.split(' ').slice(0, 2).join(' '))}>
                    {meta.icon}
                    <span className="font-semibold text-sm">{meta.label}</span>
                    <span className="ml-auto text-xs font-medium opacity-70">{typeAccounts.length}</span>
                  </div>

                  {/* Accounts list */}
                  <div className="p-3 space-y-2 min-h-[80px]">
                    {typeAccounts.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-4">
                        No {type.toLowerCase()} accounts yet
                      </p>
                    ) : (
                      typeAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">
                            {acc.name}
                          </span>
                          <button
                            onClick={() => setModal(acc)}
                            className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(acc)}
                            disabled={deletingId === acc.id}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
                          >
                            {deletingId === acc.id
                              ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add button */}
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setModal('create')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add {type}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Method Mappings Tab ── */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          {/* Explanation */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl p-4 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">What are Method Mappings?</p>
            <p>For each store, map payment methods (Cash, Card, UPI…) to the account that collects them.
              At checkout, the system routes the payment automatically. If no mapping is set, the system falls back to any available account of the matching type.</p>
          </div>

          {/* Store selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Store:</label>
            <select
              value={mappingStoreId}
              onChange={(e) => setMappingStoreId(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <button
              onClick={loadMappings}
              disabled={loadingMappings}
              className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loadingMappings && 'animate-spin')} />
            </button>
          </div>

          {/* Mapping table */}
          {accounts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No accounts yet. Create payment accounts first.</p>
              <button
                onClick={() => setActiveTab('accounts')}
                className="mt-3 text-blue-600 text-sm hover:underline"
              >
                Go to Accounts →
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {ALL_METHODS.map(({ id: method, label, icon }) => {
                    const existing = mappings.find((m) => m.method === method)
                    const isSaving = savingMethod === method
                    return (
                      <tr key={method} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5 text-gray-700 dark:text-gray-300">
                            {icon}
                            <span className="font-medium">{label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <select
                            value={existing?.paymentAccountId ?? ''}
                            onChange={(e) => handleSetMapping(method, e.target.value)}
                            disabled={isSaving}
                            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                          >
                            <option value="">— Not mapped (use fallback) —</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isSaving ? (
                            <div className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          ) : existing ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mapped
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Auto</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Account Modal */}
      {modal && (
        <AccountModal
          account={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
