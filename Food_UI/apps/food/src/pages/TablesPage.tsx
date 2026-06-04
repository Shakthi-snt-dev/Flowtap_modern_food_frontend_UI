import React, { useState } from 'react'
import { Plus, Users, DollarSign } from 'lucide-react'
import { Button, Modal, Input, Select, Badge } from '@flowtap/ui-core'
import toast from 'react-hot-toast'

interface DiningTable {
  id: string
  number: string
  capacity: number
  status: 'Available' | 'Occupied' | 'Reserved'
  currentTotal: number
}

const MOCK_TABLES: DiningTable[] = [
  { id: '1', number: 'T-01', capacity: 4, status: 'Available', currentTotal: 0 },
  { id: '2', number: 'T-02', capacity: 2, status: 'Occupied', currentTotal: 1240 },
  { id: '3', number: 'T-03', capacity: 6, status: 'Occupied', currentTotal: 3450 },
  { id: '4', number: 'T-04', capacity: 4, status: 'Reserved', currentTotal: 0 },
  { id: '5', number: 'T-05', capacity: 8, status: 'Available', currentTotal: 0 },
  { id: '6', number: 'T-06', capacity: 2, status: 'Occupied', currentTotal: 680 },
  { id: '7', number: 'T-07', capacity: 4, status: 'Available', currentTotal: 0 },
  { id: '8', number: 'VIP-01', capacity: 10, status: 'Reserved', currentTotal: 0 },
]

const STATUS_STYLES: Record<DiningTable['status'], { border: string; dot: string; badge: 'success' | 'danger' | 'warning' }> = {
  Available: { border: 'border-green-500', dot: 'bg-green-500', badge: 'success' },
  Occupied:  { border: 'border-red-500',   dot: 'bg-red-500',   badge: 'danger' },
  Reserved:  { border: 'border-yellow-500',dot: 'bg-yellow-500',badge: 'warning' },
}

type FilterType = 'All' | DiningTable['status']
const FILTERS: FilterType[] = ['All', 'Available', 'Occupied', 'Reserved']

export const TablesPage: React.FC = () => {
  const [tables, setTables] = useState<DiningTable[]>(MOCK_TABLES)
  const [filter, setFilter] = useState<FilterType>('All')
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const [addForm, setAddForm] = useState({ number: '', capacity: '', type: 'Regular' })

  const filtered = filter === 'All' ? tables : tables.filter(t => t.status === filter)

  const handleTableClick = (table: DiningTable) => {
    setSelectedTable(table)
    setShowActionModal(true)
  }

  const handleAction = (action: 'open' | 'available' | 'kot') => {
    if (!selectedTable) return
    if (action === 'available') {
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'Available', currentTotal: 0 } : t))
      toast.success(`${selectedTable.number} marked as Available`)
    } else if (action === 'open') {
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'Occupied' } : t))
      toast.success(`Order opened for ${selectedTable.number}`)
    } else {
      toast.success(`Viewing KOT for ${selectedTable.number}`)
    }
    setShowActionModal(false)
  }

  const handleAddTable = () => {
    if (!addForm.number || !addForm.capacity) {
      toast.error('Please fill all required fields')
      return
    }
    const newTable: DiningTable = {
      id: String(Date.now()),
      number: addForm.number,
      capacity: Number(addForm.capacity),
      status: 'Available',
      currentTotal: 0,
    }
    setTables(prev => [...prev, newTable])
    toast.success('Table added successfully')
    setAddForm({ number: '', capacity: '', type: 'Regular' })
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dining Tables</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Floor plan overview</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
          Add Table
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {f}
            <span className="ml-1.5 text-xs opacity-70">
              {f === 'All' ? tables.length : tables.filter(t => t.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Floor plan grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map(table => {
          const style = STATUS_STYLES[table.status]
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 ${style.border} p-4 text-left hover:shadow-md transition-all group`}
            >
              {/* Status dot */}
              <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${style.dot}`} />

              <p className="text-2xl font-bold text-gray-900 dark:text-white">{table.number}</p>
              <div className="flex items-center gap-1 mt-1 text-gray-500 dark:text-gray-400 text-xs">
                <Users className="w-3 h-3" />
                <span>{table.capacity} seats</span>
              </div>

              <div className="mt-3">
                <Badge variant={style.badge}>{table.status}</Badge>
              </div>

              {table.status === 'Occupied' && table.currentTotal > 0 && (
                <div className="flex items-center gap-1 mt-2 text-gray-700 dark:text-gray-300 text-sm font-medium">
                  <DollarSign className="w-3 h-3" />
                  <span>â‚¹{table.currentTotal.toLocaleString()}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Table Actions Modal */}
      <Modal
        open={showActionModal}
        onClose={() => setShowActionModal(false)}
        title={`Table Actions â€” ${selectedTable?.number}`}
        size="sm"
      >
        {selectedTable && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Status: <Badge variant={STATUS_STYLES[selectedTable.status].badge}>{selectedTable.status}</Badge>
            </p>
            {selectedTable.status === 'Occupied' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current Total: <span className="font-semibold text-gray-900 dark:text-white">â‚¹{selectedTable.currentTotal.toLocaleString()}</span>
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => handleAction('open')}>
                Open Order
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => handleAction('available')}>
                Mark Available
              </Button>
              <Button variant="outline" className="w-full justify-center" onClick={() => handleAction('kot')}>
                View Current KOT
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Table Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Table"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddTable}>Add Table</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Table Number"
            placeholder="e.g. T-09"
            value={addForm.number}
            onChange={e => setAddForm(p => ({ ...p, number: e.target.value }))}
          />
          <Input
            label="Capacity (seats)"
            type="number"
            min="1"
            placeholder="e.g. 4"
            value={addForm.capacity}
            onChange={e => setAddForm(p => ({ ...p, capacity: e.target.value }))}
          />
          <Select
            label="Table Type"
            options={[
              { value: 'Regular', label: 'Regular' },
              { value: 'VIP', label: 'VIP' },
              { value: 'Outdoor', label: 'Outdoor' },
            ]}
            value={addForm.type}
            onChange={e => setAddForm(p => ({ ...p, type: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  )
}

