import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeftRight, Plus, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { Button, Modal, Badge, Table, Spinner, Select, Input } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transfer {
  id: string
  transferNumber: string
  fromWarehouseName: string
  toWarehouseName: string
  status: string
  notes: string | null
  createdAt: string
}

interface Warehouse {
  id: string
  name: string
  code: string
}

interface Product {
  id: string
  name: string
  sku: string
}

interface TransferItem {
  productId: string
  quantity: number
}

interface TransferForm {
  fromWarehouseId: string
  toWarehouseId: string
  notes: string
  items: TransferItem[]
}

const EMPTY_FORM: TransferForm = {
  fromWarehouseId: '',
  toWarehouseId: '',
  notes: '',
  items: [{ productId: '', quantity: 1 }],
}

const STATUS_COLORS: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  Pending: 'warning',
  Shipped: 'info',
  Completed: 'success',
  Cancelled: 'danger',
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TransfersPage: React.FC = () => {
  const tenant     = useAppSelector((s) => s.tenant.tenant)
  const employeeId = useAppSelector((s) => s.auth.user?.employeeId)

  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TransferForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const loadTransfers = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)
    inventoryApi
      .getTransfers({ status: statusFilter || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        const data = res.data?.data ?? res.data
        setTransfers(data?.items ?? data ?? [])
        setTotal(data?.totalCount ?? 0)
      })
      .catch(() => toast.error('Failed to load transfers'))
      .finally(() => setLoading(false))
  }, [tenant?.id, statusFilter, page])

  useEffect(() => { loadTransfers() }, [loadTransfers])

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

  const handleSubmit = async () => {
    if (!form.fromWarehouseId || !form.toWarehouseId) {
      toast.error('Please select both warehouses')
      return
    }
    if (form.fromWarehouseId === form.toWarehouseId) {
      toast.error('Source and destination warehouses must be different')
      return
    }
    const validItems = form.items.filter((i) => i.productId && i.quantity > 0)
    if (validItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }
    setSaving(true)
    try {
      await inventoryApi.createTransfer({
        companyId: tenant!.id,
        requestedByEmployeeId: employeeId ?? '00000000-0000-0000-0000-000000000000',
        ...form,
        items: validItems,
      })
      toast.success('Transfer created')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      loadTransfers()
    } catch {
      toast.error('Failed to create transfer')
    } finally {
      setSaving(false)
    }
  }

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { productId: '', quantity: 1 }] }))
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItem = (idx: number, field: keyof TransferItem, value: string | number) =>
    setForm((f) => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item) }))

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` }))

  const columns = [
    { key: 'transferNumber', header: 'Transfer #' },
    { key: 'fromWarehouseName', header: 'From' },
    { key: 'toWarehouseName', header: 'To' },
    {
      key: 'status',
      header: 'Status',
      render: (row: Transfer) => (
        <Badge variant={STATUS_COLORS[row.status] ?? 'info'}>{row.status}</Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: Transfer) => new Date(row.createdAt).toLocaleDateString(),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Transfers</h1>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          New Transfer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Shipped', label: 'Shipped' },
            { value: 'Completed', label: 'Completed' },
            { value: 'Cancelled', label: 'Cancelled' },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Table columns={columns} data={transfers} />
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button variant="outline" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setForm(EMPTY_FORM) }}
        title="New Stock Transfer"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="From Warehouse"
              value={form.fromWarehouseId}
              onChange={(e) => setForm((f) => ({ ...f, fromWarehouseId: e.target.value }))}
              options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
            />
            <Select
              label="To Warehouse"
              value={form.toWarehouseId}
              onChange={(e) => setForm((f) => ({ ...f, toWarehouseId: e.target.value }))}
              options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
            />
          </div>

          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Transfer notes…"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</label>
              <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addItem}>
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Select
                      value={item.productId}
                      onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                      options={[{ value: '', label: 'Select product…' }, ...productOptions]}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      value={String(item.quantity)}
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      placeholder="Qty"
                    />
                  </div>
                  {form.items.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>✕</Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button loading={saving} onClick={handleSubmit}>Create Transfer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
