import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  Users, Package, Layers, UserCheck, Ticket,
  TrendingUp, Calendar, DollarSign, ShoppingCart,
  RefreshCw, Pencil, Trash2, Plus, Store,
  Crown, CreditCard, Lock, Building2, User,
  AlertTriangle, Clock, Warehouse, Settings2,
  ExternalLink, ToggleLeft, ToggleRight, X, Check,
  Banknote, Smartphone, Wallet, Info, Zap,
  Send, Mail, Filter, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, MessageSquare, History, Bell,
} from 'lucide-react'
import { cn } from '@flowtap/shared'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button, Input, Select, Modal, Card, CardHeader, CardBody, Badge } from '@flowtap/ui-core'
import { useAppDispatch, useAppSelector } from '@flowtap/store'
import { setTenant, setStores, setCurrentStore, type Store as StoreRecord } from '@flowtap/store'
import { setUser } from '@flowtap/store'
import { reportsApi } from '@flowtap/api-core'
import { tenantApi } from '@flowtap/api-core'
import { authApi } from '@flowtap/api-core'
import { inventoryApi } from '@flowtap/api-core'
import { salesApi } from '@flowtap/api-core'
import { notificationsApi } from '@flowtap/api-core'
import { employeesApi } from '@flowtap/api-core'
import { useCurrency } from '@flowtap/shared'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminOverviewDto {
  tenantName: string
  businessType: string
  country: string
  currency: string
  activeModules: string[]
  totalStores: number
  totalEmployees: number
  totalProducts: number
  totalStockQuantity: number
  totalClients: number
  openTickets: number
  revenueToday: number
  revenueThisMonth: number
  revenueAllTime: number
  totalSalesCount: number
  stores: StoreOverviewDto[]
  subscription: SubscriptionSummaryDto | null
}

interface StoreOverviewDto {
  id: string
  name: string
  countryCode: string
  currencyCode: string
  employeeCount: number
  stockItemCount: number
  isActive: boolean
  revenueToday: number
  revenueThisMonth: number
  revenueAllTime: number
  salesCount: number
}

interface SubscriptionSummaryDto {
  planName: string
  status: string
  startDate: string
  endDate: string
  nextBillingDate: string
  totalLocations: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { value: 'US', label: 'United States' }, { value: 'GB', label: 'United Kingdom' },
  { value: 'IN', label: 'India' },         { value: 'AE', label: 'UAE' },
  { value: 'CA', label: 'Canada' },        { value: 'AU', label: 'Australia' },
  { value: 'PK', label: 'Pakistan' },      { value: 'NG', label: 'Nigeria' },
  { value: 'SG', label: 'Singapore' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },   { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },         { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'AED', label: 'AED — UAE Dirham' },   { value: 'PKR', label: 'PKR — Pakistani Rupee' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },{ value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },{ value: 'AUD', label: 'AUD — Australian Dollar' },
]

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', GB: 'GBP', IN: 'INR',
  AE: 'AED', AU: 'AUD', PK: 'PKR', NG: 'NGN', SG: 'SGD',
}

const TIMEZONES = [
  { value: '',                    label: 'Select timezone' },
  { value: 'Asia/Kolkata',        label: 'Asia/Kolkata (IST +5:30)' },
  { value: 'Asia/Dubai',          label: 'Asia/Dubai (GST +4:00)' },
  { value: 'Asia/Karachi',        label: 'Asia/Karachi (PKT +5:00)' },
  { value: 'Asia/Dhaka',          label: 'Asia/Dhaka (BST +6:00)' },
  { value: 'Asia/Singapore',      label: 'Asia/Singapore (SGT +8:00)' },
  { value: 'Asia/Kuala_Lumpur',   label: 'Asia/Kuala_Lumpur (MYT +8:00)' },
  { value: 'Asia/Bangkok',        label: 'Asia/Bangkok (ICT +7:00)' },
  { value: 'Asia/Jakarta',        label: 'Asia/Jakarta (WIB +7:00)' },
  { value: 'Asia/Shanghai',       label: 'Asia/Shanghai (CST +8:00)' },
  { value: 'Asia/Tokyo',          label: 'Asia/Tokyo (JST +9:00)' },
  { value: 'Asia/Seoul',          label: 'Asia/Seoul (KST +9:00)' },
  { value: 'Asia/Riyadh',         label: 'Asia/Riyadh (AST +3:00)' },
  { value: 'Europe/London',       label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris',        label: 'Europe/Paris (CET +1:00)' },
  { value: 'Europe/Berlin',       label: 'Europe/Berlin (CET +1:00)' },
  { value: 'America/New_York',    label: 'America/New_York (EST −5:00)' },
  { value: 'America/Chicago',     label: 'America/Chicago (CST −6:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST −8:00)' },
  { value: 'America/Toronto',     label: 'America/Toronto (EST −5:00)' },
  { value: 'Africa/Lagos',        label: 'Africa/Lagos (WAT +1:00)' },
  { value: 'Africa/Nairobi',      label: 'Africa/Nairobi (EAT +3:00)' },
  { value: 'Australia/Sydney',    label: 'Australia/Sydney (AEST +10:00)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST +10:00)' },
  { value: 'UTC',                 label: 'UTC (±0:00)' },
]

const EMPTY_STORE_FORM = {
  name: '', locationCode: '', type: '1',
  phone: '', email: '', address: '',
  city: '', state: '', country: '', currency: '', postalCode: '',
  timeZoneId: '', managerEmployeeId: '',
}
type StoreFormState = typeof EMPTY_STORE_FORM

const FREE_STORE_LIMIT = 2

const MODULE_COLORS: Record<string, string> = {
  POS:            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Inventory:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ServiceTickets: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Purchasing:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Clients:        'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  Employees:      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  Reports:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Settings:       'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

// ── Per-store currency formatter ──────────────────────────────────────────────

const STORE_LOCALE: Record<string, string> = {
  IN: 'en-IN', US: 'en-US', CA: 'en-CA', GB: 'en-GB',
  AE: 'ar-AE', AU: 'en-AU', PK: 'ur-PK', NG: 'en-NG', SG: 'en-SG',
}

/** Derive currency from countryCode when currencyCode is empty/missing */
function resolveCurrency(currencyCode: string, countryCode: string): string {
  if (currencyCode && currencyCode.length === 3) return currencyCode
  return COUNTRY_CURRENCY[countryCode] ?? 'USD'
}

function formatStoreCurrency(amount: number, currencyCode: string, countryCode: string): string {
  const resolvedCurrency = resolveCurrency(currencyCode, countryCode)
  const locale = STORE_LOCALE[countryCode] ?? 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${resolvedCurrency} ${amount.toLocaleString()}`
  }
}

type SettingsTab    = 'account' | 'stores' | 'subscription' | 'settings' | 'payments' | 'communications'
type SettingsSubTab = 'company-limits' | 'inventory'
type AccountSubTab  = 'company' | 'my-profile'

interface PaymentAccountItem { id: string; name: string; type: string; isActive: boolean }

interface NotificationRecord {
  id: string; type: string; recipient: string; subject: string
  status: string; error?: string; createdAt: string; sentAt?: string
}

interface AdminBroadcastItem {
  id: string
  subject: string
  message: string
  severity: string
  sentBy: string
  createdAt: string
  locationId: string | null
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  Information: {
    bg:     'bg-blue-50  dark:bg-blue-900/20',
    border: 'border-blue-200  dark:border-blue-800',
    text:   'text-blue-800  dark:text-blue-200',
    icon:   <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />,
  },
  Warning: {
    bg:     'bg-amber-50  dark:bg-amber-900/20',
    border: 'border-amber-200  dark:border-amber-800',
    text:   'text-amber-800  dark:text-amber-200',
    icon:   <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />,
  },
  Alert: {
    bg:     'bg-red-50  dark:bg-red-900/20',
    border: 'border-red-200  dark:border-red-800',
    text:   'text-red-800  dark:text-red-200',
    icon:   <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />,
  },
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  Sent:    <CheckCircle2 className="w-4 h-4 text-green-500" />,
  Failed:  <XCircle      className="w-4 h-4 text-red-500"   />,
  Pending: <Clock        className="w-4 h-4 text-gray-400"  />,
}
const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'default'> = {
  Sent: 'success', Failed: 'danger', Pending: 'default',
}
const HIST_PAGE_SIZE = 25

const PA_STYLE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Cash:    { label: 'Cash',    color: 'bg-green-50  text-green-700  dark:bg-green-900/20  dark:text-green-400',  icon: <Banknote   className="w-4 h-4" /> },
  Bank:    { label: 'Bank',    color: 'bg-blue-50   text-blue-700   dark:bg-blue-900/20   dark:text-blue-400',   icon: <Building2  className="w-4 h-4" /> },
  Gateway: { label: 'Gateway', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400', icon: <Smartphone className="w-4 h-4" /> },
  Wallet:  { label: 'Wallet',  color: 'bg-teal-50   text-teal-700   dark:bg-teal-900/20   dark:text-teal-400',   icon: <Wallet     className="w-4 h-4" /> },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function trialDaysLeft(createdAt: string | undefined, storeCount: number): number {
  const totalDays = storeCount >= 2 ? 15 : 30
  if (!createdAt) return totalDays
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return Math.max(0, totalDays - elapsed)
}

// ── Store form fields (shared between Add and Edit modals) ────────────────────

const StoreFormFields: React.FC<{
  form: StoreFormState
  errors: Record<string, string>
  onChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  isAdd?: boolean
}> = ({ form, errors, onChange, isAdd }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <Input label="Store Name *" value={form.name} onChange={onChange('name')}
        placeholder="e.g. Downtown Branch" error={errors.name} />
      <Input label="Location Code" value={form.locationCode} onChange={onChange('locationCode')}
        placeholder="e.g. LOC-002" hint="Unique identifier" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Store Type</label>
      <select value={form.type} onChange={onChange('type')}
        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white">
        <option value="1">Physical Store</option>
        <option value="2">Warehouse</option>
        <option value="3">Online</option>
        <option value="4">Pop-up / Kiosk</option>
      </select>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country <span className="text-red-500">*</span></label>
        <select value={form.country} onChange={onChange('country')}
          className={['w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white',
            errors.country ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'].join(' ')}>
          <option value="">Select country</option>
          {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {errors.country && <p className="mt-1 text-xs text-red-500">{errors.country}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency <span className="text-red-500">*</span></label>
        <select value={form.currency} onChange={onChange('currency')}
          className={['w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white',
            errors.currency ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'].join(' ')}>
          <option value="">Select currency</option>
          {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {errors.currency && <p className="mt-1 text-xs text-red-500">{errors.currency}</p>}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Input label="Phone" type="tel" value={form.phone} onChange={onChange('phone')} placeholder="+91 XXXXX XXXXX" />
      <Input label="Email" type="email" value={form.email} onChange={onChange('email')} placeholder="store@example.com" />
    </div>
    <Input label="Street Address" value={form.address} onChange={onChange('address')} placeholder="Street / Building / Area" />
    <div className="grid grid-cols-2 gap-4">
      <Input label="City"           value={form.city}       onChange={onChange('city')}       placeholder="City" />
      <Input label="State/Province" value={form.state}      onChange={onChange('state')}      placeholder="State" />
    </div>
    <Input label="Postal / ZIP Code" value={form.postalCode} onChange={onChange('postalCode')} placeholder="PIN / ZIP" />
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Zone</label>
      <select value={form.timeZoneId} onChange={onChange('timeZoneId')}
        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white">
        {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
      </select>
    </div>
    {isAdd && (
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
        <Warehouse className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          An in-store stock room warehouse will be automatically created for this store.
        </p>
      </div>
    )}
  </div>
)

// ── StatCard ──────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode
  label: string
  value: string | number
  iconBg?: string
}> = ({ icon, label, value, iconBg = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  </div>
)

// ── Section heading helper ────────────────────────────────────────────────────

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{children}</h2>
)

// ── Main Page ─────────────────────────────────────────────────────────────────

export const AdminOverviewPage: React.FC = () => {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const tenant    = useAppSelector((s) => s.tenant.tenant)
  const user      = useAppSelector((s) => s.auth.user)
  const reduxStores = useAppSelector((s) => s.tenant.stores)

  const { format } = useCurrency()
  const [settingsTab,    setSettingsTab]    = useState<SettingsTab>('account')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('company-limits')
  const [accountSubTab,  setAccountSubTab]  = useState<AccountSubTab>('company')
  const [showSettings,   setShowSettings]   = useState(false)

  // ── Admin Broadcasts (in-app messages) ───────────────────────────────────
  const [broadcasts, setBroadcasts] = useState<AdminBroadcastItem[]>([])

  const loadBroadcasts = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const res = await notificationsApi.getBroadcasts({ companyId: tenant.id, limit: 20 })
      const items: any[] = res.data?.data ?? []
      setBroadcasts(items.map((b: any) => ({
        id:         String(b.id),
        subject:    String(b.subject ?? ''),
        message:    String(b.message ?? ''),
        severity:   String(b.severity ?? 'Information'),
        sentBy:     String(b.sentBy ?? 'Admin'),
        createdAt:  String(b.createdAt ?? ''),
        locationId: b.locationId ?? null,
      })))
    } catch { /* non-blocking */ }
  }, [tenant?.id])

  useEffect(() => { loadBroadcasts() }, [loadBroadcasts])

  const handleDismissBroadcast = async (id: string) => {
    try {
      await notificationsApi.dismissBroadcast(id)
      setBroadcasts(prev => prev.filter(b => b.id !== id))
    } catch { toast.error('Failed to dismiss message') }
  }

  // ── Payment Accounts state ────────────────────────────────────────────────
  const [payAccounts,   setPayAccounts]   = useState<PaymentAccountItem[]>([])
  const [loadingPayAcc, setLoadingPayAcc] = useState(false)
  const [paForm,        setPaForm]        = useState({ name: '', type: 'Cash' })
  const [paEditId,      setPaEditId]      = useState<string | null>(null)
  const [paEditName,    setPaEditName]    = useState('')
  const [savingPa,      setSavingPa]      = useState(false)
  const [deletingPaId,  setDeletingPaId]  = useState<string | null>(null)

  // ── Communications: Broadcast + History ──────────────────────────────────
  const [commSubTab,     setCommSubTab]     = useState<'broadcast' | 'history'>('broadcast')
  const [bSubject,       setBSubject]       = useState('')
  const [bMessage,       setBMessage]       = useState('')
  // Individual channel flags — user can mix any combination
  const [bSendEmail,     setBSendEmail]     = useState(false)
  const [bSendSms,       setBSendSms]       = useState(false)
  const [bSendApp,       setBSendApp]       = useState(true)   // in-app on by default
  const [bSeverity,      setBSeverity]      = useState<'Information' | 'Warning' | 'Alert'>('Information')
  const [bType,          setBType]          = useState<'Notification' | 'Banner' | 'Popup'>('Notification')
  const [bPriority,      setBPriority]      = useState<'Low' | 'Normal' | 'High' | 'Critical'>('Normal')
  const [bStartDate,     setBStartDate]     = useState('')
  const [bEndDate,       setBEndDate]       = useState('')
  const [bLocationId,    setBLocationId]    = useState('')
  const [bStores,        setBStores]        = useState<{ id: string; name: string }[]>([])
  const [bSending,       setBSending]       = useState(false)
  const [hRecords,       setHRecords]       = useState<NotificationRecord[]>([])
  const [hLoading,       setHLoading]       = useState(false)
  const [hTotal,         setHTotal]         = useState(0)
  const [hPage,          setHPage]          = useState(1)
  const [hChannelFilter, setHChannelFilter] = useState('')
  const [hStatusFilter,  setHStatusFilter]  = useState('')

  // ── Overview API data ─────────────────────────────────────────────────────
  const [overview, setOverview]   = useState<AdminOverviewDto | null>(null)
  const [loadingOv, setLoadingOv] = useState(true)

  const fetchOverview = useCallback(async () => {
    setLoadingOv(true)
    try {
      const res  = await reportsApi.getAdminOverview()
      const data = res.data?.data ?? res.data
      setOverview(data)
    } catch {
      toast.error('Failed to load overview stats')
    } finally {
      setLoadingOv(false)
    }
  }, [])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  // ── Payment Accounts ──────────────────────────────────────────────────────
  const loadPayAccounts = useCallback(async () => {
    if (!tenant?.id) return
    setLoadingPayAcc(true)
    try {
      const res = await salesApi.getPaymentAccounts(tenant.id)
      setPayAccounts(res.data?.data ?? [])
    } catch {
      toast.error('Failed to load payment accounts')
    } finally {
      setLoadingPayAcc(false)
    }
  }, [tenant?.id])

  useEffect(() => {
    if (settingsTab === 'payments') loadPayAccounts()
  }, [settingsTab, loadPayAccounts])

  const handleAddPayAccount = async () => {
    if (!tenant?.id || !paForm.name.trim()) { toast.error('Name is required'); return }
    setSavingPa(true)
    try {
      await salesApi.createPaymentAccount({ companyId: tenant.id, name: paForm.name.trim(), type: paForm.type })
      setPaForm({ name: '', type: 'Cash' })
      await loadPayAccounts()
      toast.success('Account added')
    } catch {
      toast.error('Failed to add account')
    } finally {
      setSavingPa(false)
    }
  }

  const handleEditPayAccount = async (id: string) => {
    if (!paEditName.trim()) { toast.error('Name is required'); return }
    setSavingPa(true)
    try {
      await salesApi.updatePaymentAccount(id, { name: paEditName.trim() })
      setPaEditId(null)
      setPaEditName('')
      await loadPayAccounts()
      toast.success('Account updated')
    } catch {
      toast.error('Failed to update account')
    } finally {
      setSavingPa(false)
    }
  }

  const handleDeletePayAccount = async (id: string) => {
    if (!window.confirm('Delete this payment account?')) return
    setDeletingPaId(id)
    try {
      await salesApi.deletePaymentAccount(id)
      await loadPayAccounts()
      toast.success('Account deleted')
    } catch {
      toast.error('Failed to delete account')
    } finally {
      setDeletingPaId(null)
    }
  }

  // ── Broadcast + History ───────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!bSubject.trim()) { toast.error('Subject is required'); return }
    if (!bMessage.trim()) { toast.error('Message is required'); return }
    if (!bSendEmail && !bSendSms && !bSendApp) { toast.error('Select at least one channel'); return }
    if (!tenant?.id) return
    setBSending(true)
    try {
      // Build comma-separated channel string from individual flags
      const channelParts = [bSendEmail && 'Email', bSendSms && 'SMS', bSendApp && 'App'].filter(Boolean)
      const channel = channelParts.join(',')

      const res = await notificationsApi.broadcastAnnouncement({
        companyId: tenant.id, subject: bSubject, message: bMessage,
        channel, severity: bSeverity,
        locationId: undefined,
        type: bType,
        targetType: bLocationId ? 'SelectedStores' : 'AllStores',
          targetLocationIds: bLocationId ? [bLocationId] : undefined,
        priority: bPriority,
        startDate: bStartDate || undefined,
        endDate: bEndDate || undefined,
      })
      const count = res.data?.data ?? 0

      // Build human-readable success message
      const parts: string[] = []
      if (bSendApp) parts.push('posted in-app')
      if (bSendEmail || bSendSms) {
        const emailSmsCount = count - (bSendApp ? 1 : 0)
        if (emailSmsCount > 0)
          parts.push(`${emailSmsCount} ${bSendEmail && bSendSms ? 'email/SMS' : bSendEmail ? 'email' : 'SMS'} queued`)
      }
      toast.success(parts.length ? parts.join(' · ') : 'Announcement sent')
      setBSubject(''); setBMessage('')
      loadBroadcasts()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to send broadcast')
    } finally { setBSending(false) }
  }

  const loadHistory = useCallback(async () => {
    if (!tenant?.id) return
    setHLoading(true)
    try {
      const res = await notificationsApi.getHistory({
        companyId: tenant.id,
        channel: hChannelFilter || undefined,
        status:  hStatusFilter  || undefined,
        page: hPage, pageSize: HIST_PAGE_SIZE,
      })
      const data = res.data?.data ?? res.data
      const items: any[] = data?.items ?? []
      setHRecords(items.map((n: any) => ({
        id: String(n.id), type: String(n.type ?? ''), recipient: String(n.recipient ?? ''),
        subject: String(n.subject ?? ''), status: String(n.status ?? ''),
        error: n.error ?? undefined, createdAt: String(n.createdAt ?? ''), sentAt: n.sentAt ?? undefined,
      })))
      setHTotal(data?.totalCount ?? data?.total ?? items.length)
    } catch { toast.error('Failed to load notification history') }
    finally { setHLoading(false) }
  }, [tenant?.id, hChannelFilter, hStatusFilter, hPage])

  // Load broadcast store list as soon as tenant is known (not tab-gated)
  useEffect(() => {
    if (!tenant?.id) return
    tenantApi.getStores(tenant.id)
      .then((r: any) =>
        setBStores((r.data?.data ?? []).map((s: any) => ({ id: String(s.id), name: String(s.title ?? s.name ?? '') })))
      )
      .catch(() => {})
  }, [tenant?.id])

  // History loads only when the communications tab is open
  useEffect(() => {
    if (settingsTab !== 'communications') return
    loadHistory()
  }, [settingsTab, hChannelFilter, hStatusFilter, hPage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setHPage(1) }, [hChannelFilter, hStatusFilter])

  const hFormatDate = (s: string) => {
    try { return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return s }
  }
  const hTotalPages = Math.max(1, Math.ceil(hTotal / HIST_PAGE_SIZE))

  // ─────────────────────────────────────────────────────────────────────────
  // PROFILE section
  // ─────────────────────────────────────────────────────────────────────────
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => { setProfileName(user?.name ?? '') }, [user?.name])

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { toast.error('Name is required'); return }
    setSavingProfile(true)
    try {
      await authApi.updateProfile({ name: profileName.trim() })
      const res = await authApi.getCurrentUser()
      if (res.data.data) dispatch(setUser(res.data.data))
      toast.success('Profile updated')
    } catch { toast.error('Failed to update profile') }
    finally { setSavingProfile(false) }
  }

  const userHasPassword = user?.hasPassword !== false   // treat undefined as true (legacy)

  const handleChangePassword = async () => {
    if (userHasPassword && !pwForm.current) { toast.error('Enter your current password'); return }
    if (pwForm.next.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setSavingPw(true)
    try {
      await authApi.changePassword({
        currentPassword: userHasPassword ? pwForm.current : undefined,
        newPassword: pwForm.next,
      })
      toast.success(userHasPassword ? 'Password changed' : 'Password set successfully')
      setPwForm({ current: '', next: '', confirm: '' })
      // Refresh user so hasPassword flips to true
      const res = await authApi.getCurrentUser()
      if (res.data?.data) dispatch(setUser(res.data.data))
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? (userHasPassword ? 'Current password is incorrect' : 'Failed to set password')
      toast.error(msg)
    }
    finally { setSavingPw(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPANY section
  // ─────────────────────────────────────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState({
    title: tenant?.title ?? '', phone: tenant?.phone ?? '',
    email: tenant?.email ?? '', country: tenant?.country ?? '', currency: tenant?.currency ?? '',
  })
  const [savingCompany, setSavingCompany] = useState(false)

  useEffect(() => {
    if (tenant) {
      setCompanyForm({
        title: tenant.title ?? '', phone: tenant.phone ?? '',
        email: tenant.email ?? '', country: tenant.country ?? '', currency: tenant.currency ?? '',
      })
    }
  }, [tenant?.id])

  const handleSaveCompany = async () => {
    if (!companyForm.title.trim()) { toast.error('Company name is required'); return }
    setSavingCompany(true)
    try {
      await tenantApi.updateTenant(companyForm)
      dispatch(setTenant({
        id: tenant!.id,
        title: companyForm.title,
        businessType: tenant?.businessType ?? '',
        industryType: tenant?.industryType ?? '',
        modules: tenant?.modules ?? [],
        phone: companyForm.phone,
        email: companyForm.email,
        country: companyForm.country,
        currency: companyForm.currency,
        createdAt: tenant?.createdAt,
        plan: tenant?.plan,
      }))
      toast.success('Company settings saved')
    } catch { toast.error('Failed to save company settings') }
    finally { setSavingCompany(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPANY LIMITS section (TenantSettings)
  // ─────────────────────────────────────────────────────────────────────────
  const [limitsForm, setLimitsForm] = useState({
    maxLocations: tenant?.maxLocations ?? 1,
    maxEmployees: tenant?.maxEmployees ?? 5,
    timeZoneId:   tenant?.timeZoneId ?? '',
    logoUrl:      tenant?.logoUrl ?? '',
  })
  const [savingLimits, setSavingLimits] = useState(false)

  useEffect(() => {
    if (tenant) {
      setLimitsForm({
        maxLocations: (tenant as any).maxLocations ?? 1,
        maxEmployees: (tenant as any).maxEmployees ?? 5,
        timeZoneId:   (tenant as any).timeZoneId ?? '',
        logoUrl:      (tenant as any).logoUrl ?? '',
      })
    }
  }, [tenant?.id])

  const handleSaveLimits = async () => {
    setSavingLimits(true)
    try {
      await tenantApi.updateTenantSettings({
        maxLocations: limitsForm.maxLocations,
        maxEmployees: limitsForm.maxEmployees,
        timeZoneId:   limitsForm.timeZoneId || undefined,
        logoUrl:      limitsForm.logoUrl || undefined,
      })
      toast.success('Company limits saved')
    } catch { toast.error('Failed to save limits') }
    finally { setSavingLimits(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY SETTINGS section (InventorySettings)
  // ─────────────────────────────────────────────────────────────────────────
  const [invSettings, setInvSettings] = useState({
    defaultValuationMethod:          'FIFO',
    stockDeductionMode:              'OnSale',
    negativeStockPolicy:             'Allow',
    enableBinTracking:               false,
    enableSerialTracking:            false,
    enableBatchTracking:             false,
    enableAutoReorder:               false,
    lowStockNotificationEnabled:     false,
    requireManagerApprovalForWriteOff: false,
    requireSerialOnSale:             false,
    autoGenerateSku:                 false,
    deadStockDaysThreshold:          90,
  })
  const [loadingInv, setLoadingInv]   = useState(false)
  const [savingInv, setSavingInv]     = useState(false)

  useEffect(() => {
    if (!tenant?.id) return
    setLoadingInv(true)
    inventoryApi.getInventorySettings()
      .then((res) => {
        const d = res.data?.data
        if (d) setInvSettings({
          defaultValuationMethod:          d.defaultValuationMethod ?? 'FIFO',
          stockDeductionMode:              d.stockDeductionMode ?? 'OnSale',
          negativeStockPolicy:             d.negativeStockPolicy ?? 'Allow',
          enableBinTracking:               d.enableBinTracking ?? false,
          enableSerialTracking:            d.enableSerialTracking ?? false,
          enableBatchTracking:             d.enableBatchTracking ?? false,
          enableAutoReorder:               d.enableAutoReorder ?? false,
          lowStockNotificationEnabled:     d.lowStockNotificationEnabled ?? false,
          requireManagerApprovalForWriteOff: d.requireManagerApprovalForWriteOff ?? false,
          requireSerialOnSale:             d.requireSerialOnSale ?? false,
          autoGenerateSku:                 d.autoGenerateSku ?? false,
          deadStockDaysThreshold:          d.deadStockDaysThreshold ?? 90,
        })
      })
      .catch(() => {})
      .finally(() => setLoadingInv(false))
  }, [tenant?.id])

  const handleSaveInv = async () => {
    setSavingInv(true)
    try {
      await inventoryApi.updateInventorySettings({
        companyId:                         tenant!.id,
        defaultValuationMethod:            invSettings.defaultValuationMethod,
        stockDeductionMode:                invSettings.stockDeductionMode,
        negativeStockPolicy:               invSettings.negativeStockPolicy,
        enableBinTracking:                 invSettings.enableBinTracking,
        enableSerialTracking:              invSettings.enableSerialTracking,
        enableBatchTracking:               invSettings.enableBatchTracking,
        enableAutoReorder:                 invSettings.enableAutoReorder,
        lowStockNotificationEnabled:       invSettings.lowStockNotificationEnabled,
        requireManagerApprovalForWriteOff: invSettings.requireManagerApprovalForWriteOff,
        requireSerialOnSale:               invSettings.requireSerialOnSale,
        autoGenerateSku:                   invSettings.autoGenerateSku,
        deadStockDaysThreshold:            invSettings.deadStockDaysThreshold,
      })
      toast.success('Inventory settings saved')
    } catch { toast.error('Failed to save inventory settings') }
    finally { setSavingInv(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STORES section
  // ─────────────────────────────────────────────────────────────────────────
  const [stores, setLocalStores]       = useState<StoreRecord[]>(reduxStores)
  const [loadingStores, setLoadingStores] = useState(false)

  const [addOpen, setAddOpen]       = useState(false)
  const [addForm, setAddForm]       = useState<StoreFormState>(EMPTY_STORE_FORM)
  const [addErrors, setAddErrors]   = useState<Record<string, string>>({})
  const [adding, setAdding]         = useState(false)

  const [editStore, setEditStore]   = useState<StoreRecord | null>(null)
  const [editForm, setEditForm]     = useState<StoreFormState>(EMPTY_STORE_FORM)
  const [storeEmployees, setStoreEmployees] = useState<{ id: string; name: string; role?: string }[]>([])
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editing, setEditing]       = useState(false)

  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const isFree      = (tenant?.plan ?? 'free') === 'free'
  const atLimit     = isFree && stores.length >= FREE_STORE_LIMIT
  const daysLeft    = trialDaysLeft(tenant?.createdAt, stores.length)
  const trialExpired = daysLeft === 0

  useEffect(() => { setLocalStores(reduxStores) }, [reduxStores])

  const loadStores = async () => {
    if (!tenant?.id) return
    setLoadingStores(true)
    try {
      const res = await tenantApi.getStores(tenant.id)
      const raw: Record<string, unknown>[] = res.data.data ?? []
      const list = raw.map((s) => ({
        id:           String(s.id ?? ''),
        name:         String(s.title ?? s.name ?? ''),
        address:      String(s.address ?? ''),
        phone:        String(s.phone ?? ''),
        email:        String(s.email ?? ''),
        city:         String(s.city ?? ''),
        state:        String(s.state ?? ''),
        countryCode:  String(s.countryCode ?? s.country ?? ''),
        currencyCode: String(s.currencyCode ?? s.currency ?? ''),
        postalCode:   String(s.postalCode ?? ''),
        locationCode: String(s.locationCode ?? ''),
        type:         Number(s.type ?? 1),
        isDefault:    Boolean(s.isDefault),
        timeZoneId:   s.timeZoneId ? String(s.timeZoneId) : undefined,
      }))
      setLocalStores(list)
      dispatch(setStores(list))
    } catch { toast.error('Failed to load stores') }
    finally { setLoadingStores(false) }
  }

  useEffect(() => { if (tenant?.id) loadStores() }, [tenant?.id])

  const validateStore = (form: StoreFormState, setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>) => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Store name is required'
    if (!form.country)     e.country = 'Country is required'
    if (!form.currency)    e.currency = 'Currency is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const makeOnChange = (setter: React.Dispatch<React.SetStateAction<StoreFormState>>) =>
    (field: string) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setter((f) => {
          const updated = { ...f, [field]: e.target.value }
          if (field === 'country' && COUNTRY_CURRENCY[e.target.value]) {
            updated.currency = COUNTRY_CURRENCY[e.target.value]
          }
          return updated
        })

  const openAdd = () => {
    setAddForm({ ...EMPTY_STORE_FORM, phone: tenant?.phone ?? '', country: tenant?.country ?? '', currency: tenant?.currency ?? '' })
    setAddErrors({})
    setAddOpen(true)
  }

  const openEdit = (store: StoreRecord) => {
    setEditStore(store)
    setEditForm({
      name:               store.name ?? '',
      locationCode:       store.locationCode ?? '',
      type:               store.type != null ? String(store.type) : '1',
      phone:              store.phone ?? '',
      email:              store.email ?? '',
      address:            store.address ?? '',
      city:               store.city ?? '',
      state:              store.state ?? '',
      country:            store.countryCode ?? tenant?.country ?? '',
      currency:           store.currencyCode ?? tenant?.currency ?? '',
      postalCode:         store.postalCode ?? '',
      timeZoneId:         store.timeZoneId ?? '',
      managerEmployeeId:  store.managerEmployeeId ?? '',
    })
    setEditErrors({})
    // Load employees for the manager dropdown
    if (tenant?.id) {
      employeesApi.getEmployees({ companyId: tenant.id, locationId: store.id, isActive: true, pageSize: 200 })
        .then((res) => {
          const raw: Record<string, unknown>[] = res.data?.data?.items ?? res.data?.data ?? []
          setStoreEmployees(raw.map((e) => ({
            id: String(e.id ?? ''),
            name: String(e.name ?? e.fullName ?? ''),
            role: e.role ? String(e.role) : undefined,
          })))
        })
        .catch(() => setStoreEmployees([]))
    }
  }

  const handleAdd = async () => {
    if (!validateStore(addForm, setAddErrors) || !tenant?.id) return
    setAdding(true)
    try {
      const storeRes = await tenantApi.createStore({
        companyId:    tenant.id,
        title:        addForm.name.trim(),
        countryCode:  addForm.country || undefined,
        currencyCode: addForm.currency || undefined,
        locationCode: addForm.locationCode.trim() || undefined,
        type:         Number(addForm.type),
        phone:        addForm.phone.trim() || undefined,
        email:        addForm.email.trim() || undefined,
        address:      addForm.address.trim() || undefined,
        city:         addForm.city.trim() || undefined,
        state:        addForm.state.trim() || undefined,
        postalCode:   addForm.postalCode.trim() || undefined,
        timeZoneId:   addForm.timeZoneId || undefined,
        isDefault:    false,
      })
      const rawData    = storeRes.data?.data
      const newStoreId: string | undefined = rawData
        ? (typeof rawData === 'object' ? String(rawData.id ?? '') : String(rawData))
        : undefined

      // Auto-create in-store warehouse
      if (newStoreId) {
        const slug   = addForm.name.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
        inventoryApi.createWarehouse({
          companyId: tenant.id,
          name: `${addForm.name.trim()} - Stock Room`,
          code: `WH-${slug}-${suffix}`,
          type: 1,
          storeId: newStoreId,
          hasRackSystem: false,
        }).catch(() => {})
      }

      toast.success('Store added successfully')
      setAddOpen(false)
      await loadStores()
      if (newStoreId) dispatch(setCurrentStore(newStoreId))
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.errors?.[0] ?? err.response?.data?.message ?? 'Failed to add store')
        : 'Failed to add store'
      toast.error(typeof msg === 'string' ? msg : 'Failed to add store')
    } finally { setAdding(false) }
  }

  const handleEdit = async () => {
    if (!editStore || !validateStore(editForm, setEditErrors) || !tenant?.id) return
    setEditing(true)
    try {
      await tenantApi.updateStore(editStore.id, {
        title:        editForm.name.trim(),
        countryCode:  editForm.country || undefined,
        currencyCode: editForm.currency || undefined,
        locationCode: editForm.locationCode.trim() || undefined,
        type:         Number(editForm.type),
        phone:        editForm.phone.trim() || undefined,
        email:        editForm.email.trim() || undefined,
        address:      editForm.address.trim() || undefined,
        city:         editForm.city.trim() || undefined,
        state:        editForm.state.trim() || undefined,
        postalCode:   editForm.postalCode.trim() || undefined,
        timeZoneId:         editForm.timeZoneId || undefined,
        managerEmployeeId:  editForm.managerEmployeeId || undefined,
      })
      toast.success('Store updated successfully')
      setEditStore(null)
      await loadStores()
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.errors?.[0] ?? err.response?.data?.message ?? 'Failed to update store')
        : 'Failed to update store'
      toast.error(typeof msg === 'string' ? msg : 'Failed to update store')
    } finally { setEditing(false) }
  }

  const handleDelete = async (store: StoreRecord) => {
    if (stores.length <= 1) { toast.error('Cannot delete the only store'); return }
    if (store.isDefault)    { toast.error('Cannot delete the default store'); return }
    if (!confirm(`Delete "${store.name}"? This cannot be undone.`)) return
    setDeletingId(store.id)
    try {
      await tenantApi.deleteStore(store.id)
      toast.success('Store deleted')
      await loadStores()
    } catch { toast.error('Failed to delete store') }
    finally { setDeletingId(null) }
  }

  const handleSetDefault = async (storeId: string) => {
    setSettingDefaultId(storeId)
    try {
      await tenantApi.setDefaultStore(storeId)
      toast.success('Default store updated')
      await loadStores()
    } catch { toast.error('Failed to set default store') }
    finally { setSettingDefaultId(null) }
  }

  const badgeVariant  = trialExpired ? 'danger' : daysLeft <= 5 ? 'warning' : 'success'
  const badgeLabel    = trialExpired ? 'Trial Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const sub = overview?.subscription

  // Subscription panel (shared between tab and modals)
  const SubscriptionContent = (
    <div className="space-y-4">
      {sub ? (
        <>
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-lg text-gray-900 dark:text-white">{sub.planName}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{overview?.tenantName}</p>
              </div>
              <Badge variant={sub.status === 'Active' ? 'success' : sub.status === 'Trial' ? 'info' : 'danger'} size="md">{sub.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {([['Start Date', new Date(sub.startDate).toLocaleDateString()],['End Date', new Date(sub.endDate).toLocaleDateString()],['Next Billing', new Date(sub.nextBillingDate).toLocaleDateString()],['Locations', sub.totalLocations]] as [string, string|number][]).map(([label, val]) => (
                <div key={label} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-lg text-gray-900 dark:text-white">Free Trial</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{overview?.tenantName ?? 'Your business'}</p>
              </div>
              <Badge variant="success" size="md">Active</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Trial Ends</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">30 days from signup</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Stores</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">Up to 2 locations</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {['POS transactions','Inventory management','Client management','Sales & inventory reports','Email support'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                </span>
                {f}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="relative group inline-block">
        <Button variant="primary" disabled icon={<Lock className="w-4 h-4" />}>Upgrade Plan</Button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
            Contact support to upgrade
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400">Contact <span className="text-blue-500">support@flowtap.io</span> to upgrade</p>
    </div>
  )

  return (
    <div className="space-y-8 pb-20">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {overview?.tenantName} · {overview?.businessType} · {overview?.country}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm"
            icon={<RefreshCw className={`w-4 h-4 ${loadingOv ? 'animate-spin' : ''}`} />}
            onClick={fetchOverview} disabled={loadingOv}>
            Refresh
          </Button>
          <Button
            variant={showSettings ? 'primary' : 'outline'}
            size="sm"
            icon={showSettings ? <X className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
            onClick={() => setShowSettings(s => !s)}>
            {showSettings ? 'Close' : 'Settings'}
          </Button>
        </div>
      </div>

      {/* ── In-App Broadcast Messages ── */}
      {broadcasts.length > 0 && (
        <section>
          <SectionHeading>Messages</SectionHeading>
          <div className="space-y-2">
            {broadcasts.map(b => {
              const s = SEVERITY_STYLE[b.severity] ?? SEVERITY_STYLE.Information
              return (
                <div
                  key={b.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border ${s.bg} ${s.border}`}
                >
                  <span className={s.text}>{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${s.text}`}>{b.subject}</p>
                    {b.message && (
                      <p className={`text-sm mt-0.5 ${s.text} opacity-80`}>{b.message}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {b.sentBy}
                      {' · '}
                      {b.locationId ? 'This store' : 'All stores'}
                      {' · '}
                      {b.createdAt
                        ? new Date(b.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismissBroadcast(b.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Business Stat Cards ── */}
      {overview && (
        <>
          <section>
            <SectionHeading>Business Overview</SectionHeading>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={<Store     className="w-6 h-6" />} label="Total Stores"  value={overview.totalStores}                         iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
              <StatCard icon={<Users     className="w-6 h-6" />} label="Employees"     value={overview.totalEmployees}                      iconBg="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
              <StatCard icon={<Package   className="w-6 h-6" />} label="Products"      value={overview.totalProducts}                       iconBg="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
              <StatCard icon={<Layers    className="w-6 h-6" />} label="Stock Qty"     value={(overview.totalStockQuantity ?? 0).toLocaleString()} iconBg="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" />
              <StatCard icon={<UserCheck className="w-6 h-6" />} label="Clients"       value={overview.totalClients}                        iconBg="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" />
              <StatCard icon={<Ticket    className="w-6 h-6" />} label="Open Tickets"  value={overview.openTickets}                         iconBg="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
            </div>
          </section>

          {/* ── Per-Store Revenue ── */}
          <section>
            <SectionHeading>Revenue by Store</SectionHeading>
            {overview.stores.length === 0 ? (
              <p className="text-sm text-gray-400">No store data yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overview.stores.map((store) => (
                  <Card key={store.id}>
                    <CardBody>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{store.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {store.countryCode && <span className="text-xs text-gray-400">{store.countryCode}</span>}
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                              {resolveCurrency(store.currencyCode ?? '', store.countryCode ?? '')}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                          (store.salesCount ?? 0) > 0
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                        }`}>
                          {(store.salesCount ?? 0) > 0
                            ? `${(store.salesCount ?? 0).toLocaleString()} sales`
                            : 'No sales yet'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { label: 'Today',      icon: <Calendar   className="w-3.5 h-3.5" />, value: store.revenueToday     ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
                          { label: 'This Month', icon: <TrendingUp className="w-3.5 h-3.5" />, value: store.revenueThisMonth ?? 0, color: 'text-blue-600 dark:text-blue-400' },
                          { label: 'All Time',   icon: <DollarSign className="w-3.5 h-3.5" />, value: store.revenueAllTime   ?? 0, color: 'text-violet-600 dark:text-violet-400' },
                        ]).map(({ label, icon, value, color }) => (
                          <div key={label} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
                            <div className={`flex items-center gap-1 mb-1 ${color}`}>{icon}</div>
                            <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                              {formatStoreCurrency(value, store.currencyCode ?? '', store.countryCode ?? '')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SETTINGS DRAWER — slides in from the right, overlays the page
          ════════════════════════════════════════════════════════════════════════ */}

      {/* Backdrop */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setShowSettings(false)} />
      )}

      {/* Drawer panel */}
      <div className={[
        'fixed inset-y-0 right-0 z-50 flex flex-col',
        'w-[600px] max-w-[95vw]',
        'bg-white dark:bg-gray-900',
        'border-l border-gray-200 dark:border-gray-700 shadow-2xl',
        'transition-transform duration-300 ease-in-out',
        showSettings ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={() => setShowSettings(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-2 overflow-x-auto flex-shrink-0">
          {([
            { id: 'account',        label: 'Account',        icon: <User         className="w-4 h-4" /> },
            { id: 'stores',         label: 'Stores',         icon: <Store        className="w-4 h-4" /> },
            { id: 'subscription',   label: 'Subscription',   icon: <Crown        className="w-4 h-4" /> },
            { id: 'payments',       label: 'Payments',       icon: <CreditCard   className="w-4 h-4" /> },
            { id: 'settings',       label: 'Settings',       icon: <Settings2    className="w-4 h-4" /> },
            { id: 'communications', label: 'Broadcast',      icon: <Send         className="w-4 h-4" /> },
          ] as { id: SettingsTab; label: string; icon: React.ReactNode }[]).map((tab) => (
            <button key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={[
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0',
                settingsTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              ].join(' ')}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable tab content */}
        <div className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">

          {/* ── Account tab: Company + My Profile inner sub-tabs ── */}
          {settingsTab === 'account' && (
            <div className="space-y-5">
              {/* Inner pill sub-tabs */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {([
                  { id: 'company',    label: 'Company',    icon: <Building2 className="w-3.5 h-3.5" /> },
                  { id: 'my-profile', label: 'My Profile', icon: <User      className="w-3.5 h-3.5" /> },
                ] as { id: AccountSubTab; label: string; icon: React.ReactNode }[]).map((st) => (
                  <button key={st.id}
                    onClick={() => setAccountSubTab(st.id)}
                    className={[
                      'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      accountSubTab === st.id
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    ].join(' ')}>
                    {st.icon}
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Company sub-tab */}
              {accountSubTab === 'company' && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Business Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                    <Input label="Company Name *" value={companyForm.title}
                      onChange={(e) => setCompanyForm(f => ({ ...f, title: e.target.value }))} placeholder="Your company name" />
                    <Input label="Phone" type="tel" value={companyForm.phone}
                      onChange={(e) => setCompanyForm(f => ({ ...f, phone: e.target.value }))} />
                    <Input label="Email" type="email" value={companyForm.email}
                      onChange={(e) => setCompanyForm(f => ({ ...f, email: e.target.value }))} />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
                      <select value={companyForm.country}
                        onChange={(e) => setCompanyForm(f => ({ ...f, country: e.target.value, currency: COUNTRY_CURRENCY[e.target.value] || f.currency }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                        <option value="">Select country</option>
                        {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                      <select value={companyForm.currency}
                        onChange={(e) => setCompanyForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                        <option value="">Select currency</option>
                        {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2 pt-1">
                      <Button variant="primary" loading={savingCompany} onClick={handleSaveCompany}>Save Business Details</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* My Profile sub-tab */}
              {accountSubTab === 'my-profile' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal info */}
                  <div className="space-y-4 max-w-md">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Personal Information</p>
                    <Input label="Display Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" />
                    <Input label="Email" type="email" value={user?.email ?? ''} readOnly disabled hint="Email cannot be changed." />
                    <Button variant="primary" loading={savingProfile} onClick={handleSaveProfile}>Save Changes</Button>
                  </div>

                  {/* Password section — adapts based on whether user has a password */}
                  <div className="space-y-4 max-w-md">
                    {!userHasPassword ? (
                      <>
                        {/* No password set yet — prompt to set one */}
                        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No password set</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Set a password so you can log in with email &amp; password.</p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Set Password</p>
                        <Input label="New Password" type="password" value={pwForm.next}
                          onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Minimum 6 characters" />
                        <Input label="Confirm Password" type="password" value={pwForm.confirm}
                          onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat password" />
                        <Button variant="primary" loading={savingPw} onClick={handleChangePassword}>Set Password</Button>
                      </>
                    ) : (
                      <>
                        {/* Password already set — show change form */}
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Change Password</p>
                        <Input label="Current Password" type="password" value={pwForm.current}
                          onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter current password" />
                        <Input label="New Password" type="password" value={pwForm.next}
                          onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Minimum 6 characters" />
                        <Input label="Confirm New Password" type="password" value={pwForm.confirm}
                          onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
                        <Button variant="outline" loading={savingPw} onClick={handleChangePassword}>Change Password</Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Settings tab: Company Limits + Inventory sub-tabs ── */}
          {settingsTab === 'settings' && (
            <div className="space-y-5">
              {/* Inner sub-tab bar */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {([
                  { id: 'company-limits', label: 'Company Settings', icon: <Building2 className="w-3.5 h-3.5" /> },
                  { id: 'inventory',      label: 'Inventory Settings', icon: <Package  className="w-3.5 h-3.5" /> },
                ] as { id: SettingsSubTab; label: string; icon: React.ReactNode }[]).map((st) => (
                  <button key={st.id}
                    onClick={() => setSettingsSubTab(st.id)}
                    className={[
                      'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      settingsSubTab === st.id
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    ].join(' ')}>
                    {st.icon}
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Company Limits sub-tab */}
              {settingsSubTab === 'company-limits' && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Company Limits</p>
                    <Badge variant={(tenant as any)?.isOnboardingComplete ? 'success' : 'warning'} size="sm">
                      {(tenant as any)?.isOnboardingComplete ? 'Setup Complete' : 'Setup Incomplete'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                    <Input label="Max Locations" type="number" min={1}
                      value={String(limitsForm.maxLocations)}
                      onChange={(e) => setLimitsForm(f => ({ ...f, maxLocations: Number(e.target.value) }))}
                      hint="Maximum stores/locations allowed" />
                    <Input label="Max Employees" type="number" min={1}
                      value={String(limitsForm.maxEmployees)}
                      onChange={(e) => setLimitsForm(f => ({ ...f, maxEmployees: Number(e.target.value) }))}
                      hint="Maximum employee accounts allowed" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Time Zone</label>
                      <select value={limitsForm.timeZoneId}
                        onChange={(e) => setLimitsForm(f => ({ ...f, timeZoneId: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white">
                        {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <Input label="Logo URL" value={limitsForm.logoUrl}
                        onChange={(e) => setLimitsForm(f => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="https://..." hint="Company logo image URL" />
                      {limitsForm.logoUrl && (
                        <img src={limitsForm.logoUrl} alt="Logo preview"
                          className="mt-2 h-10 w-auto rounded object-contain border border-gray-200 dark:border-gray-700"
                          onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      )}
                    </div>
                    <div className="md:col-span-2 pt-1">
                      <Button variant="primary" loading={savingLimits} onClick={handleSaveLimits}>Save Company Settings</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Inventory Settings sub-tab */}
              {settingsSubTab === 'inventory' && (
                <div>
                  {loadingInv ? (
                    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { label: 'Valuation Method',      key: 'defaultValuationMethod', opts: ['FIFO','LIFO','WeightedAverage'] },
                          { label: 'Stock Deduction Mode',  key: 'stockDeductionMode',     opts: ['OnSale','OnDelivery','Manual'] },
                          { label: 'Negative Stock Policy', key: 'negativeStockPolicy',    opts: ['Allow','Warn','Block'] },
                        ].map(({ label, key, opts }) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                            <select value={(invSettings as any)[key]}
                              onChange={(e) => setInvSettings(f => ({ ...f, [key]: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white">
                              {opts.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([
                          ['autoGenerateSku',                   'Auto-generate SKU'],
                          ['enableBinTracking',                 'Bin Tracking'],
                          ['enableSerialTracking',              'Serial Number Tracking'],
                          ['enableBatchTracking',               'Batch / Lot Tracking'],
                          ['enableAutoReorder',                 'Auto Reorder'],
                          ['lowStockNotificationEnabled',       'Low Stock Notifications'],
                          ['requireManagerApprovalForWriteOff', 'Manager Approval for Write-offs'],
                          ['requireSerialOnSale',               'Require Serial on Sale'],
                        ] as [keyof typeof invSettings, string][]).map(([key, label]) => {
                          const checked = Boolean(invSettings[key])
                          return (
                            <button key={key}
                              onClick={() => setInvSettings(f => ({ ...f, [key]: !f[key] }))}
                              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
                              {checked
                                ? <ToggleRight className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                : <ToggleLeft  className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="max-w-xs">
                        <Input label="Dead Stock Threshold (days)" type="number" min={1}
                          value={String(invSettings.deadStockDaysThreshold)}
                          onChange={(e) => setInvSettings(f => ({ ...f, deadStockDaysThreshold: Number(e.target.value) }))}
                          hint="Items not sold in this many days are considered dead stock" />
                      </div>
                      <Button variant="primary" loading={savingInv} onClick={handleSaveInv}>Save Inventory Settings</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Stores tab ── */}
          {settingsTab === 'stores' && (
            <div className="space-y-4">
              {/* Free Trial Banner */}
              {isFree && (
                <div className={['p-4 rounded-xl border flex items-start gap-3',
                  trialExpired ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                    : daysLeft <= 5 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700'
                    : 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800',
                ].join(' ')}>
                  <div className={['flex-shrink-0 mt-0.5',
                    trialExpired ? 'text-red-500' : daysLeft <= 5 ? 'text-amber-500' : 'text-blue-500'].join(' ')}>
                    {trialExpired || daysLeft <= 5 ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={['text-sm font-semibold',
                        trialExpired ? 'text-red-700 dark:text-red-400'
                          : daysLeft <= 5 ? 'text-amber-800 dark:text-amber-300'
                          : 'text-blue-800 dark:text-blue-300'].join(' ')}>
                        {trialExpired ? 'Free trial has expired' : 'Free Trial Active'}
                      </p>
                      <Badge variant={badgeVariant} size="sm">{badgeLabel}</Badge>
                    </div>
                    <p className={['text-xs mt-1',
                      trialExpired ? 'text-red-600 dark:text-red-400'
                        : daysLeft <= 5 ? 'text-amber-700 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'].join(' ')}>
                      {trialExpired ? 'Upgrade to continue using all features.'
                        : stores.length >= 2 ? `Using ${stores.length} of ${FREE_STORE_LIMIT} stores · ${daysLeft} days remaining`
                        : `${stores.length} of ${FREE_STORE_LIMIT} stores used`}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isFree ? `${stores.length} of ${FREE_STORE_LIMIT} locations` : `${stores.length} location${stores.length !== 1 ? 's' : ''}`}
                </p>
                <div className="flex items-center gap-2">
                  {atLimit && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Plan limit reached</span>}
                  <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
                    onClick={openAdd} disabled={atLimit || trialExpired}
                    title={atLimit ? 'Upgrade to add more stores' : trialExpired ? 'Trial expired' : 'Add new store'}>
                    Add Store
                  </Button>
                </div>
              </div>

              {loadingStores ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : stores.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No stores yet. Add your first store.</div>
              ) : (
                <div className="space-y-3">
                  {stores.map((store) => {
                    const storeOv = overview?.stores.find((s) => s.id === store.id)
                    return (
                      <div key={store.id}
                        className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                          <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 dark:text-white">{store.name}</p>
                            {store.isDefault && <Badge variant="info" size="sm">Default</Badge>}
                          </div>
                          {store.address && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{store.address}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {store.phone        && <span className="text-xs text-gray-400">{store.phone}</span>}
                            {store.countryCode  && <span className="text-xs text-gray-400">{store.countryCode}</span>}
                            {store.currencyCode && <span className="text-xs text-gray-400 font-medium">{store.currencyCode}</span>}
                            {store.timeZoneId   && <span className="text-xs text-gray-400">{store.timeZoneId}</span>}
                            {storeOv && (
                              <>
                                <span className="text-xs text-gray-400">{storeOv.employeeCount} staff</span>
                                <span className="text-xs text-gray-400">{storeOv.stockItemCount} products</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="success" size="sm">Active</Badge>
                          {!store.isDefault && (
                            <Button variant="outline" size="sm"
                              onClick={() => handleSetDefault(store.id)}
                              loading={settingDefaultId === store.id}>
                              Set Default
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => openEdit(store)} title="Edit store" />
                          {!store.isDefault && stores.length > 1 && (
                            <Button variant="ghost" size="sm"
                              icon={
                                deletingId === store.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              }
                              onClick={() => handleDelete(store)}
                              disabled={!!deletingId}
                              title="Delete store" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {isFree && stores.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2 mb-1">
                    {Array.from({ length: FREE_STORE_LIMIT }, (_, i) => (
                      <div key={i} className={['flex-1 h-2 rounded-full', i < stores.length ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'].join(' ')} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {stores.length}/{FREE_STORE_LIMIT} slots used
                    {stores.length < FREE_STORE_LIMIT && ` · ${FREE_STORE_LIMIT - stores.length} available`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Subscription tab ── */}
          {settingsTab === 'subscription' && SubscriptionContent}

          {/* ── Payments tab — Payment Accounts CRUD ── */}
          {settingsTab === 'payments' && (
            <div className="space-y-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Payment Accounts</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
                Company-wide accounts (Cash Drawers, Bank Terminals, Gateways). Map them to payment methods per store in <strong>Settings → Payments</strong>.
              </p>

              {/* Add Account form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={paForm.name}
                  onChange={(e) => setPaForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddPayAccount() }}
                  placeholder="Account name (e.g. Cash Drawer, Razorpay)"
                  className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={paForm.type}
                  onChange={(e) => setPaForm(f => ({ ...f, type: e.target.value }))}
                  className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Gateway">Gateway</option>
                  <option value="Wallet">Wallet</option>
                </select>
                <button
                  onClick={handleAddPayAccount}
                  disabled={savingPa || !paForm.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {savingPa
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Plus className="w-3.5 h-3.5" />
                  }
                  Add
                </button>
              </div>

              {/* Accounts list */}
              {loadingPayAcc ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : payAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <CreditCard className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">No payment accounts yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(['Cash', 'Bank', 'Gateway', 'Wallet'] as const).map((type) => {
                    const group = payAccounts.filter((a) => a.type === type)
                    if (group.length === 0) return null
                    const style = PA_STYLE[type]
                    return (
                      <div key={type}>
                        <div className={`flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-lg mb-1 w-fit ${style.color}`}>
                          {style.icon}
                          {style.label}
                        </div>
                        <div className="space-y-1 ml-1">
                          {group.map((acc) => (
                            <div key={acc.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
                              {paEditId === acc.id ? (
                                <input
                                  type="text"
                                  value={paEditName}
                                  onChange={(e) => setPaEditName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditPayAccount(acc.id); if (e.key === 'Escape') { setPaEditId(null); setPaEditName('') } }}
                                  className="flex-1 text-sm border border-blue-400 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
                                  autoFocus
                                />
                              ) : (
                                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{acc.name}</span>
                              )}
                              {!acc.isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">Inactive</span>
                              )}
                              <div className="flex items-center gap-1">
                                {paEditId === acc.id ? (
                                  <>
                                    <button
                                      onClick={() => handleEditPayAccount(acc.id)}
                                      disabled={savingPa}
                                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                      {savingPa
                                        ? <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        : <Check className="w-3.5 h-3.5" />
                                      }
                                    </button>
                                    <button
                                      onClick={() => { setPaEditId(null); setPaEditName('') }}
                                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => { setPaEditId(acc.id); setPaEditName(acc.name) }}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePayAccount(acc.id)}
                                      disabled={deletingPaId === acc.id}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      {deletingPaId === acc.id
                                        ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />
                                      }
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Communications tab: Broadcast + History ── */}
          {settingsTab === 'communications' && (
            <div className="space-y-4">
              {/* Sub-tab switcher */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {(['broadcast', 'history'] as const).map(t => (
                  <button key={t} onClick={() => setCommSubTab(t)}
                    className={[
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      commSubTab === t
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                    ].join(' ')}>
                    {t === 'broadcast' ? <><Send className="w-4 h-4" />Broadcast</> : <><History className="w-4 h-4" />History</>}
                  </button>
                ))}
              </div>

              {/* ── Broadcast sub-tab ── */}
              {commSubTab === 'broadcast' && (
                <div className="grid grid-cols-1 gap-5">
                  {/* Compose */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Compose Broadcast</h2>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subject</label>
                      <input type="text" value={bSubject} onChange={e => setBSubject(e.target.value)}
                        placeholder="e.g. Store closes early today at 5pm"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
                      <textarea value={bMessage} onChange={e => setBMessage(e.target.value)}
                        placeholder="Type your message here..." rows={4}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    {/* Channel — independent toggles, select any combination */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Send Via <span className="text-gray-400 font-normal normal-case">(select one or more)</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Email */}
                        <button onClick={() => setBSendEmail(v => !v)}
                          className={cn(
                            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                            bSendEmail
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                          )}>
                          <Mail className="w-4 h-4" />Email
                        </button>
                        {/* SMS */}
                        <button onClick={() => setBSendSms(v => !v)}
                          className={cn(
                            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                            bSendSms
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                          )}>
                          <MessageSquare className="w-4 h-4" />SMS
                        </button>
                        {/* In-App */}
                        <button onClick={() => setBSendApp(v => !v)}
                          className={cn(
                            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                            bSendApp
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                          )}>
                          <Bell className="w-4 h-4" />In-App
                        </button>
                      </div>
                      {/* Summary of selected */}
                      {(bSendEmail || bSendSms || bSendApp) && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          Sending via: {[bSendEmail && 'Email', bSendSms && 'SMS', bSendApp && 'In-App'].filter(Boolean).join(' + ')}
                        </p>
                      )}
                    </div>
                    {/* Severity */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Severity</label>
                      <div className="flex gap-2">
                        {([
                          { id: 'Information', icon: <Info className="w-4 h-4" />,          cls: 'border-blue-500  bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-300'  },
                          { id: 'Warning',     icon: <AlertTriangle className="w-4 h-4" />,  cls: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
                          { id: 'Alert',       icon: <Zap className="w-4 h-4" />,            cls: 'border-red-500   bg-red-50   dark:bg-red-900/20   text-red-700   dark:text-red-300'   },
                        ] as const).map(s => (
                          <button key={s.id} onClick={() => setBSeverity(s.id)}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                              bSeverity === s.id ? s.cls : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            )}>
                            {s.icon}{s.id}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Announcement Type */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Announcement Type</label>
                      <div className="flex gap-2">
                        {(['Notification', 'Banner', 'Popup'] as const).map(t => (
                          <button key={t} onClick={() => setBType(t)}
                            className={cn(
                              'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                              bType === t
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            )}>
                            {t === 'Notification' ? '🔔 Notification' : t === 'Banner' ? '📢 Banner' : '💬 Popup'}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {bType === 'Banner' ? 'Shows as a colored strip at top of app for all users' : bType === 'Popup' ? 'Shows as a modal overlay that users must dismiss' : 'Shows in Admin Overview and dashboard cards'}
                      </p>
                    </div>
                    {/* Priority */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Priority</label>
                      <div className="flex gap-2">
                        {([
                          { id: 'Low',      cls: 'border-gray-400  bg-gray-50  text-gray-700' },
                          { id: 'Normal',   cls: 'border-blue-500  bg-blue-50  text-blue-700' },
                          { id: 'High',     cls: 'border-amber-500 bg-amber-50 text-amber-700' },
                          { id: 'Critical', cls: 'border-red-500   bg-red-50   text-red-700' },
                        ] as const).map(p => (
                          <button key={p.id} onClick={() => setBPriority(p.id)}
                            className={cn(
                              'flex-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-all',
                              bPriority === p.id ? p.cls + ' dark:bg-opacity-20' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                            )}>
                            {p.id}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Target Store */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Store</label>
                      <select value={bLocationId} onChange={e => setBLocationId(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All Stores</option>
                        {bStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    {/* Date range (optional) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date (optional)</label>
                        <input type="datetime-local" value={bStartDate} onChange={e => setBStartDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">End Date (optional)</label>
                        <input type="datetime-local" value={bEndDate} onChange={e => setBEndDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <Button onClick={handleBroadcast}
                      disabled={bSending || !bSubject.trim() || !bMessage.trim()}
                      icon={bSending
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Send className="w-4 h-4" />}
                      className="w-full justify-center">
                      {bSending ? 'Sending…' : 'Send to Staff'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── History sub-tab ── */}
              {commSubTab === 'history' && (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex gap-1">
                      {['All', 'Email', 'Sms'].map(ch => (
                        <button key={ch} onClick={() => setHChannelFilter(ch === 'All' ? '' : ch)}
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
                            hChannelFilter === (ch === 'All' ? '' : ch)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'
                          )}>{ch}</button>
                      ))}
                    </div>
                    <div className="w-px bg-gray-200 dark:bg-gray-700 self-stretch" />
                    <div className="flex gap-1">
                      {['All', 'Pending', 'Sent', 'Failed'].map(st => (
                        <button key={st} onClick={() => setHStatusFilter(st === 'All' ? '' : st)}
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
                            hStatusFilter === (st === 'All' ? '' : st)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'
                          )}>{st}</button>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadHistory} className="ml-auto">Refresh</Button>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {hLoading ? (
                      <div className="flex items-center justify-center py-16 text-gray-400">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : hRecords.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
                        <History className="w-10 h-10 opacity-30" />
                        <p className="text-sm font-medium">No notifications found</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                <th className="px-4 py-3 text-left font-medium">Channel</th>
                                <th className="px-4 py-3 text-left font-medium">Recipient</th>
                                <th className="px-4 py-3 text-left font-medium">Subject</th>
                                <th className="px-4 py-3 text-left font-medium">Sent At</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                              {hRecords.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      {STATUS_ICON[r.status] ?? <Clock className="w-4 h-4 text-gray-400" />}
                                      <Badge variant={STATUS_VARIANT[r.status] ?? 'default'} size="sm">{r.status}</Badge>
                                    </div>
                                    {r.error && <p className="text-[11px] text-red-400 mt-0.5 truncate max-w-[120px]" title={r.error}>{r.error}</p>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                      {r.type === 'Email' ? <Mail className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                      <span className="text-xs font-medium">{r.type}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{r.recipient}</td>
                                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium text-xs">{r.subject}</td>
                                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                    {r.sentAt ? hFormatDate(r.sentAt) : <span className="text-gray-300">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                          <p className="text-xs text-gray-500">{hTotal} total · page {hPage} of {hTotalPages}</p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setHPage(p => Math.max(1, p - 1))} disabled={hPage === 1}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={() => setHPage(p => Math.min(hTotalPages, p + 1))} disabled={hPage >= hTotalPages}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Active Modules ── */}
      {overview && (
        <section>
          <SectionHeading>Active Modules</SectionHeading>
          <Card>
            <CardBody>
              {overview.activeModules.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {overview.activeModules.map((mod) => (
                    <span key={mod}
                      className={`text-sm font-medium px-3 py-1.5 rounded-full ${MODULE_COLORS[mod] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {mod}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No modules configured.</p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400">
                  Modules control which features appear in the sidebar. Configure them in
                </p>
                <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="mt-1 -ml-2 text-blue-500"
                  onClick={() => navigate('/settings')}>
                  Settings
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>
      )}

      {/* ── Add Store Modal ── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Store / Location" size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={adding} onClick={handleAdd}>Add Store</Button>
          </div>
        }>
        <>
          {isFree && stores.length === 1 && (
            <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Adding a second store on the free plan reduces your trial to <strong>15 days total</strong>.
              </p>
            </div>
          )}
          <StoreFormFields form={addForm} errors={addErrors} onChange={makeOnChange(setAddForm)} isAdd />
        </>
      </Modal>

      {/* ── Edit Store Modal ── */}
      <Modal open={!!editStore} onClose={() => setEditStore(null)} title="Edit Store" size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditStore(null)}>Cancel</Button>
            <Button variant="primary" loading={editing} onClick={handleEdit}>Save Changes</Button>
          </div>
        }>
        <StoreFormFields form={editForm} errors={editErrors} onChange={makeOnChange(setEditForm)} />

        {/* Store Manager — shown only in edit (employee must already be assigned to this store) */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Store Manager <span className="text-xs font-normal text-gray-400">(optional — used for stock alert routing)</span>
          </label>
          <select
            value={editForm.managerEmployeeId}
            onChange={(e) => setEditForm((f) => ({ ...f, managerEmployeeId: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white"
          >
            <option value="">No manager assigned</option>
            {storeEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.role ? `${e.name} — ${e.role}` : e.name}
              </option>
            ))}
          </select>
          {storeEmployees.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Assign employees to this store first via the Employees page.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
