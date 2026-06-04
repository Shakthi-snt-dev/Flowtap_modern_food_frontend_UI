import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Eye, ChevronLeft, ChevronRight, Trash2, RefreshCw } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { purchaseApi } from '@flowtap/api-core'
import { inventoryApi } from '@flowtap/api-core'
import {
  Button, Input, Select, Modal, Badge, Table, Spinner, EmptyState,
} from '@flowtap/ui-core'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PurchaseOrder {
  id: string
  poNumber: string
  supplier: string
  supplierId?: string
  date: string
  items: number
  total: number
  status: string
  currency: string
}

interface POItem {
  productId: string
  productName: string
  quantity: number
  unitCost: number
}

interface POForm {
  supplierId: string
  expectedDelivery: string
  notes: string
  warehouseId: string
  currency: string
}

interface SupplierOption { value: string; label: string }
interface ProductOption  { value: string; label: string; cost: number }

// ─── Constants ─────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: '$', CAD: '$', AED: 'د.إ', SGD: '$'
}

const STATUS_COLORS: Record<string, 'success' | 'info' | 'default' | 'danger'> = {
  Received: 'success', Sent: 'info', Draft: 'default', Cancelled: 'danger',
}

const STATUS_TABS = ['All', 'Draft', 'Sent', 'Received', 'Cancelled']
const PAGE_SIZE = 10
const defaultPOForm = (defaultCurrency: string = 'INR', defaultWarehouseId: string = ''): POForm => ({
  supplierId: '',
  expectedDelivery: '',
  notes: '',
  warehouseId: defaultWarehouseId,
  currency: defaultCurrency,
})

// ─── New PO Modal ─────────────────────────────────────────────────────────────

interface NewPOModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  tenantId: string
  storeId?: string | null
  suppliers: SupplierOption[]
  products: ProductOption[]
  warehouses: { value: string; label: string }[]
  defaultCurrency: string
}

const NewPOModal: React.FC<NewPOModalProps> = ({ open, onClose, onCreated, tenantId, storeId, suppliers, products, warehouses, defaultCurrency }) => {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<POForm>(() => defaultPOForm(defaultCurrency, warehouses[0]?.value ?? ''))
  const [lineItems, setLineItems] = useState<POItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm(defaultPOForm(defaultCurrency, warehouses[0]?.value ?? ''))
    }
  }, [open, defaultCurrency, warehouses])

  const set = (field: keyof POForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSelectedProduct(id)
    const prod = products.find((p) => p.value === id)
    if (prod) setUnitCost(String(prod.cost))
  }

  const addLineItem = () => {
    const prod = products.find((p) => p.value === selectedProduct)
    if (!prod || !qty || Number(qty) <= 0 || !unitCost) { toast.error('Select product, valid qty, and cost'); return }
    if (lineItems.find((li) => li.productId === prod.value)) {
      toast.error('Product already added — change quantity instead')
      return
    }
    setLineItems((prev) => [
      ...prev,
      { productId: prod.value, productName: prod.label, quantity: parseInt(qty, 10), unitCost: parseFloat(unitCost) },
    ])
    setSelectedProduct(''); setQty('1'); setUnitCost('')
  }

  const removeLineItem = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i))
  const runningTotal = lineItems.reduce((s, li) => s + li.quantity * li.unitCost, 0)

  const handleClose = () => {
    setStep(1); setForm(defaultPOForm(defaultCurrency, warehouses[0]?.value ?? '')); setLineItems([])
    setSelectedProduct(''); setQty('1'); setUnitCost('')
    onClose()
  }

  const handleSubmit = async () => {
    if (lineItems.length === 0) { toast.error('Add at least one item'); return }
    if (!form.warehouseId) { toast.error('Select a warehouse'); return }
    setSubmitting(true)
    try {
      await purchaseApi.createPurchaseOrder({
        companyId: tenantId,
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        currency: form.currency,
        locationId: storeId ?? undefined,
        expectedDeliveryDate: form.expectedDelivery || undefined,
        notes: form.notes || undefined,
        items: lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity, unitCost: li.unitCost })),
      })
      toast.success('Purchase order created')
      onCreated()
      handleClose()
    } catch {
      toast.error('Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSupplierLabel = suppliers.find((s) => s.value === form.supplierId)?.label ?? '—'
  const stepTitles = ['Supplier & Details', 'Add Items', 'Review & Submit']

  return (
    <Modal open={open} onClose={handleClose} title="New Purchase Order" size="xl"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={step === 1 ? handleClose : () => setStep((s) => s - 1)}
            icon={step > 1 ? <ChevronLeft className="w-4 h-4" /> : undefined}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`w-2 h-2 rounded-full transition-colors ${s === step ? 'bg-blue-600' : s < step ? 'bg-blue-300' : 'bg-gray-200 dark:bg-gray-600'}`} />
            ))}
          </div>
          {step < 3
            ? <Button onClick={() => { if (step === 1 && !form.supplierId) { toast.error('Select a supplier'); return } if (step === 1 && !form.warehouseId) { toast.error('Select a warehouse'); return } setStep((s) => s + 1) }} icon={<ChevronRight className="w-4 h-4" />}>Next</Button>
            : <Button onClick={handleSubmit} loading={submitting}>Submit Order</Button>}
        </div>
      }
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Step {step} of 3 — {stepTitles[step - 1]}</p>

      {step === 1 && (
        <div className="space-y-4">
          <Select label="Supplier *" value={form.supplierId} onChange={set('supplierId')}
            options={suppliers} placeholder="Select supplier" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Warehouse *" value={form.warehouseId} onChange={set('warehouseId')}
              options={warehouses} placeholder="Select warehouse" />
            <Select label="Currency *" value={form.currency} onChange={set('currency')}
              options={[
                { value: 'INR', label: 'INR (₹)' },
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'GBP', label: 'GBP (£)' },
                { value: 'AUD', label: 'AUD ($)' },
                { value: 'CAD', label: 'CAD ($)' },
                { value: 'AED', label: 'AED (د.إ)' },
                { value: 'SGD', label: 'SGD ($)' },
              ]} placeholder="Select currency" />
          </div>
          <Input label="Expected Delivery Date" value={form.expectedDelivery}
            onChange={set('expectedDelivery')} type="date" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              placeholder="Any special instructions..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select label="Product" value={selectedProduct} onChange={handleProductChange}
                options={products.map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Select product..." />
            </div>
            <div className="w-20">
              <Input label="Qty" value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="1" />
            </div>
            <div className="w-28">
              <Input label={`Unit Cost (${CURRENCY_SYMBOLS[form.currency] ?? form.currency})`} value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)} type="number" min="0" />
            </div>
            <Button variant="outline" onClick={addLineItem} disabled={!selectedProduct || Number(qty) <= 0 || unitCost === ''}>Add</Button>
          </div>

          {lineItems.length > 0 ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Product', 'Qty', 'Unit Cost', 'Total', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {lineItems.map((li, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{li.productName}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{li.quantity}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{(CURRENCY_SYMBOLS[form.currency] ?? form.currency)}{li.unitCost.toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{(CURRENCY_SYMBOLS[form.currency] ?? form.currency)}{(li.quantity * li.unitCost).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeLineItem(i)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total: {(CURRENCY_SYMBOLS[form.currency] ?? form.currency)}{runningTotal.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No items added yet</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Supplier</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedSupplierLabel}</span>
            </div>
            {form.expectedDelivery && (
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Delivery</span>
                <span className="font-medium text-gray-900 dark:text-white">{form.expectedDelivery}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Line Items</span>
              <span className="font-medium text-gray-900 dark:text-white">{lineItems.length}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <span>Grand Total</span>
              <span className="text-blue-600 dark:text-blue-400">{(CURRENCY_SYMBOLS[form.currency] ?? form.currency)}{runningTotal.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {['Product', 'Qty', 'Unit Cost', 'Total'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {lineItems.map((li, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{li.productName}</td>
                    <td className="px-3 py-2">{li.quantity}</td>
                    <td className="px-3 py-2">{(CURRENCY_SYMBOLS[form.currency] ?? form.currency)}{li.unitCost.toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium">{(CURRENCY_SYMBOLS[form.currency] ?? form.currency)}{(li.quantity * li.unitCost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const PurchasesPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [activeTab, setActiveTab] = useState('All')
  const [page, setPage] = useState(1)
  const [newModalOpen, setNewModalOpen] = useState(false)

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([])

  // Load dropdown data once
  useEffect(() => {
    if (!tenant?.id) return
    purchaseApi.getSuppliers({ companyId: tenant.id, pageSize: 200 })
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? []
        setSuppliers((Array.isArray(raw) ? raw : []).map((s: Record<string, unknown>) => ({
          value: String(s.id),
          label: String(s.name ?? ''),
        })))
      }).catch(() => {})

    inventoryApi.getProducts({ companyId: tenant.id, isActive: true, pageSize: 200 })
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? []
        setProducts((Array.isArray(raw) ? raw : []).map((p: Record<string, unknown>) => ({
          value: String(p.id),
          label: String(p.name ?? ''),
          cost: Number(p.defaultCostPrice ?? p.purchasePrice ?? 0),
        })))
      }).catch(() => {})

    inventoryApi.getWarehouses({ companyId: tenant.id })
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? []
        setWarehouses((Array.isArray(raw) ? raw : []).map((w: Record<string, unknown>) => ({
          value: String(w.id),
          label: String(w.name ?? ''),
        })))
      }).catch(() => {})
  }, [tenant?.id])

  const load = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)
    purchaseApi
      .getPurchaseOrders({
        companyId: tenant.id,
        locationId: currentStoreId ?? undefined,
        status: activeTab === 'All' ? undefined : activeTab,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? []
        const items: PurchaseOrder[] = (Array.isArray(raw) ? raw : []).map((o: Record<string, unknown>) => ({
          id: String(o.id),
          poNumber: String(o.poNumber ?? o.orderNumber ?? '#' + String(o.id).slice(-6)),
          supplier: String(o.supplierName ?? o.supplier ?? '—'),
          supplierId: o.supplierId ? String(o.supplierId) : undefined,
          date: o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-IN') : String(o.date ?? ''),
          items: Number(o.itemCount ?? (Array.isArray(o.items) ? o.items.length : (o.items ?? 0))),
          total: Number(o.total ?? o.totalAmount ?? 0),
          status: String(o.status ?? 'Draft'),
          currency: String(o.currency ?? 'INR'),
        }))
        setOrders(items)
        setTotal(res.data?.total ?? res.data?.count ?? items.length)
      })
      .catch(() => toast.error('Failed to load purchase orders'))
      .finally(() => setLoading(false))
  }, [tenant?.id, currentStoreId, activeTab, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [activeTab])

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await purchaseApi.updatePurchaseOrderStatus(id, status)
      toast.success(`Order marked as ${status}`)
      load()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const columns = [
    { key: 'poNumber', header: 'PO #', render: (r: PurchaseOrder) => <span className="font-semibold text-gray-900 dark:text-white">{r.poNumber}</span> },
    { key: 'supplier', header: 'Supplier', render: (r: PurchaseOrder) => <span className="text-gray-700 dark:text-gray-300">{r.supplier}</span> },
    { key: 'date', header: 'Date', render: (r: PurchaseOrder) => <span className="text-gray-600 dark:text-gray-400 text-sm">{r.date}</span> },
    { key: 'items', header: 'Items', render: (r: PurchaseOrder) => <span className="text-gray-700 dark:text-gray-300">{r.items} items</span> },
    { key: 'total', header: 'Total', render: (r: PurchaseOrder) => <span className="font-semibold text-gray-900 dark:text-white">{(CURRENCY_SYMBOLS[r.currency] ?? r.currency)}{r.total.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: (r: PurchaseOrder) => <Badge variant={STATUS_COLORS[r.status] ?? 'default'}>{r.status}</Badge> },
    {
      key: 'actions', header: 'Actions',
      render: (r: PurchaseOrder) => (
        <div className="flex gap-1">
          {r.status === 'Draft' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(r.id, 'Sent')}>Send</Button>
          )}
          {r.status === 'Sent' && (
            <Button size="sm" variant="primary" onClick={() => handleStatusUpdate(r.id, 'Received')}>Receive</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setNewModalOpen(true)}>
            New Order
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
            ].join(' ')}>
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Eye className="w-16 h-16" />}
            title="No purchase orders"
            description="Create your first purchase order to get started."
            action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setNewModalOpen(true)}>New Order</Button>}
          />
        ) : (
          <Table data={orders} columns={columns} />
        )}
      </div>

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Page {page} of {totalPages} · {total} orders</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <NewPOModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={load}
        tenantId={tenant?.id ?? ''}
        storeId={currentStoreId}
        suppliers={suppliers}
        products={products}
        warehouses={warehouses}
        defaultCurrency={tenant?.currency || 'INR'}
      />
    </div>
  )
}
