import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { foodApi, type FoodTable, type FoodTableStatus } from '@flowtap/api-core'
import { Button, Modal, Spinner, Input, Select, Badge } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableForm {
  name: string
  capacity: string
  section: string
}

const EMPTY_FORM: TableForm = { name: '', capacity: '4', section: 'Indoor' }

const SECTIONS = ['All', 'Indoor', 'Outdoor', 'Private', 'VIP', 'Terrace']

const STATUS_CONFIG: Record<FoodTableStatus, { label: string; bg: string; text: string; dot: string }> = {
  Available: { label: 'Available', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  Occupied:  { label: 'Occupied',  bg: 'bg-red-50 dark:bg-red-900/20',   text: 'text-red-700 dark:text-red-300',   dot: 'bg-red-500'   },
  Reserved:  { label: 'Reserved',  bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  Cleaning:  { label: 'Cleaning',  bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500'  },
}

const STATUS_OPTIONS: FoodTableStatus[] = ['Available', 'Occupied', 'Reserved', 'Cleaning']

// ─── Component ────────────────────────────────────────────────────────────────

export const FoodTablesPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [tables, setTables]       = useState<FoodTable[]>([])
  const [loading, setLoading]     = useState(false)
  const [section, setSection]     = useState('All')
  const [addOpen, setAddOpen]     = useState(false)
  const [form, setForm]           = useState<TableForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [statusModal, setStatusModal] = useState<FoodTable | null>(null)
  const [newStatus, setNewStatus] = useState<FoodTableStatus>('Available')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const companyId  = tenant?.id ?? ''
  const locationId = currentStoreId ?? ''

  const loadTables = useCallback(async () => {
    if (!companyId || !locationId) return
    setLoading(true)
    try {
      const res = await foodApi.getTables({ companyId, locationId })
      setTables(res.data?.data ?? res.data ?? [])
    } catch {
      toast.error('Failed to load tables')
    } finally {
      setLoading(false)
    }
  }, [companyId, locationId])

  useEffect(() => { loadTables() }, [loadTables])

  const openStatusModal = (t: FoodTable) => {
    setStatusModal(t)
    setNewStatus(t.status)
  }

  const handleStatusUpdate = async () => {
    if (!statusModal) return
    setUpdatingStatus(true)
    try {
      await foodApi.updateTableStatus(statusModal.id, newStatus)
      toast.success(`${statusModal.name} → ${newStatus}`)
      setStatusModal(null)
      loadTables()
    } catch {
      toast.error('Failed to update table status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleAddTable = async () => {
    if (!form.name.trim()) { toast.error('Table name is required'); return }
    setSaving(true)
    try {
      await foodApi.createTable({
        companyId,
        locationId,
        name: form.name.trim(),
        capacity: parseInt(form.capacity) || 4,
        section: form.section || undefined,
        status: 'Available',
      })
      toast.success('Table added')
      setAddOpen(false)
      setForm(EMPTY_FORM)
      loadTables()
    } catch {
      toast.error('Failed to add table')
    } finally {
      setSaving(false)
    }
  }

  const displayed = section === 'All' ? tables : tables.filter((t) => t.section === section)

  const sectionCounts = SECTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'All' ? tables.length : tables.filter((t) => t.section === s).length
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tables</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tables.filter((t) => t.status === 'Available').length} available · {tables.filter((t) => t.status === 'Occupied').length} occupied
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Table
        </Button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 dark:border-gray-700">
        {SECTIONS.map((s) => (
          sectionCounts[s] > 0 || s === 'All' ? (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                section === s
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {s}
              {sectionCounts[s] > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                  {sectionCounts[s]}
                </span>
              )}
            </button>
          ) : null
        ))}
      </div>

      {/* Status Legend */}
      <div className="flex gap-4 flex-wrap">
        {STATUS_OPTIONS.map((s) => {
          const cfg = STATUS_CONFIG[s]
          return (
            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          )
        })}
      </div>

      {/* Table Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">No tables found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {displayed.map((t) => {
            const cfg = STATUS_CONFIG[t.status]
            return (
              <button
                key={t.id}
                onClick={() => openStatusModal(t)}
                className={`${cfg.bg} border-2 rounded-xl p-4 text-left transition-all hover:shadow-md hover:scale-105 active:scale-100
                           ${t.status === 'Available' ? 'border-green-200 dark:border-green-800' :
                             t.status === 'Occupied'  ? 'border-red-200 dark:border-red-800' :
                             t.status === 'Reserved'  ? 'border-yellow-200 dark:border-yellow-800' :
                                                        'border-blue-200 dark:border-blue-800'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${cfg.dot}`} />
                </div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{t.name}</p>
                {t.section && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.section}</p>
                )}
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${cfg.text}`}>
                  <Users className="w-3 h-3" />
                  {t.capacity}
                </div>
                <p className={`text-xs font-medium mt-1 ${cfg.text}`}>{cfg.label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Status Update Modal */}
      <Modal
        open={!!statusModal}
        onClose={() => setStatusModal(null)}
        title={`Update ${statusModal?.name ?? 'Table'}`}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Change status for <strong>{statusModal?.name}</strong> (Capacity: {statusModal?.capacity})
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((s) => {
            const cfg = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                onClick={() => setNewStatus(s)}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  newStatus === s
                    ? `${cfg.bg} ${cfg.text} border-current`
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${cfg.dot}`} />
                {cfg.label}
              </button>
            )
          })}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
          <Button onClick={handleStatusUpdate} disabled={updatingStatus}>
            {updatingStatus ? <Spinner size="sm" /> : 'Update Status'}
          </Button>
        </div>
      </Modal>

      {/* Add Table Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Table">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Table Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Table 7, Window Seat A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
            <Input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              min={1}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
            <Select
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              options={SECTIONS.filter((s) => s !== 'All').map((s) => ({ value: s, label: s }))}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={handleAddTable} disabled={saving}>
            {saving ? <Spinner size="sm" /> : 'Add Table'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
