import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { CategoryFilter } from '@flowtap/ui-core'
import { ProductCard } from '@flowtap/ui-core'
import { CartItemRow } from '@flowtap/ui-core'
import { CartSummary } from '@flowtap/ui-core'
import { PaymentPanel } from '@flowtap/ui-core'
import { ReceiptModal } from '@flowtap/ui-core'
import { FoodOrderBar } from '@flowtap/ui-core'
import { useAppDispatch, useAppSelector } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'
import { addItem, clearCart, setClient, clearClient, updateItemNotes } from '@flowtap/store'
import { inventoryApi } from '@flowtap/api-core'
import { ticketsApi } from '@flowtap/api-core'
import { salesApi } from '@flowtap/api-core'
import { clientsApi } from '@flowtap/api-core'
import { ShoppingCart, Package, Wrench, UserCircle, X, Search, ScanLine, Barcode, Users, UserPlus, CheckCircle2 } from 'lucide-react'
import { cn } from '@flowtap/shared'
import toast from 'react-hot-toast'
import type { POSProduct } from '@flowtap/shared'
import { Modal, Select, Input, Button } from '@flowtap/ui-core'

// â"€â"€â"€ Local types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface POSService {
  id: string
  name: string
  description?: string
  basePrice: number
  isUniversal: boolean
  serviceCategoryId?: string
}

interface DeviceBrand { id: string; name: string }
interface DeviceModel { id: string; name: string; brandId?: string }

interface TaxLine { label: string; amount: number }

type ReceiptData = {
  saleId: string
  items: { name: string; quantity: number; price: number; total: number }[]
  subtotal: number
  discount: number
  tax: number
  taxBreakdown: TaxLine[]
  isInclusive: boolean
  total: number
  paymentMethod: string
  tenantName: string
  createdAt: string
}

export const POSPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const cart = useAppSelector((s) => s.cart)
  const tenant   = useAppSelector((s) => s.tenant.tenant)
  const isRepair = tenant?.industryType === 'RepairShop'
  const isFood   = tenant?.industryType === 'Food'
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)
  const authUser = useAppSelector((s) => s.auth.user)              // employee when switched, owner otherwise
  const { format } = useCurrency()

  // Ticket-checkout context (set when navigating from TicketDetailPage → Collect)
  const ticketId       = cart.ticketId
  const ticketNumber   = cart.ticketNumber
  const advancePaid    = cart.ticketAdvancePaid ?? 0

  // Food industry context — undefined for Repair/Retail
  const foodTableId    = cart.tableId
  const foodOrderType  = cart.foodOrderType

  const [products, setProducts] = useState<POSProduct[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')
  const [charging, setCharging] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // â"€â"€ Content tab (Products vs Services) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [contentTab, setContentTab] = useState<'products' | 'services'>('products')

  // â"€â"€ Unified search â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [posSearch, setPosSearch] = useState('')
  const [searchResults, setSearchResults] = useState<POSProduct[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // â"€â"€ Services â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [services, setServices] = useState<POSService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState<string | null>(null)

  // â"€â"€ Device filter (driven by CategoryFilter drill-down) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [modelProducts, setModelProducts] = useState<POSProduct[] | null>(null)
  const [modelServices, setModelServices] = useState<POSService[] | null>(null)
  const [brands, setBrands] = useState<DeviceBrand[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])

  // â"€â"€ Serial scan â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [scanInput, setScanInput] = useState('')
  const [scanning, setScanning] = useState(false)

  const [taxConfig, setTaxConfig] = useState({ isInclusive: false })
  const [taxSlabs, setTaxSlabs] = useState<any[]>([])

  // â"€â"€ Employees & Warehouses â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [employees, setEmployees] = useState<{ id: string; name: string; jobTitle?: string }[]>([])  // used for technician dropdown in service config
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])

  // â"€â"€ Service Config modal state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [activeService, setActiveService] = useState<POSService | null>(null)
  const [serviceConfig, setServiceConfig] = useState({
    brandId: '',
    brandName: '',
    modelId: '',
    modelName: '',
    problem: '',
    password: '',
    appearance: '',
    technicianId: '',
    estimatedCost: '',
  })
  const [selectedParts, setSelectedParts] = useState<{ productId: string; name: string; quantity: number; unitPrice: number; warehouseId: string }[]>([])
  const [compatibleProducts, setCompatibleProducts] = useState<any[]>([])
  const [loadingCompatible, setLoadingCompatible] = useState(false)

  // Load Tax settings (store-specific config if currentStoreId is set, falls back to company-wide)
  useEffect(() => {
    if (!tenant?.id) return
    import('@flowtap/api-core').then((mod) => {
      mod.taxApi.getConfiguration(tenant.id!, currentStoreId ?? undefined)
        .then((res) => {
          const d = res.data?.data ?? res.data
          if (d) setTaxConfig({ isInclusive: d.isInclusive ?? false })
        })
      mod.taxApi.getSlabs(tenant.id!).then((res) => {
        const d = res.data?.data ?? res.data
        setTaxSlabs(Array.isArray(d) ? d : [])
      })
    }).catch(() => {})
  }, [tenant?.id, currentStoreId])

  // Load active employees (technicians) and warehouses
  useEffect(() => {
    if (!tenant?.id) return
    import('@flowtap/api-core').then((mod) => {
      mod.employeesApi.getEmployees({ companyId: tenant.id!, isActive: true, pageSize: 200 })
        .then((res) => {
          const raw = res.data?.data?.items ?? res.data?.data ?? []
          setEmployees((Array.isArray(raw) ? raw : []).map((e: any) => ({
            id: String(e.id),
            name: String(e.name ?? ''),
            jobTitle: e.jobTitle ? String(e.jobTitle) : undefined,
          })))
        })
    }).catch(() => {})

    inventoryApi.getWarehouses({ companyId: tenant.id })
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? []
        setWarehouses((Array.isArray(raw) ? raw : []).map((w: any) => ({
          id: String(w.id),
          name: String(w.name ?? ''),
        })))
      }).catch(() => {})
  }, [tenant?.id])

  // Load services
  useEffect(() => {
    if (!tenant?.id) return
    setLoadingServices(true)
    ticketsApi.getServices(tenant.id)
      .then((res) => {
        const data = res.data?.data?.items ?? res.data?.data ?? []
        setServices(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => setLoadingServices(false))
  }, [tenant?.id])

  // Unified search â€" debounced product search when in products tab;
  // for services tab the filter is done inline (client-side)
  useEffect(() => {
    if (!posSearch.trim() || contentTab !== 'products') {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await inventoryApi.getProducts({
          companyId: tenant?.id ?? '',
          search: posSearch,
          locationId: currentStoreId ?? undefined,
          pageSize: 20,
          kind: isFood ? 'FinalProduct' : undefined,
        })
        setSearchResults(res.data?.data?.items ?? res.data?.data ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [posSearch, contentTab, tenant?.id, currentStoreId])

  // Clear search results when switching tabs
  useEffect(() => {
    setPosSearch('')
    setSearchResults([])
  }, [contentTab])

  // Filter by model when model changes
  useEffect(() => {
    if (!selectedModelId || !tenant?.id) { setModelProducts(null); setModelServices(null); return }
    inventoryApi.getProductsByModel(selectedModelId, tenant.id).then((res) => {
      const data = res.data?.data ?? res.data ?? []
      setModelProducts(Array.isArray(data) ? data : [])
    }).catch(() => { setModelProducts(null) })
    ticketsApi.getServicesByModel(selectedModelId, tenant.id).then((res) => {
      const data = res.data?.data ?? res.data ?? []
      setModelServices(Array.isArray(data) ? data : [])
    }).catch(() => { setModelServices(null) })
  }, [selectedModelId, tenant?.id])

  // Initialize serviceConfig when activeService modal is opened
  useEffect(() => {
    if (activeService) {
      setServiceConfig({
        brandId: selectedBrandId || '',
        brandName: '',   // user picks brand inside modal
        modelId: selectedModelId || '',
        modelName: '',   // user picks model inside modal
        problem: activeService.description || '',
        password: '',
        appearance: '',
        technicianId: employees[0]?.id || '',
        estimatedCost: String(activeService.basePrice),
      })
      setSelectedParts([])
      
      // Load available device brands for service configuration
      inventoryApi.getDeviceBrands()
        .then((res) => {
          const data: any[] = res.data?.data ?? res.data ?? []
          setBrands(data.map((b: any) => ({
            id: String(b.id),
            name: String(b.name),
          })))
        })
        .catch(() => setBrands([]))
    }
  }, [activeService, selectedBrandId, selectedModelId, employees])

  // Load compatible spare parts when modelId is chosen in service configuration modal
  useEffect(() => {
    if (!serviceConfig.modelId || !tenant?.id) { setCompatibleProducts([]); return }
    setLoadingCompatible(true)
    inventoryApi.getProductsByModel(serviceConfig.modelId, tenant.id)
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? []
        setCompatibleProducts(Array.isArray(raw) ? raw : [])
      })
      .catch(() => setCompatibleProducts([]))
      .finally(() => setLoadingCompatible(false))
  }, [serviceConfig.modelId, tenant?.id])

  // Handle compatible device model parts selection / adjustments
  const handlePartToggle = (prod: any) => {
    const exists = selectedParts.some(p => p.productId === prod.id)
    if (exists) {
      setSelectedParts(selectedParts.filter(p => p.productId !== prod.id))
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          unitPrice: prod.locationSalePrice ?? prod.defaultSalePrice ?? 0,
          warehouseId: warehouses[0]?.id || '',
        }
      ])
    }
  }

  const handleUpdatePartQty = (productId: string, qty: number) => {
    setSelectedParts(selectedParts.map(p => p.productId === productId ? { ...p, quantity: qty } : p))
  }

  const handleUpdatePartWarehouse = (productId: string, whId: string) => {
    setSelectedParts(selectedParts.map(p => p.productId === productId ? { ...p, warehouseId: whId } : p))
  }

  // Computed totals
  const subtotal = cart.items.reduce((s, i) => s + i.total, 0)
  const discountAmt = subtotal * cart.discountPercent / 100
  const baseDiscounted = subtotal - discountAmt

  // Per-component tax breakdown (CGST, SGST, HST, VAT, etc.)
  const taxBreakdown = useMemo<TaxLine[]>(() => {
    const componentMap: Record<string, number> = {}

    for (const item of cart.items) {
      const itemNet = item.total * (1 - cart.discountPercent / 100)
      const slab = taxSlabs.find((s: any) => s.id === item.taxSlabId)
      const totalSlabRate: number = slab?.rate ?? item.taxRate ?? 0
      if (totalSlabRate === 0) continue

      const rules: Array<{ componentName: string; rate: number }> = slab?.rateRules ?? []
      const isInclusive = item.isTaxIncluded ?? taxConfig.isInclusive

      if (rules.length > 1) {
        // Multi-component slab â€" compute each component separately
        for (const rule of rules) {
          const amt = isInclusive
            ? itemNet * rule.rate / (100 + totalSlabRate)   // extract portion
            : itemNet * rule.rate / 100                      // add on top
          componentMap[rule.componentName] = (componentMap[rule.componentName] ?? 0) + amt
        }
      } else {
        // Single-component (or no slab detail) â€" treat as one line
        const label = rules[0]?.componentName ?? slab?.code ?? 'Tax'
        const amt = isInclusive
          ? itemNet * totalSlabRate / (100 + totalSlabRate)
          : itemNet * totalSlabRate / 100
        componentMap[label] = (componentMap[label] ?? 0) + amt
      }
    }

    return Object.entries(componentMap).map(([label, amount]) => ({ label, amount: parseFloat(amount.toFixed(2)) }))
  }, [cart.items, cart.discountPercent, taxSlabs, taxConfig.isInclusive])

  const totalTax = parseFloat(taxBreakdown.reduce((s, l) => s + l.amount, 0).toFixed(2))
  const total = parseFloat((cart.items.reduce((sum, item) => {
    const itemNet = item.total * (1 - cart.discountPercent / 100)
    const isInclusive = item.isTaxIncluded ?? taxConfig.isInclusive
    if (isInclusive) {
      return sum + itemNet
    } else {
      const slab = taxSlabs.find((s: any) => s.id === item.taxSlabId)
      const rate = slab?.rate ?? item.taxRate ?? 0
      const itemTax = itemNet * rate / 100
      return sum + itemNet + itemTax
    }
  }, 0)).toFixed(2))

  // In ticket-checkout mode the advance already paid is deducted from what the cashier owes
  const effectiveTotal = Math.max(0, parseFloat((total - advancePaid).toFixed(2)))

  // Charge-button state — mirrors PaymentPanel's internal logic so the sticky footer button
  // can show the right label without needing to lift state out of PaymentPanel.
  const cartPaid       = cart.payments.reduce((s, p) => s + p.amount, 0)
  const isAdvFull      = effectiveTotal <= 0.01
  const cartBalance    = Math.max(0, effectiveTotal - cartPaid)
  const isFullyPaid    = isAdvFull || cartPaid >= effectiveTotal - 0.01
  const canCharge      = isAdvFull || cart.payments.length > 0

  // Load products when category or store changes (not when there's an active search)
  const loadProducts = useCallback(() => {
    if (!tenant?.id) return
    if (posSearch.trim()) return  // search results are shown instead
    setLoadingProducts(true)
    inventoryApi
      .getProducts({
        companyId: tenant.id,
        categoryId: selectedCategory ?? undefined,
        isActive: true,
        pageSize: 40,
        locationId: currentStoreId ?? undefined,
        kind: isFood ? 'FinalProduct' : undefined,
      })
      .then((res) => setProducts(res.data.data?.items ?? res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [tenant?.id, selectedCategory, currentStoreId, posSearch, isFood])

  useEffect(() => { loadProducts() }, [loadProducts])

  const handleAddPOSProduct = (product: POSProduct) => {
    // Prefer location-specific tax slab (e.g. HST for Canada store) over product default (e.g. GST)
    const effectiveTaxSlabId = product.locationTaxSlabId ?? (product as any).taxSlabId
    const slab = taxSlabs.find((s: any) => s.id === effectiveTaxSlabId)
    const rate: number = slab?.rate ?? (product as any).taxRate ?? 0

    // Use store-specific price if available (already loaded with the product list)
    const salePrice     = product.locationSalePrice ?? product.defaultSalePrice
    const isTaxIncluded = product.locationIsTaxIncluded ?? taxConfig.isInclusive

    dispatch(
      addItem({
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: salePrice,
        quantity: 1,
        discount: 0,
        taxSlabId: effectiveTaxSlabId,
        taxRate: rate,
        isTaxIncluded,
      })
    )
    // Switch to cart view on mobile after adding
    if (mobileTab === 'products') setMobileTab('cart')
    toast.success(`${product.name} added`, { duration: 1000 })
  }

  const handleAddService = (service: POSService) => {
    setServiceModalOpen(true)
    setServiceSearch('')
    setServiceResults([])
  }

  const handleConfirmService = async () => {
    if (!serviceConfig.brandId || !serviceConfig.modelId) {
      toast.error('Please select a device brand and model')
      return
    }
    if (!serviceConfig.problem.trim()) {
      toast.error('Problem description is required')
      return
    }

    setCharging(true)
    try {
      // Create service ticket directly with selected client
      const ticketRes = await ticketsApi.createTicket({
        companyId: tenant!.id,
        locationId: currentStoreId ?? undefined,
        clientId: cart.clientId || undefined,  // Use selected client if available
        deviceBrandId: serviceConfig.brandId,
        deviceModelId: serviceConfig.modelId,
        problemDescription: serviceConfig.problem,
        estimatedCost: parseFloat(serviceConfig.estimatedCost) || activeService!.basePrice,
        technicianEmployeeId: serviceConfig.technicianId || undefined,
        appearance: serviceConfig.appearance || undefined,
        password: serviceConfig.password || undefined,
        reason: serviceConfig.problem,
      })
      
      const newServiceTicketId = ticketRes.data?.data?.id ?? ticketRes.data?.id

      if (newServiceTicketId) {
        // Add compatible spare parts to the ticket if selected
        const totalPartsCost = selectedParts.reduce((s, p) => s + p.unitPrice * p.quantity, 0)
        for (const part of selectedParts) {
          try {
            await ticketsApi.addPart(newServiceTicketId, {
              productId: part.productId,
              warehouseId: part.warehouseId,
              quantity: part.quantity,
              unitPrice: part.unitPrice,
            })
          } catch (err) {
            console.error('Failed to add part to service ticket:', err)
          }
        }
      }

      setActiveService(null)
      setServiceModalOpen(false)
      setServiceSearch('')
      setServiceResults([])
      
      // Clear form
      setServiceConfig({
        brandId: '',
        brandName: '',
        modelId: '',
        modelName: '',
        problem: '',
        password: '',
        appearance: '',
        technicianId: '',
        estimatedCost: '',
      })
      setSelectedParts([])
      setBrands([])
      setModels([])
      
      toast.success(`Service ticket created successfully!`)
    } catch (err) {
      console.error('Failed to create service ticket:', err)
      toast.error('Failed to create service ticket. Please try again.')
    } finally {
      setCharging(false)
    }
  }

  const handleScan = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || !tenant?.id) return
    setScanning(true)
    try {
      const res = await inventoryApi.getSerials({ companyId: tenant.id, serialNumber: trimmed, pageSize: 1 })
      const items = res.data?.data?.items ?? res.data?.data ?? []
      const serial = items[0]
      if (!serial) { toast.error('Serial not found'); return }
      if (serial.isSold) { toast.error('This item is already sold'); return }
      // Look up the product's tax rate from loaded slabs
      const serialNum = serial.companySerial || serial.manufacturerSerial || trimmed
      const serialSlab = taxSlabs.find((s: any) => s.id === serial.taxSlabId)
      const serialTaxRate: number = serialSlab?.rate ?? 0

      dispatch(
        addItem({
          id: serial.id,          // use serial id â€" prevents duplicate scan of same unit
          productId: serial.productId,
          type: 'Product',
          name: serial.productName,
          sku: serialNum,         // serial number stored in sku for display
          price: serial.salePrice ?? 0,
          quantity: 1,
          discount: 0,
          taxSlabId: serial.taxSlabId,
          taxRate: serialTaxRate,
        })
      )
      toast.success(`Added: ${serial.productName}`)
      setScanInput('')
    } catch {
      toast.error('Scan failed')
    } finally {
      setScanning(false)
    }
  }

  // Called by CategoryFilter when brand/model selection changes
  const handleBrandModelSelect = (brandId: string | null, modelId: string | null) => {
    setSelectedBrandId(brandId ?? '')
    setSelectedModelId(modelId ?? '')
    if (!brandId && !modelId) {
      setModelProducts(null)
      setModelServices(null)
    }
  }

  // Called by CategoryFilter when a category is selected (for services tab)
  const handleServiceCategorySelect = (categoryId: string | null) => {
    setSelectedServiceCategoryId(categoryId)
  }

  // Client picker
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<{ id: string; name: string; phone?: string; email?: string; totalSpent?: number }[]>([])
  const [clientSearching, setClientSearching] = useState(false)
  const [clientPage, setClientPage] = useState(1)
  const [hasMoreClients, setHasMoreClients] = useState(false)

  // Service picker
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceResults, setServiceResults] = useState<POSService[]>([])
  const [serviceSearching, setServiceSearching] = useState(false)

  // Load clients when modal opens - fetch all clients or search results
  useEffect(() => {
    if (!clientModalOpen || !tenant?.id) return
    
    setClientSearching(true)
    setClientPage(1)
    
    const query: any = { 
      companyId: tenant.id, 
      pageSize: 15,
      pageNumber: 1
    }
    
    if (clientSearch.trim()) {
      query.search = clientSearch
    }
    
    clientsApi.getClients(query)
      .then((res) => {
        const raw = res.data.data?.items ?? res.data.data ?? []
        const clients = (Array.isArray(raw) ? raw : []).map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          phone: c.phone ? String(c.phone) : undefined,
          email: c.email ? String(c.email) : undefined,
          totalSpent: c.totalSpent ? Number(c.totalSpent) : undefined,
        }))
        setClientResults(clients)
        setHasMoreClients(clients.length >= 15)
      })
      .catch(() => setClientResults([]))
      .finally(() => setClientSearching(false))
  }, [clientModalOpen, tenant?.id])

  // Handle search - debounced
  useEffect(() => {
    if (!clientModalOpen || !tenant?.id) return
    
    const timer = setTimeout(() => {
      setClientSearching(true)
      setClientPage(1)
      
      const query: any = { 
        companyId: tenant.id, 
        pageSize: 15,
        pageNumber: 1
      }
      
      if (clientSearch.trim()) {
        query.search = clientSearch
      }
      
      clientsApi.getClients(query)
        .then((res) => {
          const raw = res.data.data?.items ?? res.data.data ?? []
          const clients = (Array.isArray(raw) ? raw : []).map((c: Record<string, unknown>) => ({
            id: String(c.id),
            name: String(c.name ?? ''),
            phone: c.phone ? String(c.phone) : undefined,
            email: c.email ? String(c.email) : undefined,
            totalSpent: c.totalSpent ? Number(c.totalSpent) : undefined,
          }))
          setClientResults(clients)
          setHasMoreClients(clients.length >= 15)
        })
        .catch(() => setClientResults([]))
        .finally(() => setClientSearching(false))
    }, 300)
    
    return () => clearTimeout(timer)
  }, [clientSearch, clientModalOpen, tenant?.id])

  // Load services when service picker modal opens
  useEffect(() => {
    if (!serviceModalOpen || !tenant?.id) return
    
    setServiceSearching(true)
    
    // Filter services based on search and selected category
    let filtered = services
    
    if (serviceSearch.trim()) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.description?.toLowerCase().includes(serviceSearch.toLowerCase())
      )
    }
    
    if (selectedServiceCategoryId) {
      filtered = filtered.filter(s => s.serviceCategoryId === selectedServiceCategoryId)
    }
    
    setServiceResults(filtered)
    setServiceSearching(false)
  }, [serviceModalOpen, serviceSearch, tenant?.id, selectedServiceCategoryId, services])

  const handleSelectService = (service: POSService) => {
    setActiveService(service)
    setServiceModalOpen(false)
    setServiceSearch('')
    setServiceResults([])
  }

  const handleSelectClient = (client: { id: string; name: string }) => {
    dispatch(setClient({ id: client.id, name: client.name }))
    setClientModalOpen(false)
    setClientSearch('')
    setClientResults([])
  }

  const handleRemoveClient = () => {
    dispatch(clearClient())
  }

  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Background Sync
  useEffect(() => {
    if (isOnline) {
      import('@flowtap/shared').then(async (mod) => {
        const pending = await mod.offlineService.getPendingSales()
        for (const sale of pending) {
          try {
            await salesApi.createSale(sale.saleData)
            await mod.offlineService.markAsSynced(sale.id!)
          } catch {
            // Retry later
          }
        }
      })
    }
  }, [isOnline])

  const handleCharge = async () => {
    if (cart.items.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setCharging(true)
    try {
      const saleData = {
        companyId:      tenant!.id,
        locationId:     currentStoreId,
        clientId:       cart.clientId || null,   // null = walk-in, backend creates "Walk-in Customer"
        employeeId:     authUser?.employeeId ?? null,
        source:         'POS',
        idempotencyKey: crypto.randomUUID(),

        // Payments â€" all methods selected by cashier
        payments: cart.payments.map(p => ({
          method:  p.method,
          amount:  p.amount,
          purpose: p.purpose,
        })),

        // Items â€" normalize price + combine discounts
        items: cart.items.map((i) => {
          // Backend always adds tax on top: total = net * (1 + taxRate/100)
          // For inclusive tax, the item.price already contains tax â†’ extract net price
          const isInclusive = i.isTaxIncluded ?? taxConfig.isInclusive
          const netPrice = isInclusive && i.taxRate > 0
            ? i.price / (1 + i.taxRate / 100)
            : i.price

          // Combine item-level discount + order-level discount into one absolute amount
          // Formula: gross - gross*(1-itemDisc%)*(1-orderDisc%)
          const lineGross   = netPrice * i.quantity
          const discountAmt = parseFloat(
            (lineGross * (1 - (1 - i.discount / 100) * (1 - cart.discountPercent / 100))).toFixed(2)
          )

          return {
            productId:       i.productId,
            productName:     i.name,
            type:            i.type ?? 'Product',
            quantity:        i.quantity,
            unitPrice:       parseFloat(netPrice.toFixed(4)),
            discountPercent: i.discount,
            discountAmount:  discountAmt,
            taxPercent:      i.taxRate,
            // Serial number: cart items added via scan have sku = the serial number string
            // (non-scanned items have sku = product.sku barcode, which is different from their id)
            serialNumber: i.type === 'Product' && i.sku && i.sku !== i.productId ? i.sku : undefined,
            // Food industry — per-item variant + special instructions
            variantId: isFood ? i.variantId : undefined,
            notes:     isFood ? i.notes     : undefined,
          }
        }),

        // Food industry — table + order type (null for Repair/Retail)
        tableId:       isFood ? foodTableId    : undefined,
        foodOrderType: isFood ? (foodOrderType ?? 'Takeaway') : undefined,
      }

      if (!isOnline) {
        const mod = await import('@flowtap/shared')
        await mod.offlineService.queueSale(saleData)
        toast.success('Sale queued offline!')
      } else if (ticketId) {
        // ── Ticket-checkout mode ────────────────────────────────────────────────
        // The backend already has all ticket items — we just confirm collection
        // and record the remaining payment (if any).
        const finalAmount = cart.payments.reduce((s, p) => s + p.amount, 0)
        const finalMethod = cart.payments[0]?.method ?? 'Cash'
        const res = await ticketsApi.collectTicket(ticketId, {
          finalPaymentAmount: finalAmount > 0 ? finalAmount : undefined,
          finalPaymentMethod: finalAmount > 0 ? finalMethod : undefined,
        })
        const saleId = res.data?.data ?? res.data ?? crypto.randomUUID()
        setReceipt({
          saleId: String(saleId),
          items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal,
          discount: discountAmt,
          tax: totalTax,
          taxBreakdown,
          isInclusive: taxConfig.isInclusive,
          total,
          paymentMethod: cart.payments.map(p => p.method).join(', ') || 'Advance',
          tenantName: tenant?.title ?? 'Flowtap',
          createdAt: new Date().toISOString(),
        })
        toast.success('Ticket collected — sale created!')
      } else {
        // ── Regular POS sale ────────────────────────────────────────────────────
        // Auto-create Service Ticket for any Service items that have a ticket config
        const serviceItems = cart.items.filter(i => i.type === 'Service' && i.ticketConfig)
        for (const item of serviceItems) {
          const config = item.ticketConfig!
          try {
            const ticketRes = await ticketsApi.createTicket({
              companyId: tenant!.id,
              locationId: currentStoreId ?? undefined,
              clientId: cart.clientId || undefined,
              deviceBrandId: config.brandId,
              deviceModelId: config.modelId,
              problemDescription: config.problem,
              estimatedCost: config.estimatedCost,
              technicianEmployeeId: config.technicianId || undefined,
              appearance: config.appearance,
              password: config.password,
              reason: config.problem,
            })
            const newTicketId = ticketRes.data?.data?.id ?? ticketRes.data?.id
            if (newTicketId) {
              for (const part of config.parts) {
                try {
                  await ticketsApi.addPart(newTicketId, {
                    productId: part.productId,
                    warehouseId: part.warehouseId,
                    quantity: part.quantity,
                    unitPrice: part.unitPrice,
                  })
                } catch (err) {
                  console.error('Failed to add part to service ticket:', err)
                }
              }
            }
          } catch (err) {
            console.error('Failed to auto-create service ticket during checkout:', err)
          }
        }

        const res = await salesApi.createSale(saleData)
        const saleId = res.data.data?.id ?? crypto.randomUUID()
        const amountPaid = cart.payments.reduce((s, p) => s + p.amount, 0)
        const isDraft    = amountPaid < total - 0.009

        setReceipt({
          saleId,
          items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal,
          discount: discountAmt,
          tax: totalTax,
          taxBreakdown,
          isInclusive: taxConfig.isInclusive,
          total,
          paymentMethod: cart.payments.map(p => p.method).join(', '),
          tenantName: tenant?.title ?? 'Flowtap',
          createdAt: new Date().toISOString(),
        })
        toast.success(isDraft ? 'Sale saved as Draft — balance due.' : 'Sale completed!')
      }

      dispatch(clearCart())
      setMobileTab('products')
      // Reload product stock so the grid reflects the deducted quantities immediately
      loadProducts()
    } catch {
      toast.error('Failed to complete sale. Please try again.')
    } finally {
      setCharging(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Mobile tab switcher */}
      <div className="lg:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <button
          onClick={() => setMobileTab('products')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors',
            mobileTab === 'products'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500'
          )}
        >
          <Package className="w-4 h-4" /> Products
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors relative',
            mobileTab === 'cart'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500'
          )}
        >
          <ShoppingCart className="w-4 h-4" /> Cart
          {cart.items.length > 0 && (
            <span className="absolute top-2 right-[calc(50%-30px)] w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
              {cart.items.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* â"€â"€ Left: POSProduct Panel â"€â"€ */}
        <div
          className={cn(
            'flex flex-col flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950',
            mobileTab === 'cart' && 'hidden lg:flex'
          )}
        >
          {/* Top bar: Serial scan + Products/Services tab + Device filter */}
          <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">

            {/* â"€â"€ Row 1: Products/Services switcher + unified search + serial scan â"€â"€ */}
            <div className="flex gap-2 items-center">
              {/* Products / Services tab switcher */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-shrink-0">
                <button
                  onClick={() => setContentTab('products')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    contentTab === 'products'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Products</span>
                </button>
                {isRepair && (
                  <button
                    onClick={() => setContentTab('services')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      contentTab === 'services'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Services</span>
                  </button>
                )}
              </div>

              {/* Unified search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  onKeyDown={(e) => {
                    // Barcode scan: Enter with 8+ chars that have no spaces
                    if (e.key === 'Enter' && posSearch.length >= 8 && !posSearch.includes(' ')) {
                      // Try SKU lookup first
                      inventoryApi.getProducts({
                        companyId: tenant?.id ?? '',
                        sku: posSearch,
                        locationId: currentStoreId ?? undefined,
                      }).then((res) => {
                        const items: POSProduct[] = res.data?.data?.items ?? res.data?.data ?? []
                        if (items.length === 1) {
                          handleAddPOSProduct(items[0])
                          setPosSearch('')
                          setSearchResults([])
                        } else {
                          // Fall back to serial scan
                          handleScan(posSearch)
                        }
                      }).catch(() => handleScan(posSearch))
                    }
                  }}
                  placeholder={
                    contentTab === 'products'
                      ? 'Search products or scan barcodeâ€¦ (F2)'
                      : 'Search servicesâ€¦'
                  }
                  className="w-full pl-9 pr-8 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  autoComplete="off"
                />
                {posSearch && (
                  <button
                    onClick={() => { setPosSearch(''); setSearchResults([]); searchInputRef.current?.focus() }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {!posSearch && <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />}

                {/* Search results dropdown (products tab only) */}
                {contentTab === 'products' && (searchResults.length > 0 || searchLoading) && posSearch.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-20 max-h-64 overflow-y-auto">
                    {searchLoading ? (
                      <div className="p-4 text-center text-gray-400 text-sm">Searchingâ€¦</div>
                    ) : (
                      searchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { handleAddPOSProduct(p); setPosSearch(''); setSearchResults([]) }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                        >
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{p.name}</div>
                            <div className="text-xs text-gray-500">{p.sku} Â· Stock: {p.stock ?? (p as any).stockQuantity ?? 0}</div>
                          </div>
                          <div className="text-sm font-semibold text-blue-600">
                            {format(p.locationSalePrice ?? p.defaultSalePrice)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Serial scan spinner */}
              {scanning && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            </div>

            {/* â"€â"€ Row 2: Hierarchical category navigation â"€â"€ */}
            <CategoryFilter
              tab={contentTab}
              onCategorySelect={(id) => {
                if (contentTab === 'products') {
                  setSelectedCategory(id)
                  setSelectedModelId('')
                  setModelProducts(null)
                } else {
                  handleServiceCategorySelect(id)
                }
              }}
              onBrandModelSelect={handleBrandModelSelect}
            />
          </div>

          {/* Content: Products grid */}
          {contentTab === 'products' && (
          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (modelProducts !== null ? modelProducts : products).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No products found</p>
                <p className="text-sm mt-1">Try a different category or search</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {(modelProducts !== null ? modelProducts : products).map((p) => (
                  <ProductCard key={p.id} product={p} onAdd={handleAddPOSProduct} />
                ))}
              </div>
            )}
          </div>
          )}

          {/* Content: Services list — repair industry only */}
          {contentTab === 'services' && isRepair && (
          <div className="flex-1 overflow-y-auto p-4">
            {loadingServices ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              (() => {
                const displayServices = modelServices !== null ? modelServices : services
                const filtered = displayServices.filter((s) => {
                  if (posSearch && !s.name.toLowerCase().includes(posSearch.toLowerCase())) return false
                  if (selectedServiceCategoryId && s.serviceCategoryId !== selectedServiceCategoryId) return false
                  return true
                })
                return filtered.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No services found</p>
                    <p className="text-sm mt-1">Add services from the Service Tickets section</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => handleAddService(svc)}
                        className="flex flex-col items-start p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 hover:shadow-md transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                          <Wrench className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">{svc.name}</p>
                        {svc.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{svc.description}</p>
                        )}
                        <p className="mt-auto pt-2 text-base font-bold text-blue-600 dark:text-blue-400">
                          {format(svc.basePrice)}
                        </p>
                      </button>
                    ))}
                  </div>
                )
              })()
            )}
          </div>
          )}
        </div>

        {/* â"€â"€ Right: Cart Panel â"€â"€ */}
        <div
          className={cn(
            'flex flex-col w-full lg:w-96 xl:w-[420px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0',
            mobileTab === 'products' && 'hidden lg:flex'
          )}
        >
          {/* ── Ticket-checkout banner (fixed at top) ── */}
          {ticketId && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold flex-shrink-0">
              <Wrench className="w-4 h-4 shrink-0" />
              <span className="flex-1">Ticket #{ticketNumber} — Collecting</span>
              {advancePaid > 0 && (
                <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Advance: {format(advancePaid)}
                </span>
              )}
            </div>
          )}

          {/* ── Cart header (fixed at top) ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900 dark:text-white">Cart</span>
              {cart.items.length > 0 && (
                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.items.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {cart.clientId ? (
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                  <UserCircle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium max-w-[100px] truncate">{cart.clientName}</span>
                  <button onClick={handleRemoveClient} className="ml-0.5 hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setClientModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <UserCircle className="w-4 h-4" />
                  Add Client
                </button>
              )}
              {cart.items.length > 0 && (
                <button
                  onClick={() => dispatch(clearCart())}
                  className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Clear cart"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Food order bar — Dine In / Takeaway / Delivery + table picker */}
          {isFood && (
            <div className="px-3 pt-2">
              <FoodOrderBar
                companyId={tenant!.id}
                locationId={currentStoreId ?? ''}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
               ZONE 1 — ITEMS  (always visible, own scroll, ~40% height)
               Items live here permanently so they're never scrolled away.
          ═══════════════════════════════════════════════════════════════ */}
          <div
            className={cn(
              'overflow-y-auto px-3',
              cart.items.length === 0
                ? 'flex-1'                // empty: fill all space
                : 'flex-[0_0_40%] border-b border-gray-100 dark:border-gray-700'
            )}
          >
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
                <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-medium">Cart is empty</p>
                <p className="text-sm mt-1">Add products from the left panel</p>
              </div>
            ) : (
              <>
                {/* section label */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-2 pb-1 px-1">
                  Items ({cart.items.length})
                </p>
                {cart.items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    readOnly={!!ticketId}
                    showNotes={isFood}
                    onNotesChange={(id, notes) => dispatch(updateItemNotes({ id, notes }))}
                  />
                ))}
              </>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
               ZONE 2 — SUMMARY + PAYMENT  (own scroll, gets remaining space)
               Always visible below items. Charge button pinned at bottom.
          ═══════════════════════════════════════════════════════════════ */}
          {cart.items.length > 0 && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-2 space-y-3">
                <CartSummary
                  subtotal={subtotal}
                  discountAmt={discountAmt}
                  taxBreakdown={taxBreakdown}
                  totalTax={totalTax}
                  total={total}
                  isInclusive={taxConfig.isInclusive}
                  advancePaid={advancePaid > 0 ? advancePaid : undefined}
                />
                <PaymentPanel
                  total={effectiveTotal}
                  onCharge={handleCharge}
                  loading={charging}
                  hideChargeButton
                />
              </div>

              {/* ── Charge button — always pinned at very bottom ── */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-1.5">
                {isFullyPaid ? (
                  <button
                    onClick={() => setCheckoutOpen(true)}
                    disabled={charging}
                    className="w-full py-3.5 rounded-2xl text-base font-black uppercase tracking-widest transition-all bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white shadow-lg shadow-green-500/20 disabled:opacity-70"
                  >
                    {isAdvFull
                      ? <span className="flex flex-col items-center leading-snug">
                          <span>Complete Sale</span>
                          <span className="text-xs font-medium opacity-80">Fully covered by advance</span>
                        </span>
                      : <span className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5" /> Complete Sale
                        </span>
                    }
                  </button>
                ) : canCharge ? (
                  <button
                    onClick={() => setCheckoutOpen(true)}
                    disabled={charging}
                    className="w-full py-3.5 rounded-2xl text-base font-black uppercase tracking-widest transition-all bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white shadow-lg shadow-amber-500/20 disabled:opacity-70"
                  >
                    <span className="flex flex-col items-center leading-snug">
                      <span className="text-sm">Save as Draft</span>
                      <span className="text-xs font-medium opacity-80">Balance due: {format(cartBalance)}</span>
                    </span>
                  </button>
                ) : (
                  <button disabled className="w-full py-3.5 rounded-2xl text-base font-black uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed">
                    Add a Payment to Charge
                  </button>
                )}
                {canCharge && !isFullyPaid && (
                  <p className="text-[10px] text-center text-gray-400">
                    Saved as <span className="font-semibold text-amber-600">Draft</span> — collect remaining {format(cartBalance)} from Sales History.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Receipt modal */}
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />

      {/* ── Pre-checkout review modal ───────────────────────────────────────── */}
      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Order Review"
        size="lg"
      >
        <div className="space-y-4">

          {/* Ticket / client header */}
          {(ticketId || cart.clientName) && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
              {ticketId && (
                <span className="text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-2 py-1 rounded-lg">
                  Ticket #{ticketNumber}
                </span>
              )}
              {cart.clientName && (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {cart.clientName}
                </span>
              )}
            </div>
          )}

          {/* Items list */}
          <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Items ({cart.items.length})
              </p>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-52 overflow-y-auto">
              {cart.items.map((item) => (
                <CartItemRow key={item.id} item={item} readOnly />
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-1">
            <CartSummary
              subtotal={subtotal}
              discountAmt={discountAmt}
              taxBreakdown={taxBreakdown}
              totalTax={totalTax}
              total={total}
              isInclusive={taxConfig.isInclusive}
              advancePaid={advancePaid > 0 ? advancePaid : undefined}
            />
          </div>

          {/* Payments breakdown */}
          {cart.payments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-1">Payments</p>
              {cart.payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {p.method === 'UPI' ? 'UPI/Online' : p.method === 'NetBanking' ? 'Net Banking' : p.method}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      p.purpose === 'Advance' ? 'bg-amber-100 text-amber-700'
                    : p.purpose === 'Partial' ? 'bg-blue-100 text-blue-700'
                    :                           'bg-green-100 text-green-700'
                    )}>
                      {p.purpose}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{format(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Advance-only note */}
          {isAdvFull && (
            <div className="px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300 font-medium text-center">
              Fully covered by advance payment — no further collection needed
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setCheckoutOpen(false)}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={async () => { setCheckoutOpen(false); await handleCharge() }}
              disabled={charging}
              className={cn(
                'flex-[2] py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all disabled:opacity-70',
                isFullyPaid
                  ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20'
                  : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20'
              )}
            >
              {charging
                ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                : isFullyPaid ? 'Confirm & Complete Sale' : 'Confirm & Save Draft'
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* Client Picker Modal */}
      {/* Service Configuration Modal */}
      <Modal
        open={!!activeService}
        onClose={() => setActiveService(null)}
        title={activeService ? `Configure Service: ${activeService.name}` : ''}
        size="lg"
      >
        {activeService && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-900 dark:text-purple-200">
                <span className="font-semibold">ðŸ"‹ This will create a new Service Ticket</span> with the details below. The ticket can be viewed and managed in the Service Tickets section.
              </p>
            </div>

            {/* Client Selection */}
            {cart.clientId ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Client: {cart.clientName}</span>
                </div>
                <button
                  onClick={handleRemoveClient}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setClientModalOpen(true)}
                className="w-full p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-center hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UserCircle className="w-4 h-4" />
                  <span>Select a Client (Optional)</span>
                </div>
              </button>
            )}

            {/* Service Details */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Device Brand *"
                value={serviceConfig.brandId}
                onChange={(e) => {
                  const bid = e.target.value
                  const bname = brands.find(b => b.id === bid)?.name || ''
                  setServiceConfig(prev => ({ ...prev, brandId: bid, brandName: bname, modelId: '', modelName: '' }))
                  if (bid) {
                    inventoryApi.getDeviceModels({ brandId: bid }).then((res) => {
                      const data = res.data?.data ?? res.data ?? []
                      setModels(Array.isArray(data) ? data : [])
                    })
                  } else {
                    setModels([])
                  }
                }}
                options={brands.map(b => ({ value: b.id, label: b.name }))}
                placeholder="Select brand"
              />
              <Select
                label="Device Model *"
                value={serviceConfig.modelId}
                disabled={!serviceConfig.brandId}
                onChange={(e) => {
                  const mid = e.target.value
                  const mname = models.find(m => m.id === mid)?.name || ''
                  setServiceConfig(prev => ({ ...prev, modelId: mid, modelName: mname }))
                }}
                options={models.map(m => ({ value: m.id, label: m.name }))}
                placeholder="Select model"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Assignee Technician"
                value={serviceConfig.technicianId}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, technicianId: e.target.value }))}
                options={employees.map(e => ({ value: e.id, label: e.name }))}
                placeholder="Select technician"
              />
              <Input
                label="Estimated Service Price (â‚¹) *"
                type="number"
                value={serviceConfig.estimatedCost}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, estimatedCost: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Device Password (optional)"
                placeholder="e.g. 1234 or Pattern description"
                value={serviceConfig.password}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, password: e.target.value }))}
              />
              <Input
                label="Physical Condition / Appearance"
                placeholder="e.g. Scratched screen, dented corner"
                value={serviceConfig.appearance}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, appearance: e.target.value }))}
              />
            </div>

            <div>
              <Input
                label="Problem Description *"
                placeholder="Describe issues to be repaired"
                value={serviceConfig.problem}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, problem: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="outline" onClick={() => setActiveService(null)} disabled={charging}>
                Cancel
              </Button>
              <Button onClick={handleConfirmService} loading={charging}>
                Create Service Ticket
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setClientModalOpen(false); setClientSearch(''); setClientResults([]); setClientPage(1) }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Select Client</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search by name, phone or email..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {clientSearching ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : clientResults.length > 0 ? (
                <ul className="py-1">
                  {clientResults.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => handleSelectClient(c)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold flex-shrink-0">
                          {c.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {[c.phone, c.email].filter(Boolean).join(' â€¢ ')}
                          </div>
                          {c.totalSpent !== undefined && c.totalSpent > 0 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                              Total Spent: {format(c.totalSpent)}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600"></div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : clientSearch.trim() ? (
                <div className="py-8 text-center text-gray-400">
                  <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No clients found</p>
                  <p className="text-xs mt-1">Try searching with a different name or phone number</p>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Type to search clients</p>
                  <p className="text-xs mt-1">or select from the list above</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setClientModalOpen(false); setClientSearch(''); setClientResults([]); setClientPage(1) }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Picker Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setServiceModalOpen(false); setServiceSearch(''); setServiceResults([]) }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Select Service</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search services by name..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {serviceSearching ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : serviceResults.length > 0 ? (
                <ul className="py-1">
                  {serviceResults.map((svc) => (
                    <li key={svc.id}>
                      <button
                        onClick={() => handleSelectService(svc)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                          <Wrench className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{svc.name}</p>
                          {svc.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{svc.description}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                            {format(svc.basePrice)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : serviceSearch.trim() ? (
                <div className="py-8 text-center text-gray-400">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No services found</p>
                  <p className="text-xs mt-1">Try searching with different keywords</p>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Type to search services</p>
                  <p className="text-xs mt-1">or select from the list above</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setServiceModalOpen(false); setServiceSearch(''); setServiceResults([]) }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
