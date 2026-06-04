import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { Button, Modal, Spinner, Input, Select, Badge } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  sku: string
  kind: string
  categoryId?: string
  categoryName?: string
  defaultSalePrice?: number
  defaultCostPrice?: number
  isActive: boolean
  publishStatus?: string
}

interface Category {
  id: string
  name: string
  parentCategoryId?: string
}

interface ProductForm {
  name: string
  sku: string
  categoryId: string
  defaultSalePrice: string
  defaultCostPrice: string
}

const EMPTY_FORM: ProductForm = {
  name: '',
  sku: '',
  categoryId: '',
  defaultSalePrice: '',
  defaultCostPrice: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FoodMenuPage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState<ProductForm>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  const companyId = tenant?.id ?? ''

  const loadData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        inventoryApi.getProducts({ companyId, kind: 'FinalProduct', pageSize: 200 }),
        inventoryApi.getCategories({ companyId, pageSize: 200 }),
      ])
      // getProducts returns paginated: { data: { items: [...] } }
      const prodData = prodRes.data?.data
      setProducts(prodData?.items ?? (Array.isArray(prodData) ? prodData : []))
      // getCategories returns Result<List<...>> → data.data is the array directly
      const catData = catRes.data?.data
      setCategories(Array.isArray(catData) ? catData : (catData?.items ?? []))
    } catch {
      toast.error('Failed to load menu')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { loadData() }, [loadData])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      sku: p.sku,
      categoryId: p.categoryId ?? '',
      defaultSalePrice: String(p.defaultSalePrice ?? ''),
      defaultCostPrice: String(p.defaultCostPrice ?? ''),
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast.error('Name and SKU are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        companyId,
        kind: 'FinalProduct',
        defaultSalePrice: parseFloat(form.defaultSalePrice) || 0,
        defaultCostPrice: parseFloat(form.defaultCostPrice) || 0,
        isActive: true,
        isUniversal: true,
        publishStatus: 'Published',
      }
      if (editing) {
        await inventoryApi.updateProduct(editing.id, payload)
        toast.success('Menu item updated')
      } else {
        await inventoryApi.createProduct(payload)
        toast.success('Menu item added')
      }
      setModalOpen(false)
      loadData()
    } catch {
      toast.error('Failed to save menu item')
    } finally {
      setSaving(false)
    }
  }

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !filterCat || p.categoryId === filterCat
    return matchSearch && matchCat
  })

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Menu</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your restaurant menu items</p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <Select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          options={categoryOptions}
          className="w-full sm:w-56"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          No menu items found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                         p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{p.name}</h3>
                <button
                  onClick={() => openEdit(p)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{p.sku}</p>

              {p.categoryName && (
                <Badge variant="default" className="text-xs w-fit">{p.categoryName}</Badge>
              )}

              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  ₹{p.defaultSalePrice?.toFixed(0) ?? '—'}
                </span>
                <Badge variant={p.isActive ? 'success' : 'danger'} className="text-xs">
                  {p.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Menu Item' : 'Add Menu Item'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Butter Chicken"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU *</label>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. RST-NV-BCH"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <Select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              options={[{ value: '', label: 'Select category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sale Price (₹)</label>
              <Input
                type="number"
                value={form.defaultSalePrice}
                onChange={(e) => setForm({ ...form, defaultSalePrice: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price (₹)</label>
              <Input
                type="number"
                value={form.defaultCostPrice}
                onChange={(e) => setForm({ ...form, defaultCostPrice: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : editing ? 'Update' : 'Add'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
