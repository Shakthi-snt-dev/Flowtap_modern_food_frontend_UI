import React, { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, Package, AlertTriangle, XCircle, History, Plus, Printer } from 'lucide-react'
import Barcode from 'react-barcode'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import {
  Button,
  Select,
  Modal,
  Badge,
  Table,
  Spinner,
  StatCard,
  Input,
} from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

type StockStatus = 'OK' | 'Low' | 'Out'

interface StockLevel {
  id: string          // stock record id
  productId: string   // product id for adjustment
  warehouseId: string // warehouse id for adjustment
  product: string
  sku: string
  warehouse: string
  quantity: number
  minLevel: number
  status: StockStatus
}

type AdjustmentType = 'Add' | 'Remove' | 'Set'
// Values match backend StockAdjustmentReason enum names exactly
type AdjustmentReason = 'Supplier' | 'Damaged' | 'Loss' | 'Correction' | 'Returned' | 'Audit'

const REASON_LABELS: Record<string, string> = {
  Supplier:   'Received from Supplier',
  Damaged:    'Damaged',
  Loss:       'Loss',
  Correction: 'Stock Count Correction',
  Returned:   'Returned',
  Audit:      'Audit',
}

interface AdjustmentForm {
  type: AdjustmentType
  quantity: string
  reason: AdjustmentReason
}

interface AddStockForm {
  productId: string
  warehouseId: string
  quantity: string
  reason: string
}

interface Product   { id: string; name: string; sku: string }
interface Warehouse { id: string; name: string; code: string }

interface StockAdjustment {
  id: string
  productId: string
  productName: string
  warehouseId: string
  adjustmentNumber: string
  adjustmentType: string
  quantityDifference: number
  quantityBefore: number
  quantityAfter: number
  reason: string | null
  isApproved: boolean
  createdAt: string
}

type PageTab = 'stock' | 'adjustments'
type StockTab = 'all' | 'low' | 'out'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusVariant = (status: StockStatus) => {
  if (status === 'OK') return 'success' as const
  if (status === 'Low') return 'warning' as const
  return 'danger' as const
}

const EMPTY_FORM: AdjustmentForm = {
  type: 'Add',
  quantity: '',
  reason: 'Supplier',
}

const EMPTY_ADD_FORM: AddStockForm = {
  productId: '',
  warehouseId: '',
  quantity: '',
  reason: 'Supplier',
}

// ─── Barcode helpers ─────────────────────────────────────────────────────────

interface BarcodeTemplate {
  codeType: string; showProductName: boolean; showSKU: boolean
  labelWidthMm: number; labelHeightMm: number; labelsPerRow: number; isDefault: boolean
}

const toBarcodeFormat = (codeType: string): string => {
  const map: Record<string, string> = {
    Code128: 'CODE128', code128: 'CODE128',
    Code39: 'CODE39',   code39: 'CODE39',
    EAN13: 'EAN13',     ean13: 'EAN13',
    UPC: 'UPC',         upc: 'UPC',
  }
  return map[codeType] ?? 'CODE128'
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StockPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  // ── Page-level tab (Stock Levels vs Adjustments History) ────────────────────
  const [pageTab, setPageTab] = useState<PageTab>('stock')

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<StockTab>('all')

  // ── Adjustments history ───────────────────────────────────────────────────────
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [adjLoading, setAdjLoading] = useState(false)
  const [adjPage, setAdjPage] = useState(1)
  const [adjTotal, setAdjTotal] = useState(0)
  const ADJ_PAGE_SIZE = 20

  // adjustment modal (for existing stock rows)
  const [modalOpen, setModalOpen] = useState(false)
  const [adjustingRow, setAdjustingRow] = useState<StockLevel | null>(null)
  const [form, setForm] = useState<AdjustmentForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Add Stock modal (for products with no stock record yet)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddStockForm>(EMPTY_ADD_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // Barcode print
  const [barcodeTemplate, setBarcodeTemplate] = useState<BarcodeTemplate | null>(null)
  const [printJob, setPrintJob] = useState<{ sku: string; name: string; copies: number } | null>(null)
  const [printCopies, setPrintCopies] = useState(1)

  // ── Load stock ───────────────────────────────────────────────────────────────
  const loadStock = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)
    inventoryApi
      .getStockLevels({ companyId: tenant.id, locationId: currentStoreId ?? undefined })
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? []
        const items: StockLevel[] = Array.isArray(raw)
          ? raw.map((r: Record<string, unknown>) => {
              const qty = Number(r.quantity ?? r.stock ?? 0)
              const min = Number(r.minLevel ?? r.reorderLevel ?? 0)
              const status: StockStatus =
                (r.status as StockStatus) ??
                (qty === 0 ? 'Out' : qty < min ? 'Low' : 'OK')
              return {
                id: String(r.id ?? r.productId),
                productId: String(r.productId ?? r.product_id ?? r.id),
                warehouseId: String(r.warehouseId ?? r.warehouse_id ?? ''),
                product: String(r.product ?? r.productName ?? r.name ?? ''),
                sku: String(r.sku ?? ''),
                warehouse: String(r.warehouse ?? r.warehouseName ?? r.location ?? ''),
                quantity: qty,
                minLevel: min,
                status,
              }
            })
          : []
        setStockLevels(items)
      })
      .catch(() => { toast.error('Failed to load stock levels'); setStockLevels([]) })
      .finally(() => setLoading(false))
  }, [tenant?.id, currentStoreId])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  // When store switches, clear cached warehouse list so modal re-fetches for the new store
  useEffect(() => {
    setWarehouses([])
  }, [currentStoreId])

  // Load default barcode template on mount
  useEffect(() => {
    inventoryApi.getBarcodeTemplates().then(res => {
      const list: any[] = res.data?.data ?? res.data ?? []
      const def = list.find((t: any) => t.isDefault) ?? list[0] ?? null
      if (def) setBarcodeTemplate(def)
    }).catch(() => {})
  }, [])

  // Inject print CSS when print modal is open
  useEffect(() => {
    if (!printJob) return
    const style = document.createElement('style')
    style.id = 'stock-barcode-print-style'
    style.textContent = `@media print { body > * { display: none !important; } #stock-barcode-labels { display: flex !important; flex-wrap: wrap; } }`
    document.head.appendChild(style)
    return () => { document.getElementById('stock-barcode-print-style')?.remove() }
  }, [printJob])

  // Load products + warehouses for the Add Stock modal
  useEffect(() => {
    if (!addModalOpen || !tenant?.id) return
    if (products.length === 0)
      inventoryApi.getProducts({ companyId: tenant.id, pageSize: 200 }).then((res) => {
        const data = res.data?.data ?? res.data
        setProducts((data?.items ?? data ?? []).map((p: Record<string, unknown>) => ({
          id: String(p.id), name: String(p.name ?? ''), sku: String(p.sku ?? ''),
        })))
      }).catch(() => {})
    if (warehouses.length === 0)
      // Filter to current store's warehouses so stock goes to the right place
      inventoryApi.getWarehouses({ companyId: tenant.id, storeId: currentStoreId ?? undefined }).then((res) => {
        const data = res.data?.data ?? res.data
        setWarehouses((Array.isArray(data) ? data : []).map((w: Record<string, unknown>) => ({
          id: String(w.id), name: String(w.name ?? ''), code: String(w.code ?? ''),
        })))
      }).catch(() => {})
  }, [addModalOpen, tenant?.id, currentStoreId])

  // ── Load adjustment history ───────────────────────────────────────────────────
  const loadAdjustments = useCallback(() => {
    if (!tenant?.id) return
    setAdjLoading(true)
    inventoryApi
      .getStockAdjustments({ companyId: tenant.id, page: adjPage, pageSize: ADJ_PAGE_SIZE })
      .then((res) => {
        const data = res.data?.data ?? res.data
        const raw = data?.items ?? data ?? []
        setAdjustments(
          Array.isArray(raw)
            ? raw.map((r: Record<string, unknown>) => ({
                id: String(r.id ?? ''),
                productId: String(r.productId ?? ''),
                productName: String(r.productName ?? ''),
                warehouseId: String(r.warehouseId ?? ''),
                adjustmentNumber: String(r.adjustmentNumber ?? ''),
                adjustmentType: String(r.adjustmentType ?? ''),
                quantityDifference: Number(r.quantityDifference ?? 0),
                quantityBefore: Number(r.quantityBefore ?? 0),
                quantityAfter: Number(r.quantityAfter ?? 0),
                reason: r.reason ? String(r.reason) : null,
                isApproved: Boolean(r.isApproved ?? true),
                createdAt: String(r.createdAt ?? ''),
              }))
            : []
        )
        setAdjTotal(data?.totalCount ?? 0)
      })
      .catch(() => toast.error('Failed to load adjustment history'))
      .finally(() => setAdjLoading(false))
  }, [tenant?.id, adjPage])

  useEffect(() => {
    if (pageTab === 'adjustments') loadAdjustments()
  }, [pageTab, loadAdjustments])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalProducts = stockLevels.length
  const lowStockItems = stockLevels.filter((s) => s.status === 'Low').length
  const outOfStockItems = stockLevels.filter((s) => s.status === 'Out').length

  // ── Filtered data ────────────────────────────────────────────────────────────
  const filteredData = stockLevels.filter((s) => {
    if (activeTab === 'low') return s.status === 'Low'
    if (activeTab === 'out') return s.status === 'Out'
    return true
  })

  // ── Adjustment modal ─────────────────────────────────────────────────────────
  const openAdjust = (row: StockLevel) => {
    setAdjustingRow(row)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setAdjustingRow(null)
  }

  const handleAdjust = async () => {
    if (!form.quantity || isNaN(Number(form.quantity))) {
      toast.error('Please enter a valid quantity')
      return
    }
    if (!adjustingRow?.warehouseId) {
      toast.error('Warehouse information missing for this stock entry')
      return
    }
    setSaving(true)
    try {
      await inventoryApi.adjustStock({
        companyId: tenant?.id ?? '',
        productId: adjustingRow.productId,
        warehouseId: adjustingRow.warehouseId,
        adjustmentType: form.type,
        quantity: Number(form.quantity),
        reason: form.reason,
        reasonCode: form.reason,   // backend enum field
      })
      toast.success('Stock adjusted successfully')
      closeModal()
      loadStock()
    } catch {
      toast.error('Failed to adjust stock')
    } finally {
      setSaving(false)
    }
  }

  // ── Add Stock (for products with no existing warehouse stock record) ──────────
  const handleAddStock = async () => {
    if (!addForm.productId) { toast.error('Select a product'); return }
    if (!addForm.warehouseId) { toast.error('Select a warehouse'); return }
    if (!addForm.quantity || isNaN(Number(addForm.quantity)) || Number(addForm.quantity) <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    setAddSaving(true)
    try {
      await inventoryApi.adjustStock({
        companyId: tenant?.id ?? '',
        productId: addForm.productId,
        warehouseId: addForm.warehouseId,
        adjustmentType: 'Add',
        quantity: Number(addForm.quantity),
        reason: addForm.reason,
        reasonCode: addForm.reason,
      })
      // find the product to get its SKU for label printing
      const addedProduct = products.find(p => p.id === addForm.productId)
      const qty = Number(addForm.quantity)
      toast.success(`Stock added — ${qty} unit${qty !== 1 ? 's' : ''} recorded`)
      setAddModalOpen(false)
      setAddForm(EMPTY_ADD_FORM)
      loadStock()
      // offer barcode label printing for the added quantity
      if (addedProduct?.sku) {
        setPrintCopies(qty)
        setPrintJob({ sku: addedProduct.sku, name: addedProduct.name, copies: qty })
      }
    } catch {
      toast.error('Failed to add stock')
    } finally {
      setAddSaving(false)
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'product' as const,
      header: 'Product',
      render: (row: StockLevel) => (
        <span className="font-medium text-gray-900 dark:text-white">{row.product}</span>
      ),
    },
    {
      key: 'sku' as const,
      header: 'SKU',
      render: (row: StockLevel) => (
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{row.sku}</span>
      ),
    },
    {
      key: 'warehouse' as const,
      header: 'Warehouse',
      render: (row: StockLevel) => (
        <span className="text-gray-700 dark:text-gray-300">{row.warehouse}</span>
      ),
    },
    {
      key: 'quantity' as const,
      header: 'Current Stock',
      render: (row: StockLevel) => (
        <span
          className={
            row.status === 'Out'
              ? 'font-semibold text-red-600 dark:text-red-400'
              : row.status === 'Low'
              ? 'font-semibold text-yellow-600 dark:text-yellow-400'
              : 'text-gray-700 dark:text-gray-300'
          }
        >
          {row.quantity}
        </span>
      ),
    },
    {
      key: 'minLevel' as const,
      header: 'Min Level',
      render: (row: StockLevel) => (
        <span className="text-gray-500 dark:text-gray-400">{row.minLevel}</span>
      ),
    },
    {
      key: 'status' as const,
      header: 'Status',
      render: (row: StockLevel) => (
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions' as const,
      header: 'Actions',
      render: (row: StockLevel) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<SlidersHorizontal className="w-4 h-4" />}
            onClick={(e) => { e.stopPropagation(); openAdjust(row) }}
          >
            Adjust
          </Button>
          {row.sku && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer className="w-4 h-4 text-purple-500" />}
              title="Print barcode labels"
              onClick={(e) => {
                e.stopPropagation()
                const copies = row.quantity > 0 ? row.quantity : 1
                setPrintCopies(copies)
                setPrintJob({ sku: row.sku, name: row.product, copies })
              }}
            />
          )}
        </div>
      ),
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock</h1>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { setAddForm(EMPTY_ADD_FORM); setAddModalOpen(true) }}
        >
          Add Stock
        </Button>
      </div>

      {/* Page-level tab: Stock Levels | Adjustment History */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit border-b-0">
        <button
          onClick={() => setPageTab('stock')}
          className={
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ' +
            (pageTab === 'stock'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')
          }
        >
          <Package className="w-4 h-4" /> Stock Levels
        </button>
        <button
          onClick={() => setPageTab('adjustments')}
          className={
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ' +
            (pageTab === 'adjustments'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')
          }
        >
          <History className="w-4 h-4" /> Adjustment History
        </button>
      </div>

      {/* ── STOCK LEVELS TAB ─────────────────────────────────────────────────── */}
      {pageTab === 'stock' && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Products"
              value={totalProducts}
              icon={<Package className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              title="Low Stock Items"
              value={lowStockItems}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="orange"
            />
            <StatCard
              title="Out of Stock"
              value={outOfStockItems}
              icon={<XCircle className="w-5 h-5" />}
              color="red"
            />
          </div>

          {/* Stock filter tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            {([
              { key: 'all', label: 'All Stock' },
              { key: 'low', label: `Low Stock (${lowStockItems})` },
              { key: 'out', label: `Out of Stock (${outOfStockItems})` },
            ] as { key: StockTab; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors ' +
                  (activeTab === tab.key
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Stock table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <Table<StockLevel>
              columns={columns}
              data={filteredData}
              emptyMessage="No stock items found"
            />
          )}
        </>
      )}

      {/* ── ADJUSTMENTS HISTORY TAB ──────────────────────────────────────────── */}
      {pageTab === 'adjustments' && (
        <>
          {adjLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : adjustments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No adjustments recorded yet</p>
              <p className="text-sm mt-1">Adjustments you make on the Stock Levels tab will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Adj #', 'Product', 'Type', 'Before', 'Change', 'After', 'Reason', 'Status', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{adj.adjustmentNumber || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{adj.productName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                          adj.adjustmentType === 'Add' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : adj.adjustmentType === 'Remove' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {adj.adjustmentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{adj.quantityBefore}</td>
                      <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                        <span className={adj.quantityDifference >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {adj.quantityDifference >= 0 ? '+' : ''}{adj.quantityDifference}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{adj.quantityAfter}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{adj.reason ? (REASON_LABELS[adj.reason] ?? adj.reason) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={adj.isApproved ? 'success' : 'warning'}>
                          {adj.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(adj.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adjTotal > ADJ_PAGE_SIZE && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={adjPage <= 1} onClick={() => setAdjPage((p) => p - 1)}>Prev</Button>
              <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-300">
                Page {adjPage} of {Math.ceil(adjTotal / ADJ_PAGE_SIZE)}
              </span>
              <Button variant="outline" disabled={adjPage >= Math.ceil(adjTotal / ADJ_PAGE_SIZE)} onClick={() => setAdjPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Stock Adjustment"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button loading={saving} onClick={handleAdjust}>Confirm</Button>
          </div>
        }
      >
        {adjustingRow && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <p className="font-semibold text-gray-900 dark:text-white">{adjustingRow.product}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {adjustingRow.sku} &middot; {adjustingRow.warehouse}
              </p>
              <p className="text-sm mt-1">
                <span className="text-gray-500 dark:text-gray-400">Current stock: </span>
                <span
                  className={
                    adjustingRow.status === 'Out'
                      ? 'font-semibold text-red-600 dark:text-red-400'
                      : adjustingRow.status === 'Low'
                      ? 'font-semibold text-yellow-600 dark:text-yellow-400'
                      : 'font-semibold text-gray-900 dark:text-white'
                  }
                >
                  {adjustingRow.quantity}
                </span>
              </p>
            </div>

            <Select
              label="Adjustment Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AdjustmentType }))}
              options={[
                { value: 'Add', label: 'Add Stock' },
                { value: 'Remove', label: 'Remove Stock' },
                { value: 'Set', label: 'Set Exact Quantity' },
              ]}
            />

            <Input
              label="Quantity"
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="0"
            />

            <Select
              label="Reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value as AdjustmentReason }))}
              options={[
                { value: 'Supplier',   label: 'Received from Supplier' },
                { value: 'Damaged',    label: 'Damaged' },
                { value: 'Loss',       label: 'Loss' },
                { value: 'Correction', label: 'Stock Count Correction' },
                { value: 'Returned',   label: 'Returned' },
                { value: 'Audit',      label: 'Audit' },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ── Add Stock Modal (for products with no existing stock record) ── */}
      <Modal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); setAddForm(EMPTY_ADD_FORM) }}
        title="Add Stock"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAddModalOpen(false); setAddForm(EMPTY_ADD_FORM) }}>Cancel</Button>
            <Button loading={addSaving} onClick={handleAddStock}>Add Stock</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use this to add initial stock for a product, or to record received inventory.
          </p>

          <Select
            label="Product *"
            value={addForm.productId}
            onChange={(e) => setAddForm((f) => ({ ...f, productId: e.target.value }))}
            options={[
              { value: '', label: 'Select product…' },
              ...products.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` })),
            ]}
          />

          <Select
            label="Warehouse *"
            value={addForm.warehouseId}
            onChange={(e) => setAddForm((f) => ({ ...f, warehouseId: e.target.value }))}
            options={[
              { value: '', label: 'Select warehouse…' },
              ...warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
            ]}
          />

          <Input
            label="Quantity *"
            type="number"
            min={1}
            value={addForm.quantity}
            onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="e.g. 50"
          />

          <Select
            label="Reason"
            value={addForm.reason}
            onChange={(e) => setAddForm((f) => ({ ...f, reason: e.target.value }))}
            options={[
              { value: 'Supplier',   label: 'Received from Supplier' },
              { value: 'Correction', label: 'Stock Count Correction' },
              { value: 'Damaged',    label: 'Damaged' },
              { value: 'Loss',       label: 'Loss' },
              { value: 'Returned',   label: 'Returned' },
              { value: 'Audit',      label: 'Audit' },
            ]}
          />
        </div>
      </Modal>

      {/* ── Barcode Print Modal ── */}
      {printJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPrintJob(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Printer className="w-4 h-4 text-purple-600" /> Print Barcode Labels
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{printJob.name} · SKU: {printJob.sku}</p>

            {/* Copies input */}
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Number of copies
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={printCopies}
                onChange={e => setPrintCopies(Math.max(1, Math.min(500, Number(e.target.value))))}
                className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <span className="text-xs text-gray-400">label{printCopies !== 1 ? 's' : ''}</span>
            </div>

            {/* Preview (1 label) */}
            <div className="mb-5 flex justify-center">
              <div
                className="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl"
                style={barcodeTemplate ? {
                  width: `${barcodeTemplate.labelWidthMm * 3.78}px`,
                  minHeight: `${barcodeTemplate.labelHeightMm * 3.78}px`,
                } : {}}
              >
                <p className="text-xs text-gray-400 mb-0.5">Preview</p>
                {(!barcodeTemplate || barcodeTemplate.showProductName) && (
                  <p className="text-xs font-semibold text-gray-900 mb-1 text-center">{printJob.name}</p>
                )}
                <Barcode
                  value={printJob.sku}
                  format={toBarcodeFormat(barcodeTemplate?.codeType ?? 'Code128') as any}
                  width={1.2}
                  height={barcodeTemplate ? Math.max(25, barcodeTemplate.labelHeightMm * 1.2) : 50}
                  fontSize={10}
                  displayValue={!barcodeTemplate || barcodeTemplate.showSKU}
                />
              </div>
            </div>

            {/* Hidden print area — renders all copies */}
            <div
              id="stock-barcode-labels"
              style={{
                display: 'none',
                flexWrap: 'wrap',
                gap: '4px',
                padding: '8px',
              }}
            >
              {Array.from({ length: printCopies }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '4px',
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    ...(barcodeTemplate ? {
                      width: `${barcodeTemplate.labelWidthMm * 3.78}px`,
                      minHeight: `${barcodeTemplate.labelHeightMm * 3.78}px`,
                    } : {}),
                  }}
                >
                  {(!barcodeTemplate || barcodeTemplate.showProductName) && (
                    <span style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', marginBottom: 2 }}>
                      {printJob.name}
                    </span>
                  )}
                  <Barcode
                    value={printJob.sku}
                    format={toBarcodeFormat(barcodeTemplate?.codeType ?? 'Code128') as any}
                    width={1.2}
                    height={barcodeTemplate ? Math.max(25, barcodeTemplate.labelHeightMm * 1.2) : 50}
                    fontSize={9}
                    displayValue={!barcodeTemplate || barcodeTemplate.showSKU}
                    margin={2}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPrintJob(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" /> Print {printCopies} Label{printCopies !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
