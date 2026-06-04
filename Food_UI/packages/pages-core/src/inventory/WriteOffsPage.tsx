import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { Button, Modal, Badge, Table, Spinner, Select, Input } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WriteOff {
  id: string
  writeOffNumber: string
  productName: string
  warehouseName: string
  quantity: number
  writeOffType: string
  reason: string
  status: string
  createdAt: string
}

interface WriteOffForm {
  warehouseId: string
  productId: string
  quantity: string
  writeOffType: string
  reason: string
}

interface ApproveForm {
  approved: boolean
  notes: string
}

interface Warehouse { id: string; name: string; code: string }
interface Product   { id: string; name: string; sku: string }

const EMPTY_FORM: WriteOffForm = {
  warehouseId: '',
  productId: '',
  quantity: '',
  writeOffType: 'Damaged',
  reason: '',
}

const STATUS_COLORS: Record<string, 'warning' | 'success' | 'danger'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WriteOffsPage: React.FC = () => {
  const tenant     = useAppSelector((s) => s.tenant.tenant)
  const employeeId  = useAppSelector((s) => s.auth.user?.employeeId)

  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([])
  const [loading, setLoading]     = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const PAGE_SIZE = 20

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm]             = useState<WriteOffForm>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  const [approveOpen, setApproveOpen]   = useState(false)
  const [approvingId, setApprovingId]   = useState<string | null>(null)
  const [approveForm, setApproveForm]   = useState<ApproveForm>({ approved: true, notes: '' })
  const [approving, setApproving]       = useState(false)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts]     = useState<Product[]>([])

  const loadWriteOffs = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)
    inventoryApi
      .getWriteOffs({ status: statusFilter || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        const data = res.data?.data ?? res.data
        setWriteOffs(data?.items ?? data ?? [])
        setTotal(data?.totalCount ?? 0)
      })
      .catch(() => toast.error('Failed to load write-offs'))
      .finally(() => setLoading(false))
  }, [tenant?.id, statusFilter, page])

  useEffect(() => { loadWriteOffs() }, [loadWriteOffs])

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
    if (!form.warehouseId || !form.productId || !form.quantity || !form.reason) {
      toast.error('All fields are required')
      return
    }
    setSaving(true)
    try {
      await inventoryApi.createWriteOff({
        companyId: tenant!.id,
        requestedByEmployeeId: employeeId ?? '00000000-0000-0000-0000-000000000000',
        ...form,
        quantity: parseInt(form.quantity),
        type: form.writeOffType,
      })
      toast.success('Write-off created')
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      loadWriteOffs()
    } catch {
      toast.error('Failed to create write-off')
    } finally {
      setSaving(false)
    }
  }

  const openApprove = (row: WriteOff, approve: boolean) => {
    setApprovingId(row.id)
    setApproveForm({ approved: approve, notes: '' })
    setApproveOpen(true)
  }

  const handleApprove = async () => {
    if (!approvingId) return
    setApproving(true)
    try {
      await inventoryApi.approveWriteOff(approvingId, {
        approved: approveForm.approved,
        approvedByEmployeeId: employeeId ?? '',
        notes: approveForm.notes || undefined,
      })
      toast.success(approveForm.approved ? 'Write-off approved' : 'Write-off rejected')
      setApproveOpen(false)
      loadWriteOffs()
    } catch {
      toast.error('Failed to update write-off')
    } finally {
      setApproving(false)
    }
  }

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))
  const productOptions   = products.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` }))

  const columns = [
    { key: 'writeOffNumber', header: 'Write-off #' },
    { key: 'productName',    header: 'Product' },
    { key: 'warehouseName',  header: 'Warehouse' },
    { key: 'quantity',       header: 'Qty' },
    { key: 'writeOffType',   header: 'Type' },
    {
      key: 'status',
      header: 'Status',
      render: (row: WriteOff) => (
        <Badge variant={STATUS_COLORS[row.status] ?? 'info'}>{row.status}</Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: WriteOff) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (row: WriteOff) =>
        row.status === 'Pending' ? (
          <div className="flex gap-2">
            <Button
              variant="ghost" size="sm"
              icon={<CheckCircle className="w-3.5 h-3.5 text-green-500" />}
              onClick={() => openApprove(row, true)}
              title="Approve"
            />
            <Button
              variant="ghost" size="sm"
              icon={<XCircle className="w-3.5 h-3.5 text-red-500" />}
              onClick={() => openApprove(row, false)}
              title="Reject"
            />
          </div>
        ) : null,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Write-offs</h1>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          New Write-off
        </Button>
      </div>

      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Rejected', label: 'Rejected' },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Table columns={columns} data={writeOffs} />
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

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(EMPTY_FORM) }} title="New Write-off">
        <div className="space-y-4">
          <Select
            label="Warehouse"
            value={form.warehouseId}
            onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}
            options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
          />
          <Select
            label="Product"
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            options={[{ value: '', label: 'Select product…' }, ...productOptions]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            <Select
              label="Type"
              value={form.writeOffType}
              onChange={(e) => setForm((f) => ({ ...f, writeOffType: e.target.value }))}
              options={[
                { value: 'Damaged', label: 'Damaged' },
                { value: 'Scrap',   label: 'Scrap' },
                { value: 'Expired', label: 'Expired' },
              ]}
            />
          </div>
          <Input
            label="Reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Explain the reason for write-off…"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Submit</Button>
          </div>
        </div>
      </Modal>

      {/* Approve/Reject Modal */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={approveForm.approved ? 'Approve Write-off' : 'Reject Write-off'}
      >
        <div className="space-y-4">
          <Input
            label="Notes (optional)"
            value={approveForm.notes}
            onChange={(e) => setApproveForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Add any review notes…"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button
              loading={approving}
              variant={approveForm.approved ? 'primary' : 'danger'}
              onClick={handleApprove}
            >
              {approveForm.approved ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
