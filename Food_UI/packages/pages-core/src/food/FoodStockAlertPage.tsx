import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Plus, Edit2, Trash2, Mail, MessageSquare, Phone, X, Clock, CheckCircle2, XCircle, RefreshCw, Eye, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { foodApi, inventoryApi, notificationsApi, type StockAlertRule } from '@flowtap/api-core'
import { Button, Modal, Table, Spinner, Select, Input, Badge } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Warehouse {
  id: string; name: string; code: string
  type?: string        // "InStore" | "KitchenStore" | "LocationWarehouse" | ...
  locationId?: string  // store/location this warehouse belongs to
  managerEmployeeId?: string
}
interface Product { id: string; name: string; sku: string; kind: string }


interface RuleForm {
  productId:          string
  warehouseId:        string
  threshold:          string
  unit:               string
  sendEmail:          boolean
  sendSms:            boolean
  sendWhatsApp:       boolean
  emailRecipients:    string[]
  smsRecipients:      string[]
  whatsAppRecipients: string[]
  notifyRoles:        string[]
}

const EMPTY_FORM: RuleForm = {
  productId:          '',
  warehouseId:        '',
  threshold:          '',
  unit:               'kg',
  sendEmail:          true,
  sendSms:            false,
  sendWhatsApp:       false,
  emailRecipients:    [],
  smsRecipients:      [],
  whatsAppRecipients: [],
  notifyRoles:        [],
}

// ─── Static roles always available ───────────────────────────────────────────
const STATIC_ROLES = [
  { value: 'Owner', label: 'Owner', icon: '👑', desc: 'Company owner — from account registration', warn: false },
  { value: 'Chef',  label: 'Chef',  icon: '👨‍🍳', desc: 'All employees with Chef role at this store', warn: false },
]


const UNITS = ['kg', 'g', 'litres', 'ml', 'pieces', 'packets', 'boxes', 'dozen']

// ─── RecipientTagInput ────────────────────────────────────────────────────────
// Type a value → press Enter or comma → chip appears. Click × to remove.

interface RecipientTagInputProps {
  label:       string
  type:        'email' | 'tel'
  placeholder: string
  hint?:       string
  values:      string[]
  onChange:    (values: string[]) => void
}

const RecipientTagInput: React.FC<RecipientTagInputProps> = ({
  label, type, placeholder, hint, values, onChange,
}) => {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const v = draft.trim()
    if (!v) return
    if (!values.includes(v)) onChange([...values, v])
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>

      {/* Chip container — click anywhere to focus the input */}
      <div
        className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-2.5 py-1.5
                   border border-gray-300 dark:border-gray-600 rounded-lg bg-white
                   dark:bg-gray-800 cursor-text
                   focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs
                       font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          >
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)) }}
              className="rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : 'Add another…'}
          className="flex-1 min-w-[180px] text-sm bg-transparent outline-none
                     text-gray-700 dark:text-gray-300 placeholder-gray-400"
        />
      </div>

      {hint && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FoodStockAlertPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [tab, setTab]               = useState<'rules' | 'history'>('rules')
  const [rules, setRules]           = useState<StockAlertRule[]>([])
  const [loading, setLoading]       = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<StockAlertRule | null>(null)
  const [form, setForm]             = useState<RuleForm>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Preview recipients ─────────────────────────────────────────────────────
  interface PreviewContact { role: string; email?: string; phone?: string; status: string }
  interface PreviewResult  { resolvedContacts: PreviewContact[]; warnings: string[] }
  const [previewRule, setPreviewRule]     = useState<StockAlertRule | null>(null)
  const [previewData, setPreviewData]     = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const handleTriggerNow = async (rule: StockAlertRule) => {
    setTriggeringId(rule.id)
    try {
      const res = await foodApi.triggerNow(rule.id)
      const data = res.data?.data ?? res.data
      if (data.triggered) {
        toast.success(`✅ ${data.reason}`)
        loadRules() // refresh LastTriggeredAt
      } else {
        toast.error(`ℹ️ ${data.reason}`)
      }
    } catch {
      toast.error('Failed to trigger alert')
    } finally {
      setTriggeringId(null)
    }
  }

  const openPreview = async (rule: StockAlertRule) => {
    setPreviewRule(rule)
    setPreviewData(null)
    setPreviewLoading(true)
    try {
      const res = await foodApi.previewRecipients(rule.id)
      setPreviewData(res.data?.data ?? res.data)
    } catch {
      toast.error('Failed to preview recipients')
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Alert history ──────────────────────────────────────────────────────────
  interface AlertHistoryItem {
    id: string; type: string; recipient: string; subject: string
    payload: string; status: string; error?: string
    createdAt: string; sentAt?: string; retryCount: number
  }
  const [history, setHistory]           = useState<AlertHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage]   = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyChannel, setHistoryChannel] = useState('')
  const [historyStatus, setHistoryStatus]   = useState('')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const HIST_PAGE_SIZE = 20

  const loadHistory = useCallback(() => {
    if (!tenant?.id) return
    setHistoryLoading(true)
    notificationsApi.getHistory({
      // No subjectContains filter — show all company notifications (Email + SMS + WhatsApp)
      // SMS/WhatsApp kitchen alerts have empty Subject so subjectContains would exclude them
      channel:  historyChannel || undefined,
      status:   historyStatus  || undefined,
      page:     historyPage,
      pageSize: HIST_PAGE_SIZE,
    })
      .then((res) => {
        const data = res.data?.data ?? res.data
        const items: AlertHistoryItem[] = (data?.items ?? data ?? []).map((n: Record<string, unknown>) => ({
          id:         String(n.id ?? ''),
          type:       String(n.type ?? ''),
          recipient:  String(n.recipient ?? ''),
          subject:    String(n.subject ?? ''),
          // Payload may come as a JSON string or plain text — normalise to string
          payload: typeof n.payload === 'string'
            ? n.payload
            : n.payload != null ? JSON.stringify(n.payload) : '',
          status:     String(n.status ?? ''),
          error:      n.error ? String(n.error) : undefined,
          createdAt:  String(n.createdAt ?? ''),
          sentAt:     n.sentAt ? String(n.sentAt) : undefined,
          retryCount: Number(n.retryCount ?? 0),
        }))
        setHistory(items)
        setHistoryTotal(data?.totalCount ?? items.length)
      })
      .catch(() => toast.error('Failed to load alert history'))
      .finally(() => setHistoryLoading(false))
  }, [tenant?.id, historyPage, historyChannel, historyStatus])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, loadHistory])

  const loadRules = useCallback(() => {
    setLoading(true)
    foodApi.getStockAlerts()
      .then((res) => {
        const data = res.data?.data ?? res.data ?? []
        setRules(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error('Failed to load stock alert rules'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadRules() }, [loadRules])

  // When store changes, reset warehouse selection in any open form and reload
  useEffect(() => {
    setForm((f) => ({ ...f, warehouseId: '', notifyRoles: [] }))
    setWarehouses([])
  }, [currentStoreId])

  useEffect(() => {
    if (!tenant?.id) return

    // Only load warehouses belonging to the current store
    // When store is switched, this re-runs and shows only that store's warehouses
    inventoryApi.getWarehouses({ companyId: tenant.id, storeId: currentStoreId ?? undefined }).then((res) => {
      const raw: Record<string, unknown>[] = res.data?.data ?? res.data ?? []
      setWarehouses((Array.isArray(raw) ? raw : []).map((w) => ({
        id:                String(w.id ?? ''),
        name:              String(w.name ?? ''),
        code:              String(w.code ?? ''),
        type:              w.type ? String(w.type) : undefined,
        locationId:        w.locationId ? String(w.locationId) : undefined,
        managerEmployeeId: w.managerEmployeeId ? String(w.managerEmployeeId) : undefined,
      })))
    })

    inventoryApi.getProducts({ companyId: tenant.id, pageSize: 500, kind: 'FinalProduct,RawMaterial' }).then((res) => {
      const data = res.data?.data ?? res.data
      setProducts(data?.items ?? data ?? [])
    })
  }, [tenant?.id, currentStoreId])  // re-run whenever the store changes

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true) }

  const openEdit = (rule: StockAlertRule) => {
    setEditing(rule)
    setForm({
      productId:          rule.productId,
      warehouseId:        rule.warehouseId,
      threshold:          String(rule.threshold),
      unit:               rule.unit,
      sendEmail:          rule.sendEmail,
      sendSms:            rule.sendSms,
      sendWhatsApp:       rule.sendWhatsApp,
      emailRecipients:    rule.emailRecipients    ?? [],
      smsRecipients:      rule.smsRecipients      ?? [],
      whatsAppRecipients: rule.whatsAppRecipients ?? [],
      notifyRoles:        rule.notifyRoles        ?? [],
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.productId || !form.warehouseId) {
      toast.error('Product and warehouse are required'); return
    }
    if (!form.threshold || parseFloat(form.threshold) <= 0) {
      toast.error('Threshold must be greater than 0'); return
    }
    if (!form.sendEmail && !form.sendSms && !form.sendWhatsApp) {
      toast.error('Select at least one notification channel'); return
    }
    // Channels that have no explicit recipients still reach role-holders automatically —
    // so no hard-block here; the backend resolves contacts from Store/Warehouse assignments.

    setSaving(true)
    try {
      const payload = {
        productId:          form.productId,
        warehouseId:        form.warehouseId,
        threshold:          parseFloat(form.threshold),
        unit:               form.unit,
        sendEmail:          form.sendEmail,
        sendSms:            form.sendSms,
        sendWhatsApp:       form.sendWhatsApp,
        emailRecipients:    form.sendEmail    ? form.emailRecipients    : [],
        smsRecipients:      form.sendSms      ? form.smsRecipients      : [],
        whatsAppRecipients: form.sendWhatsApp ? form.whatsAppRecipients : [],
        notifyRoles:        form.notifyRoles,
      }
      if (editing) {
        await foodApi.updateStockAlert(editing.id, payload)
        toast.success('Alert rule updated')
      } else {
        await foodApi.createStockAlert(payload)
        toast.success('Alert rule created')
      }
      setModalOpen(false)
      loadRules()
    } catch {
      toast.error('Failed to save alert rule')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this stock alert rule?')) return
    setDeletingId(id)
    try {
      await foodApi.deleteStockAlert(id)
      toast.success('Rule deleted')
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error('Failed to delete rule')
    } finally {
      setDeletingId(null)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const ChannelBadges: React.FC<{ rule: StockAlertRule }> = ({ rule }) => (
    <div className="flex gap-1.5">
      {rule.sendEmail    && <span title="Email"    className="p-1 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Mail          className="w-3.5 h-3.5" /></span>}
      {rule.sendSms      && <span title="SMS"      className="p-1 rounded bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"><Phone       className="w-3.5 h-3.5" /></span>}
      {rule.sendWhatsApp && <span title="WhatsApp" className="p-1 rounded bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><MessageSquare className="w-3.5 h-3.5" /></span>}
    </div>
  )

  // Recipients table cell: show each channel's list as small chips
  const RecipientSummary: React.FC<{ rule: StockAlertRule }> = ({ rule }) => {
    const rows = [
      { color: 'text-blue-500',    label: 'Email', items: rule.sendEmail    ? (rule.emailRecipients    ?? []) : [] },
      { color: 'text-green-500',   label: 'SMS',   items: rule.sendSms      ? (rule.smsRecipients      ?? []) : [] },
      { color: 'text-emerald-500', label: 'WA',    items: rule.sendWhatsApp ? (rule.whatsAppRecipients ?? []) : [] },
    ].filter((r) => r.items.length > 0)

    const staticRoleIcons: Record<string, string> = {
      Owner: '👑', Chef: '👨‍🍳', Manager: '🧑‍💼', Admin: '🔑',
    }
    const staticRoleLabels: Record<string, string> = {
      Owner: 'Owner', Chef: 'Chef', Manager: 'Manager', Admin: 'Admin',
    }
    // Resolve WHAdmin:{id} → warehouse name
    const getRoleIcon  = (r: string) => r.startsWith('WHAdmin:') ? '🏪' : (staticRoleIcons[r] ?? '👤')
    const getRoleLabel = (r: string) => {
      if (r.startsWith('WHAdmin:')) {
        const id = r.slice('WHAdmin:'.length)
        return warehouses.find((w) => w.id === id)?.name ?? 'WH Admin'
      }
      return staticRoleLabels[r] ?? r
    }
    const roles = rule.notifyRoles ?? []

    if (rows.length === 0 && roles.length === 0)
      return <span className="text-xs text-gray-400">—</span>

    return (
      <div className="space-y-1.5">
        {/* Role chips */}
        {roles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 text-[10px] font-semibold
                                       px-1.5 py-0.5 rounded-full
                                       bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {getRoleIcon(r)} {getRoleLabel(r)}
              </span>
            ))}
          </div>
        )}
        {/* Explicit external contacts */}
        {rows.map(({ color, label, items }) => (
          <div key={label} className="flex flex-wrap gap-1 items-baseline">
            <span className={`text-xs font-semibold ${color} shrink-0`}>{label}:</span>
            {items.map((v) => (
              <span key={v} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700
                                       text-gray-600 dark:text-gray-300">
                {v}
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: w.type === 'KitchenStore'
      ? `🍳 ${w.name} — Kitchen`
      : w.type === 'InStore'
      ? `🏪 ${w.name} — InStore`
      : `${w.name} (${w.code})`,
  }))

  // Group products: FinalProduct (menu items) first, then RawMaterial (ingredients)
  const finalProducts = products.filter((p) => p.kind === 'FinalProduct')
  const rawMaterials  = products.filter((p) => p.kind === 'RawMaterial')
  const productOptions = [
    { value: '', label: 'Select product…' },
    ...(finalProducts.length > 0 ? [{ value: '__final__', label: '── Menu Items (FinalProduct) ──', disabled: true }] : []),
    ...finalProducts.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` })),
    ...(rawMaterials.length > 0 ? [{ value: '__raw__', label: '── Raw Materials / Ingredients ──', disabled: true }] : []),
    ...rawMaterials.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` })),
  ]

  const unitOptions = UNITS.map((u) => ({ value: u, label: u }))

  // Derive selected product's kind for the recipient hint
  const selectedProduct   = products.find((p) => p.id === form.productId)
  const selectedWarehouse = warehouses.find((w) => w.id === form.warehouseId)

  // Show ALL warehouses of the current store as role cards — fixed, not tied to the monitoring dropdown.
  // This way for FinalProduct you can notify MainStore admin + Kitchen admin + Owner + Chef,
  // and for RawMaterial the same options are available — user just picks who they want.
  const warehouseRoles: { value: string; icon: string; label: string; desc: string; warn: boolean }[] =
    warehouses.map((wh) => ({
      // Use WHAdmin:{id} — resolves by warehouse ID on the backend.
      // This avoids type-based matching (KitchenStore/InStore) which fails when
      // the warehouse was created as LocationWarehouse type.
      value: `WHAdmin:${wh.id}`,
      icon:  wh.type === 'KitchenStore' ? '🍳' : '🏪',
      label: wh.name,
      desc:  wh.managerEmployeeId ? 'Warehouse admin' : '⚠ No admin assigned yet',
      warn:  !wh.managerEmployeeId,
    }))

  // Deduplicate by role value (e.g. two InStore warehouses would both map to InStoreWarehouseManager)
  const seen = new Set<string>()
  const dynamicRoles = [
    ...warehouseRoles.filter((r) => { if (seen.has(r.value)) return false; seen.add(r.value); return true }),
    ...STATIC_ROLES,
  ]

  // When warehouse is selected on a new rule, pre-check all warehouse admins + Owner + Chef
  const handleWarehouseChange = (warehouseId: string) => {
    setForm((f) => {
      const isDefault = f.notifyRoles.length === 0
      if (!isDefault || !warehouseId) return { ...f, warehouseId }
      // Build default roles from all warehouses at the store
      const allWarehouseRoles = warehouses.map((wh) => `WHAdmin:${wh.id}`)
      return {
        ...f,
        warehouseId,
        notifyRoles: [...allWarehouseRoles, 'Owner', 'Chef'],
      }
    })
  }

  const productName   = (id: string) => products.find((p)  => p.id  === id)?.name  ?? id
  const productKind   = (id: string) => products.find((p)  => p.id  === id)?.kind
  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id

  const columns = [
    {
      key: 'productId',
      header: 'Product',
      render: (row: StockAlertRule) => {
        const kind = productKind(row.productId)
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800 dark:text-gray-200">{productName(row.productId)}</span>
            {kind && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                kind === 'FinalProduct'
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
              }`}>
                {kind === 'FinalProduct' ? 'Menu Item' : 'Ingredient'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'warehouseId',
      header: 'Kitchen Store',
      render: (row: StockAlertRule) => warehouseName(row.warehouseId),
    },
    {
      key: 'threshold',
      header: 'Alert Below',
      render: (row: StockAlertRule) => (
        <span className="font-semibold text-orange-600 dark:text-orange-400">
          {row.threshold} {row.unit}
        </span>
      ),
    },
    {
      key: 'channels',
      header: 'Notify Via',
      render: (row: StockAlertRule) => <ChannelBadges rule={row} />,
    },
    {
      key: 'recipients',
      header: 'Recipients',
      render: (row: StockAlertRule) => <RecipientSummary rule={row} />,
    },
    {
      key: 'lastTriggeredAt',
      header: 'Last Triggered',
      render: (row: StockAlertRule) =>
        row.lastTriggeredAt
          ? <span className="text-xs text-red-500">{new Date(row.lastTriggeredAt).toLocaleString()}</span>
          : <span className="text-xs text-gray-400">Never</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row: StockAlertRule) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" title="Test: trigger this alert now"
            icon={triggeringId === row.id
              ? <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              : <Zap className="w-3.5 h-3.5 text-orange-500" />}
            disabled={!!triggeringId}
            onClick={() => handleTriggerNow(row)} />
          <Button variant="ghost" size="sm" title="Preview who will receive this alert"
            icon={<Eye className="w-3.5 h-3.5 text-blue-500" />} onClick={() => openPreview(row)} />
          <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEdit(row)} />
          <Button
            variant="ghost" size="sm"
            icon={deletingId === row.id
              ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              : <Trash2 className="w-3.5 h-3.5 text-red-500" />
            }
            disabled={!!deletingId}
            onClick={() => handleDelete(row.id)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kitchen Stock Alerts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Get notified when raw materials fall below threshold — before service begins
            </p>
          </div>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Alert Rule</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['rules', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'rules' ? '📋 Alert Rules' : '📨 Sent Alerts'}
          </button>
        ))}
      </div>

      {/* ── RULES TAB ── */}
      {tab === 'rules' && <>
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold">How it works:</span> Kitchen stock is checked instantly after every sale and every 30 minutes in the background.
          When a raw material drops below the threshold, <strong>all configured contacts</strong> are notified via the selected channels.
          Repeat notifications are held for 4 hours to avoid spam.
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No stock alert rules yet</p>
          <p className="text-sm mt-1">Add rules to get notified when kitchen ingredients run low</p>
        </div>
      ) : (
        <Table columns={columns} data={rules} />
      )}

      </>}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <select
              value={historyChannel}
              onChange={(e) => { setHistoryChannel(e.target.value); setHistoryPage(1) }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5
                         bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All channels</option>
              <option value="Email">📧 Email</option>
              <option value="Sms">📱 SMS</option>
              <option value="WhatsApp">💬 WhatsApp</option>
            </select>
            <select
              value={historyStatus}
              onChange={(e) => { setHistoryStatus(e.target.value); setHistoryPage(1) }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5
                         bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="Sent">✅ Sent</option>
              <option value="Pending">⏳ Pending</option>
              <option value="Failed">❌ Failed</option>
            </select>
            <button
              onClick={loadHistory}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400 ml-auto">{historyTotal} alerts sent</span>
          </div>

          {/* History list */}
          {historyLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No alerts sent yet</p>
              <p className="text-sm mt-1">Kitchen stock alerts will appear here when triggered</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const isExpanded = expandedId === item.id
                const channelIcon = item.type === 'Email' ? '📧'
                  : item.type === 'WhatsApp' ? '💬' : '📱'
                const statusIcon = item.status === 'Sent'
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : item.status === 'Failed'
                  ? <XCircle className="w-4 h-4 text-red-500" />
                  : <Clock className="w-4 h-4 text-amber-500" />

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
                  >
                    {/* Row header */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <span className="text-base">{channelIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {item.subject || item.payload.slice(0, 60) + '…'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <span>→ {item.recipient}</span>
                          <span>·</span>
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusIcon}
                        {item.sentAt && (
                          <span className="text-xs text-gray-400">
                            {new Date(item.sentAt).toLocaleTimeString()}
                          </span>
                        )}
                        {item.retryCount > 0 && (
                          <span className="text-xs text-amber-500">retry {item.retryCount}</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded message body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-3 mb-1.5">
                          Message
                        </p>
                        {item.type === 'Email' ? (
                          // Render email HTML safely in an iframe-like div
                          <div
                            className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto"
                            dangerouslySetInnerHTML={{ __html: item.payload }}
                          />
                        ) : (
                          <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {item.payload}
                          </pre>
                        )}
                        {item.error && (
                          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> {item.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {historyTotal > HIST_PAGE_SIZE && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}>← Prev</Button>
              <span className="text-sm text-gray-500 self-center">
                Page {historyPage} of {Math.ceil(historyTotal / HIST_PAGE_SIZE)}
              </span>
              <Button variant="outline" size="sm" disabled={historyPage * HIST_PAGE_SIZE >= historyTotal}
                onClick={() => setHistoryPage((p) => p + 1)}>Next →</Button>
            </div>
          )}
        </div>
      )}

      {/* Preview Recipients Modal */}
      <Modal
        open={!!previewRule}
        onClose={() => setPreviewRule(null)}
        title={`Who receives alerts for this rule?`}
      >
        {previewLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : previewData ? (
          <div className="space-y-4">
            {/* Warnings */}
            {previewData.warnings.length > 0 && (
              <div className="space-y-1.5">
                {previewData.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20
                                          border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved contacts */}
            {previewData.resolvedContacts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No recipients could be resolved — check the warnings above.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Will receive the next alert:
                </p>
                {previewData.resolvedContacts.map((c, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                    c.status === 'OK'
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                      : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                  }`}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.role}</p>
                      {c.email && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {c.phone} (SMS + WhatsApp)
                        </p>
                      )}
                      {c.status !== 'OK' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          ⚠ {c.status === 'NoManager' ? 'No manager assigned to warehouse'
                            : c.status === 'NoAccount' ? 'Employee has no login account'
                            : 'No email or phone in account'}
                        </p>
                      )}
                    </div>
                    {c.status === 'OK'
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    }
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
              💡 To fix missing contacts: go to <strong>Inventory → Warehouses → Edit</strong> and assign a Manager,
              then ensure that employee has Email/Phone in <strong>Employees → Edit</strong>.
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Alert Rule' : 'New Kitchen Stock Alert Rule'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Product (Menu Item or Ingredient)"
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              options={productOptions}
            />
            <Select
              label="Kitchen Store / Warehouse"
              value={form.warehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Alert Threshold"
              type="number"
              placeholder="e.g. 5"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              hint="Send alert when stock falls below this quantity"
            />
            <Select
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              options={unitOptions}
            />
          </div>

          {/* Who to notify — role checkboxes */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Who should be notified?
              <span className="ml-2 text-xs font-normal text-gray-400">select roles</span>
            </p>

            {warehouses.length === 0 && (
              <p className="text-xs text-amber-500">No warehouses found for this store.</p>
            )}

            {warehouses.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {dynamicRoles.map(({ value, label, icon, desc, warn }) => {
                  const checked = form.notifyRoles.includes(value)
                  return (
                    <label
                      key={value}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            notifyRoles: e.target.checked
                              ? [...f.notifyRoles, value]
                              : f.notifyRoles.filter((r) => r !== value),
                          }))
                        }
                        className="mt-0.5 rounded accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base leading-none">{icon}</span>
                          <span className={`text-sm font-semibold ${
                            checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'
                          }`}>
                            {label}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 leading-tight ${
                          warn ? 'text-amber-500' : 'text-gray-400'
                        }`}>{desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            {form.notifyRoles.length > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ {form.notifyRoles.length} role{form.notifyRoles.length > 1 ? 's' : ''} selected —
                their email / phone resolved at notification time
              </p>
            )}
          </div>

          {/* Notification flow info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50 dark:bg-gray-800/40">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              How notifications are sent
            </p>
            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                <span><strong>Email</strong> — sent to each person's registered email address</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                <span><strong>SMS</strong> — sent to each person's registered phone number</span>
              </div>
              <div className="flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                <span><strong>WhatsApp</strong> — sent to same phone number (WhatsApp runs on same number)</span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                <Plus className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                <span>
                  <strong>Extra contacts below</strong> — for people outside the system (suppliers,
                  external managers). Enter email / phone manually.
                </span>
              </div>
            </div>
          </div>

          {/* Notification channels */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notify via</p>
            <div className="flex gap-4">
              {([ ['sendEmail', 'Email', Mail], ['sendSms', 'SMS', Phone], ['sendWhatsApp', 'WhatsApp', MessageSquare] ] as const).map(
                ([key, label, Icon]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                )
              )}
            </div>
          </div>

          {/* Per-channel tag inputs — visible only when that channel is enabled */}
          {form.sendEmail && (
            <RecipientTagInput
              label="Email Recipients"
              type="email"
              placeholder="owner@restaurant.com"
              hint="Type an address and press Enter (or comma). Add as many as needed — owner, manager, chef…"
              values={form.emailRecipients}
              onChange={(v) => setForm((f) => ({ ...f, emailRecipients: v }))}
            />
          )}
          {form.sendSms && (
            <RecipientTagInput
              label="SMS Phone Numbers"
              type="tel"
              placeholder="+91 98765 43210"
              hint="Type a number in E.164 format and press Enter. Add multiple recipients."
              values={form.smsRecipients}
              onChange={(v) => setForm((f) => ({ ...f, smsRecipients: v }))}
            />
          )}
          {form.sendWhatsApp && (
            <RecipientTagInput
              label="WhatsApp Numbers"
              type="tel"
              placeholder="+91 98765 43210"
              hint="Type a number in E.164 format and press Enter. Add multiple recipients."
              values={form.whatsAppRecipients}
              onChange={(v) => setForm((f) => ({ ...f, whatsAppRecipients: v }))}
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>
              {editing ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
