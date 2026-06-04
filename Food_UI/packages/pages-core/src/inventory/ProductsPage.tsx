import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Archive, MapPin, BarChart2, Printer, Smartphone, Trash2 } from 'lucide-react'
import { useCurrency } from '@flowtap/shared'
import Barcode from 'react-barcode'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { tenantApi } from '@flowtap/api-core'
import { taxApi } from '@flowtap/api-core'
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  Table,
  Spinner,
  SearchInput,
  ImageUpload,
} from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
  category: string
  categoryId?: string
  stock: number
  price: number
  isActive: boolean
  kind: number
  isSerialized: boolean
  isUniversal: boolean
  hsnCode?: string
  emoji?: string
  tag?: string
  imageUrl?: string
  taxSlabId?: string
}

interface ProductForm {
  name: string
  sku: string
  categoryId: string
  unit: string
  purchasePrice: string
  salePrice: string
  description: string
  isActive: boolean
  kind: string
  isSerialized: boolean
  isUniversal: boolean
  hsnCode: string
  emoji: string
  tag: string
  imageUrl: string
  taxSlabId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


const EMPTY_FORM: ProductForm = {
  name: '',
  sku: '',
  categoryId: '',
  unit: 'pcs',
  purchasePrice: '',
  salePrice: '',
  description: '',
  isActive: true,
  kind: '1',
  isSerialized: false,
  isUniversal: false,
  hsnCode: '',
  emoji: '',
  tag: '',
  imageUrl: '',
  taxSlabId: '',
}

const PAGE_SIZE = 10

// maps template codeType to react-barcode format string
const toBarcodeFormat = (codeType: string): string => {
  const map: Record<string, string> = {
    Code128: 'CODE128', code128: 'CODE128',
    Code39: 'CODE39',   code39: 'CODE39',
    EAN13: 'EAN13',     ean13: 'EAN13',
    UPC: 'UPC',         upc: 'UPC',
  }
  return map[codeType] ?? 'CODE128'   // QRCode falls back to CODE128 (react-barcode doesn't support QR)
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProductsPage: React.FC = () => {
  const tenant   = useAppSelector((s) => s.tenant.tenant)
  const isRepair = tenant?.industryType === 'RepairShop'
  const { format } = useCurrency()

  // data
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // filters
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)

  // modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [productKinds, setProductKinds] = useState<{ value: string; label: string }[]>([])
  const [taxSlabs, setTaxSlabs] = useState<{ value: string; label: string }[]>([])

  // barcode print
  const [barcodeProduct, setBarcodeProduct] = useState<{ sku: string; name: string } | null>(null)
  const [barcodeTemplate, setBarcodeTemplate] = useState<{
    codeType: string; showProductName: boolean; showSKU: boolean
    labelWidthMm: number; labelHeightMm: number; isDefault: boolean
  } | null>(null)

  // load default barcode template on mount
  useEffect(() => {
    inventoryApi.getBarcodeTemplates().then(res => {
      const list: any[] = res.data?.data ?? res.data ?? []
      const def = list.find((t: any) => t.isDefault) ?? list[0] ?? null
      if (def) setBarcodeTemplate(def)
    }).catch(() => {/* no templates yet */})
  }, [])

  // inject print-only CSS when barcode modal is open
  useEffect(() => {
    if (!barcodeProduct) return
    const style = document.createElement('style')
    style.id = 'barcode-print-style'
    style.textContent = `@media print { body > * { display: none !important; } #barcode-label { display: flex !important; position: fixed; top: 0; left: 0; } }`
    document.head.appendChild(style)
    return () => { document.getElementById('barcode-print-style')?.remove() }
  }, [barcodeProduct])

  // load enums
  useEffect(() => {
    inventoryApi.getEnums().then(res => {
      const data = res.data?.data ?? res.data
      if (data?.ProductKind) {
        setProductKinds(data.ProductKind.map((k: any) => ({ value: String(k.value), label: k.label })))
      }
    }).catch(console.error)
  }, [])

  // load tax slabs
  useEffect(() => {
    if (!tenant?.id) return
    taxApi.getSlabs(tenant.id).then(res => {
      const data: any[] = res.data?.data ?? res.data ?? []
      setTaxSlabs(
        Array.isArray(data)
          ? data
              .filter((s: any) => s.isActive !== false)
              .map((s: any) => ({
                value: String(s.id),
                label: `${s.name} (${s.rate ?? 0}%)`,
              }))
          : []
      )
    }).catch(() => { /* tax slabs optional */ })
  }, [tenant?.id])

  // location pricing states
  const [pricingModalOpen, setPricingModalOpen] = useState(false)
  const [pricingProduct, setPricingProduct] = useState<Product | null>(null)
  const [stores, setStores] = useState<{ id: string, name: string }[]>([])
  const [locationPrices, setLocationPrices] = useState<{
    id: string
    locationId: string
    costPrice: number
    salePrice: number
    mrp?: number
    isTaxIncluded: boolean
    taxSlabId?: string
    status: string
    effectiveFrom: string
  }[]>([])
  const [pricingForm, setPricingForm] = useState({
    locationId: '',
    costPrice: '',
    salePrice: '',
    mrp: '',
    isTaxIncluded: false,
    taxSlabId: '',
  })
  const [savingPrice, setSavingPrice] = useState(false)

  const openPricing = async (product: Product) => {
    setPricingProduct(product)
    setPricingForm({
      locationId: '',
      costPrice: '',
      salePrice: String(product.price),
      mrp: '',
      isTaxIncluded: false,
      taxSlabId: '',
    })
    setPricingModalOpen(true)

    // Load stores if not loaded yet
    if (tenant?.id && stores.length === 0) {
      try {
        const res = await tenantApi.getStores(tenant.id)
        const sData = res.data?.data ?? res.data ?? []
        setStores(Array.isArray(sData) ? sData.map((s: Record<string, unknown>) => ({ id: String(s.id), name: String(s.title ?? s.name ?? '') })) : [])
      } catch {
        toast.error('Failed to load stores')
      }
    }

    // Load existing location prices
    try {
      const res = await inventoryApi.getProductLocationPrices(product.id)
      const pData = res.data?.data ?? res.data ?? []
      setLocationPrices(Array.isArray(pData) ? pData.map((p: Record<string, unknown>) => ({
        id: String(p.id),
        locationId: String(p.locationId),
        costPrice: Number(p.costPrice ?? 0),
        salePrice: Number(p.salePrice ?? 0),
        mrp: p.mrp ? Number(p.mrp) : undefined,
        isTaxIncluded: Boolean(p.isTaxIncluded ?? false),
        taxSlabId: p.taxSlabId ? String(p.taxSlabId) : undefined,
        status: String(p.status ?? 'Draft'),
        effectiveFrom: String(p.effectiveFrom ?? '')
      })) : [])
    } catch {
      toast.error('Failed to load location prices')
      setLocationPrices([])
    }
  }

  const handleSaveLocationPrice = async () => {
    if (!pricingProduct) return
    if (!pricingForm.locationId) { toast.error('Please select a store / location'); return }
    if (!pricingForm.salePrice || isNaN(Number(pricingForm.salePrice))) { toast.error('Please enter a valid sale price'); return }

    setSavingPrice(true)
    try {
      await inventoryApi.setProductLocationPrice(pricingProduct.id, {
        companyId: tenant?.id,
        locationId: pricingForm.locationId,
        costPrice: pricingForm.costPrice ? Number(pricingForm.costPrice) : 0,
        salePrice: Number(pricingForm.salePrice),
        mrp: pricingForm.mrp ? Number(pricingForm.mrp) : null,
        isTaxIncluded: pricingForm.isTaxIncluded,
        taxSlabId: pricingForm.taxSlabId || undefined,
      })
      toast.success('Location price set successfully')
      
      // Reload location prices
      const res = await inventoryApi.getProductLocationPrices(pricingProduct.id)
      const pData = res.data?.data ?? res.data ?? []
      setLocationPrices(Array.isArray(pData) ? pData.map((p: Record<string, unknown>) => ({
        id: String(p.id),
        locationId: String(p.locationId),
        costPrice: Number(p.costPrice ?? 0),
        salePrice: Number(p.salePrice ?? 0),
        mrp: p.mrp ? Number(p.mrp) : undefined,
        isTaxIncluded: Boolean(p.isTaxIncluded ?? false),
        taxSlabId: p.taxSlabId ? String(p.taxSlabId) : undefined,
        status: String(p.status ?? 'Draft'),
        effectiveFrom: String(p.effectiveFrom ?? '')
      })) : [])

      setPricingForm({
        locationId: '',
        costPrice: '',
        salePrice: String(pricingProduct.price),
        mrp: '',
        isTaxIncluded: false,
        taxSlabId: '',
      })
    } catch {
      toast.error('Failed to set location price')
    } finally {
      setSavingPrice(false)
    }
  }

  // ── Device mapping states ────────────────────────────────────────────────────
  // ── Device mapping states ────────────────────────────────────────────────────
  const [deviceModalOpen, setDeviceModalOpen]     = useState(false)
  const [deviceProduct, setDeviceProduct]         = useState<Product | null>(null)
  const [deviceMappings, setDeviceMappings]       = useState<{ deviceModelId: string; modelName: string; brandName: string | null }[]>([])
  const [loadingDevices, setLoadingDevices]       = useState(false)
  const [addingModel, setAddingModel]             = useState(false)
  const [removingModelId, setRemovingModelId]     = useState<string | null>(null)

  // cascade: category → brand → model
  const [deviceCategoryId, setDeviceCategoryId]   = useState('')
  const [deviceBrands, setDeviceBrands]           = useState<{ id: string; name: string }[]>([])
  const [deviceBrandId, setDeviceBrandId]         = useState('')
  const [deviceModels, setDeviceModels]           = useState<{ id: string; name: string; brandName: string }[]>([])
  const [selectedModelId, setSelectedModelId]     = useState('')
  const [loadingBrands, setLoadingBrands]         = useState(false)
  const [loadingModels, setLoadingModels]         = useState(false)

  const openDeviceMapping = async (product: Product) => {
    setDeviceProduct(product)
    setDeviceBrandId('')
    setDeviceBrands([])
    setDeviceModels([])
    setSelectedModelId('')
    setDeviceModalOpen(true)
    setLoadingDevices(true)
    try {
      const mappingsRes = await inventoryApi.getProductDeviceMappings(product.id)
      const mappingsData = mappingsRes.data?.data ?? mappingsRes.data ?? []
      setDeviceMappings(Array.isArray(mappingsData) ? mappingsData : [])
    } catch { toast.error('Failed to load device mappings') }
    finally { setLoadingDevices(false) }
    // auto-set category from the product so brands load immediately
    setDeviceCategoryId(product.categoryId ?? '')
  }

  // load all brands once when the device modal opens (no category filter — Apple exists once for both Mobile & Laptop)
  useEffect(() => {
    if (!deviceModalOpen) return
    setLoadingBrands(true)
    inventoryApi.getDeviceBrands()
      .then(res => {
        const data = res.data?.data ?? res.data ?? []
        setDeviceBrands(Array.isArray(data) ? data.map((b: Record<string, unknown>) => ({ id: String(b.id), name: String(b.name ?? '') })) : [])
      })
      .catch(() => toast.error('Failed to load brands'))
      .finally(() => setLoadingBrands(false))
  }, [deviceModalOpen])

  // when brand changes → load models filtered by brand + product's category
  // e.g. Apple + Mobile → iPhones only;  Apple + Laptop → MacBooks only
  useEffect(() => {
    setDeviceModels([])
    setSelectedModelId('')
    if (!deviceBrandId) return
    setLoadingModels(true)
    inventoryApi.getDeviceModels({
      brandId: deviceBrandId,
      ...(deviceCategoryId ? { productCategoryId: deviceCategoryId } : {}),
    })
      .then(res => {
        const data = res.data?.data ?? res.data ?? []
        setDeviceModels(Array.isArray(data) ? data.map((m: Record<string, unknown>) => ({
          id: String(m.id), name: String(m.name ?? ''), brandName: String(m.brandName ?? ''),
        })) : [])
      })
      .catch(() => toast.error('Failed to load models'))
      .finally(() => setLoadingModels(false))
  }, [deviceBrandId, deviceCategoryId])

  const handleAddDeviceMapping = async () => {
    if (!selectedModelId || !deviceProduct) return
    setAddingModel(true)
    try {
      await inventoryApi.addProductDeviceMapping(deviceProduct.id, selectedModelId)
      const model = deviceModels.find(m => m.id === selectedModelId)
      if (model) setDeviceMappings(prev => [...prev, { deviceModelId: model.id, modelName: model.name, brandName: model.brandName }])
      setSelectedModelId('')
      toast.success('Device model linked')
    } catch { toast.error('Failed to link device model') }
    finally { setAddingModel(false) }
  }

  const handleRemoveDeviceMapping = async (deviceModelId: string) => {
    if (!deviceProduct) return
    setRemovingModelId(deviceModelId)
    try {
      await inventoryApi.removeProductDeviceMapping(deviceProduct.id, deviceModelId)
      setDeviceMappings(prev => prev.filter(m => m.deviceModelId !== deviceModelId))
      toast.success('Device model unlinked')
    } catch { toast.error('Failed to unlink device model') }
    finally { setRemovingModelId(null) }
  }

  // ── Load categories ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.id) return
    inventoryApi
      .getCategories({ companyId: tenant.id })
      .then((res) => {
        const data = res.data?.data ?? res.data ?? []
        setCategories(Array.isArray(data) ? data.map((c: Record<string, unknown>) => ({ id: String(c.id), name: String(c.name ?? '') })) : [])
      })
      .catch(() => setCategories([]))
  }, [tenant?.id])

  // ── Load products ────────────────────────────────────────────────────────────
  const loadProducts = useCallback(() => {
    if (!tenant?.id) return
    setLoading(true)

    const params = {
      companyId: tenant.id,
      page,
      pageSize: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(activeFilter !== 'all' ? { isActive: activeFilter === 'active' } : {}),
    }

    inventoryApi
      .getProducts(params)
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.data ?? res.data ?? []
        const items: Product[] = Array.isArray(raw)
          ? raw.map((p: Record<string, unknown>) => ({
              id: String(p.id),
              name: String(p.name ?? ''),
              sku: String(p.sku ?? ''),
              category: String(p.category ?? p.categoryName ?? ''),
              categoryId: p.categoryId ? String(p.categoryId) : undefined,
              stock: Number(p.stock ?? p.stockQuantity ?? 0),
              price: Number(p.defaultSalePrice ?? p.salePrice ?? p.price ?? 0),
              isActive: Boolean(p.isActive ?? true),
              kind: Number(p.kind ?? 1),
              isSerialized: Boolean(p.isSerialized ?? false),
              isUniversal: Boolean(p.isUniversal ?? false),
              hsnCode: p.hsnCode ? String(p.hsnCode) : undefined,
              emoji: p.emoji ? String(p.emoji) : undefined,
              tag: p.tag ? String(p.tag) : undefined,
              imageUrl: p.imageUrl ? String(p.imageUrl) : undefined,
              taxSlabId: p.taxSlabId ? String(p.taxSlabId) : undefined,
            }))
          : []
        setProducts(items)
        setTotal(res.data?.data?.totalCount ?? res.data?.total ?? res.data?.count ?? items.length)
      })
      .catch(() => {
        toast.error('Failed to load products')
        setProducts([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [tenant?.id, page, search, categoryId, activeFilter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, categoryId, activeFilter])

  // ── Modal helpers ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId ?? '',
      unit: 'pcs',
      purchasePrice: '',
      salePrice: String(product.price),
      description: '',
      isActive: product.isActive,
      kind: String(product.kind),
      isSerialized: product.isSerialized,
      isUniversal: product.isUniversal,
      hsnCode: product.hsnCode ?? '',
      emoji: product.emoji ?? '',
      tag: product.tag ?? '',
      imageUrl: product.imageUrl ?? '',
      taxSlabId: product.taxSlabId ?? '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProduct(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.salePrice) { toast.error('Sale price is required'); return }
    setSaving(true)
    try {
      const payload = {
        companyId: tenant?.id,
        name: form.name,
        sku: form.sku,
        categoryId: form.categoryId || undefined,
        unit: form.unit,
        defaultCostPrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
        defaultSalePrice: Number(form.salePrice),
        description: form.description,
        isActive: form.isActive,
        kind: Number(form.kind),
        isSerialized: form.isSerialized,
        isUniversal: form.isUniversal,
        hsnCode: form.hsnCode,
        emoji: form.emoji,
        tag: form.tag,
        imageUrl: form.imageUrl || undefined,
        taxSlabId: form.taxSlabId || undefined,
      }
      if (editingProduct) {
        await inventoryApi.updateProduct(editingProduct.id, payload)
        toast.success('Product updated')
      } else {
        await inventoryApi.createProduct(payload)
        toast.success('Product created')
      }
      closeModal()
      loadProducts()
    } catch {
      toast.error('Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (product: Product) => {
    if (!window.confirm(`Archive "${product.name}"?`)) return
    try {
      await inventoryApi.archiveProduct(product.id)
      toast.success('Product archived')
      loadProducts()
    } catch {
      toast.error('Failed to archive product')
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'image' as const,
      header: '',
      render: (row: Product) => (
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.name} className="w-full h-full object-cover" />
          ) : row.emoji ? (
            <span className="text-xl">{row.emoji}</span>
          ) : (
            <span className="text-lg text-gray-400 dark:text-gray-500">📦</span>
          )}
        </div>
      ),
    },
    {
      key: 'name' as const,
      header: 'Product',
      render: (row: Product) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{row.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.sku}</p>
        </div>
      ),
    },
    {
      key: 'category' as const,
      header: 'Category',
      render: (row: Product) => (
        <span className="text-gray-700 dark:text-gray-300">{row.category || '—'}</span>
      ),
    },
    {
      key: 'stock' as const,
      header: 'Stock',
      render: (row: Product) => (
        <span
          className={
            row.stock === 0
              ? 'font-semibold text-red-600 dark:text-red-400'
              : row.stock < 5
              ? 'font-semibold text-orange-500 dark:text-orange-400'
              : 'text-gray-700 dark:text-gray-300'
          }
        >
          {row.stock}
        </span>
      ),
    },
    {
      key: 'price' as const,
      header: 'Sale Price',
      render: (row: Product) => (
        <span className="text-gray-700 dark:text-gray-300">{format(row.price)}</span>
      ),
    },
    {
      key: 'isActive' as const,
      header: 'Status',
      render: (row: Product) => (
        <Badge variant={row.isActive ? 'success' : 'default'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions' as const,
      header: 'Actions',
      render: (row: Product) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openPricing(row) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
            title="Location Pricing"
          >
            <MapPin className="w-4 h-4" />
          </button>
          {isRepair && (
            <button
              onClick={(e) => { e.stopPropagation(); openDeviceMapping(row) }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              title="Device Compatibility"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setBarcodeProduct({ sku: row.sku, name: row.name }) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
            title="Print Barcode"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleArchive(row) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const showingFrom = (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, total)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search products…"
          className="w-64"
        />
        <Select
          options={[
            { value: '', label: 'All Categories' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-48"
          placeholder=""
        />
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={
                'px-3 py-1.5 text-sm font-medium capitalize transition-colors ' +
                (activeFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700')
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Table<Product>
          columns={columns}
          data={products}
          emptyMessage="No products found"
        />
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {showingFrom}–{showingTo} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 items-start">
            <div className="col-span-2 space-y-4">
              <Input
                label="Product Name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. iPhone 15 Screen"
              />
              <Input
                label="Emoji Icon"
                value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="📱"
              />
            </div>
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              label="Product Image"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              placeholder="e.g. IPH15-SCR"
            />
            <Select
              label="Product Kind"
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              options={productKinds.length > 0 ? productKinds : [
                { value: '1', label: 'Physical Product' },
                { value: '2', label: 'Service' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select category"
            />
            <Select
              label="Tax Slab"
              value={form.taxSlabId}
              onChange={(e) => setForm((f) => ({ ...f, taxSlabId: e.target.value }))}
              options={taxSlabs}
              placeholder="No tax / select slab"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Purchase Price"
              type="number"
              value={form.purchasePrice}
              onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Sale Price *"
              type="number"
              value={form.salePrice}
              onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
              placeholder="0"
            />
            <Select
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              options={[
                { value: 'pcs', label: 'Pieces (pcs)' },
                { value: 'kg', label: 'Kilogram (kg)' },
                { value: 'litre', label: 'Litre' },
                { value: 'box', label: 'Box' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="HSN Code"
              value={form.hsnCode}
              onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
              placeholder="e.g. 8517"
            />
            <Input
              label="Tag / Label"
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
              placeholder="e.g. Premium, Fragile"
            />
          </div>

          <div className="flex flex-wrap gap-6 py-2 border-y border-gray-100 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isSerialized}
                onChange={(e) => setForm((f) => ({ ...f, isSerialized: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Has Serial Number</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isUniversal}
                onChange={(e) => setForm((f) => ({ ...f, isUniversal: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Universal Part</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Location Prices Modal */}
      <Modal
        open={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        title={pricingProduct ? `Location Prices - ${pricingProduct.name}` : 'Location Pricing'}
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPricingModalOpen(false)}>Close</Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Add Price Form */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Configure Price per Location</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <div className="col-span-2 sm:col-span-2">
                <Select
                  label="Select Store"
                  value={pricingForm.locationId}
                  onChange={(e) => setPricingForm(f => ({ ...f, locationId: e.target.value }))}
                  options={stores.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="Select store..."
                />
              </div>
              <div>
                <Input
                  label="Cost Price *"
                  type="number"
                  placeholder="0"
                  value={pricingForm.costPrice}
                  onChange={(e) => setPricingForm(f => ({ ...f, costPrice: e.target.value }))}
                />
              </div>
              <div>
                <Input
                  label="Sale Price *"
                  type="number"
                  placeholder="0"
                  value={pricingForm.salePrice}
                  onChange={(e) => setPricingForm(f => ({ ...f, salePrice: e.target.value }))}
                />
              </div>
              <div className="flex justify-end w-full">
                <Button loading={savingPrice} onClick={handleSaveLocationPrice} className="w-full">
                  Set Price
                </Button>
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              <Input
                label="MRP"
                type="number"
                placeholder="Optional"
                value={pricingForm.mrp}
                onChange={(e) => setPricingForm(f => ({ ...f, mrp: e.target.value }))}
                className="w-1/3"
              />
              <div className="flex-1 min-w-[160px]">
                <Select
                  label="Tax Slab (this store)"
                  value={pricingForm.taxSlabId}
                  onChange={(e) => setPricingForm(f => ({ ...f, taxSlabId: e.target.value }))}
                  options={taxSlabs}
                  placeholder="Use product default"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-7">
                <input
                  type="checkbox"
                  checked={pricingForm.isTaxIncluded}
                  onChange={(e) => setPricingForm(f => ({ ...f, isTaxIncluded: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tax Included in Price</span>
              </label>
            </div>
          </div>

          {/* List of Configured Prices */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Configured Store Prices</h3>
            {locationPrices.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                No store-specific prices set yet. This product will use default prices.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Store</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost Price</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sale Price</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">MRP</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tax Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {locationPrices.map((p) => {
                      const storeName = stores.find(s => s.id === p.locationId)?.name ?? 'Default Store';
                      return (
                        <tr key={p.id}>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{storeName}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300">{format(p.costPrice)}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-950 dark:text-white font-semibold">{format(p.salePrice)}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{p.mrp ? format(p.mrp) : '—'}</td>
                          <td className="px-4 py-2.5 text-sm">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${p.isTaxIncluded ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                              {p.isTaxIncluded ? 'Tax Inclusive' : 'Tax Exclusive'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            <Badge variant={p.status === 'Published' ? 'success' : 'default'}>{p.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Device Compatibility Modal */}
      <Modal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title={deviceProduct ? `Device Compatibility — ${deviceProduct.name}` : 'Device Compatibility'}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDeviceModalOpen(false)}>Close</Button>
          </div>
        }
      >
        {loadingDevices ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : (
          <div className="space-y-5">
            {/* Link a model — Brand → Model (category pre-filled from product) */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Link a Device Model</p>
                {deviceProduct?.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                    {deviceProduct.category}
                  </span>
                )}
              </div>

              {/* Step 1: Brand (auto-loaded from product's category) */}
              <Select
                label="Brand"
                value={deviceBrandId}
                onChange={(e) => setDeviceBrandId(e.target.value)}
                options={
                  loadingBrands
                    ? [{ value: '', label: 'Loading brands…' }]
                    : deviceBrands.length === 0
                    ? [{ value: '', label: 'No brands found' }]
                    : [{ value: '', label: 'Select brand…' }, ...deviceBrands.map(b => ({ value: b.id, label: b.name }))]
                }
                disabled={loadingBrands}
              />

              {/* Step 2: Model + Link button */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select
                    label="Model"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    options={
                      !deviceBrandId
                        ? [{ value: '', label: 'Select a brand first…' }]
                        : loadingModels
                        ? [{ value: '', label: 'Loading models…' }]
                        : deviceModels.length === 0
                        ? [{ value: '', label: 'No models for this brand' }]
                        : [
                            { value: '', label: 'Select model…' },
                            ...deviceModels
                              .filter(m => !deviceMappings.some(dm => dm.deviceModelId === m.id))
                              .map(m => ({ value: m.id, label: m.name })),
                          ]
                    }
                    disabled={!deviceBrandId || loadingModels}
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <Button
                    loading={addingModel}
                    disabled={!selectedModelId}
                    onClick={handleAddDeviceMapping}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Link
                  </Button>
                </div>
              </div>
            </div>

            {/* Linked models list */}
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Linked Device Models ({deviceMappings.length})
              </p>
              {deviceMappings.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  No device models linked yet. This product won't appear in model-filtered searches.
                </div>
              ) : (
                <div className="space-y-2">
                  {deviceMappings.map((m) => (
                    <div
                      key={m.deviceModelId}
                      className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{m.modelName}</span>
                        {m.brandName && (
                          <span className="text-xs text-gray-400">· {m.brandName}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveDeviceMapping(m.deviceModelId)}
                        disabled={removingModelId === m.deviceModelId}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                        title="Unlink"
                      >
                        {removingModelId === m.deviceModelId
                          ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Barcode Print Modal */}
      {barcodeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBarcodeProduct(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-600" /> Print Barcode Label
            </h3>
            <div
              id="barcode-label"
              className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200"
              style={barcodeTemplate ? {
                width: `${barcodeTemplate.labelWidthMm * 3.78}px`,
                minHeight: `${barcodeTemplate.labelHeightMm * 3.78}px`,
              } : {}}
            >
              {(!barcodeTemplate || barcodeTemplate.showProductName) && (
                <p className="text-sm font-semibold text-gray-900 mb-1 text-center">{barcodeProduct.name}</p>
              )}
              {barcodeProduct.sku ? (
                <Barcode
                  value={barcodeProduct.sku}
                  format={toBarcodeFormat(barcodeTemplate?.codeType ?? 'Code128') as any}
                  width={1.5}
                  height={barcodeTemplate ? Math.max(30, barcodeTemplate.labelHeightMm * 1.5) : 60}
                  fontSize={12}
                  displayValue={!barcodeTemplate || barcodeTemplate.showSKU}
                />
              ) : (
                <p className="text-xs text-gray-400">No SKU available</p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setBarcodeProduct(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
