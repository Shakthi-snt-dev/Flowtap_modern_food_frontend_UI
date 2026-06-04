import React, { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { Button, Modal, Badge, Table, Spinner, Select, Input } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventorySettings {
  id?: string
  defaultValuationMethod: string
  stockDeductionMode: string
  negativeStockPolicy: string
  enableBinTracking: boolean
  enableSerialTracking: boolean
  enableAutoReorder: boolean
  lowStockNotificationEnabled: boolean
  allowBackDatingTransactions: boolean
  requireManagerApprovalForWriteOff: boolean
  requireSerialOnSale: boolean
  enableBatchTracking: boolean
  autoGenerateSku: boolean
  deadStockDaysThreshold: number
}

interface BarcodeTemplate {
  id: string
  name: string
  codeType: string
  isDefault: boolean
  labelsPerRow: number
  labelWidthMm: number
  labelHeightMm: number
  showProductName: boolean
  showSKU: boolean
}

interface BarcodeForm {
  name: string
  codeType: string
  isDefault: boolean
  labelsPerRow: string
  labelWidthMm: string
  labelHeightMm: string
  showProductName: boolean
  showSKU: boolean
}

type SettingsTab = 'general' | 'barcode'

const EMPTY_BARCODE_FORM: BarcodeForm = {
  name: '',
  codeType: 'Code128',
  isDefault: false,
  labelsPerRow: '3',
  labelWidthMm: '60',
  labelHeightMm: '40',
  showProductName: true,
  showSKU: true,
}

// ─── Toggle row helper ────────────────────────────────────────────────────────

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────

export const InventorySettingsPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // General settings
  const [settings, setSettings] = useState<InventorySettings>({
    defaultValuationMethod: 'FIFO',
    stockDeductionMode: 'OnTicketClose',
    negativeStockPolicy: 'Warn',
    enableBinTracking: false,
    enableSerialTracking: false,
    enableAutoReorder: false,
    lowStockNotificationEnabled: true,
    allowBackDatingTransactions: false,
    requireManagerApprovalForWriteOff: true,
    requireSerialOnSale: false,
    enableBatchTracking: false,
    autoGenerateSku: true,
    deadStockDaysThreshold: 90,
  })
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings]   = useState(false)

  // Barcode templates
  const [templates, setTemplates]           = useState<BarcodeTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate]   = useState<BarcodeTemplate | null>(null)
  const [templateForm, setTemplateForm]         = useState<BarcodeForm>(EMPTY_BARCODE_FORM)
  const [savingTemplate, setSavingTemplate]     = useState(false)
  const [deletingId, setDeletingId]             = useState<string | null>(null)

  const loadSettings = useCallback(() => {
    if (!tenant?.id) return
    setLoadingSettings(true)
    inventoryApi
      .getInventorySettings()
      .then((res) => {
        const data = res.data?.data ?? res.data
        if (data) setSettings(data)
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [tenant?.id])

  const loadTemplates = useCallback(() => {
    if (!tenant?.id) return
    setLoadingTemplates(true)
    inventoryApi
      .getBarcodeTemplates()
      .then((res) => {
        const data = res.data?.data ?? res.data
        setTemplates(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoadingTemplates(false))
  }, [tenant?.id])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { if (activeTab === 'barcode') loadTemplates() }, [activeTab, loadTemplates])

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await inventoryApi.updateInventorySettings({ ...settings, companyId: tenant!.id })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const openCreateTemplate = () => { setEditingTemplate(null); setTemplateForm(EMPTY_BARCODE_FORM); setTemplateModalOpen(true) }
  const openEditTemplate   = (t: BarcodeTemplate) => {
    setEditingTemplate(t)
    setTemplateForm({
      name: t.name, codeType: t.codeType, isDefault: t.isDefault,
      labelsPerRow: String(t.labelsPerRow), labelWidthMm: String(t.labelWidthMm),
      labelHeightMm: String(t.labelHeightMm), showProductName: t.showProductName, showSKU: t.showSKU,
    })
    setTemplateModalOpen(true)
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name) { toast.error('Name is required'); return }
    setSavingTemplate(true)
    try {
      const payload = {
        companyId:      tenant!.id,
        name:           templateForm.name,
        codeType:       templateForm.codeType,
        isDefault:      templateForm.isDefault,
        labelsPerRow:   parseInt(templateForm.labelsPerRow) || 3,
        labelWidthMm:   parseFloat(templateForm.labelWidthMm) || 60,
        labelHeightMm:  parseFloat(templateForm.labelHeightMm) || 40,
        showProductName: templateForm.showProductName,
        showSKU:        templateForm.showSKU,
      }
      if (editingTemplate) {
        await inventoryApi.updateBarcodeTemplate(editingTemplate.id, payload)
        toast.success('Template updated')
      } else {
        await inventoryApi.createBarcodeTemplate(payload)
        toast.success('Template created')
      }
      setTemplateModalOpen(false)
      loadTemplates()
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    setDeletingId(id)
    try {
      await inventoryApi.deleteBarcodeTemplate(id)
      toast.success('Template deleted')
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error('Failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  const templateColumns = [
    { key: 'name', header: 'Name' },
    { key: 'codeType', header: 'Type' },
    { key: 'labelsPerRow', header: 'Labels / Row' },
    {
      key: 'isDefault',
      header: 'Default',
      render: (row: BarcodeTemplate) =>
        row.isDefault ? <Badge variant="success">Default</Badge> : null,
    },
    {
      key: 'actions',
      header: '',
      render: (row: BarcodeTemplate) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEditTemplate(row)} />
          <Button
            variant="ghost" size="sm"
            icon={deletingId === row.id
              ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              : <Trash2 className="w-3.5 h-3.5 text-red-500" />
            }
            disabled={!!deletingId}
            onClick={() => handleDeleteTemplate(row.id)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['general', 'barcode'] as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab === 'general' ? 'General' : 'Barcode Templates'}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        loadingSettings ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="max-w-xl space-y-2">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Select
                label="Valuation Method"
                value={settings.defaultValuationMethod}
                onChange={(e) => setSettings((s) => ({ ...s, defaultValuationMethod: e.target.value }))}
                options={[{ value: 'FIFO', label: 'FIFO' }, { value: 'Average', label: 'Average' }]}
              />
              <Select
                label="Negative Stock"
                value={settings.negativeStockPolicy}
                onChange={(e) => setSettings((s) => ({ ...s, negativeStockPolicy: e.target.value }))}
                options={[
                  { value: 'Allow', label: 'Allow' },
                  { value: 'Block', label: 'Block' },
                  { value: 'Warn', label: 'Warn' },
                ]}
              />
            </div>

            <Toggle label="Enable Bin Tracking"     checked={settings.enableBinTracking}    onChange={(v) => setSettings((s) => ({ ...s, enableBinTracking: v }))} />
            <Toggle label="Enable Serial Tracking"  checked={settings.enableSerialTracking}  onChange={(v) => setSettings((s) => ({ ...s, enableSerialTracking: v }))} />
            <Toggle label="Enable Batch Tracking"   checked={settings.enableBatchTracking}   onChange={(v) => setSettings((s) => ({ ...s, enableBatchTracking: v }))} />
            <Toggle label="Enable Auto Reorder"     checked={settings.enableAutoReorder}     onChange={(v) => setSettings((s) => ({ ...s, enableAutoReorder: v }))} />
            <Toggle label="Low Stock Notifications" checked={settings.lowStockNotificationEnabled} onChange={(v) => setSettings((s) => ({ ...s, lowStockNotificationEnabled: v }))} />
            <Toggle label="Require Approval for Write-offs" checked={settings.requireManagerApprovalForWriteOff} onChange={(v) => setSettings((s) => ({ ...s, requireManagerApprovalForWriteOff: v }))} />
            <Toggle label="Require Serial on Sale"  checked={settings.requireSerialOnSale}   onChange={(v) => setSettings((s) => ({ ...s, requireSerialOnSale: v }))} />
            <Toggle label="Auto-generate SKU"       checked={settings.autoGenerateSku}       onChange={(v) => setSettings((s) => ({ ...s, autoGenerateSku: v }))} />
            <Toggle label="Allow Back-dating Transactions" checked={settings.allowBackDatingTransactions} onChange={(v) => setSettings((s) => ({ ...s, allowBackDatingTransactions: v }))} />

            <div className="pt-4">
              <Input
                label="Dead Stock Days Threshold"
                type="number"
                value={String(settings.deadStockDaysThreshold)}
                onChange={(e) => setSettings((s) => ({ ...s, deadStockDaysThreshold: parseInt(e.target.value) || 90 }))}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button loading={savingSettings} onClick={handleSaveSettings}>Save Settings</Button>
            </div>
          </div>
        )
      )}

      {/* Barcode Templates */}
      {activeTab === 'barcode' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateTemplate}>Add Template</Button>
          </div>
          {loadingTemplates ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <Table columns={templateColumns} data={templates} />
          )}
        </div>
      )}

      {/* Barcode Template Modal */}
      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplate ? 'Edit Template' : 'New Barcode Template'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Template Name"
              value={templateForm.name}
              onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="Code Type"
              value={templateForm.codeType}
              onChange={(e) => setTemplateForm((f) => ({ ...f, codeType: e.target.value }))}
              options={[
                { value: 'Code128', label: 'Code 128' },
                { value: 'QRCode',  label: 'QR Code' },
                { value: 'Code39',  label: 'Code 39' },
                { value: 'EAN13',   label: 'EAN-13' },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Labels / Row"
              type="number"
              value={templateForm.labelsPerRow}
              onChange={(e) => setTemplateForm((f) => ({ ...f, labelsPerRow: e.target.value }))}
            />
            <Input
              label="Width (mm)"
              type="number"
              value={templateForm.labelWidthMm}
              onChange={(e) => setTemplateForm((f) => ({ ...f, labelWidthMm: e.target.value }))}
            />
            <Input
              label="Height (mm)"
              type="number"
              value={templateForm.labelHeightMm}
              onChange={(e) => setTemplateForm((f) => ({ ...f, labelHeightMm: e.target.value }))}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={templateForm.showProductName}
                onChange={(e) => setTemplateForm((f) => ({ ...f, showProductName: e.target.checked }))}
                className="rounded"
              />
              Show Product Name
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={templateForm.showSKU}
                onChange={(e) => setTemplateForm((f) => ({ ...f, showSKU: e.target.checked }))}
                className="rounded"
              />
              Show SKU
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={templateForm.isDefault}
                onChange={(e) => setTemplateForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded"
              />
              Set as Default
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setTemplateModalOpen(false)}>Cancel</Button>
            <Button loading={savingTemplate} onClick={handleSaveTemplate}>
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
