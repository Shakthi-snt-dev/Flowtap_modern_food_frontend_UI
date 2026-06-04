import React, { useState, useEffect } from 'react'
import { Plus, Clock, Trash2 } from 'lucide-react'
import { Button, Modal, Input, Select, Badge, EmptyState } from '@flowtap/ui-core'
import toast from 'react-hot-toast'

interface KOTItem {
  name: string
  qty: number
}

interface KOT {
  id: string
  kotNumber: number
  table: string
  status: 'New' | 'Preparing' | 'Ready'
  createdAt: string
  items: KOTItem[]
}

const MOCK_KOTS: KOT[] = [
  { id: '1', kotNumber: 101, table: 'T-02', status: 'New', createdAt: new Date(Date.now() - 5 * 60000).toISOString(), items: [{ name: 'Butter Chicken', qty: 2 }, { name: 'Naan', qty: 4 }] },
  { id: '2', kotNumber: 102, table: 'T-03', status: 'Preparing', createdAt: new Date(Date.now() - 12 * 60000).toISOString(), items: [{ name: 'Dal Makhani', qty: 1 }, { name: 'Rice', qty: 2 }] },
  { id: '3', kotNumber: 103, table: 'T-06', status: 'Ready', createdAt: new Date(Date.now() - 20 * 60000).toISOString(), items: [{ name: 'Paneer Tikka', qty: 1 }] },
]

const TABLE_OPTIONS = ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'VIP-01'].map(t => ({ value: t, label: t }))

function getElapsed(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins < 1) return 'just now'
  return `${mins} min${mins !== 1 ? 's' : ''} ago`
}

const COLUMN_CONFIG: { status: KOT['status']; label: string; nextStatus?: KOT['status']; actionLabel: string; color: string }[] = [
  { status: 'New',      label: 'New',      nextStatus: 'Preparing', actionLabel: 'Mark Preparing', color: 'text-blue-600 dark:text-blue-400' },
  { status: 'Preparing',label: 'Preparing',nextStatus: 'Ready',     actionLabel: 'Mark Ready',     color: 'text-yellow-600 dark:text-yellow-400' },
  { status: 'Ready',    label: 'Ready',    nextStatus: undefined,   actionLabel: 'Served',          color: 'text-green-600 dark:text-green-400' },
]

const BADGE_MAP: Record<KOT['status'], 'info' | 'warning' | 'success'> = {
  New: 'info', Preparing: 'warning', Ready: 'success',
}

export const KOTPage: React.FC = () => {
  const [kots, setKots] = useState<KOT[]>(MOCK_KOTS)
  const [tick, setTick] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)

  const [newForm, setNewForm] = useState({ table: 'T-01', items: [{ name: '', qty: 1 }] })

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const handleAdvance = (kot: KOT) => {
    const col = COLUMN_CONFIG.find(c => c.status === kot.status)
    if (!col) return
    if (col.nextStatus) {
      setKots(prev => prev.map(k => k.id === kot.id ? { ...k, status: col.nextStatus! } : k))
      toast.success(`KOT #${kot.kotNumber} moved to ${col.nextStatus}`)
    } else {
      setKots(prev => prev.filter(k => k.id !== kot.id))
      toast.success(`KOT #${kot.kotNumber} marked as Served`)
    }
  }

  const addItem = () => setNewForm(p => ({ ...p, items: [...p.items, { name: '', qty: 1 }] }))
  const removeItem = (idx: number) => setNewForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  const updateItem = (idx: number, field: keyof KOTItem, value: string | number) =>
    setNewForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }))

  const handleCreateKOT = () => {
    const validItems = newForm.items.filter(it => it.name.trim())
    if (!validItems.length) { toast.error('Add at least one item'); return }
    const newKOT: KOT = {
      id: String(Date.now()),
      kotNumber: Math.max(...kots.map(k => k.kotNumber), 100) + 1,
      table: newForm.table,
      status: 'New',
      createdAt: new Date().toISOString(),
      items: validItems,
    }
    setKots(prev => [newKOT, ...prev])
    toast.success(`KOT #${newKOT.kotNumber} created`)
    setNewForm({ table: 'T-01', items: [{ name: '', qty: 1 }] })
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kitchen Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage kitchen order tickets</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
          New KOT
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMN_CONFIG.map(col => {
          const items = kots.filter(k => k.status === col.status)
          return (
            <div key={col.status} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center gap-2">
                <h2 className={`font-semibold text-base ${col.color}`}>{col.label}</h2>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>

              {/* KOT cards */}
              <div className="flex flex-col gap-3 min-h-[120px]">
                {items.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
                    No orders
                  </div>
                ) : (
                  items.map(kot => (
                    <div
                      key={kot.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white text-sm">#{kot.kotNumber}</span>
                          <Badge variant={BADGE_MAP[kot.status]}>{kot.table}</Badge>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {getElapsed(kot.createdAt)}
                        </span>
                      </div>

                      {/* Items */}
                      <ul className="space-y-1 mb-3">
                        {kot.items.map((item, i) => (
                          <li key={i} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                            <span>{item.name}</span>
                            <span className="font-medium">Ã—{item.qty}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        size="sm"
                        variant={col.status === 'New' ? 'primary' : col.status === 'Preparing' ? 'secondary' : 'ghost'}
                        className="w-full justify-center"
                        onClick={() => handleAdvance(kot)}
                      >
                        {col.actionLabel}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* New KOT Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New KOT"
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleCreateKOT}>Create KOT</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Table"
            options={TABLE_OPTIONS}
            value={newForm.table}
            onChange={e => setNewForm(p => ({ ...p, table: e.target.value }))}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</label>
              <button
                onClick={addItem}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {newForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="Item name"
                    value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                    className="w-16"
                  />
                  {newForm.items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

