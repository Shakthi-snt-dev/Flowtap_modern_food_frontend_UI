import React, { useEffect, useState, useCallback } from 'react'
import { useAppSelector } from '@flowtap/store'
import { employeesApi } from '@flowtap/api-core'
import {
  UserPlus, Search, Phone, Mail, Shield, Pencil, Trash2,
  UserCheck, UserX, ChevronDown, ChevronUp, DollarSign,
  Lock, Building2, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string
  name: string
  phone?: string
  email?: string
  role?: string
  jobTitle?: string
  department?: string
  joinedAt?: string
  comment?: string
  vatin?: string
  isActive: boolean
  salary?: number
  salaryType?: string
  salaryCurrency?: string
  locationIds?: string[]
  permissions?: Record<string, boolean>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['Admin', 'Manager', 'Technician', 'Cashier', 'Receptionist', 'Supervisor', 'Staff']

const SALARY_TYPES = ['Monthly', 'Weekly', 'Daily', 'Hourly']

const MODULES = [
  { key: 'POS',           label: 'Point of Sale',    description: 'Process sales and payments' },
  { key: 'Inventory',     label: 'Inventory',         description: 'Products, stock and warehouses' },
  { key: 'ServiceTickets',label: 'Service Tickets',   description: 'Repair tickets and services' },
  { key: 'Purchasing',    label: 'Purchasing',         description: 'Purchase orders and suppliers' },
  { key: 'Clients',       label: 'Clients',            description: 'Customer records' },
  { key: 'Employees',     label: 'Employees',          description: 'Team management' },
  { key: 'Reports',       label: 'Reports',            description: 'Sales and analytics' },
  { key: 'Settings',      label: 'Settings',           description: 'System configuration' },
]

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  POS: true, Inventory: true, ServiceTickets: true, Purchasing: false,
  Clients: true, Employees: false, Reports: false, Settings: false,
}

const EMPTY_FORM = {
  name: '', phone: '', email: '', role: 'Technician', pin: '',
  jobTitle: '', department: '', joinedAt: new Date().toISOString().split('T')[0],
  comment: '', vatin: '',
  salaryType: 'Monthly', salary: '', salaryCurrency: '',
  isActive: true,
}

// ─── Field helper ─────────────────────────────────────────────────────────────

const cls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none'
const label = (text: string) => (
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{text}</label>
)

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          {icon}{title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-4 bg-white dark:bg-gray-900">{children}</div>}
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
    className={[
      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
      checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ].join(' ')}>
    <span className={['inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
      checked ? 'translate-x-[18px]' : 'translate-x-1'].join(' ')} />
  </button>
)

// ─── Employee Modal ───────────────────────────────────────────────────────────

interface EmployeeModalProps {
  open: boolean
  employee: Employee | null
  tenantId: string
  currency: string
  currentStoreId: string | null
  onClose: () => void
  onSaved: () => void
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({
  open, employee, tenantId, currency, currentStoreId, onClose, onSaved,
}) => {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [permissions, setPermissions] = useState<Record<string, boolean>>(DEFAULT_PERMISSIONS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (employee) {
      setForm({
        name:           employee.name,
        phone:          employee.phone ?? '',
        email:          employee.email ?? '',
        role:           employee.role ?? 'Technician',
        pin:            '',
        jobTitle:       employee.jobTitle ?? '',
        department:     employee.department ?? '',
        joinedAt:       employee.joinedAt ?? new Date().toISOString().split('T')[0],
        comment:        employee.comment ?? '',
        vatin:          employee.vatin ?? '',
        salaryType:     employee.salaryType ?? 'Monthly',
        salary:         employee.salary != null ? String(employee.salary) : '',
        salaryCurrency: employee.salaryCurrency ?? currency,
        isActive:       employee.isActive,
      })
      setPermissions(employee.permissions ?? { ...DEFAULT_PERMISSIONS })
    } else {
      setForm({ ...EMPTY_FORM, salaryCurrency: currency })
      setPermissions({ ...DEFAULT_PERMISSIONS })
    }
  }, [employee, open, currency])

  if (!open) return null

  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const togglePermission = (key: string) =>
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const payload = {
        companyId:      tenantId,
        name:           form.name.trim(),
        phone:          form.phone.trim() || undefined,
        email:          form.email.trim() || undefined,
        role:           form.role,
        pin:            form.pin || undefined,
        jobTitle:       form.jobTitle.trim() || undefined,
        department:     form.department.trim() || undefined,
        joinedAt:       form.joinedAt || undefined,
        comment:        form.comment.trim() || undefined,
        vatin:          form.vatin.trim() || undefined,
        salaryType:     form.salaryType || undefined,
        salary:         form.salary ? Number(form.salary) : undefined,
        salaryCurrency: form.salaryCurrency || currency || undefined,
        // Assign to the currently selected store (from top nav); backend falls back to default store if null
        locationIds: currentStoreId ? [currentStoreId] : undefined,
        permissions,
        isActive:       form.isActive,
      }
      if (employee) {
        await employeesApi.updateEmployee(employee.id, payload)
        toast.success('Employee updated')
      } else {
        await employeesApi.createEmployee(payload)
        toast.success('Employee added')
      }
      onSaved()
      onClose()
    } catch {
      toast.error(employee ? 'Failed to update employee' : 'Failed to add employee')
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = form.role === 'Admin'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-700 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {employee ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-light">✕</button>
        </div>

        {/* Scrollable body */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">

            {/* ── Personal Info ────────────────────────────────────────── */}
            <Section title="Personal Information" icon={<UserPlus className="w-4 h-4 text-blue-500" />}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {label('Full Name *')}
                  <input required value={form.name} onChange={set('name')} placeholder="John Smith" className={cls} />
                </div>
                <div>
                  {label('Email')}
                  <input type="email" value={form.email} onChange={set('email')} placeholder="john@example.com" className={cls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  {label('Phone')}
                  <input value={form.phone} onChange={set('phone')} placeholder="+91..." className={cls} />
                </div>
                <div>
                  {label('Role *')}
                  <select value={form.role} onChange={set('role')} className={cls}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  {label(employee ? 'New PIN (blank = keep)' : 'Security PIN')}
                  <input value={form.pin} onChange={set('pin')} placeholder="4 digits" maxLength={4} className={cls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {label('Job Title')}
                  <input value={form.jobTitle} onChange={set('jobTitle')} placeholder="e.g. Lead Technician" className={cls} />
                </div>
                <div>
                  {label('Department')}
                  <input value={form.department} onChange={set('department')} placeholder="e.g. Service" className={cls} />
                </div>
              </div>
              <div>
                {label('Internal Notes')}
                <textarea rows={2} value={form.comment} onChange={set('comment')} placeholder="HR notes, skills, etc." className={cls} />
              </div>
            </Section>

            {/* ── Employment Details ───────────────────────────────────── */}
            <Section title="Employment Details" icon={<Building2 className="w-4 h-4 text-purple-500" />} defaultOpen>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {label('Join Date')}
                  <input type="date" value={form.joinedAt} onChange={set('joinedAt')} className={cls} />
                </div>
                <div>
                  {label('Tax ID (VATIN)')}
                  <input value={form.vatin} onChange={set('vatin')} placeholder="VATIN / Tax Number" className={cls} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Employee Status</p>
                  <p className="text-xs text-gray-500 mt-0.5">{form.isActive ? 'Currently active — can log in and work' : 'Inactive — access suspended'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${form.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
                </div>
              </div>
            </Section>

            {/* ── Salary ──────────────────────────────────────────────── */}
            <Section title="Salary" icon={<DollarSign className="w-4 h-4 text-green-500" />} defaultOpen={false}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  {label('Pay Type')}
                  <select value={form.salaryType} onChange={set('salaryType')} className={cls}>
                    {SALARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  {label('Amount')}
                  <input type="number" min={0} value={form.salary} onChange={set('salary')}
                    placeholder="0.00" className={cls} />
                </div>
                <div>
                  {label('Currency')}
                  <input value={form.salaryCurrency} onChange={set('salaryCurrency')}
                    placeholder={currency || 'INR'} className={cls} />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Salary is stored for HR reference only — not used in automated calculations.
              </p>
            </Section>

            {/* ── Module Permissions ───────────────────────────────────── */}
            <Section title="Module Permissions" icon={<Lock className="w-4 h-4 text-red-500" />} defaultOpen={false}>
              {isAdmin ? (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  Admin role has full access to all modules and cannot be restricted.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Toggle which modules this employee can access.
                  </p>
                  {MODULES.map((mod) => {
                    const enabled = permissions[mod.key] ?? false
                    return (
                      <div key={mod.key}
                        className={[
                          'flex items-center justify-between p-3 rounded-xl border transition-colors',
                          enabled
                            ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
                            : 'border-gray-200 dark:border-gray-700',
                        ].join(' ')}>
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{mod.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{mod.description}</p>
                        </div>
                        <Toggle checked={enabled} onChange={() => togglePermission(mod.key)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => {
            formRef.current?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
          }}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
            {saving ? (employee ? 'Saving…' : 'Adding…') : (employee ? 'Save Changes' : 'Add Employee')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reset PIN Modal ──────────────────────────────────────────────────────────

const ResetPinModal: React.FC<{
  employee: Employee | null
  onClose: () => void
}> = ({ employee, onClose }) => {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (employee) { setPin(''); setConfirm('') } }, [employee])

  const handleSave = async () => {
    if (!employee) return
    if (pin.length < 4 || !/^\d+$/.test(pin)) { toast.error('PIN must be at least 4 digits'); return }
    if (pin !== confirm) { toast.error('PINs do not match'); return }
    setSaving(true)
    try {
      await employeesApi.resetPin(employee.id, pin)
      toast.success(`PIN reset for ${employee.name}`)
      onClose()
    } catch {
      toast.error('Failed to reset PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${employee ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Reset PIN</h3>
            <p className="text-xs text-gray-500">{employee?.name}</p>
          </div>
        </div>
        <div>
          {label('New PIN (digits only)')}
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••" className={cls}
          />
        </div>
        <div>
          {label('Confirm PIN')}
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            placeholder="••••" className={cls}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors">
            {saving ? 'Saving…' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const EmployeesPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)
  const stores = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [resetPinEmployee, setResetPinEmployee] = useState<Employee | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await employeesApi.getEmployees({
        companyId: tenant.id,
        search: search || undefined,
        pageSize: 100,
      })
      const raw = res.data.data?.items ?? res.data.data ?? []
      setEmployees(
        (Array.isArray(raw) ? raw : []).map((e: Record<string, unknown>) => ({
          id:             String(e.id),
          name:           String(e.name ?? e.fullName ?? 'Unknown'),
          phone:          e.phone ? String(e.phone) : undefined,
          email:          e.email ? String(e.email) : undefined,
          role:           e.role ? String(e.role) : undefined,
          jobTitle:       e.jobTitle ? String(e.jobTitle) : undefined,
          department:     e.department ? String(e.department) : undefined,
          joinedAt:       e.joinedAt ? String(e.joinedAt).split('T')[0] : undefined,
          comment:        e.comment ? String(e.comment) : undefined,
          vatin:          e.vatin || e.vATIN ? String(e.vatin ?? e.vATIN) : undefined,
          isActive:       e.isActive === true || e.status === 'Active',
          salary:         e.salary != null ? Number(e.salary) : undefined,
          salaryType:     e.salaryType ? String(e.salaryType) : undefined,
          salaryCurrency: e.salaryCurrency ? String(e.salaryCurrency) : undefined,
          locationIds:    Array.isArray(e.locationIds) ? (e.locationIds as string[]) : [],
          permissions:    e.permissions && typeof e.permissions === 'object'
            ? (e.permissions as Record<string, boolean>)
            : undefined,
        }))
      )
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, search])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (emp: Employee) => {
    setActionLoading(emp.id)
    try {
      if (emp.isActive) {
        await employeesApi.deactivateEmployee(emp.id)
        toast.success(`${emp.name} deactivated`)
      } else {
        await employeesApi.activateEmployee(emp.id)
        toast.success(`${emp.name} activated`)
      }
      await load()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Delete ${emp.name}? This cannot be undone.`)) return
    setActionLoading(emp.id)
    try {
      await employeesApi.deleteEmployee(emp.id)
      toast.success(`${emp.name} deleted`)
      await load()
    } catch {
      toast.error('Failed to delete employee')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter by current store if one is selected
  const filtered = employees.filter((emp) => {
    const matchesSearch = !search ||
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.phone?.includes(search)
    return matchesSearch
  })

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} team member{filtered.length !== 1 ? 's' : ''}
            {currentStoreId && stores.find(s => s.id === currentStoreId) &&
              ` · ${stores.find(s => s.id === currentStoreId)?.name}`}
          </p>
        </div>
        <button onClick={() => { setEditEmployee(null); setModalOpen(true) }}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-500/20 text-sm">
          <UserPlus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-gray-600 dark:text-gray-300">No employees found</p>
            <p className="text-sm mt-1">Add your first team member to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Employee', 'Contact', 'Role', 'Salary', 'Permissions', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((emp) => {
                  const empLocations = stores.filter((s) => emp.locationIds?.includes(s.id))
                  const enabledMods = emp.permissions
                    ? Object.entries(emp.permissions).filter(([, v]) => v).length
                    : null
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm flex-shrink-0">
                            {emp.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{emp.name}</p>
                            {emp.jobTitle && <p className="text-xs text-gray-400">{emp.jobTitle}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 space-y-0.5">
                        {emp.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Phone className="w-3 h-3 flex-shrink-0" />{emp.phone}
                          </div>
                        )}
                        {emp.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Mail className="w-3 h-3 flex-shrink-0" />{emp.email}
                          </div>
                        )}
                        {!emp.phone && !emp.email && <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {emp.role ?? 'Staff'}
                        </span>
                      </td>

                      {/* Salary */}
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {emp.salary != null ? (
                          <div>
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {(() => {
                                const cur = emp.salaryCurrency || tenant?.currency || 'USD'
                                try {
                                  return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(emp.salary!)
                                } catch {
                                  return `${cur} ${emp.salary!.toLocaleString()}`
                                }
                              })()}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">/{(emp.salaryType ?? 'Month').toLowerCase()}</span>
                          </div>
                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      {/* Permissions */}
                      <td className="px-4 py-3">
                        {emp.role === 'Admin' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                            <Shield className="w-3 h-3" /> Full access
                          </span>
                        ) : enabledMods != null ? (
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {enabledMods}/{MODULES.length} modules
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Default</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          emp.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {emp.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditEmployee(emp); setModalOpen(true) }}
                            disabled={actionLoading === emp.id} title="Edit"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setResetPinEmployee(emp)}
                            disabled={actionLoading === emp.id} title="Reset PIN"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50">
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleActive(emp)}
                            disabled={actionLoading === emp.id} title={emp.isActive ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              emp.isActive
                                ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}>
                            {actionLoading === emp.id
                              ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : emp.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleDelete(emp)}
                            disabled={actionLoading === emp.id} title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EmployeeModal
        open={modalOpen}
        employee={editEmployee}
        tenantId={tenant?.id ?? ''}
        currency={stores.find((s) => s.id === currentStoreId)?.currencyCode || tenant?.currency || 'INR'}
        currentStoreId={currentStoreId}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
      <ResetPinModal
        employee={resetPinEmployee}
        onClose={() => setResetPinEmployee(null)}
      />
    </div>
  )
}
