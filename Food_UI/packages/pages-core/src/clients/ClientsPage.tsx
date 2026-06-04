import React, { useState, useEffect, useCallback } from 'react'
import { UserPlus, Eye, Pencil, Trash2, Users, ShoppingBag, Calendar, CreditCard, TrendingUp, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Button, Input, Select, Modal, Badge, Card, CardHeader, CardBody,
  Table, SearchInput, EmptyState, Spinner,
} from '@flowtap/ui-core'
import { useAppSelector } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'
import { clientsApi } from '@flowtap/api-core'
import { cn } from '@flowtap/shared'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface Client {
  id: string
  name: string
  phone: string
  email: string
  totalSpent: number
  totalPaid: number
  balanceDue: number
  visitCount: number
  lastVisitAt?: string
  type: number
  whatsApp?: string
  companyName?: string
  gstin?: string
  discountPercent: number
  city?: string
  state?: string
  address?: string
  postalCode?: string
  dateOfBirth?: string
  referralSource?: string
  notes?: string
}

interface ClientPurchase {
  id: string
  transactionNumber?: string
  status: string
  source: string
  subTotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  totalPaid: number
  balanceDue: number
  itemCount: number
  createdAt: string
  payments: Array<{ id: string; method: string; amount: number; purpose: string; paidAt: string }>
}

interface AddClientForm {
  name: string
  phone: string
  whatsApp: string
  email: string
  type: string
  companyName: string
  gstin: string
  address: string
  city: string
  state: string
  postalCode: string
  referralSource: string
  notes: string
  discountPercent: string
  dateOfBirth: string
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

const EMPTY_FORM: AddClientForm = {
  name: '', phone: '', whatsApp: '', email: '', type: '1',
  companyName: '', gstin: '', address: '', city: '', state: '',
  postalCode: '', referralSource: '', notes: '', discountPercent: '0', dateOfBirth: '',
}

const PAGE_SIZE = 20

const STATUS_STYLE: Record<string, string> = {
  Completed : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  Draft     : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Cancelled : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  Refunded  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
}

const METHOD_ICON: Record<string, string> = {
  Cash: '💵', Card: '💳', UPI: '📱', NetBanking: '🏦', Wallet: '👛',
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export const ClientsPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const { format } = useCurrency()

  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')

  const [addOpen, setAddOpen]           = useState(false)
  const [viewClient, setViewClient]     = useState<Client | null>(null)
  const [clientPurchases, setClientPurchases] = useState<ClientPurchase[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [editClient, setEditClient]     = useState<Client | null>(null)
  const [form, setForm]                 = useState<AddClientForm>(EMPTY_FORM)
  const [formErrors, setFormErrors]     = useState<Record<string, string>>({})
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState<string | null>(null)

  /* ── Load ───────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await clientsApi.getClients({
        companyId: tenant.id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      const raw = res.data?.data ?? res.data ?? []
      const items: Client[] = (Array.isArray(raw) ? raw : raw?.items ?? []).map((c: Record<string, unknown>) => ({
        id           : String(c.id),
        name         : String(c.name ?? ''),
        phone        : String(c.phone ?? ''),
        email        : String(c.email ?? ''),
        totalSpent   : Number(c.totalSpent ?? c.totalPurchases ?? 0),
        totalPaid    : Number(c.totalPaid ?? 0),
        balanceDue   : Math.max(0, Number(c.totalSpent ?? 0) - Number(c.totalPaid ?? 0)),
        visitCount   : Number(c.visitCount ?? 0),
        lastVisitAt  : c.lastVisitAt ? String(c.lastVisitAt) : undefined,
        type         : Number(c.type ?? c.clientType ?? 1),
        whatsApp     : c.whatsApp ? String(c.whatsApp) : undefined,
        companyName  : c.companyName ? String(c.companyName) : undefined,
        gstin        : c.gstin ? String(c.gstin) : undefined,
        discountPercent: Number(c.discountPercent ?? 0),
        city         : c.city ? String(c.city) : undefined,
        state        : c.state ? String(c.state) : undefined,
        address      : c.address ? String(c.address) : undefined,
        postalCode   : c.postalCode ? String(c.postalCode) : undefined,
        dateOfBirth  : c.dateOfBirth ? String(c.dateOfBirth) : undefined,
        referralSource: c.referralSource ? String(c.referralSource) : undefined,
        notes        : c.notes ? String(c.notes) : undefined,
      }))
      setClients(items)
      // Backend returns PaginatedList — totalCount is nested under data
      const totalCount = raw?.totalCount ?? res.data?.data?.totalCount ?? res.data?.totalCount ?? items.length
      setTotal(totalCount)
    } catch {
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  /* ── Validation ─────────────────────────────────────────────────────────── */
  const validate = (f: AddClientForm) => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Name is required'
    if (!f.phone.trim()) e.phone = 'Phone is required'
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Invalid email'
    return e
  }

  /* ── Add ────────────────────────────────────────────────────────────────── */
  const handleAdd = async () => {
    const errors = validate(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      await clientsApi.createClient({
        companyId    : tenant!.id,
        name         : form.name.trim(),
        phone        : form.phone.trim() || undefined,
        whatsApp     : form.whatsApp.trim() || undefined,
        email        : form.email.trim() || undefined,
        type         : Number(form.type),
        companyName  : form.companyName.trim() || undefined,
        gstin        : form.gstin.trim() || undefined,
        address      : form.address.trim() || undefined,
        city         : form.city.trim() || undefined,
        state        : form.state.trim() || undefined,
        postalCode   : form.postalCode.trim() || undefined,
        discountPercent: Number(form.discountPercent) || 0,
        dateOfBirth  : form.dateOfBirth || undefined,
        referralSource: form.referralSource || undefined,
        notes        : form.notes.trim() || undefined,
      })
      toast.success('Client added')
      setAddOpen(false)
      setForm(EMPTY_FORM)
      setFormErrors({})
      load()
    } catch {
      toast.error('Failed to add client')
    } finally {
      setSaving(false)
    }
  }

  /* ── Edit ───────────────────────────────────────────────────────────────── */
  const handleSaveEdit = async () => {
    if (!editClient) return
    const errors = validate(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      await clientsApi.updateClient(editClient.id, {
        name         : form.name.trim(),
        phone        : form.phone.trim() || undefined,
        whatsApp     : form.whatsApp.trim() || undefined,
        email        : form.email.trim() || undefined,
        type         : Number(form.type),
        companyName  : form.companyName.trim() || undefined,
        gstin        : form.gstin.trim() || undefined,
        address      : form.address.trim() || undefined,
        city         : form.city.trim() || undefined,
        state        : form.state.trim() || undefined,
        postalCode   : form.postalCode.trim() || undefined,
        discountPercent: Number(form.discountPercent) || 0,
        dateOfBirth  : form.dateOfBirth || undefined,
        referralSource: form.referralSource || undefined,
        notes        : form.notes.trim() || undefined,
      })
      toast.success('Client updated')
      setEditClient(null)
      setForm(EMPTY_FORM)
      setFormErrors({})
      load()
    } catch {
      toast.error('Failed to update client')
    } finally {
      setSaving(false)
    }
  }

  /* ── Delete ─────────────────────────────────────────────────────────────── */
  const handleDelete = async (client: Client) => {
    if (!window.confirm(`Delete client "${client.name}"? This cannot be undone.`)) return
    setDeleting(client.id)
    try {
      await clientsApi.deleteClient(client.id)
      toast.success('Client deleted')
      load()
    } catch {
      toast.error('Failed to delete client')
    } finally {
      setDeleting(null)
    }
  }

  /* ── View / Purchases ───────────────────────────────────────────────────── */
  const openView = (c: Client) => {
    setViewClient(c)
    setClientPurchases([])
    setPurchasesLoading(true)
    clientsApi.getClientPurchases(c.id, { pageSize: 15 })
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? []
        setClientPurchases((Array.isArray(raw) ? raw : []).map((p: Record<string, unknown>) => ({
          id              : String(p.id ?? ''),
          transactionNumber: p.transactionNumber ? String(p.transactionNumber) : undefined,
          status          : String(p.status ?? 'Draft'),
          source          : String(p.source ?? 'POS'),
          subTotal        : Number(p.subTotal ?? 0),
          discountAmount  : Number(p.discountAmount ?? 0),
          taxAmount       : Number(p.taxAmount ?? 0),
          totalAmount     : Number(p.totalAmount ?? 0),
          totalPaid       : Number(p.totalPaid ?? 0),
          balanceDue      : Number(p.balanceDue ?? 0),
          itemCount       : Number(p.itemCount ?? 0),
          createdAt       : String(p.createdAt ?? ''),
          payments        : (Array.isArray(p.payments) ? p.payments : []).map((pay: Record<string, unknown>) => ({
            id     : String(pay.id ?? ''),
            method : String(pay.method ?? ''),
            amount : Number(pay.amount ?? 0),
            purpose: String(pay.purpose ?? ''),
            paidAt : String(pay.paidAt ?? ''),
          })),
        })))
      })
      .catch(() => setClientPurchases([]))
      .finally(() => setPurchasesLoading(false))
  }

  const openAdd = () => { setForm(EMPTY_FORM); setFormErrors({}); setAddOpen(true) }

  const openEdit = (c: Client) => {
    setForm({
      name           : c.name,
      phone          : c.phone,
      whatsApp       : c.whatsApp ?? '',
      email          : c.email,
      type           : String(c.type),
      companyName    : c.companyName ?? '',
      gstin          : c.gstin ?? '',
      address        : c.address ?? '',
      city           : c.city ?? '',
      state          : c.state ?? '',
      postalCode     : c.postalCode ?? '',
      referralSource : c.referralSource ?? '',
      notes          : c.notes ?? '',
      discountPercent: String(c.discountPercent),
      dateOfBirth    : c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : '',
    })
    setFormErrors({})
    setEditClient(c)
  }

  // Open edit from the View modal
  const openEditFromView = () => {
    if (!viewClient) return
    setViewClient(null)
    openEdit(viewClient)
  }

  /* ── Table columns ──────────────────────────────────────────────────────── */
  const columns = [
    {
      key: 'name', header: 'Name',
      render: (row: Client) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
          <Badge variant={row.type === 2 ? 'purple' : 'info'} size="sm">
            {row.type === 2 ? 'Corporate' : 'Individual'}
          </Badge>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (r: Client) => r.phone || '—' },
    {
      key: 'visits', header: 'Visits',
      render: (r: Client) => (
        <span className="text-gray-600 dark:text-gray-400">
          {r.visitCount > 0 ? `${r.visitCount} ${r.visitCount === 1 ? 'visit' : 'visits'}` : '—'}
        </span>
      ),
    },
    {
      key: 'totalSpent', header: 'Total Spent',
      render: (r: Client) => (
        <span className="font-semibold text-green-600 dark:text-green-400">
          {format(r.totalSpent)}
        </span>
      ),
    },
    {
      key: 'balanceDue', header: 'Balance Due',
      render: (r: Client) => r.balanceDue > 0 ? (
        <span className="font-semibold text-red-600 dark:text-red-400">{format(r.balanceDue)}</span>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: (row: Client) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openView(row) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
            disabled={deleting === row.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
        <Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={openAdd}>
          Add Client
        </Button>
      </div>

      <Card>
        <CardHeader
          title={`All Clients${total > 0 ? ` (${total})` : ''}`}
          action={
            <SearchInput value={search} onChange={setSearch}
              placeholder="Search by name, phone, email…" className="w-64" />
          }
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : clients.length === 0 ? (
            search ? (
              <EmptyState icon={<Users className="w-16 h-16" />} title="No clients found"
                description={`No clients match "${search}".`} />
            ) : (
              <EmptyState icon={<Users className="w-16 h-16" />} title="No clients yet"
                description="Add your first client to get started."
                action={<Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={openAdd}>Add Client</Button>} />
            )
          ) : (
            <Table data={clients} columns={columns} onRowClick={(row) => openView(row)} />
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Page {page} of {totalPages} · {total} clients</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Add Modal ────────────────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Client" size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleAdd}>Add Client</Button>
          </div>
        }
      >
        <ClientForm form={form} errors={formErrors} onChange={(f, v) => setForm(prev => ({ ...prev, [f]: v }))} />
      </Modal>

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!editClient} onClose={() => setEditClient(null)} title="Edit Client" size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        }
      >
        <ClientForm form={form} errors={formErrors} onChange={(f, v) => setForm(prev => ({ ...prev, [f]: v }))} />
      </Modal>

      {/* ── View Modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!viewClient}
        onClose={() => setViewClient(null)}
        title="Client Details"
        size="lg"
      >
        {viewClient && (
          <div className="space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {viewClient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewClient.name}</h3>
                  {viewClient.companyName && <p className="text-sm text-gray-500">{viewClient.companyName}</p>}
                  <Badge variant={viewClient.type === 2 ? 'purple' : 'info'}>
                    {viewClient.type === 2 ? 'Corporate' : 'Individual'}
                  </Badge>
                </div>
              </div>
              <button
                onClick={openEditFromView}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20 transition-colors flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Visits</span>
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{viewClient.visitCount}</p>
                {viewClient.lastVisitAt && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    Last: {new Date(viewClient.lastVisitAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Total Spent</span>
                </div>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{format(viewClient.totalSpent)}</p>
              </div>
              <div className={cn(
                'rounded-xl p-3 text-center',
                viewClient.balanceDue > 0
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : 'bg-gray-50 dark:bg-gray-800'
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className={cn('w-3.5 h-3.5', viewClient.balanceDue > 0 ? 'text-red-500' : 'text-gray-400')} />
                  <span className={cn('text-xs font-medium', viewClient.balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>
                    Balance Due
                  </span>
                </div>
                <p className={cn('text-lg font-bold', viewClient.balanceDue > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500')}>
                  {viewClient.balanceDue > 0 ? format(viewClient.balanceDue) : '—'}
                </p>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Phone',    value: viewClient.phone },
                { label: 'Email',    value: viewClient.email },
                { label: 'WhatsApp', value: viewClient.whatsApp },
                { label: 'GSTIN',    value: viewClient.gstin },
                { label: 'Address',  value: viewClient.address },
                { label: 'City',     value: viewClient.city },
                { label: 'State',    value: viewClient.state },
                { label: 'Postal Code', value: viewClient.postalCode },
                { label: 'Date of Birth', value: viewClient.dateOfBirth ? new Date(viewClient.dateOfBirth).toLocaleDateString() : undefined },
                { label: 'Discount', value: viewClient.discountPercent ? `${viewClient.discountPercent}%` : '0%' },
                { label: 'Referral', value: viewClient.referralSource },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{value}</p>
                </div>
              ) : null)}
            </div>

            {viewClient.notes && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{viewClient.notes}</p>
              </div>
            )}

            {/* Purchase History */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Purchase History</p>
                {clientPurchases.length > 0 && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                    {clientPurchases.length}
                  </span>
                )}
              </div>

              {purchasesLoading ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : clientPurchases.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">No purchases recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {clientPurchases.map((p) => (
                    <div key={p.id} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      {/* Purchase header */}
                      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {p.transactionNumber ?? `#${p.id.slice(-6).toUpperCase()}`}
                          </span>
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            STATUS_STYLE[p.status] ?? STATUS_STYLE['Draft']
                          )}>
                            {p.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{format(p.totalAmount)}</p>
                          <p className="text-[10px] text-gray-400">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>

                      {/* Purchase body */}
                      <div className="px-3 py-2 space-y-1.5">
                        {/* Line breakdown */}
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{p.itemCount} {p.itemCount === 1 ? 'item' : 'items'}</span>
                          {p.discountAmount > 0 && <span>Discount: -{format(p.discountAmount)}</span>}
                          {p.taxAmount > 0 && <span>Tax: +{format(p.taxAmount)}</span>}
                        </div>

                        {/* Payment summary */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.payments.length > 0 ? p.payments.map((pay) => (
                              <span key={pay.id} className="inline-flex items-center gap-1 text-[11px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-2 py-0.5 text-gray-600 dark:text-gray-300">
                                <span>{METHOD_ICON[pay.method] ?? '💰'}</span>
                                {pay.method}: {format(pay.amount)}
                              </span>
                            )) : (
                              <span className="text-xs text-gray-400 italic">No payments</span>
                            )}
                          </div>
                          {p.balanceDue > 0 && (
                            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium flex-shrink-0">
                              <CreditCard className="w-3 h-3" />
                              Due: {format(p.balanceDue)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ─── Shared form ───────────────────────────────────────────────────────────── */

const ClientForm: React.FC<{
  form: AddClientForm
  errors: Record<string, string>
  onChange: (field: keyof AddClientForm, value: string) => void
}> = ({ form, errors, onChange }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4">
      <Input label="Name *" value={form.name} onChange={(e) => onChange('name', e.target.value)}
        placeholder="Full name" error={errors.name} />
      <Select label="Client Type" value={form.type} onChange={(e) => onChange('type', e.target.value)}
        options={[{ value: '1', label: 'Individual' }, { value: '2', label: 'Corporate' }]} />
    </div>

    {form.type === '2' && (
      <div className="grid grid-cols-2 gap-4">
        <Input label="Company Name" value={form.companyName}
          onChange={(e) => onChange('companyName', e.target.value)} placeholder="Acme Corp" />
        <Input label="GSTIN" value={form.gstin}
          onChange={(e) => onChange('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
      </div>
    )}

    <div className="grid grid-cols-3 gap-4">
      <Input label="Phone *" value={form.phone} onChange={(e) => onChange('phone', e.target.value)}
        placeholder="+91 XXXXX XXXXX" error={errors.phone} />
      <Input label="WhatsApp" value={form.whatsApp}
        onChange={(e) => onChange('whatsApp', e.target.value)} placeholder="WhatsApp no." />
      <Input label="Email" value={form.email} onChange={(e) => onChange('email', e.target.value)}
        placeholder="email@example.com" error={errors.email} />
    </div>

    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Address</p>
      <Input label="Street Address" value={form.address}
        onChange={(e) => onChange('address', e.target.value)} placeholder="Building, Street..." />
      <div className="grid grid-cols-3 gap-4 mt-3">
        <Input label="City" value={form.city} onChange={(e) => onChange('city', e.target.value)} placeholder="City" />
        <Input label="State" value={form.state} onChange={(e) => onChange('state', e.target.value)} placeholder="State" />
        <Input label="Postal Code" value={form.postalCode}
          onChange={(e) => onChange('postalCode', e.target.value)} placeholder="PIN" />
      </div>
    </div>

    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Marketing & Loyalty</p>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Default Discount (%)" type="number" value={form.discountPercent}
          onChange={(e) => onChange('discountPercent', e.target.value)} placeholder="0" />
        <Input label="Date of Birth" type="date" value={form.dateOfBirth}
          onChange={(e) => onChange('dateOfBirth', e.target.value)} />
        <Select label="Referral Source" value={form.referralSource}
          onChange={(e) => onChange('referralSource', e.target.value)}
          options={[
            { value: '', label: 'None' }, { value: 'Google', label: 'Google Search' },
            { value: 'Social', label: 'Social Media' }, { value: 'Friend', label: 'Friend/Relative' },
            { value: 'Walk-in', label: 'Walk-in' },
          ]} />
      </div>
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={2}
          placeholder="Internal notes..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        />
      </div>
    </div>
  </div>
)
