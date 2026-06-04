import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, Plus, BarChart2, Printer } from 'lucide-react'
import Barcode from 'react-barcode'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { Button, Modal, Badge, Table, Spinner, Select, Input } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Serial {
  id: string
  productId: string
  productName: string
  warehouseId: string
  warehouseName: string
  manufacturerSerial: string | null
  companySerial: string
  displayName: string
  isSold: boolean
  isReturned: boolean
  isActive: boolean
  warrantyStartDate: string | null
  warrantyEndDate: string | null
}

interface SerialForm {
  productId: string
  warehouseId: string
  manufacturerSerial: string
  companySerial: string
  displayName: string
  warrantyStartDate: string
  warrantyEndDate: string
}

interface Warehouse { id: string; name: string; code: string }
interface Product   { id: string; name: string; sku: string }

const EMPTY_FORM: SerialForm = {
  productId: '',
  warehouseId: '',
  manufacturerSerial: '',
  companySerial: '',
  displayName: '',
  warrantyStartDate: '',
  warrantyEndDate: '',
}

// maps template codeType to react-barcode format string
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

export const SerialsPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)

  const [serials, setSerials]   = useState<Serial[]>([])
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const PAGE_SIZE = 20

  const [soldFilter, setSoldFilter]           = useState('')
  const [productFilter, setProductFilter]     = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]           = useState<SerialForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  // barcode print
  const [barcodeSerial, setBarcodeSerial] = useState<{ value: string; label: string } | null>(null)
  const [barcodeTemplate, setBarcodeTemplate] = useState<{
    codeType: string; showProductName: boolean; showSKU: boolean
    labelWidthMm: number; labelHeightMm: number; isDefault: boolean
  } | null>(null)

  // load default barcode template on mount
  useEffect(() => {
    inventoryApi.getBarcodeTemplates().then(res => {
      const list: any[] = res.data?.data ?? res.data ?? []
      const def = list.find((t: any) => t.isDefault) ?? list[0] ?? null
      if (def) setBarcodeTemplate(def)
    }).catch(() => {/* no templates yet */})
  }, [])

  // inject print-only CSS when barcode modal is open
  useEffect(() => {
    if (!barcodeSerial) return
    const style = document.createElement('style')
    style.id = 'barcode-print-style'
    style.textContent = `@media print { body > * { display: none !important; } #barcode-label { display: flex !important; position: fixed; top: 0; left: 0; } }`
    document.head.appendChild(style)
    return () => { document.getElementById('barcode-print-style')?.remove() }
  }, [barcodeSerial])

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts]     = useState<Product[]>([])

  const loadSerials = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)
    inventoryApi
      .getSerials({
        productId:   productFilter   || undefined,
        warehouseId: warehouseFilter || undefined,
        isSold:      soldFilter === '' ? undefined : soldFilter === 'true',
        page,
        pageSize:    PAGE_SIZE,
      })
      .then((res) => {
        const data = res.data?.data ?? res.data
        setSerials(data?.items ?? data ?? [])
        setTotal(data?.totalCount ?? 0)
      })
      .catch(() => toast.error('Failed to load serials'))
      .finally(() => setLoading(false))
  }, [tenant?.id, productFilter, warehouseFilter, soldFilter, page])

  useEffect(() => { loadSerials() }, [loadSerials])

  useEffect(() => {
    if (!tenant?.id) return
    inventoryApi.getWarehouses({ companyId: tenant.id }).then((res) => {
      const data = res.data?.data ?? res.data
      setWarehouses(Array.isArray(data) ? data : [])
    })
    inventoryApi.getProducts({ companyId: tenant.id, pageSize: 200 }).then((res) => {
      const data = res.data?.data ?? res.data
      setProducts(data?.items ?? data ?? [])
    })
  }, [tenant?.id])

  const handleCreate = async () => {
    if (!form.productId || !form.warehouseId) {
      toast.error('Product and warehouse are required')
      return
    }
    setSaving(true)
    try {
      await inventoryApi.createSerial({
        companyId: tenant!.id,
        ...form,
        warrantyStartDate: form.warrantyStartDate || null,
        warrantyEndDate:   form.warrantyEndDate   || null,
      })
      toast.success('Serial created')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      loadSerials()
    } catch {
      toast.error('Failed to create serial')
    } finally {
      setSaving(false)
    }
  }

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))
  const productOptions   = products.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` }))

  const columns = [
    { key: 'companySerial',      header: 'Serial #' },
    { key: 'productName',        header: 'Product' },
    { key: 'warehouseName',      header: 'Warehouse' },
    { key: 'manufacturerSerial', header: 'Mfr Serial' },
    {
      key: 'isSold',
      header: 'Status',
      render: (row: Serial) => (
        <Badge variant={row.isSold ? 'success' : row.isActive ? 'info' : 'danger'}>
          {row.isSold ? 'Sold' : row.isActive ? 'In Stock' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'warrantyEndDate',
      header: 'Warranty End',
      render: (row: Serial) =>
        row.warrantyEndDate ? new Date(row.warrantyEndDate).toLocaleDateString() : '—',
    },
    {
      key: 'actions',
      header: '',
      render: (row: Serial) => {
        const barcodeValue = row.companySerial || row.manufacturerSerial || ''
        return barcodeValue ? (
          <button
            onClick={() => setBarcodeSerial({ value: barcodeValue, label: `${row.productName} — ${barcodeValue}` })}
            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
            title="Print barcode label"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
        ) : null
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Serial Numbers</h1>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Add Serial
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={productFilter}
          onChange={(e) => { setProductFilter(e.target.value); setPage(1) }}
          options={[{ value: '', label: 'All Products' }, ...productOptions]}
        />
        <Select
          value={warehouseFilter}
          onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1) }}
          options={[{ value: '', label: 'All Warehouses' }, ...warehouseOptions]}
        />
        <Select
          value={soldFilter}
          onChange={(e) => { setSoldFilter(e.target.value); setPage(1) }}
          options={[
            { value: '', label: 'All' },
            { value: 'false', label: 'In Stock' },
            { value: 'true',  label: 'Sold' },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Table columns={columns} data={serials} />
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button variant="outline" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {/* Barcode Print Modal */}
      {barcodeSerial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBarcodeSerial(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-600" /> Print Serial Label
            </h3>
            <div
              id="barcode-label"
              className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200"
              style={barcodeTemplate ? {
                width: `${barcodeTemplate.labelWidthMm * 3.78}px`,
                minHeight: `${barcodeTemplate.labelHeightMm * 3.78}px`,
              } : {}}
            >
              {(!barcodeTemplate || barcodeTemplate.showProductName) && (
                <p className="text-sm font-semibold text-gray-900 mb-1 text-center">{barcodeSerial.label}</p>
              )}
              <Barcode
                value={barcodeSerial.value}
                format={toBarcodeFormat(barcodeTemplate?.codeType ?? 'Code128') as any}
                width={1.5}
                height={barcodeTemplate ? Math.max(30, barcodeTemplate.labelHeightMm * 1.5) : 60}
                fontSize={12}
                displayValue={!barcodeTemplate || barcodeTemplate.showSKU}
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setBarcodeSerial(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(EMPTY_FORM) }} title="Add Serial Number">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Product"
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              options={[{ value: '', label: 'Select product…' }, ...productOptions]}
            />
            <Select
              label="Warehouse"
              value={form.warehouseId}
              onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}
              options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Manufacturer Serial"
              value={form.manufacturerSerial}
              onChange={(e) => setForm((f) => ({ ...f, manufacturerSerial: e.target.value }))}
              placeholder="IMEI or manufacturer S/N"
            />
            <Input
              label="Company Serial"
              value={form.companySerial}
              onChange={(e) => setForm((f) => ({ ...f, companySerial: e.target.value }))}
              placeholder="Your internal serial"
            />
          </div>
          <Input
            label="Display Name"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="e.g. iPhone 15 Blue 256GB"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Warranty Start"
              type="date"
              value={form.warrantyStartDate}
              onChange={(e) => setForm((f) => ({ ...f, warrantyStartDate: e.target.value }))}
            />
            <Input
              label="Warranty End"
              type="date"
              value={form.warrantyEndDate}
              onChange={(e) => setForm((f) => ({ ...f, warrantyEndDate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setModalOpen(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
