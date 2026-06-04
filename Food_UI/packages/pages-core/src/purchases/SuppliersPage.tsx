import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Pencil, ShoppingCart, AlertCircle } from 'lucide-react'
import { useAppSelector } from '@flowtap/store'
import { purchaseApi } from '@flowtap/api-core'
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  Table,
  SearchInput,
  Spinner,
  EmptyState,
} from '@flowtap/ui-core'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  name: string
  phone: string
  email: string
  gst: string
  outstanding: number
  address?: string
  paymentTerms?: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_TERMS_OPTIONS = [
  { value: 'COD', label: 'COD (Cash on Delivery)' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
]

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

interface SupplierForm {
  name: string
  phone: string
  email: string
  gst: string
  address: string
  paymentTerms: string
}

const defaultForm: SupplierForm = {
  name: '', phone: '', email: '', gst: '', address: '', paymentTerms: 'COD',
}

interface SupplierModalProps {
  open: boolean
  supplier: Supplier | null
  onClose: () => void
  onSaved: (supplier: Supplier) => void
  tenantId: string
}

const SupplierModal: React.FC<SupplierModalProps> = ({ open, supplier, onClose, onSaved, tenantId }) => {
  const [form, setForm] = useState<SupplierForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        gst: supplier.gst,
        address: supplier.address ?? '',
        paymentTerms: supplier.paymentTerms ?? 'COD',
      })
    } else {
      setForm(defaultForm)
    }
  }, [supplier, open])

  const set = (field: keyof SupplierForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    if (!form.name) { toast.error('Supplier name is required'); return }
    setSaving(true)
    try {
      const payload = {
        companyId: tenantId,
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        gstNumber: form.gst || undefined,
        paymentTerms: form.paymentTerms,
      }
      let savedId = supplier?.id ?? crypto.randomUUID()
      if (supplier) {
        await purchaseApi.updateSupplier(supplier.id, payload)
      } else {
        const res = await purchaseApi.createSupplier(payload)
        savedId = res.data?.data?.id ?? savedId
      }
      const saved: Supplier = {
        id: savedId,
        name: form.name,
        phone: form.phone,
        email: form.email,
        gst: form.gst,
        address: form.address,
        paymentTerms: form.paymentTerms,
        outstanding: supplier?.outstanding ?? 0,
      }
      onSaved(saved)
      toast.success(supplier ? 'Supplier updated' : 'Supplier added')
      onClose()
    } catch {
      toast.error('Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? 'Edit Supplier' : 'Add Supplier'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{supplier ? 'Save Changes' : 'Add Supplier'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Supplier Name *" value={form.name} onChange={set('name')} placeholder="Company or person name" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" />
          <Input label="Email" value={form.email} onChange={set('email')} placeholder="contact@supplier.com" type="email" />
        </div>
        <Input label="GST Number" value={form.gst} onChange={set('gst')} placeholder="e.g. 27AAAPZ0011H1ZP" />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
          <textarea
            value={form.address}
            onChange={set('address')}
            rows={2}
            placeholder="Street, City, State, PIN"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
        <Select label="Payment Terms" value={form.paymentTerms} onChange={set('paymentTerms')} options={PAYMENT_TERMS_OPTIONS} />
      </div>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const SuppliersPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const navigate = useNavigate()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    if (!tenant?.id) return
    setLoading(true)
    purchaseApi
      .getSuppliers({ companyId: tenant.id })
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? res.data ?? []
        const items: Supplier[] = (Array.isArray(raw) ? raw : []).map((s: Record<string, unknown>) => ({
          id: String(s.id),
          name: String(s.name ?? ''),
          phone: String(s.phone ?? ''),
          email: String(s.email ?? ''),
          gst: String(s.gstNumber ?? s.gst ?? ''),
          address: s.address ? String(s.address) : undefined,
          paymentTerms: s.paymentTerms ? String(s.paymentTerms) : undefined,
          outstanding: Number(s.outstanding ?? s.outstandingBalance ?? 0),
        }))
        setSuppliers(items)
      })
      .catch(() => { toast.error('Failed to load suppliers') })
      .finally(() => setLoading(false))
  }, [tenant?.id])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.gst.toLowerCase().includes(q)
    )
  }, [suppliers, search])

  const handleOpenAdd = () => {
    setEditSupplier(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (supplier: Supplier) => {
    setEditSupplier(supplier)
    setModalOpen(true)
  }

  const handleSaved = (saved: Supplier) => {
    setSuppliers((prev) => {
      const exists = prev.find((s) => s.id === saved.id)
      return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev]
    })
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: Supplier) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{row.name}</p>
          {row.paymentTerms && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{row.paymentTerms}</p>
          )}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row: Supplier) => <span className="text-gray-700 dark:text-gray-300">{row.phone || '—'}</span> },
    { key: 'email', header: 'Email', render: (row: Supplier) => <span className="text-gray-700 dark:text-gray-300">{row.email || '—'}</span> },
    {
      key: 'gst',
      header: 'GST Number',
      render: (row: Supplier) =>
        row.gst ? (
          <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{row.gst}</span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (row: Supplier) =>
        row.outstanding > 0 ? (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            ₹{row.outstanding.toLocaleString()}
          </span>
        ) : (
          <Badge variant="success">Settled</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: Supplier) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleOpenEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" icon={<ShoppingCart className="w-3.5 h-3.5" />} onClick={() => navigate('/purchases')}>
            Orders
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{filtered.length} supplier{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenAdd}>Add Supplier</Button>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, phone or GST…" className="max-w-md" />

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No suppliers found"
          description={search ? 'Try a different search term' : 'Add your first supplier to get started'}
          action={<Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenAdd}>Add Supplier</Button>}
        />
      ) : (
        <Table data={filtered} columns={columns} />
      )}

      <SupplierModal
        open={modalOpen}
        supplier={editSupplier}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        tenantId={tenant?.id ?? ''}
      />
    </div>
  )
}
