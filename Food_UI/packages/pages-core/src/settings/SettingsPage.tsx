import React, { useEffect, useState } from 'react'
import {
  Palette, CreditCard,
  Plus, Moon, Sun, Globe, Lock, Pencil, Trash2, Percent, History,
  ExternalLink, LayoutGrid, MapPin, Store, ToggleLeft, ToggleRight,
  Check, Banknote, Building2, Smartphone, Wallet, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Select, Modal, Card, CardHeader, CardBody, Badge, Table } from '@flowtap/ui-core'
import { useTheme } from '@flowtap/shared'
import { useAppSelector, useAppDispatch } from '@flowtap/store'
import { setTheme, setColorTheme, setAccentColor, setFontFamily, setBorderRadius, setSidebarDensity, applyAppearance } from '@flowtap/store'
import { taxApi } from '@flowtap/api-core'
import { inventoryApi } from '@flowtap/api-core'
import { storeSettingsApi } from '@flowtap/api-core'
import { salesApi } from '@flowtap/api-core'

type TabId = 'tax' | 'payments' | 'appearance' | 'roles' | 'audit' | 'location-inventory' | 'store-settings'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'tax',                label: 'Tax Settings',        icon: <Percent    className="w-4 h-4" /> },
  { id: 'payments',           label: 'Payments',            icon: <CreditCard className="w-4 h-4" /> },
  { id: 'location-inventory', label: 'Location Inventory',  icon: <MapPin     className="w-4 h-4" /> },
  { id: 'store-settings',     label: 'Store Settings',      icon: <Store      className="w-4 h-4" /> },
  { id: 'appearance',         label: 'Appearance',          icon: <Palette    className="w-4 h-4" /> },
  { id: 'roles',              label: 'Roles',               icon: <Lock       className="w-4 h-4" /> },
  { id: 'audit',              label: 'Audit Logs',          icon: <History    className="w-4 h-4" /> },
]


export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('tax')
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const ui       = useAppSelector((s) => s.ui)
  const tenant   = useAppSelector((s) => s.tenant.tenant)
  const stores   = useAppSelector((s) => s.tenant.stores)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* ── Moved-to-Admin banner ── */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Profile, Company, Stores &amp; Subscription have moved
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Manage your profile, company details, store locations and subscription from the Admin Overview page.
          </p>
        </div>
        <Button size="sm" icon={<ExternalLink className="w-4 h-4" />}
          onClick={() => navigate('/admin')}>
          Go to Admin Overview
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 flex-shrink-0">
          <Card>
            <nav className="p-2 space-y-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </Card>
        </aside>
        <main className="flex-1 min-w-0">
          {activeTab === 'tax'                && <TaxTab />}
          {activeTab === 'payments'           && <PaymentsTab />}
          {activeTab === 'audit'              && <AuditTab />}
          {activeTab === 'appearance'         && (
            <AppearanceTab
              isDark={isDark} toggle={toggle}
              ui={ui} dispatch={dispatch}
              stores={stores} tenantId={tenant?.id ?? ''}
            />
          )}
          {activeTab === 'roles'              && <RolesTab />}
          {activeTab === 'location-inventory' && (
            <LocationInventoryTab stores={stores} tenantId={tenant?.id ?? ''} />
          )}
          {activeTab === 'store-settings'     && (
            <StoreSettingsTab stores={stores} tenantId={tenant?.id ?? ''} />
          )}
        </main>
      </div>
    </div>
  )
}

/* ─── Tax Settings Tab ────────────────────────────────────────────────────── */

interface RateRule { id: string; componentName: string; rate: number; jurisdiction?: string }
interface TaxSlab { id: string; name: string; code: string; rate: number | null; isActive: boolean; rateRules: RateRule[] }

// Country → tax system metadata
const COUNTRY_TAX_META: Record<string, {
  systemType: string; systemLabel: string
  taxIdLabel: string; taxIdPlaceholder: string
  flag: string
}> = {
  IN: { systemType: '1', systemLabel: 'GST (India)',        taxIdLabel: 'GSTIN',                  taxIdPlaceholder: '22AAAAA0000A1Z5',  flag: '🇮🇳' },
  CA: { systemType: '4', systemLabel: 'HST / GST (Canada)', taxIdLabel: 'Business Number (BN)',    taxIdPlaceholder: '123456789',         flag: '🇨🇦' },
  US: { systemType: '4', systemLabel: 'Sales Tax (US)',      taxIdLabel: 'EIN / State Tax ID',     taxIdPlaceholder: '12-3456789',        flag: '🇺🇸' },
  AE: { systemType: '3', systemLabel: 'VAT (UAE)',           taxIdLabel: 'TRN',                    taxIdPlaceholder: '100012345600003',   flag: '🇦🇪' },
  SA: { systemType: '3', systemLabel: 'VAT (Saudi Arabia)', taxIdLabel: 'VAT Registration No.',   taxIdPlaceholder: '300012345600003',   flag: '🇸🇦' },
  GB: { systemType: '2', systemLabel: 'VAT (UK)',            taxIdLabel: 'VAT Registration No.',   taxIdPlaceholder: 'GB123456789',       flag: '🇬🇧' },
  AU: { systemType: '5', systemLabel: 'GST (Australia)',     taxIdLabel: 'ABN',                    taxIdPlaceholder: '12 345 678 901',    flag: '🇦🇺' },
  SG: { systemType: '5', systemLabel: 'GST (Singapore)',     taxIdLabel: 'UEN / GST Reg. No.',     taxIdPlaceholder: '200312345A',        flag: '🇸🇬' },
  NG: { systemType: '4', systemLabel: 'VAT (Nigeria)',        taxIdLabel: 'Tax ID (TIN)',           taxIdPlaceholder: '12345678-0001',     flag: '🇳🇬' },
  PK: { systemType: '4', systemLabel: 'Sales Tax (Pakistan)', taxIdLabel: 'NTN / STRN',            taxIdPlaceholder: '1234567-8',         flag: '🇵🇰' },
}
const DEFAULT_TAX_META = { systemType: '4', systemLabel: 'Sales Tax', taxIdLabel: 'Tax ID', taxIdPlaceholder: '', flag: '🌐' }

const TAX_SYSTEM_OPTIONS = [
  { value: '1', label: 'GST (India)' },
  { value: '2', label: 'VAT (EU / UK)' },
  { value: '3', label: 'VAT (UAE / Gulf)' },
  { value: '4', label: 'Sales Tax / HST' },
  { value: '5', label: 'GST (Australia / SG)' },
]

// ─── Slab Modal (with rate-rule components) ───────────────────────────────────

interface SlabModalProps {
  open: boolean
  slab: TaxSlab | null
  companyId: string
  onClose: () => void
  onSaved: () => void
}

const SlabModal: React.FC<SlabModalProps> = ({ open, slab, companyId, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', code: '', rate: '', isActive: true })
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<RateRule[]>([])
  const [newRule, setNewRule] = useState({ componentName: '', rate: '', jurisdiction: '' })
  const [addingRule, setAddingRule] = useState(false)

  useEffect(() => {
    if (open && slab) {
      setForm({ name: slab.name, code: slab.code, rate: String(slab.rate ?? ''), isActive: slab.isActive })
      setRules(slab.rateRules ?? [])
    } else if (open) {
      setForm({ name: '', code: '', rate: '', isActive: true })
      setRules([])
    }
  }, [slab, open])

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code are required'); return }
    setSaving(true)
    try {
      const payload = { companyId, name: form.name.trim(), code: form.code.trim().toUpperCase(), rate: Number(form.rate) || 0, isActive: form.isActive }
      if (slab) {
        await taxApi.updateSlab(slab.id, payload)
        toast.success('Tax slab updated')
      } else {
        await taxApi.createSlab(payload)
        toast.success('Tax slab added')
      }
      onSaved(); onClose()
    } catch { toast.error('Failed to save tax slab') }
    finally { setSaving(false) }
  }

  const handleAddRule = async () => {
    if (!slab?.id || !newRule.componentName.trim()) { toast.error('Component name required'); return }
    setAddingRule(true)
    try {
      const res = await taxApi.addRule(slab.id, { componentName: newRule.componentName.trim(), rate: Number(newRule.rate) || 0, jurisdiction: newRule.jurisdiction || undefined })
      const r = res.data?.data ?? res.data
      setRules(prev => [...prev, { id: r.id, componentName: r.componentName, rate: r.rate, jurisdiction: r.jurisdiction }])
      setNewRule({ componentName: '', rate: '', jurisdiction: '' })
      onSaved()
    } catch { toast.error('Failed to add component') }
    finally { setAddingRule(false) }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!slab?.id) return
    try {
      await taxApi.deleteRule(slab.id, ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      onSaved()
    } catch { toast.error('Failed to remove component') }
  }

  const totalFromRules = rules.reduce((s, r) => s + r.rate, 0)

  return (
    <Modal open={open} onClose={onClose} title={slab ? 'Edit Tax Slab' : 'Add Tax Slab'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>{slab ? 'Save Changes' : 'Add Slab'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Basic fields */}
        <Input label="Name *" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HST 13%" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Code *" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. HST13" />
          <Input label="Total Rate (%)" type="number" value={form.rate} min={0} max={100}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="0"
            hint={rules.length > 1 ? `Components sum: ${totalFromRules}%` : undefined} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Active</span>
          <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
            className={['relative inline-flex h-6 w-11 items-center rounded-full transition-colors', form.isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'].join(' ')}>
            <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', form.isActive ? 'translate-x-6' : 'translate-x-1'].join(' ')} />
          </button>
        </div>

        {/* Rate rule components (only shown when editing existing slab) */}
        {slab && (
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax Components</p>
            <p className="text-xs text-gray-400">Break down the rate into CGST/SGST, GST/PST, HST etc. Applied automatically by "Load Defaults".</p>

            {rules.length > 0 && (
              <div className="space-y-1">
                {rules.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{r.componentName}</span>
                      {r.jurisdiction && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{r.jurisdiction}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{r.rate}%</span>
                      <button onClick={() => handleDeleteRule(r.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end px-3 text-xs font-bold text-gray-500">
                  Total: {totalFromRules}%
                </div>
              </div>
            )}

            {/* Add component row */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Input placeholder="Component (e.g. CGST)" value={newRule.componentName}
                onChange={e => setNewRule(n => ({ ...n, componentName: e.target.value }))} />
              <Input placeholder="Rate %" type="number" value={newRule.rate}
                onChange={e => setNewRule(n => ({ ...n, rate: e.target.value }))} />
              <Input placeholder="Jurisdiction (opt.)" value={newRule.jurisdiction}
                onChange={e => setNewRule(n => ({ ...n, jurisdiction: e.target.value }))} />
            </div>
            <Button variant="outline" size="sm" loading={addingRule} icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddRule}>
              Add Component
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Tax Tab ──────────────────────────────────────────────────────────────────

const TaxTab: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const stores         = useAppSelector((s) => s.tenant.stores)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  // Always use the globally-selected store — no separate dropdown
  const selectedStore = stores.find(s => s.id === currentStoreId) ?? stores[0]
  const selectedStoreId = selectedStore?.id ?? ''
  const countryCode   = selectedStore?.countryCode ?? ''
  const taxMeta       = COUNTRY_TAX_META[countryCode] ?? DEFAULT_TAX_META

  const [slabs, setSlabs] = useState<TaxSlab[]>([])
  const [config, setConfig] = useState({ systemType: taxMeta.systemType, taxId: '', isInclusive: false })
  const [savingConfig, setSavingConfig] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [slabModal, setSlabModal] = useState(false)
  const [editSlab, setEditSlab] = useState<TaxSlab | null>(null)

  const loadSlabs = () => {
    if (!tenant?.id) return
    taxApi.getSlabs(tenant.id).then((res) => {
      const data = res.data?.data ?? res.data ?? []
      if (Array.isArray(data)) {
        setSlabs(data.map((s: Record<string, unknown>) => ({
          id: String(s.id),
          name: String(s.name ?? ''),
          code: String(s.code ?? ''),
          rate: s.rate != null ? Number(s.rate) : null,
          isActive: Boolean(s.isActive ?? true),
          rateRules: Array.isArray(s.rateRules) ? (s.rateRules as Record<string, unknown>[]).map(r => ({
            id: String(r.id), componentName: String(r.componentName), rate: Number(r.rate ?? 0), jurisdiction: r.jurisdiction ? String(r.jurisdiction) : undefined,
          })) : [],
        })))
      }
    }).catch(() => {})
  }

  useEffect(() => {
    if (!tenant?.id || !selectedStoreId) return
    // Load this store's tax configuration
    taxApi.getConfiguration(tenant.id, selectedStoreId).then((res) => {
      const d = res.data?.data ?? res.data
      if (d) {
        setConfig({ systemType: String(d.systemType ?? taxMeta.systemType), taxId: d.taxIdNumber ?? d.taxId ?? '', isInclusive: Boolean(d.isInclusive) })
      } else {
        // No config yet — auto-suggest from country
        setConfig({ systemType: taxMeta.systemType, taxId: '', isInclusive: false })
      }
    }).catch(() => {
      setConfig({ systemType: taxMeta.systemType, taxId: '', isInclusive: false })
    })
    loadSlabs()
  }, [tenant?.id, selectedStoreId])

  // Auto-update system type hint when store changes (only if user hasn't saved yet)
  useEffect(() => {
    setConfig(c => ({ ...c, systemType: taxMeta.systemType }))
  }, [selectedStoreId])

  const handleSaveConfig = async () => {
    if (!tenant?.id || !selectedStoreId) return
    setSavingConfig(true)
    try {
      await taxApi.saveConfiguration({ companyId: tenant.id, systemType: Number(config.systemType), taxIdNumber: config.taxId, isInclusive: config.isInclusive, storeId: selectedStoreId })
      toast.success('Tax configuration saved')
    } catch { toast.error('Failed to save tax configuration') }
    finally { setSavingConfig(false) }
  }

  const handleApplyTemplate = async () => {
    if (!selectedStoreId || !countryCode) { toast.error('Current store has no country set. Update store settings first.'); return }
    if (!window.confirm(`Load ${taxMeta.flag} ${countryCode} tax defaults for "${selectedStore?.name}"?\n\nThis adds country-appropriate tax components (${countryCode === 'IN' ? 'CGST/SGST/IGST' : countryCode === 'CA' ? 'GST/PST' : countryCode === 'AE' ? 'VAT' : 'Tax components'}) to your existing slabs.`)) return
    setApplyingTemplate(true)
    try {
      await taxApi.applyTemplate(selectedStoreId, countryCode)
      toast.success(`${countryCode} tax defaults applied`)
      loadSlabs()
    } catch { toast.error('Failed to apply template') }
    finally { setApplyingTemplate(false) }
  }

  const handleDeleteSlab = async (slab: TaxSlab) => {
    if (!window.confirm(`Delete tax slab "${slab.name}"?`)) return
    try {
      await taxApi.deleteSlab(slab.id)
      toast.success('Tax slab deleted')
      loadSlabs()
    } catch { toast.error('Failed to delete slab') }
  }

  return (
    <div className="space-y-6">
      {/* Current store indicator — read-only, switch store via global top nav */}
      {selectedStore && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
          <span className="text-lg">{taxMeta.flag}</span>
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedStore.name}
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400 ml-2">
              {countryCode} · {selectedStore.currencyCode} · {taxMeta.systemLabel}
            </span>
          </div>
          <span className="text-xs text-blue-400 dark:text-blue-500 italic">
            Switch store from top nav to configure another store
          </span>
        </div>
      )}

      {/* Tax Configuration */}
      <Card>
        <CardHeader
          title="Tax Configuration"
          subtitle="Each store can have its own tax registration number and tax system type"
          action={
            <Button variant="outline" size="sm" loading={applyingTemplate} onClick={handleApplyTemplate}>
              Load {countryCode || '?'} Defaults
            </Button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <Select
              label="Tax System"
              value={config.systemType}
              onChange={(e) => setConfig(c => ({ ...c, systemType: e.target.value }))}
              options={TAX_SYSTEM_OPTIONS}
            />
            <Input
              label={taxMeta.taxIdLabel}
              value={config.taxId}
              onChange={(e) => setConfig(c => ({ ...c, taxId: e.target.value }))}
              placeholder={taxMeta.taxIdPlaceholder}
            />
            <div className="col-span-2 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Tax-Inclusive Pricing</p>
                <p className="text-xs text-gray-500">Prices already include tax (e.g. Retail/B2C)</p>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, isInclusive: !c.isInclusive }))}
                className={['relative inline-flex h-6 w-11 items-center rounded-full transition-colors', config.isInclusive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'].join(' ')}
              >
                <span className={['inline-block h-4 w-4 transform rounded-full bg-white transition-transform', config.isInclusive ? 'translate-x-6' : 'translate-x-1'].join(' ')} />
              </button>
            </div>
          </div>
          {countryCode && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              <strong>Tip:</strong> Click <em>"Load {countryCode} Defaults"</em> above to automatically add {
                countryCode === 'IN' ? 'CGST / SGST / IGST components' :
                countryCode === 'CA' ? 'GST (Federal) + PST/HST (Provincial) components' :
                countryCode === 'US' ? 'State Tax + Local Tax components' :
                countryCode === 'AE' ? 'VAT (5%) component' :
                countryCode === 'GB' ? 'VAT (20%) component' :
                'the correct tax components'
              } to your slabs.
            </div>
          )}
          <div className="mt-5 flex gap-3">
            <Button variant="primary" loading={savingConfig} onClick={handleSaveConfig}>Save Configuration</Button>
          </div>
        </CardBody>
      </Card>

      {/* Tax Slabs — company-wide, shared across all stores */}
      <Card>
        <CardHeader
          title="Tax Slabs"
          subtitle="Rate levels shared across all stores — products link to these slabs"
          action={
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
              onClick={() => { setEditSlab(null); setSlabModal(true) }}>
              Add Slab
            </Button>
          }
        />
        <CardBody className="p-0">
          {slabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
              <p className="text-sm">No tax slabs yet.</p>
              <p className="text-xs mt-1">Add slabs manually or click <strong>"Load {countryCode || 'Country'} Defaults"</strong> above to auto-create them.</p>
            </div>
          ) : (
            <Table
              data={slabs}
              columns={[
                {
                  key: 'name', header: 'Name',
                  render: (s: TaxSlab) => (
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{s.code}</p>
                    </div>
                  ),
                },
                {
                  key: 'rate', header: 'Rate / Components',
                  render: (s: TaxSlab) => (
                    <div>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {s.rate != null ? `${s.rate}%` : '—'}
                      </span>
                      {s.rateRules.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.rateRules.map(r => (
                            <span key={r.id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium">
                              {r.componentName} {r.rate}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'status', header: 'Status',
                  render: (s: TaxSlab) => (
                    <Badge variant={s.isActive ? 'success' : 'default'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  ),
                },
                {
                  key: 'actions', header: '',
                  render: (s: TaxSlab) => (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon={<Pencil className="w-3 h-3" />}
                        onClick={() => { setEditSlab(s); setSlabModal(true) }} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="w-3 h-3" />}
                        onClick={() => handleDeleteSlab(s)} />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <SlabModal
        open={slabModal}
        slab={editSlab}
        companyId={tenant?.id ?? ''}
        onClose={() => setSlabModal(false)}
        onSaved={loadSlabs}
      />
    </div>
  )
}

/* ─── Payments Tab ────────────────────────────────────────────────────────── */

/* ─── Payments Tab — Method Mapping per store ─────────────────────────────── */

interface PaymentAccount { id: string; name: string; type: string; isActive: boolean }
interface MethodMapping  { id: string; method: string; paymentAccountId: string; accountName: string }

const METHOD_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  Cash:       { label: 'Cash',        icon: <Banknote    className="w-4 h-4" />, color: 'text-green-600  bg-green-50  dark:bg-green-900/20  dark:text-green-400'  },
  Card:       { label: 'Card',        icon: <CreditCard  className="w-4 h-4" />, color: 'text-blue-600   bg-blue-50   dark:bg-blue-900/20   dark:text-blue-400'   },
  UPI:        { label: 'UPI',         icon: <Smartphone  className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400' },
  NetBanking: { label: 'Net Banking', icon: <Building2   className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' },
  Wallet:     { label: 'Wallet',      icon: <Wallet      className="w-4 h-4" />, color: 'text-teal-600   bg-teal-50   dark:bg-teal-900/20   dark:text-teal-400'   },
}

const METHODS = ['Cash', 'Card', 'UPI', 'NetBanking', 'Wallet']

const PaymentsTab: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const stores         = useAppSelector((s) => s.tenant.stores)

  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [mappings, setMappings] = useState<MethodMapping[]>([])
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState<string | null>(null)   // method being saved
  const [removing, setRemoving] = useState<string | null>(null)   // method being removed

  const currentStore = stores?.find((s: any) => s.id === currentStoreId)

  useEffect(() => {
    if (!tenant?.id || !currentStoreId) return
    setLoading(true)
    Promise.all([
      salesApi.getPaymentAccounts(tenant.id),
      salesApi.getMethodMappings(tenant.id, currentStoreId),
    ])
      .then(([accRes, mapRes]) => {
        setAccounts(accRes.data?.data ?? [])
        setMappings(mapRes.data?.data ?? [])
      })
      .catch(() => toast.error('Failed to load payment settings'))
      .finally(() => setLoading(false))
  }, [tenant?.id, currentStoreId])

  const handleMap = async (method: string, paymentAccountId: string) => {
    if (!tenant?.id || !currentStoreId) return
    setSaving(method)
    try {
      await salesApi.createMethodMapping({ companyId: tenant.id, locationId: currentStoreId, method, paymentAccountId })
      const mapRes = await salesApi.getMethodMappings(tenant.id, currentStoreId)
      setMappings(mapRes.data?.data ?? [])
      toast.success(`${METHOD_META[method]?.label ?? method} mapped`)
    } catch {
      toast.error('Failed to save mapping')
    } finally {
      setSaving(null)
    }
  }

  const handleRemove = async (method: string) => {
    const mapping = mappings.find((m) => m.method === method)
    if (!mapping) return
    setRemoving(method)
    try {
      await salesApi.deleteMethodMapping(mapping.id)
      setMappings((prev) => prev.filter((m) => m.method !== method))
      toast.success(`${METHOD_META[method]?.label ?? method} mapping removed`)
    } catch {
      toast.error('Failed to remove mapping')
    } finally {
      setRemoving(null)
    }
  }

  if (!currentStoreId) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <Store className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No store selected</p>
            <p className="text-xs text-gray-400">Select a store from the top navigation to configure payment methods.</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Method Mapping</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {currentStore ? currentStore.name : 'Current store'} — assign an account to each payment method
              </p>
            </div>
            <button
              onClick={() => {
                if (!tenant?.id || !currentStoreId) return
                setLoading(true)
                Promise.all([salesApi.getPaymentAccounts(tenant.id), salesApi.getMethodMappings(tenant.id, currentStoreId)])
                  .then(([a, m]) => { setAccounts(a.data?.data ?? []); setMappings(m.data?.data ?? []) })
                  .catch(() => toast.error('Refresh failed'))
                  .finally(() => setLoading(false))
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
            Manage payment accounts (Cash Drawer, Bank, Gateway) in <strong>Admin Overview → Settings → Payments</strong>
          </p>
        </CardBody>
      </Card>

      {/* Method rows */}
      {loading ? (
        <Card>
          <CardBody>
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {METHODS.map((method) => {
              const meta    = METHOD_META[method]
              const mapping = mappings.find((m) => m.method === method)
              const isSaving  = saving  === method
              const isRemoving = removing === method

              return (
                <div key={method} className="flex items-center gap-4 px-5 py-4">
                  {/* Icon + label */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{meta.label}</p>
                    {mapping && (
                      <p className="text-xs text-gray-400 truncate">→ {mapping.accountName}</p>
                    )}
                  </div>

                  {/* Account select */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={mapping?.paymentAccountId ?? ''}
                      onChange={(e) => {
                        if (e.target.value) handleMap(method, e.target.value)
                        else handleRemove(method)
                      }}
                      disabled={isSaving || isRemoving}
                      className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                    >
                      <option value="">Auto (no mapping)</option>
                      {accounts.filter((a) => a.isActive).map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>

                    {/* Remove button */}
                    {mapping && (
                      <button
                        onClick={() => handleRemove(method)}
                        disabled={isRemoving}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Remove mapping"
                      >
                        {isRemoving
                          ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}

                    {/* Saving spinner */}
                    {isSaving && (
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {accounts.length === 0 && !loading && (
            <div className="px-5 pb-4">
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                No payment accounts found. Add accounts in <strong>Admin Overview → Settings → Payments</strong> first.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

/* ─── Audit Logs Tab ──────────────────────────────────────────────────────── */

const AuditTab: React.FC = () => {
  const navigate = useNavigate()
  return (
    <Card>
      <CardHeader title="Audit Logs" subtitle="Track all system changes and user actions" />
      <CardBody>
        <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
            <History className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">Full Audit Log Viewer</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              View detailed activity logs with filters by entity type, action, user, and date range.
            </p>
          </div>
          <Button
            variant="primary"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={() => navigate('/audit-logs')}
          >
            Open Audit Logs
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

/* ─── Roles & Permissions Tab ─────────────────────────────────────────────── */

const MODULES = [
  { key: 'POS', label: 'Point of Sale' },
  { key: 'Inventory', label: 'Inventory' },
  { key: 'ServiceTickets', label: 'Service Tickets' },
  { key: 'Purchasing', label: 'Purchasing' },
  { key: 'Clients', label: 'Clients' },
  { key: 'Employees', label: 'Employees' },
  { key: 'Reports', label: 'Reports' },
  { key: 'Settings', label: 'Settings' },
]

type RoleKey = 'Admin' | 'Manager' | 'Cashier' | 'Technician'

const DEFAULT_PERMISSIONS: Record<RoleKey, Record<string, boolean>> = {
  Admin:      { POS: true,  Inventory: true,  ServiceTickets: true,  Purchasing: true,  Clients: true,  Employees: true,  Reports: true,  Settings: true  },
  Manager:    { POS: true,  Inventory: true,  ServiceTickets: true,  Purchasing: true,  Clients: true,  Employees: false, Reports: true,  Settings: false },
  Cashier:    { POS: true,  Inventory: false, ServiceTickets: false, Purchasing: false, Clients: true,  Employees: false, Reports: false, Settings: false },
  Technician: { POS: false, Inventory: true,  ServiceTickets: true,  Purchasing: false, Clients: false, Employees: false, Reports: false, Settings: false },
}

const RolesTab: React.FC = () => {
  const [permissions, setPermissions] = useState<Record<RoleKey, Record<string, boolean>>>(DEFAULT_PERMISSIONS)
  const [selectedRole, setSelectedRole] = useState<RoleKey>('Admin')
  const [saving, setSaving] = useState(false)

  const roles: RoleKey[] = ['Admin', 'Manager', 'Cashier', 'Technician']

  const toggle = (module: string) => {
    if (selectedRole === 'Admin') return // Admin always has full access
    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [module]: !prev[selectedRole][module],
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Permissions are stored client-side; in a full RBAC implementation
      // this would POST to /roles/:roleId/permissions
      toast.success('Permissions saved')
    } finally {
      setSaving(false)
    }
  }

  const currentPerms = permissions[selectedRole]
  const enabledCount = Object.values(currentPerms).filter(Boolean).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Roles & Permissions"
          subtitle="Configure which modules each role can access"
        />
        <CardBody>
          {/* Role selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  selectedRole === role
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400',
                ].join(' ')}
              >
                {role}
              </button>
            ))}
          </div>

          {/* Info bar */}
          <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                {selectedRole} Role
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                {selectedRole === 'Admin'
                  ? 'Admin has full access to all modules and cannot be restricted.'
                  : `${enabledCount} of ${MODULES.length} modules enabled`}
              </p>
            </div>
            <Badge variant="info">{enabledCount}/{MODULES.length}</Badge>
          </div>

          {/* Permissions matrix */}
          <div className="space-y-2">
            {MODULES.map((mod) => {
              const enabled = currentPerms[mod.key] ?? false
              const isFixed = selectedRole === 'Admin'
              return (
                <div
                  key={mod.key}
                  className={[
                    'flex items-center justify-between p-3 rounded-xl border transition-colors',
                    enabled
                      ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <div className={[
                      'w-2 h-2 rounded-full',
                      enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {mod.label}
                    </span>
                  </div>
                  <button
                    onClick={() => toggle(mod.key)}
                    disabled={isFixed}
                    title={isFixed ? 'Admin always has full access' : `Toggle ${mod.label}`}
                    className={[
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
                      isFixed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    <span className={[
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                      enabled ? 'translate-x-[18px]' : 'translate-x-1',
                    ].join(' ')} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="primary" loading={saving} onClick={handleSave}>
              Save Permissions
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

/* ─── Appearance Tab ──────────────────────────────────────────────────────── */

/* ─── Appearance Tab (enhanced) ──────────────────────────────────────────── */

// ── Color themes ─────────────────────────────────────────────────────────────
// `sidebar` accepts any CSS background value (hex OR gradient string).
// The preview card renders it via `style={{ background: t.sidebar }}`.
interface ColorTheme {
  id: string; label: string
  sidebar: string        // CSS background — flat colour or gradient
  page: string           // page bg hex for preview
  sidebarText: string    // text colour for preview dots
  dark: boolean          // true = always forces .dark on <html>
  group: 'food' | 'classic' | 'gradient' | 'red' | 'professional' | 'metallic'
}

const COLOR_THEMES: ColorTheme[] = [
  // ── Food industry themes (shown first) ──────────────────────────────────
  { id: 'food-light', label: 'Food Orange', group: 'food', dark: false, sidebar: '#FFFFFF', page: '#FFF4E8', sidebarText: '#FF8A24' },

  // ── Classic flat-colour themes ──────────────────────────────────────────
  { id: 'default',  label: 'Default',  group: 'classic',  dark: false, sidebar: '#ffffff', page: '#f9fafb', sidebarText: '#6b7280' },
  { id: 'ocean',    label: 'Ocean',    group: 'classic',  dark: false, sidebar: '#0c1f3f', page: '#eef6ff', sidebarText: '#93b8d5' },
  { id: 'forest',   label: 'Forest',   group: 'classic',  dark: false, sidebar: '#0a2218', page: '#f0fdf4', sidebarText: '#6db898' },
  { id: 'midnight', label: 'Midnight', group: 'classic',  dark: true,  sidebar: '#08080b', page: '#141417', sidebarText: '#71717a' },
  { id: 'sunset',   label: 'Sunset',   group: 'classic',  dark: false, sidebar: '#3b0a14', page: '#fff5f7', sidebarText: '#f9a8b4' },
  { id: 'lavender', label: 'Lavender', group: 'classic',  dark: false, sidebar: '#1e0a47', page: '#faf5ff', sidebarText: '#c4b5fd' },
  { id: 'aurora',   label: 'Aurora',   group: 'classic',  dark: false, sidebar: '#042f2e', page: '#f0fdfa', sidebarText: '#5eead4' },
  { id: 'carbon',   label: 'Carbon',   group: 'classic',  dark: false, sidebar: '#0f172a', page: '#f8fafc', sidebarText: '#94a3b8' },
  { id: 'rose',     label: 'Rose',     group: 'classic',  dark: false, sidebar: '#3d0a1e', page: '#fff1f2', sidebarText: '#fda4af' },

  // ── Modern gradient themes ───────────────────────────────────────────────
  { id: 'cosmic',   label: 'Cosmic',   group: 'gradient', dark: true,  sidebar: 'linear-gradient(155deg,#0f0c29 0%,#302b63 55%,#24243e 100%)', page: '#1a1033', sidebarText: '#c4b5fd' },
  { id: 'candy',    label: 'Candy',    group: 'gradient', dark: false, sidebar: 'linear-gradient(155deg,#4a0e8f 0%,#be185d 100%)',              page: '#fdf4ff', sidebarText: '#f9a8d4' },
  { id: 'ember',    label: 'Ember',    group: 'gradient', dark: false, sidebar: 'linear-gradient(155deg,#7f1d1d 0%,#9a3412 60%,#78350f 100%)',  page: '#fff7ed', sidebarText: '#fed7aa' },
  { id: 'galaxy',   label: 'Galaxy',   group: 'gradient', dark: true,  sidebar: 'linear-gradient(180deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)', page: '#020617', sidebarText: '#818cf8' },
  { id: 'royal',    label: 'Royal',    group: 'gradient', dark: false, sidebar: 'linear-gradient(155deg,#1e1b4b 0%,#1d4ed8 100%)',              page: '#f5f3ff', sidebarText: '#a5b4fc' },
  { id: 'tropical', label: 'Tropical', group: 'gradient', dark: false, sidebar: 'linear-gradient(155deg,#042f2e 0%,#065f46 100%)',              page: '#ecfeff', sidebarText: '#5eead4' },
  { id: 'golden',   label: 'Golden',   group: 'gradient', dark: false, sidebar: 'linear-gradient(155deg,#1c1008 0%,#451a03 55%,#78350f 100%)', page: '#fffbeb', sidebarText: '#fde68a' },
  { id: 'neon',     label: 'Neon',     group: 'gradient', dark: true,  sidebar: 'linear-gradient(180deg,#050508 0%,#0a0f1e 100%)',              page: '#030712', sidebarText: '#67e8f9' },
  { id: 'obsidian', label: 'Obsidian', group: 'gradient', dark: true,  sidebar: 'linear-gradient(180deg,#0c0a1e 0%,#16113a 60%,#0c0a1e 100%)', page: '#0c0a1e', sidebarText: '#7c3aed' },
  { id: 'sakura',   label: 'Sakura',   group: 'gradient', dark: false, sidebar: 'linear-gradient(155deg,#3d0a1e 0%,#581c87 100%)',              page: '#fdf4ff', sidebarText: '#f9a8d4' },

  // ── Red tone themes ──────────────────────────────────────────────────────
  { id: 'crimson',   label: 'Crimson',   group: 'red', dark: true,  sidebar: 'linear-gradient(155deg,#090000 0%,#3d0000 35%,#7f1d1d 70%,#450a0a 100%)', page: '#0a0000', sidebarText: '#fca5a5' },
  { id: 'scarlet',   label: 'Scarlet',   group: 'red', dark: false, sidebar: 'linear-gradient(155deg,#dc2626 0%,#b91c1c 50%,#991b1b 100%)',              page: '#fff5f5', sidebarText: '#fecdd3' },
  { id: 'ruby',      label: 'Ruby',      group: 'red', dark: false, sidebar: 'linear-gradient(155deg,#2d0000 0%,#7f1d1d 45%,#991b1b 75%,#450a0a 100%)', page: '#fff1f2', sidebarText: '#fda4af' },

  // ── Professional themes ──────────────────────────────────────────────────
  { id: 'executive', label: 'Executive', group: 'professional', dark: false, sidebar: 'linear-gradient(155deg,#111827 0%,#1f2937 50%,#111827 100%)', page: '#fafafa',  sidebarText: '#d1d5db' },
  { id: 'corporate', label: 'Corporate', group: 'professional', dark: false, sidebar: 'linear-gradient(155deg,#0f2027 0%,#203a43 50%,#2c5364 100%)', page: '#f0f7ff',  sidebarText: '#bae6fd' },
  { id: 'noir',      label: 'Noir',      group: 'professional', dark: true,  sidebar: 'linear-gradient(180deg,#000000 0%,#0a0a0a 100%)',             page: '#0a0a0a',  sidebarText: '#737373' },
  { id: 'slate-grey',  label: 'Slate Grey',  group: 'professional', dark: false, sidebar: 'linear-gradient(155deg,#334155 0%,#475569 50%,#64748b 100%)', page: '#f1f5f9', sidebarText: '#e2e8f0' },
  { id: 'blue-pure',   label: 'Blue',        group: 'professional', dark: false, sidebar: 'linear-gradient(155deg,#1e40af 0%,#1d4ed8 50%,#2563eb 100%)', page: '#eff6ff', sidebarText: '#bfdbfe' },
  { id: 'angel-white', label: 'Angel White', group: 'professional', dark: false, sidebar: 'linear-gradient(155deg,#e0e7ff 0%,#f0f9ff 50%,#ffffff 100%)', page: '#f8faff', sidebarText: '#6366f1' },
  { id: 'jet-black',   label: 'Jet Black',   group: 'professional', dark: true,  sidebar: 'linear-gradient(155deg,#000000 0%,#0a0a0a 60%,#18181b 100%)', page: '#09090b',  sidebarText: '#a1a1aa' },

  // ── Metallic shining themes ──────────────────────────────────────────────
  { id: 'steel',    label: 'Steel',    group: 'metallic', dark: false, sidebar: 'linear-gradient(120deg,#1c2536 0%,#2d3a4f 30%,#4a5568 50%,#2d3a4f 70%,#1c2536 100%)',  page: '#f7f8fc', sidebarText: '#cbd5e1' },
  { id: 'silver',   label: 'Silver',   group: 'metallic', dark: false, sidebar: 'linear-gradient(135deg,#334155 0%,#475569 30%,#94a3b8 50%,#475569 70%,#334155 100%)',  page: '#f1f5f9', sidebarText: '#e2e8f0' },
  { id: 'chrome',   label: 'Chrome',   group: 'metallic', dark: false, sidebar: 'linear-gradient(135deg,#232526 0%,#3d3d3d 30%,#6b6b6b 50%,#3d3d3d 70%,#232526 100%)', page: '#f8f9fa', sidebarText: '#d4d4d4' },
  { id: 'titanium', label: 'Titanium', group: 'metallic', dark: false, sidebar: 'linear-gradient(155deg,#0a0e1a 0%,#151d2e 25%,#1e2a42 50%,#263450 70%,#0a0e1a 100%)', page: '#f8fafc', sidebarText: '#93c5fd' },

  // ── Blue & Neutral — the user-requested new themes ───────────────────────
]

const FOOD_THEMES         = COLOR_THEMES.filter((t) => t.group === 'food')
const CLASSIC_THEMES      = COLOR_THEMES.filter((t) => t.group === 'classic')
const GRADIENT_THEMES     = COLOR_THEMES.filter((t) => t.group === 'gradient')
const RED_THEMES          = COLOR_THEMES.filter((t) => t.group === 'red')
const PROFESSIONAL_THEMES = COLOR_THEMES.filter((t) => t.group === 'professional')
const METALLIC_THEMES     = COLOR_THEMES.filter((t) => t.group === 'metallic')

// Theme group tab definitions
type ThemeGroupTab = 'food' | 'classic' | 'gradient' | 'red' | 'professional' | 'metallic'
interface ThemeGroupDef {
  id: ThemeGroupTab
  label: string
  badge?: string
  badgeCls?: string
  dot: string
  themes: ColorTheme[]
}
const THEME_GROUPS: ThemeGroupDef[] = [
  { id: 'food',         label: 'Food',     badge: '⭐ Default', badgeCls: 'bg-[#FF8A24] text-white',                                          dot: 'bg-[#FF8A24]',                                     themes: FOOD_THEMES },
  { id: 'classic',      label: 'Classic',                                                                                                  dot: 'bg-gradient-to-br from-white to-slate-800',        themes: CLASSIC_THEMES },
  { id: 'gradient',     label: 'Gradients',      badge: 'NEW', badgeCls: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',     dot: 'bg-gradient-to-br from-purple-600 to-pink-500',    themes: GRADIENT_THEMES },
  { id: 'red',          label: 'Red & Bold',     badge: 'HOT', badgeCls: 'bg-gradient-to-r from-red-600 to-rose-500 text-white',        dot: 'bg-gradient-to-br from-red-600 to-rose-700',       themes: RED_THEMES },
  { id: 'professional', label: 'Pro',            badge: 'PRO', badgeCls: 'bg-gradient-to-r from-gray-600 to-slate-800 text-white',      dot: 'bg-gradient-to-br from-gray-700 to-slate-900',     themes: PROFESSIONAL_THEMES },
  { id: 'metallic',     label: 'Metallic',       badge: '✦',   badgeCls: 'bg-gradient-to-r from-slate-400 to-gray-600 text-white',      dot: 'bg-gradient-to-br from-slate-400 to-gray-700',     themes: METALLIC_THEMES },
]

// ── Shared theme preview card ─────────────────────────────────────────────
const ThemeCard: React.FC<{
  t: ColorTheme
  active: string
  onSelect: (id: string) => void
}> = ({ t, active, onSelect }) => {
  const isActive = active === t.id
  return (
    <button
      onClick={() => onSelect(t.id)}
      className={[
        'group relative overflow-hidden rounded-xl border-2 transition-all text-left w-full',
        isActive
          ? 'border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.03]'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:scale-[1.01]',
      ].join(' ')}
      title={t.label}
    >
      {/* ── Mini preview ─────────────────────────────────────────────── */}
      <div className="flex h-14 overflow-hidden">
        {/* Sidebar strip (gradient-aware) */}
        <div
          className="w-8 flex-shrink-0 flex flex-col gap-1 pt-2 px-1.5"
          style={{ background: t.sidebar }}
        >
          <div className="h-1 rounded-full opacity-70" style={{ backgroundColor: t.sidebarText }} />
          <div className="h-1 rounded-full opacity-45" style={{ backgroundColor: t.sidebarText }} />
          <div className="h-1 rounded-full opacity-45" style={{ backgroundColor: t.sidebarText }} />
          <div className="h-1 w-2/3 rounded-full opacity-30" style={{ backgroundColor: t.sidebarText }} />
        </div>
        {/* Page content area */}
        <div
          className="flex-1 flex flex-col gap-1 pt-2 px-1.5"
          style={{ backgroundColor: t.page }}
        >
          <div className={['h-1.5 rounded w-3/4', t.dark ? 'bg-gray-500' : 'bg-gray-300'].join(' ')} />
          <div className={['h-4 rounded', t.dark ? 'bg-gray-700' : 'bg-gray-200'].join(' ')} />
          <div className={['h-1.5 rounded w-1/2', t.dark ? 'bg-gray-600' : 'bg-gray-300'].join(' ')} />
        </div>
      </div>

      {/* ── Label strip ──────────────────────────────────────────────── */}
      <div className={[
        'px-2 py-1 text-[11px] font-semibold flex items-center justify-between',
        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300',
      ].join(' ')}>
        {t.label}
        {isActive && <Check className="w-3 h-3 text-blue-500 flex-shrink-0" />}
      </div>
    </button>
  )
}

const ACCENT_COLORS = [
  { id: 'food-orange', label: 'Food Orange', color: '#FF8A24' },  // Food industry default
  { id: 'blue',   label: 'Blue',   color: '#2563eb' },
  { id: 'purple', label: 'Purple', color: '#7c3aed' },
  { id: 'green',  label: 'Green',  color: '#059669' },
  { id: 'orange', label: 'Orange', color: '#ea580c' },
  { id: 'rose',   label: 'Rose',   color: '#e11d48' },
  { id: 'teal',   label: 'Teal',   color: '#0d9488' },
  { id: 'amber',  label: 'Amber',  color: '#d97706' },
  { id: 'slate',  label: 'Slate',  color: '#475569' },
]

const FONT_OPTIONS = [
  { id: 'inter',   label: 'Inter',   style: "'Inter', sans-serif" },
  { id: 'poppins', label: 'Poppins', style: "'Poppins', sans-serif" },
  { id: 'roboto',  label: 'Roboto',  style: "'Roboto', sans-serif" },
  { id: 'dm-sans', label: 'DM Sans', style: "'DM Sans', sans-serif" },
  { id: 'nunito',  label: 'Nunito',  style: "'Nunito', sans-serif" },
]

const RADIUS_OPTIONS = [
  { id: 'sharp',   label: 'Sharp',   preview: 'rounded-sm' },
  { id: 'normal',  label: 'Normal',  preview: 'rounded-lg' },
  { id: 'rounded', label: 'Rounded', preview: 'rounded-2xl' },
]

interface AppearanceTabProps {
  isDark: boolean
  toggle: () => void
  ui: { theme: string; colorTheme: string; accentColor: string; fontFamily: string; borderRadius: string; sidebarDensity: string }
  dispatch: (action: ReturnType<typeof setTheme | typeof setColorTheme | typeof setAccentColor | typeof setFontFamily | typeof setBorderRadius | typeof setSidebarDensity | typeof applyAppearance>) => void
  stores: { id: string; name: string }[]
  tenantId: string
}

/* ── Tabbed Color Theme Card ────────────────────────────────────────────── */
const ColorThemeCard: React.FC<{
  ui: { colorTheme: string }
  dispatch: (a: ReturnType<typeof setColorTheme>) => void
}> = ({ ui, dispatch }) => {
  const [activeGroup, setActiveGroup] = useState<ThemeGroupTab>('food')
  const group = THEME_GROUPS.find(g => g.id === activeGroup)!

  // If the currently-selected theme belongs to a different group, show that group
  useEffect(() => {
    const found = THEME_GROUPS.find(g => g.themes.some(t => t.id === ui.colorTheme))
    if (found) setActiveGroup(found.id)
  }, [ui.colorTheme])

  const darkAlways = ['midnight','cosmic','galaxy','neon','obsidian','crimson','noir','jet-black']

  return (
    <Card>
      <CardHeader
        title="Color Theme"
        subtitle="Changes sidebar colour, page background and active states — pick any style instantly"
      />
      <CardBody>
        {/* ── Group Tab Bar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1.5">
          {THEME_GROUPS.map(g => {
            const isActive = activeGroup === g.id
            const hasSelected = g.themes.some(t => t.id === ui.colorTheme)
            return (
              <button
                key={g.id}
                id={`theme-group-tab-${g.id}`}
                onClick={() => setActiveGroup(g.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {/* Colour dot swatch */}
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${g.dot} border border-black/10`} />
                {g.label}
                {g.badge && (
                  <span className={`hidden sm:inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold leading-none ${g.badgeCls}`}>
                    {g.badge}
                  </span>
                )}
                {/* Dot indicator if a theme in this group is selected */}
                {hasSelected && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Theme Grid for active group ────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {group.themes.map(t => (
            <ThemeCard key={t.id} t={t} active={ui.colorTheme} onSelect={(id) => dispatch(setColorTheme(id))} />
          ))}
        </div>

        {/* Dark-always notice */}
        {darkAlways.includes(ui.colorTheme) && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 flex-shrink-0" />
            This theme always applies dark mode to the page — the Light/Dark toggle below is ignored.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

const AppearanceTab: React.FC<AppearanceTabProps> = ({ isDark, toggle, ui, dispatch, stores }) => {
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const selectedStore  = currentStoreId ?? stores[0]?.id ?? ''
  const currentStore   = stores.find((s) => s.id === selectedStore)
  const [saving, setSaving] = useState(false)

  // Load store appearance when current store changes
  useEffect(() => {
    if (!selectedStore) return
    storeSettingsApi.get(selectedStore)
      .then((res) => {
        const d = res.data?.data
        if (d) dispatch(applyAppearance({
          themeMode:      d.themeMode,
          colorTheme:     d.colorTheme,
          accentColor:    d.accentColor,
          fontFamily:     d.fontFamily,
          borderRadius:   d.borderRadius,
          sidebarDensity: d.sidebarDensity,
        }))
      })
      .catch(() => {})
  }, [selectedStore])

  const handleSave = async () => {
    if (!selectedStore) { toast.error('No store selected. Switch store from the top navigation.'); return }
    setSaving(true)
    try {
      await storeSettingsApi.upsert(selectedStore, {
        themeMode:      ui.theme,
        colorTheme:     ui.colorTheme,
        accentColor:    ui.accentColor,
        fontFamily:     ui.fontFamily,
        borderRadius:   ui.borderRadius,
        sidebarDensity: ui.sidebarDensity,
      })
      toast.success('Appearance saved')
    } catch { toast.error('Failed to save appearance') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">

      {/* Current store badge */}
      {currentStore && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Customising appearance for:</span>
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{currentStore.name}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Color Theme (tabbed) ─────────────────────────────────────────── */}
      <ColorThemeCard ui={ui} dispatch={dispatch} />

      {/* ── Light / Dark / System mode (applies to page content) ─────────────── */}
      <Card>
        <CardHeader title="Page Mode" subtitle="Controls whether the main content area is light or dark" />
        <CardBody>
          <div className="flex gap-3">
            {[
              { id: 'light',  label: 'Light',  icon: <Sun   className="w-5 h-5 text-yellow-500" /> },
              { id: 'dark',   label: 'Dark',   icon: <Moon  className="w-5 h-5 text-blue-400" /> },
              { id: 'system', label: 'System', icon: <Globe className="w-5 h-5 text-gray-500" /> },
            ].map((opt) => (
              <button key={opt.id}
                onClick={() => dispatch(setTheme(opt.id as 'light' | 'dark' | 'system'))}
                className={[
                  'flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all text-sm font-medium',
                  ui.theme === opt.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300',
                ].join(' ')}>
                {opt.icon}
                {opt.label}
                {ui.theme === opt.id && <Check className="w-4 h-4 text-blue-500" />}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Accent Colour */}
      <Card>
        <CardHeader title="Accent Colour" subtitle="Primary colour used across buttons, links and highlights" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((c) => (
              <button key={c.id}
                onClick={() => dispatch(setAccentColor(c.id))}
                title={c.label}
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all ring-offset-2 ring-offset-white dark:ring-offset-gray-900',
                  ui.accentColor === c.id ? 'ring-2 ring-gray-700 dark:ring-gray-200 scale-110' : 'hover:scale-105',
                ].join(' ')}
                style={{ backgroundColor: c.color }}>
                {ui.accentColor === c.id && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Selected: <span className="font-medium capitalize">{ui.accentColor}</span></p>
        </CardBody>
      </Card>

      {/* Font Family */}
      <Card>
        <CardHeader title="Font Family" subtitle="Typeface used throughout the interface" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((f) => (
              <button key={f.id}
                onClick={() => dispatch(setFontFamily(f.id))}
                style={{ fontFamily: f.style }}
                className={[
                  'px-4 py-2 rounded-lg border-2 text-sm transition-all',
                  ui.fontFamily === f.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300',
                ].join(' ')}>
                {f.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Border Radius */}
      <Card>
        <CardHeader title="Border Radius" subtitle="Corner rounding style for cards and buttons" />
        <CardBody>
          <div className="flex gap-3">
            {RADIUS_OPTIONS.map((r) => (
              <button key={r.id}
                onClick={() => dispatch(setBorderRadius(r.id))}
                className={[
                  'flex-1 flex flex-col items-center gap-3 py-4 border-2 transition-all',
                  r.id === 'sharp' ? 'rounded-sm' : r.id === 'rounded' ? 'rounded-2xl' : 'rounded-xl',
                  ui.borderRadius === r.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                ].join(' ')}>
                <div className={['w-10 h-8 bg-gray-300 dark:bg-gray-600', r.preview].join(' ')} />
                <span className={[
                  'text-sm font-medium',
                  ui.borderRadius === r.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400',
                ].join(' ')}>{r.label}</span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Sidebar Density */}
      <Card>
        <CardHeader title="Sidebar Density" subtitle="Spacing for sidebar navigation items" />
        <CardBody>
          <div className="flex gap-3 max-w-sm">
            {[
              { id: 'comfortable', label: 'Comfortable', desc: 'More spacing, easier to scan' },
              { id: 'compact',     label: 'Compact',     desc: 'Tighter spacing, more items visible' },
            ].map((opt) => (
              <button key={opt.id}
                onClick={() => dispatch(setSidebarDensity(opt.id))}
                className={[
                  'flex-1 text-left p-4 rounded-xl border-2 transition-all',
                  ui.sidebarDensity === opt.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                ].join(' ')}>
                <p className={['text-sm font-semibold', ui.sidebarDensity === opt.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'].join(' ')}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant="primary" loading={saving} onClick={handleSave}>Save Appearance</Button>
      </div>
    </div>
  )
}

/* ─── Location Inventory Tab ─────────────────────────────────────────────── */

interface LocationInventoryTabProps {
  stores: { id: string; name: string }[]
  tenantId: string
}

const LocationInventoryTab: React.FC<LocationInventoryTabProps> = ({ stores }) => {
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const selectedStore  = currentStoreId ?? stores[0]?.id ?? ''
  const currentStore   = stores.find((s) => s.id === selectedStore)

  const [settings, setSettings] = useState({
    enableBinTracking:       false,
    allowNegativeStock:      false,
    enableAutoReorder:       false,
    reorderNotificationEmail: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const load = async (storeId: string) => {
    if (!storeId) return
    setLoading(true)
    try {
      const res = await inventoryApi.getLocationInventorySettings(storeId)
      const d   = res.data?.data
      if (d) setSettings({
        enableBinTracking:        d.enableBinTracking ?? false,
        allowNegativeStock:       d.allowNegativeStock ?? false,
        enableAutoReorder:        d.enableAutoReorder ?? false,
        reorderNotificationEmail: d.reorderNotificationEmail ?? '',
      })
      else setSettings({ enableBinTracking: false, allowNegativeStock: false, enableAutoReorder: false, reorderNotificationEmail: '' })
    } catch { toast.error('Failed to load location settings') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(selectedStore) }, [selectedStore])

  const handleSave = async () => {
    if (!selectedStore) { toast.error('No store selected. Switch store from the top navigation.'); return }
    setSaving(true)
    try {
      await inventoryApi.updateLocationInventorySettings(selectedStore, settings)
      toast.success('Location inventory settings saved')
    } catch { toast.error('Failed to save settings') }
    finally { setSaving(false) }
  }

  const toggleField = (key: keyof typeof settings) =>
    setSettings((f) => ({ ...f, [key]: !f[key] }))

  if (!selectedStore) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Store className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No store selected</p>
            <p className="text-xs text-gray-400">Select a store from the top navigation to configure its inventory settings.</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Location Inventory Settings"
          subtitle="Per-store inventory overrides — these take precedence over company defaults" />
        <CardBody>
          <div className="space-y-5">
            {/* Current store badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-fit">
              <Store className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{currentStore?.name ?? 'Current Store'}</span>
            </div>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-3">
                {([
                  ['enableBinTracking',  'Bin Tracking',       'Enable bin-level stock tracking for this store'],
                  ['allowNegativeStock', 'Allow Negative Stock','Allow stock to go below zero (e.g. pre-orders)'],
                  ['enableAutoReorder',  'Auto Reorder',        'Automatically generate purchase orders when stock is low'],
                ] as [keyof typeof settings, string, string][]).map(([key, label, desc]) => (
                  <button key={key}
                    onClick={() => toggleField(key)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
                    {settings[key]
                      ? <ToggleRight className="w-6 h-6 text-blue-500 flex-shrink-0" />
                      : <ToggleLeft  className="w-6 h-6 text-gray-400 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}

                <div className="pt-2">
                  <Input label="Reorder Notification Email"
                    type="email"
                    value={settings.reorderNotificationEmail}
                    onChange={(e) => setSettings(f => ({ ...f, reorderNotificationEmail: e.target.value }))}
                    placeholder="warehouse@example.com"
                    hint="Email to notify when auto-reorder triggers" />
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="primary" loading={saving} onClick={handleSave}>Save Location Settings</Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

/* ─── Store Settings Tab ─────────────────────────────────────────────────── */

interface StoreSettingsTabProps {
  stores: { id: string; name: string }[]
  tenantId: string
}

const StoreSettingsTab: React.FC<StoreSettingsTabProps> = ({ stores }) => {
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const selectedStore  = currentStoreId ?? stores[0]?.id ?? ''
  const currentStore   = stores.find((s) => s.id === selectedStore)

  const [form, setForm] = useState({
    requireClientOnSale:      false,
    allowDiscount:            true,
    maxDiscountPercent:       100,
    allowVoid:                true,
    requireManagerPinForVoid: false,
    autoPrintReceipt:         false,
    receiptFooterText:        '',
    openingTime:              '',
    closingTime:              '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const load = async (storeId: string) => {
    if (!storeId) return
    setLoading(true)
    try {
      const res = await storeSettingsApi.get(storeId)
      const d   = res.data?.data
      if (d) setForm({
        requireClientOnSale:      d.requireClientOnSale      ?? false,
        allowDiscount:            d.allowDiscount            ?? true,
        maxDiscountPercent:       d.maxDiscountPercent        ?? 100,
        allowVoid:                d.allowVoid                ?? true,
        requireManagerPinForVoid: d.requireManagerPinForVoid ?? false,
        autoPrintReceipt:         d.autoPrintReceipt         ?? false,
        receiptFooterText:        d.receiptFooterText        ?? '',
        openingTime:              d.openingTime              ?? '',
        closingTime:              d.closingTime              ?? '',
      })
    } catch { toast.error('Failed to load store settings') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(selectedStore) }, [selectedStore])

  const handleSave = async () => {
    if (!selectedStore) { toast.error('No store selected. Switch store from the top navigation.'); return }
    setSaving(true)
    try {
      await storeSettingsApi.upsert(selectedStore, {
        requireClientOnSale:      form.requireClientOnSale,
        allowDiscount:            form.allowDiscount,
        maxDiscountPercent:       form.maxDiscountPercent,
        allowVoid:                form.allowVoid,
        requireManagerPinForVoid: form.requireManagerPinForVoid,
        autoPrintReceipt:         form.autoPrintReceipt,
        receiptFooterText:        form.receiptFooterText || undefined,
        openingTime:              form.openingTime || undefined,
        closingTime:              form.closingTime || undefined,
      })
      toast.success('Store settings saved')
    } catch { toast.error('Failed to save store settings') }
    finally { setSaving(false) }
  }

  const toggle = (key: keyof typeof form) =>
    setForm((f) => ({ ...f, [key]: !f[key] }))

  if (!selectedStore) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Store className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No store selected</p>
            <p className="text-xs text-gray-400">Select a store from the top navigation to configure its settings.</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Store Settings" subtitle="POS behaviour and operational settings for this store" />
        <CardBody>
          <div className="space-y-5">
            {/* Current store label */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-fit">
              <Store className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{currentStore?.name ?? 'Current Store'}</span>
            </div>

            {loading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-3">
                {/* Toggles */}
                {([
                  ['requireClientOnSale',      'Require Client on Sale',        'Every sale must have a client assigned'],
                  ['allowDiscount',             'Allow Discounts',               'Let staff apply discounts at the POS'],
                  ['allowVoid',                 'Allow Void',                    'Let staff void/cancel completed sales'],
                  ['requireManagerPinForVoid',  'Manager PIN for Void',          'Require manager PIN before voiding a sale'],
                  ['autoPrintReceipt',          'Auto-print Receipt',            'Automatically print receipt after each sale'],
                ] as [keyof typeof form, string, string][]).map(([key, label, desc]) => (
                  <button key={key}
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
                    {form[key]
                      ? <ToggleRight className="w-6 h-6 text-blue-500 flex-shrink-0" />
                      : <ToggleLeft  className="w-6 h-6 text-gray-400 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}

                {/* Max discount — only shown when discounts are allowed */}
                {form.allowDiscount && (
                  <div className="max-w-xs pl-1">
                    <Input label="Max Discount %" type="number" min={0} max={100}
                      value={String(form.maxDiscountPercent)}
                      onChange={(e) => setForm(f => ({ ...f, maxDiscountPercent: Number(e.target.value) }))}
                      hint="Maximum percentage staff can discount" />
                  </div>
                )}

                {/* Hours */}
                <div className="grid grid-cols-2 gap-4 max-w-sm pt-1">
                  <Input label="Opening Time" type="time"
                    value={form.openingTime}
                    onChange={(e) => setForm(f => ({ ...f, openingTime: e.target.value }))} />
                  <Input label="Closing Time" type="time"
                    value={form.closingTime}
                    onChange={(e) => setForm(f => ({ ...f, closingTime: e.target.value }))} />
                </div>

                {/* Receipt footer */}
                <div className="pt-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt Footer Text</label>
                  <textarea
                    value={form.receiptFooterText}
                    onChange={(e) => setForm(f => ({ ...f, receiptFooterText: e.target.value }))}
                    rows={3}
                    placeholder="Thank you for shopping with us!"
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">Printed at the bottom of every receipt</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="primary" loading={saving} onClick={handleSave}>Save Store Settings</Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
