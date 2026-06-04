import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { Button, Modal, Badge, Table, Spinner, Select, Input } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReorderAlert {
  id: string
  productName: string
  warehouseName: string
  currentQuantity: number
  reorderLevel: number
  severity: string
}

interface ReorderRule {
  id: string
  productId: string
  productName: string
  warehouseId: string
  warehouseName: string
  minimumQuantity: number
  reorderQuantity: number
  leadTimeDays: number
  isActive: boolean
}

interface RuleForm {
  productId: string
  warehouseId: string
  minimumQuantity: string
  reorderQuantity: string
  leadTimeDays: string
}

interface Warehouse { id: string; name: string; code: string }
interface Product   { id: string; name: string; sku: string }

const EMPTY_RULE_FORM: RuleForm = {
  productId: '',
  warehouseId: '',
  minimumQuantity: '',
  reorderQuantity: '',
  leadTimeDays: '7',
}

type ReorderTab = 'alerts' | 'rules'

// ─── Component ────────────────────────────────────────────────────────────────

export const ReorderPage: React.FC = () => {
  const tenant = useAppSelector((s) => s.tenant.tenant)

  const [activeTab, setActiveTab] = useState<ReorderTab>('alerts')

  // Alerts
  const [alerts, setAlerts]           = useState<ReorderAlert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  // Rules
  const [rules, setRules]             = useState<ReorderRule[]>([])
  const [loadingRules, setLoadingRules] = useState(false)

  // Rule modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule]     = useState<ReorderRule | null>(null)
  const [ruleForm, setRuleForm]           = useState<RuleForm>(EMPTY_RULE_FORM)
  const [savingRule, setSavingRule]       = useState(false)
  const [deletingId, setDeletingId]       = useState<string | null>(null)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts]     = useState<Product[]>([])

  const loadAlerts = useCallback(() => {
    if (!tenant?.id) return
    setLoadingAlerts(true)
    inventoryApi
      .getReorderAlerts({ companyId: tenant.id })
      .then((res) => {
        const data = res.data?.data ?? res.data
        setAlerts(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error('Failed to load alerts'))
      .finally(() => setLoadingAlerts(false))
  }, [tenant?.id])

  const loadRules = useCallback(() => {
    if (!tenant?.id) return
    setLoadingRules(true)
    inventoryApi
      .getReorderRules({ companyId: tenant.id })
      .then((res) => {
        const data = res.data?.data ?? res.data ?? []
        setRules(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error('Failed to load rules'))
      .finally(() => setLoadingRules(false))
  }, [tenant?.id])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    if (activeTab === 'rules') loadRules()
  }, [activeTab, loadRules])

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

  const openCreateRule = () => {
    setEditingRule(null)
    setRuleForm(EMPTY_RULE_FORM)
    setRuleModalOpen(true)
  }

  const openEditRule = (rule: ReorderRule) => {
    setEditingRule(rule)
    setRuleForm({
      productId:       rule.productId,
      warehouseId:     rule.warehouseId,
      minimumQuantity: String(rule.minimumQuantity),
      reorderQuantity: String(rule.reorderQuantity),
      leadTimeDays:    String(rule.leadTimeDays),
    })
    setRuleModalOpen(true)
  }

  const handleSaveRule = async () => {
    if (!ruleForm.productId || !ruleForm.warehouseId) {
      toast.error('Product and warehouse are required')
      return
    }
    setSavingRule(true)
    try {
      const payload = {
        companyId:       tenant!.id,
        productId:       ruleForm.productId,
        warehouseId:     ruleForm.warehouseId,
        minimumQuantity: parseFloat(ruleForm.minimumQuantity) || 0,
        reorderQuantity: parseFloat(ruleForm.reorderQuantity) || 0,
        leadTimeDays:    parseInt(ruleForm.leadTimeDays) || 7,
      }
      if (editingRule) {
        await inventoryApi.updateReorderRule(editingRule.id, payload)
        toast.success('Rule updated')
      } else {
        await inventoryApi.createReorderRule(payload)
        toast.success('Rule created')
      }
      setRuleModalOpen(false)
      loadRules()
    } catch {
      toast.error('Failed to save rule')
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this reorder rule?')) return
    setDeletingId(id)
    try {
      await inventoryApi.deleteReorderRule(id)
      toast.success('Rule deleted')
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error('Failed to delete rule')
    } finally {
      setDeletingId(null)
    }
  }

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))
  const productOptions   = products.map((p) => ({ value: p.id, label: `${p.name} — ${p.sku}` }))

  const alertColumns = [
    { key: 'productName',       header: 'Product' },
    { key: 'warehouseName',     header: 'Warehouse' },
    { key: 'currentQuantity',   header: 'Current Qty' },
    { key: 'reorderLevel',      header: 'Reorder Level' },
    {
      key: 'severity',
      header: 'Severity',
      render: (row: ReorderAlert) => (
        <Badge variant={row.severity === 'Critical' ? 'danger' : 'warning'}>{row.severity}</Badge>
      ),
    },
  ]

  const ruleColumns = [
    { key: 'productName',   header: 'Product' },
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'minimumQuantity', header: 'Min Qty' },
    { key: 'reorderQuantity', header: 'Reorder Qty' },
    { key: 'leadTimeDays',    header: 'Lead Days' },
    {
      key: 'isActive',
      header: 'Active',
      render: (row: ReorderRule) => (
        <Badge variant={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'Yes' : 'No'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: ReorderRule) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEditRule(row)} />
          <Button
            variant="ghost" size="sm"
            icon={deletingId === row.id
              ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              : <Trash2 className="w-3.5 h-3.5 text-red-500" />
            }
            disabled={!!deletingId}
            onClick={() => handleDeleteRule(row.id)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reorder Management</h1>
        </div>
        {activeTab === 'rules' && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateRule}>Add Rule</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['alerts', 'rules'] as ReorderTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab === 'alerts' ? 'Alerts' : 'Rules'}
          </button>
        ))}
      </div>

      {activeTab === 'alerts' && (
        loadingAlerts ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <Table columns={alertColumns} data={alerts} />
        )
      )}

      {activeTab === 'rules' && (
        loadingRules ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <Table columns={ruleColumns} data={rules} />
        )
      )}

      {/* Rule Modal */}
      <Modal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={editingRule ? 'Edit Reorder Rule' : 'New Reorder Rule'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Product"
              value={ruleForm.productId}
              onChange={(e) => setRuleForm((f) => ({ ...f, productId: e.target.value }))}
              options={[{ value: '', label: 'Select product…' }, ...productOptions]}
            />
            <Select
              label="Warehouse"
              value={ruleForm.warehouseId}
              onChange={(e) => setRuleForm((f) => ({ ...f, warehouseId: e.target.value }))}
              options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Minimum Qty"
              type="number"
              value={ruleForm.minimumQuantity}
              onChange={(e) => setRuleForm((f) => ({ ...f, minimumQuantity: e.target.value }))}
            />
            <Input
              label="Reorder Qty"
              type="number"
              value={ruleForm.reorderQuantity}
              onChange={(e) => setRuleForm((f) => ({ ...f, reorderQuantity: e.target.value }))}
            />
            <Input
              label="Lead Days"
              type="number"
              value={ruleForm.leadTimeDays}
              onChange={(e) => setRuleForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRuleModalOpen(false)}>Cancel</Button>
            <Button loading={savingRule} onClick={handleSaveRule}>
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
