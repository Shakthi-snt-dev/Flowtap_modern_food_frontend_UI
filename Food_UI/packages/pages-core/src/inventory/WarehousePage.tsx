import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Warehouse, Pencil, Trash2, ChevronDown, ChevronRight,
  Layers, Box, Package, X, LayoutGrid, Settings2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi, employeesApi } from '@flowtap/api-core'
import {
  Button, Input, Modal, Badge, Card, CardHeader, CardBody, Table, Spinner, Select,
} from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarehouseData {
  id: string
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  type: number             // 1=In-Store, 2=External, 3=Distribution, 4=Transit
  storeId?: string         // set for in-store warehouses
  storeName?: string
  hasRackSystem: boolean   // whether rack/bin tracking is enabled
  totalSKUs: number
  totalValue: number
  managerEmployeeId?: string
}

interface EmployeeOption { id: string; name: string; role?: string }

interface Rack {
  id: string
  warehouseId: string
  name: string
  code?: string
  capacity?: number
  notes?: string
  binCount: number
}

interface Bin {
  id: string
  rackId: string
  name: string
  code?: string
  capacity?: number
  notes?: string
}

interface StockRow {
  productId: string
  productName: string
  sku: string
  quantity: number
  minLevel: number
  rackName?: string
  binName?: string
  status: 'OK' | 'Low' | 'Out'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WH_TYPES: Record<number, { label: string; color: string }> = {
  0: { label: 'None',               color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  1: { label: 'In-Store',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  2: { label: 'Location Warehouse', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  3: { label: 'Central Warehouse',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  4: { label: 'Kitchen Store',      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const statusVariant = (s: StockRow['status']) =>
  s === 'OK' ? 'success' as const : s === 'Low' ? 'warning' as const : 'danger' as const

interface WarehouseForm {
  name: string; code: string; address: string; city: string; state: string
  country: string; postalCode: string; type: number; storeId: string; hasRackSystem: boolean
  managerEmployeeId: string
}

const EMPTY_WH: WarehouseForm = {
  name: '', code: '', address: '', city: '', state: '', country: '', postalCode: '',
  type: 1, storeId: '', hasRackSystem: false, managerEmployeeId: '',
}

// ─── Rack Form Modal ──────────────────────────────────────────────────────────

interface RackModalProps {
  open: boolean
  warehouseId: string
  rack: Rack | null
  onClose: () => void
  onSaved: () => void
}

const RackModal: React.FC<RackModalProps> = ({ open, warehouseId, rack, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', code: '', capacity: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rack) {
      setForm({ name: rack.name, code: rack.code ?? '', capacity: String(rack.capacity ?? ''), notes: rack.notes ?? '' })
    } else {
      setForm({ name: '', code: '', capacity: '', notes: '' })
    }
  }, [rack, open])

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Rack name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        notes: form.notes.trim() || undefined,
      }
      if (rack) {
        await inventoryApi.updateRack(warehouseId, rack.id, payload)
        toast.success('Rack updated')
      } else {
        await inventoryApi.createRack(warehouseId, payload)
        toast.success('Rack added')
      }
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save rack')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={rack ? 'Edit Rack' : 'Add Rack'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>{rack ? 'Save Changes' : 'Add Rack'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Rack Name *" value={form.name} onChange={set('name')} placeholder="e.g. Rack A" />
          <Input label="Code / Label" value={form.code} onChange={set('code')} placeholder="e.g. RK-001" />
        </div>
        <Input label="Capacity (units)" type="number" value={form.capacity} onChange={set('capacity')} placeholder="Leave blank if unlimited" />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional notes..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Bin Form Modal ───────────────────────────────────────────────────────────

interface BinModalProps {
  open: boolean
  warehouseId: string
  rack: Rack
  bin: Bin | null
  onClose: () => void
  onSaved: () => void
}

const BinModal: React.FC<BinModalProps> = ({ open, warehouseId, rack, bin, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', code: '', capacity: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (bin) {
      setForm({ name: bin.name, code: bin.code ?? '', capacity: String(bin.capacity ?? ''), notes: bin.notes ?? '' })
    } else {
      setForm({ name: '', code: '', capacity: '', notes: '' })
    }
  }, [bin, open])

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Bin name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        notes: form.notes.trim() || undefined,
      }
      if (bin) {
        await inventoryApi.updateBin(warehouseId, rack.id, bin.id, payload)
        toast.success('Bin updated')
      } else {
        await inventoryApi.createBin(warehouseId, rack.id, payload)
        toast.success('Bin added')
      }
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save bin')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={bin ? `Edit Bin — ${rack.name}` : `Add Bin to ${rack.name}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>{bin ? 'Save Changes' : 'Add Bin'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Bin Name *" value={form.name} onChange={set('name')} placeholder="e.g. Bin 1" />
          <Input label="Code / Label" value={form.code} onChange={set('code')} placeholder="e.g. A-01" />
        </div>
        <Input label="Capacity (units)" type="number" value={form.capacity} onChange={set('capacity')} placeholder="Leave blank if unlimited" />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional notes..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Rack Row with inline bins ────────────────────────────────────────────────

interface RackRowProps {
  rack: Rack
  warehouseId: string
  onEdit: (rack: Rack) => void
  onDelete: (rack: Rack) => void
  onAddBin: (rack: Rack) => void
  onEditBin: (rack: Rack, bin: Bin) => void
  onDeleteBin: (rack: Rack, bin: Bin) => void
  onReload: () => void
}

const RackRow: React.FC<RackRowProps> = ({
  rack, warehouseId, onEdit, onDelete, onAddBin, onEditBin, onDeleteBin,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [bins, setBins] = useState<Bin[]>([])
  const [binsLoading, setBinsLoading] = useState(false)

  const loadBins = useCallback(async () => {
    setBinsLoading(true)
    try {
      const res = await inventoryApi.getBins(warehouseId, rack.id)
      const raw = res.data?.data ?? res.data ?? []
      setBins((Array.isArray(raw) ? raw : []).map((b: Record<string, unknown>) => ({
        id: String(b.id),
        rackId: rack.id,
        name: String(b.name ?? ''),
        code: b.code ? String(b.code) : undefined,
        capacity: b.capacity ? Number(b.capacity) : undefined,
        notes: b.notes ? String(b.notes) : undefined,
      })))
    } catch {
      setBins([])
    } finally {
      setBinsLoading(false)
    }
  }, [warehouseId, rack.id])

  const handleExpand = () => {
    if (!expanded) loadBins()
    setExpanded((p) => !p)
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Rack header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
        <button onClick={handleExpand} className="flex items-center gap-2 flex-1 text-left min-w-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <Layers className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="min-w-0">
            <span className="font-medium text-gray-900 dark:text-white text-sm">{rack.name}</span>
            {rack.code && <span className="ml-2 text-xs text-gray-400 font-mono">{rack.code}</span>}
          </div>
          <span className="ml-auto mr-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {rack.binCount} bin{rack.binCount !== 1 ? 's' : ''}
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onAddBin(rack)} title="Add bin"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(rack)} title="Edit rack"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(rack)} title="Delete rack"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bins */}
      {expanded && (
        <div className="px-4 py-3 bg-white dark:bg-gray-900">
          {binsLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : bins.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              <Box className="w-6 h-6 mx-auto mb-1 opacity-40" />
              No bins yet.{' '}
              <button onClick={() => onAddBin(rack)} className="text-blue-500 hover:underline">Add one</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {bins.map((bin) => (
                <div key={bin.id}
                  className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <Box className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{bin.name}</p>
                    {bin.code && <p className="text-xs text-gray-400 font-mono truncate">{bin.code}</p>}
                  </div>
                  {/* Actions on hover */}
                  <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 p-0.5">
                    <button onClick={() => onEditBin(rack, bin)} title="Edit bin"
                      className="p-1 rounded text-gray-400 hover:text-blue-600 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteBin(rack, bin)} title="Delete bin"
                      className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Warehouse Detail Panel ───────────────────────────────────────────────────

interface WarehouseDetailProps {
  warehouse: WarehouseData
  companyId: string
  onClose: () => void
  onReload: () => void
}

const WarehouseDetail: React.FC<WarehouseDetailProps> = ({ warehouse, companyId, onClose, onReload }) => {
  const [tab, setTab] = useState<'stock' | 'racks'>('stock')
  const [stock, setStock] = useState<StockRow[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [racks, setRacks] = useState<Rack[]>([])
  const [racksLoading, setRacksLoading] = useState(false)

  // rack/bin modals
  const [rackModal, setRackModal] = useState(false)
  const [editRack, setEditRack] = useState<Rack | null>(null)
  const [binModal, setBinModal] = useState(false)
  const [activeBinRack, setActiveBinRack] = useState<Rack | null>(null)
  const [editBin, setEditBin] = useState<Bin | null>(null)

  // ── Load stock ──────────────────────────────────────────────────────────────
  const loadStock = useCallback(() => {
    setStockLoading(true)
    inventoryApi.getStockLevels({ companyId, warehouseId: warehouse.id })
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? []
        setStock((Array.isArray(raw) ? raw : []).map((r: Record<string, unknown>) => {
          const qty = Number(r.quantity ?? r.stock ?? 0)
          const min = Number(r.minLevel ?? r.reorderLevel ?? 0)
          return {
            productId: String(r.productId ?? r.id),
            productName: String(r.productName ?? r.name ?? ''),
            sku: String(r.sku ?? ''),
            quantity: qty,
            minLevel: min,
            rackName: r.rackName ? String(r.rackName) : undefined,
            binName: r.binName ? String(r.binName) : undefined,
            status: (qty === 0 ? 'Out' : qty < min ? 'Low' : 'OK') as StockRow['status'],
          }
        }))
      })
      .catch(() => setStock([]))
      .finally(() => setStockLoading(false))
  }, [companyId, warehouse.id])

  // ── Load racks ──────────────────────────────────────────────────────────────
  const loadRacks = useCallback(() => {
    setRacksLoading(true)
    inventoryApi.getRacks(warehouse.id)
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? []
        setRacks((Array.isArray(raw) ? raw : []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          warehouseId: warehouse.id,
          name: String(r.name ?? ''),
          code: r.code ? String(r.code) : undefined,
          capacity: r.capacity ? Number(r.capacity) : undefined,
          notes: r.notes ? String(r.notes) : undefined,
          binCount: Number(r.binCount ?? r.bins ?? 0),
        })))
      })
      .catch(() => setRacks([]))
      .finally(() => setRacksLoading(false))
  }, [warehouse.id])

  useEffect(() => { loadStock() }, [loadStock])
  useEffect(() => { if (tab === 'racks') loadRacks() }, [tab, loadRacks])

  const handleDeleteRack = async (rack: Rack) => {
    if (!window.confirm(`Delete rack "${rack.name}"? All bins inside will also be removed.`)) return
    try {
      await inventoryApi.deleteRack(warehouse.id, rack.id)
      toast.success('Rack deleted')
      loadRacks()
    } catch { toast.error('Failed to delete rack') }
  }

  const handleDeleteBin = async (rack: Rack, bin: Bin) => {
    if (!window.confirm(`Delete bin "${bin.name}" from ${rack.name}?`)) return
    try {
      await inventoryApi.deleteBin(warehouse.id, rack.id, bin.id)
      toast.success('Bin deleted')
      loadRacks()
    } catch { toast.error('Failed to delete bin') }
  }

  const stockColumns = [
    {
      key: 'productName' as const, header: 'Product',
      render: (r: StockRow) => <span className="font-medium text-gray-900 dark:text-white">{r.productName}</span>,
    },
    {
      key: 'sku' as const, header: 'SKU',
      render: (r: StockRow) => <span className="text-xs font-mono text-gray-500">{r.sku}</span>,
    },
    {
      key: 'quantity' as const, header: 'Qty',
      render: (r: StockRow) => (
        <span className={
          r.status === 'Out' ? 'font-semibold text-red-600 dark:text-red-400'
          : r.status === 'Low' ? 'font-semibold text-yellow-600 dark:text-yellow-400'
          : 'text-gray-700 dark:text-gray-300'
        }>{r.quantity}</span>
      ),
    },
    {
      key: 'rackName' as const, header: 'Location',
      render: (r: StockRow) => r.rackName ? (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {r.rackName}{r.binName ? ` › ${r.binName}` : ''}
        </span>
      ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>,
    },
    {
      key: 'status' as const, header: 'Status',
      render: (r: StockRow) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
  ]

  const typeInfo = WH_TYPES[warehouse.type] ?? WH_TYPES[2]

  return (
    <Card>
      <CardHeader
        title={warehouse.name}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {warehouse.storeName && (
              <span className="text-xs text-gray-500 dark:text-gray-400">linked to {warehouse.storeName}</span>
            )}
            {warehouse.address && (
              <span className="text-xs text-gray-400">{warehouse.address}{warehouse.city ? `, ${warehouse.city}` : ''}</span>
            )}
          </span>
        }
        action={
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700 px-4">
        <button onClick={() => setTab('stock')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === 'stock'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}>
          <Package className="w-4 h-4" /> Stock
        </button>
        <button onClick={() => setTab('racks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === 'racks'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}>
          <LayoutGrid className="w-4 h-4" /> Racks & Bins
        </button>
      </div>

      <CardBody>
        {/* ── Stock Tab ── */}
        {tab === 'stock' && (
          stockLoading
            ? <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            : <Table<StockRow> columns={stockColumns} data={stock} emptyMessage="No stock in this warehouse" />
        )}

        {/* ── Racks & Bins Tab ── */}
        {tab === 'racks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {warehouse.hasRackSystem
                    ? 'Rack & bin tracking is enabled for this warehouse.'
                    : 'Add racks to enable location-level stock tracking. Racks and bins are optional.'}
                </p>
              </div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => { setEditRack(null); setRackModal(true) }}>
                Add Rack
              </Button>
            </div>

            {racksLoading ? (
              <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            ) : racks.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No racks configured</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
                  Racks organize your warehouse into sections. Each rack can have bins (slots).
                </p>
                <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => { setEditRack(null); setRackModal(true) }}>
                  Add First Rack
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {racks.map((rack) => (
                  <RackRow
                    key={rack.id}
                    rack={rack}
                    warehouseId={warehouse.id}
                    onEdit={(r) => { setEditRack(r); setRackModal(true) }}
                    onDelete={handleDeleteRack}
                    onAddBin={(r) => { setActiveBinRack(r); setEditBin(null); setBinModal(true) }}
                    onEditBin={(r, b) => { setActiveBinRack(r); setEditBin(b); setBinModal(true) }}
                    onDeleteBin={handleDeleteBin}
                    onReload={loadRacks}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardBody>

      {/* Rack modal */}
      <RackModal
        open={rackModal}
        warehouseId={warehouse.id}
        rack={editRack}
        onClose={() => setRackModal(false)}
        onSaved={loadRacks}
      />

      {/* Bin modal */}
      {activeBinRack && (
        <BinModal
          open={binModal}
          warehouseId={warehouse.id}
          rack={activeBinRack}
          bin={editBin}
          onClose={() => setBinModal(false)}
          onSaved={loadRacks}
        />
      )}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WarehousePage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const stores = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseData | null>(null)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editWarehouse, setEditWarehouse] = useState<WarehouseData | null>(null)
  const [form, setForm] = useState<WarehouseForm>({ ...EMPTY_WH })
  const [saving, setSaving] = useState(false)
  const [warehouseTypeOptions, setWarehouseTypeOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    inventoryApi.getEnums()
      .then((res) => {
        const types = res.data?.data?.WarehouseType ?? []
        // Filter out None (0) type to keep only functional types
        const filtered = types
          .filter((t: { value: number }) => t.value !== 0)
          .map((t: { value: number; label: string }) => ({
            value: String(t.value),
            label: t.label
          }))
        setWarehouseTypeOptions(filtered)
      })
      .catch(() => {
        setWarehouseTypeOptions([
          { value: '1', label: 'In-Store' },
          { value: '2', label: 'Location Warehouse' },
          { value: '3', label: 'Central Warehouse' },
          { value: '4', label: 'Kitchen Store' },
        ])
      })
  }, [])

  // ── Load warehouses ──────────────────────────────────────────────────────────
  const loadWarehouses = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)
    inventoryApi.getWarehouses({ companyId: tenant.id, storeId: currentStoreId ?? undefined })
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? []
        const items: WarehouseData[] = (Array.isArray(raw) ? raw : []).map((w: Record<string, unknown>) => ({
          id: String(w.id),
          name: String(w.name ?? ''),
          code: String(w.code ?? ''),
          address: w.address ? String(w.address) : undefined,
          city: w.city ? String(w.city) : undefined,
          state: w.state ? String(w.state) : undefined,
          country: w.country ? String(w.country) : undefined,
          postalCode: w.postalCode ? String(w.postalCode) : undefined,
          type: typeof w.type === 'number'
            ? w.type
            : w.type === 'InStore'           ? 1
            : w.type === 'LocationWarehouse' ? 2
            : w.type === 'CentralWarehouse'  ? 3
            : w.type === 'KitchenStore'      ? 4
            : Number(w.type ?? 2),
          storeId: w.storeId ? String(w.storeId) : undefined,
          storeName: w.storeName ? String(w.storeName) : undefined,
          hasRackSystem: Boolean(w.hasRackSystem ?? false),
          totalSKUs: Number(w.totalSKUs ?? w.skuCount ?? 0),
          totalValue: Number(w.totalValue ?? 0),
          managerEmployeeId: w.managerEmployeeId ? String(w.managerEmployeeId) : undefined,
        }))
        setWarehouses(items)
      })
      .catch(() => { toast.error('Failed to load warehouses'); setWarehouses([]) })
      .finally(() => setLoading(false))
  }, [tenant?.id, currentStoreId])

  useEffect(() => { loadWarehouses() }, [loadWarehouses])

  // Load employees once for the manager dropdown
  useEffect(() => {
    if (!tenant?.id) return
    employeesApi.getEmployees({ companyId: tenant.id, isActive: true, pageSize: 200 })
      .then((res) => {
        const raw: Record<string, unknown>[] = res.data?.data?.items ?? res.data?.data ?? []
        setEmployees(raw.map((e) => ({
          id: String(e.id ?? ''),
          name: String(e.name ?? e.fullName ?? ''),
          role: e.role ? String(e.role) : undefined,
        })))
      })
      .catch(() => {})
  }, [tenant?.id])

  // If selected warehouse gets reloaded, sync its reference
  useEffect(() => {
    if (selectedWarehouse) {
      const updated = warehouses.find((w) => w.id === selectedWarehouse.id)
      if (updated) setSelectedWarehouse(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses])

  // ── Add / Edit Warehouse ─────────────────────────────────────────────────────
  const hasInStoreWarehouse = warehouses.some(w => w.type === 1)

  const openAdd = () => {
    setEditWarehouse(null)
    const defaultType = hasInStoreWarehouse ? 2 : 1
    setForm({ ...EMPTY_WH, type: defaultType, storeId: currentStoreId ?? '' })
    setModalOpen(true)
  }

  const openEdit = (wh: WarehouseData) => {
    setEditWarehouse(wh)
    setForm({
      name: wh.name,
      code: wh.code,
      address: wh.address ?? '',
      city: wh.city ?? '',
      state: wh.state ?? '',
      country: wh.country ?? '',
      postalCode: wh.postalCode ?? '',
      type: wh.type,
      storeId: wh.storeId ?? '',
      hasRackSystem: wh.hasRackSystem,
      managerEmployeeId: wh.managerEmployeeId ?? '',
    })
    setModalOpen(true)
  }

  const handleDeleteWarehouse = async (wh: WarehouseData) => {
    if (!window.confirm(`Delete warehouse "${wh.name}"? This cannot be undone.`)) return
    try {
      await inventoryApi.deleteWarehouse(wh.id)
      toast.success('Warehouse deleted')
      if (selectedWarehouse?.id === wh.id) setSelectedWarehouse(null)
      loadWarehouses()
    } catch { toast.error('Failed to delete warehouse') }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Warehouse name is required'); return }
    setSaving(true)
    try {
      const payload = {
        companyId: tenant?.id,
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        type: Number(form.type),
        storeId: form.storeId || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        hasRackSystem: form.hasRackSystem,
        managerEmployeeId: form.managerEmployeeId || undefined,
      }
      if (editWarehouse) {
        await inventoryApi.updateWarehouse(editWarehouse.id, payload)
        toast.success('Warehouse updated')
      } else {
        await inventoryApi.createWarehouse(payload)
        toast.success('Warehouse created')
      }
      setModalOpen(false)
      loadWarehouses()
    } catch {
      toast.error('Failed to save warehouse')
    } finally {
      setSaving(false)
    }
  }

  // Group: in-store first, then external
  const inStore = warehouses.filter((w) => w.type === 1)
  const external = warehouses.filter((w) => w.type !== 1)

  const setF = (field: keyof WarehouseForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Warehouses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {warehouses.length} location{warehouses.length !== 1 ? 's' : ''} · manage stock, racks and bins
          </p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>Add Warehouse</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : warehouses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-base font-semibold text-gray-500 dark:text-gray-400">No warehouses yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Each store automatically gets an in-store warehouse once added.</p>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>Add Warehouse</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* In-Store Warehouses */}
          {inStore.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Warehouse className="w-3.5 h-3.5" /> In-Store Warehouses
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inStore.map((wh) => <WarehouseCard key={wh.id} wh={wh} selected={selectedWarehouse?.id === wh.id}
                  onSelect={() => setSelectedWarehouse(selectedWarehouse?.id === wh.id ? null : wh)}
                  onEdit={() => openEdit(wh)} onDelete={() => handleDeleteWarehouse(wh)}
                  employees={employees} />)}
              </div>
            </div>
          )}

          {/* External Warehouses */}
          {external.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> External Warehouses
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {external.map((wh) => <WarehouseCard key={wh.id} wh={wh} selected={selectedWarehouse?.id === wh.id}
                  onSelect={() => setSelectedWarehouse(selectedWarehouse?.id === wh.id ? null : wh)}
                  onEdit={() => openEdit(wh)} onDelete={() => handleDeleteWarehouse(wh)}
                  employees={employees} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selectedWarehouse && (
        <WarehouseDetail
          key={selectedWarehouse.id}
          warehouse={selectedWarehouse}
          companyId={tenant?.id ?? ''}
          onClose={() => setSelectedWarehouse(null)}
          onReload={loadWarehouses}
        />
      )}

      {/* Add / Edit Warehouse Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>
              {editWarehouse ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Warehouse Name *" value={form.name} onChange={setF('name')} placeholder="e.g. Main Store" />
            <Input label="Code" value={form.code} onChange={setF('code')} placeholder="e.g. WH-001" />
          </div>

          <Select
            label="Type"
            value={String(form.type)}
            onChange={setF('type')}
            options={warehouseTypeOptions.filter(o => {
              // Hide InStore if another InStore already exists (unless it's this warehouse's current type)
              if (o.value === '1' && hasInStoreWarehouse && String(editWarehouse?.type) !== '1') return false
              return true
            })}
          />



          <Input label="Street Address" value={form.address} onChange={setF('address')} placeholder="123 Main Road" />

          <div className="grid grid-cols-3 gap-4">
            <Input label="City" value={form.city} onChange={setF('city')} placeholder="City" />
            <Input label="State" value={form.state} onChange={setF('state')} placeholder="State" />
            <Input label="Postal Code" value={form.postalCode} onChange={setF('postalCode')} placeholder="PIN" />
          </div>

          {/* Manager employee */}
          <Select
            label="Warehouse Manager (optional)"
            value={form.managerEmployeeId}
            onChange={setF('managerEmployeeId')}
            options={[
              { value: '', label: 'No manager assigned' },
              ...employees.map((e) => ({
                value: e.id,
                label: e.role ? `${e.name} — ${e.role}` : e.name,
              })),
            ]}
          />

          {/* Rack system toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2.5">
              <Settings2 className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Enable Rack & Bin Tracking</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Organise stock by rack/row → bin/slot. Leave off for simple flat storage.
                </p>
              </div>
            </div>
            <button
              onClick={() => setForm((f) => ({ ...f, hasRackSystem: !f.hasRackSystem }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.hasRackSystem ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.hasRackSystem ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Warehouse Card ───────────────────────────────────────────────────────────

interface WarehouseCardProps {
  wh: WarehouseData
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  employees: EmployeeOption[]
}

const WarehouseCard: React.FC<WarehouseCardProps> = ({ wh, selected, onSelect, onEdit, onDelete, employees }) => {
  const managerName = wh.managerEmployeeId
    ? employees.find((e) => e.id === wh.managerEmployeeId)?.name
    : undefined
  const typeInfo = WH_TYPES[wh.type] ?? WH_TYPES[2]
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border-2 transition-all ${
      selected ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
    }`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Warehouse className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{wh.name}</p>
              {wh.code && <p className="text-xs text-gray-400 font-mono">{wh.code}</p>}
            </div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>

        {/* Address */}
        {(wh.address || wh.city) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {[wh.address, wh.city, wh.state].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Manager */}
        {managerName && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            👤 <span className="truncate">{managerName}</span>
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 pt-1 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-400">SKUs</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{wh.totalSKUs}</p>
          </div>
          {wh.hasRackSystem && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <Layers className="w-3 h-3" /> Rack system
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant={selected ? 'primary' : 'outline'} size="sm" className="flex-1" onClick={onSelect}>
            {selected ? 'Close' : 'View'}
          </Button>
          <button onClick={onEdit}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-gray-200 dark:border-gray-700">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-gray-200 dark:border-gray-700">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
