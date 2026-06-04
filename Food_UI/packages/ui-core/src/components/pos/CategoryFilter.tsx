import React, { useEffect, useState } from 'react'
import { inventoryApi } from '@flowtap/api-core'
import { ticketsApi } from '@flowtap/api-core'
import { useAppSelector } from '@flowtap/store'
import { cn } from '@flowtap/shared'
import { ChevronRight, Home, Smartphone } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductCategory {
  id: string
  name: string
  parentCategoryId: string | null
  isSubCategoryExist: boolean
  isDirectProductExist: boolean
  isBrandExist: boolean
  color?: string
}

interface ServiceCategory {
  id: string
  name: string
  parentCategoryId: string | null
}

interface Brand { id: string; name: string }
interface Model { id: string; name: string }

// Each frame in the navigation stack describes the current level being displayed
type NavLevel =
  | { type: 'root' }
  | { type: 'prod-sub'; parentId: string; parentName: string }
  | { type: 'brands'; categoryId: string; categoryName: string }
  | { type: 'models'; brandId: string; brandName: string }
  | { type: 'svc-sub'; parentId: string; parentName: string }
  | { type: 'svc-brands' }

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryFilterProps {
  /** 'products' or 'services' — drives which category tree to show */
  tab: 'products' | 'services'
  /** Called with a product or service category id (or null = all) */
  onCategorySelect: (categoryId: string | null) => void
  /** Called when brand or model is selected in the drill-down.
   *  modelId is null when only a brand is selected.
   *  Both null means "clear device filter". */
  onBrandModelSelect: (brandId: string | null, modelId: string | null) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  tab,
  onCategorySelect,
  onBrandModelSelect,
}) => {
  const companyId = useAppSelector((s) => s.tenant.tenant?.id ?? '')

  // Data loaded once
  const [allProductCats, setAllProductCats] = useState<ProductCategory[]>([])
  const [allServiceCats, setAllServiceCats] = useState<ServiceCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<Model[]>([])

  // Navigation stack — bottom is always root
  const [navStack, setNavStack] = useState<NavLevel[]>([{ type: 'root' }])
  // Currently highlighted item at the leaf level
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId) return
    inventoryApi
      .getCategories({ companyId, isActive: true })
      .then((res) => {
        const data: any[] = res.data?.data ?? []
        setAllProductCats(
          data.map((c: any) => ({
            id: String(c.id),
            name: String(c.name),
            parentCategoryId: c.parentCategoryId ? String(c.parentCategoryId) : null,
            isSubCategoryExist: Boolean(c.isSubCategoryExist),
            isDirectProductExist: Boolean(c.isDirectProductExist),
            isBrandExist: Boolean(c.isBrandExist),
            color: c.color ? String(c.color) : undefined,
          }))
        )
      })
      .catch(() => {})
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    ticketsApi
      .getServiceCategories(companyId)
      .then((res) => {
        const data: any[] = res.data?.data ?? []
        setAllServiceCats(
          data.map((c: any) => ({
            id: String(c.id),
            name: String(c.name),
            parentCategoryId: c.parentCategoryId ? String(c.parentCategoryId) : null,
          }))
        )
      })
      .catch(() => {})
  }, [companyId])

  // ── Reset on tab change ─────────────────────────────────────────────────────

  useEffect(() => {
    setNavStack([{ type: 'root' }])
    setActiveId(null)
    setBrands([])
    setModels([])
    onCategorySelect(null)
    onBrandModelSelect(null, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Derived: current level frame ────────────────────────────────────────────

  const currentLevel = navStack[navStack.length - 1]

  // ── Build items for current level ───────────────────────────────────────────

  interface NavItem {
    id: string
    name: string
    /** Whether clicking should drill deeper rather than selecting immediately */
    hasChildren: boolean
    color?: string
  }

  const getItems = (): NavItem[] => {
    if (tab === 'products') {
      switch (currentLevel.type) {
        case 'root':
          return allProductCats
            .filter((c) => c.parentCategoryId === null)
            .map((c) => ({
              id: c.id,
              name: c.name,
              hasChildren: c.isSubCategoryExist || c.isBrandExist,
              color: c.color,
            }))
        case 'prod-sub':
          return allProductCats
            .filter((c) => c.parentCategoryId === currentLevel.parentId)
            .map((c) => ({
              id: c.id,
              name: c.name,
              hasChildren: c.isSubCategoryExist || c.isBrandExist,
              color: c.color,
            }))
        case 'brands':
          return brands.map((b) => ({ id: b.id, name: b.name, hasChildren: true }))
        case 'models':
          return models.map((m) => ({ id: m.id, name: m.name, hasChildren: false }))
        default:
          return []
      }
    } else {
      // Services tab
      switch (currentLevel.type) {
        case 'root':
          return allServiceCats
            .filter((c) => c.parentCategoryId === null)
            .map((c) => ({
              id: c.id,
              name: c.name,
              hasChildren: allServiceCats.some((sc) => sc.parentCategoryId === c.id),
            }))
        case 'svc-sub':
          return allServiceCats
            .filter((c) => c.parentCategoryId === currentLevel.parentId)
            .map((c) => ({
              id: c.id,
              name: c.name,
              hasChildren: allServiceCats.some((sc) => sc.parentCategoryId === c.id),
            }))
        case 'svc-brands':
          return brands.map((b) => ({ id: b.id, name: b.name, hasChildren: true }))
        case 'models':
          return models.map((m) => ({ id: m.id, name: m.name, hasChildren: false }))
        default:
          return []
      }
    }
  }

  // ── Load brands for a product category ─────────────────────────────────────

  const loadBrands = (productCategoryId?: string) => {
    inventoryApi
      .getDeviceBrands(productCategoryId ? { productCategoryId } : undefined)
      .then((res) => {
        const data: any[] = res.data?.data ?? res.data ?? []
        setBrands(data.map((b: any) => ({ id: String(b.id), name: String(b.name) })))
      })
      .catch(() => {})
  }

  const loadModels = (brandId: string) => {
    inventoryApi
      .getDeviceModels({ brandId })
      .then((res) => {
        const data: any[] = res.data?.data ?? res.data ?? []
        setModels(data.map((m: any) => ({ id: String(m.id), name: String(m.name) })))
      })
      .catch(() => {})
  }

  // ── Handle item click ───────────────────────────────────────────────────────

  const handleItemClick = (item: NavItem) => {
    setActiveId(item.id)

    if (tab === 'products') {
      if (currentLevel.type === 'root' || currentLevel.type === 'prod-sub') {
        const cat = allProductCats.find((c) => c.id === item.id)
        if (!cat) return

        if (cat.isSubCategoryExist) {
          // Drill into sub-categories
          setNavStack((prev) => [...prev, { type: 'prod-sub', parentId: cat.id, parentName: cat.name }])
          onCategorySelect(null)
          onBrandModelSelect(null, null)
        } else if (cat.isBrandExist) {
          // Load brands for this category
          loadBrands(cat.id)
          setNavStack((prev) => [...prev, { type: 'brands', categoryId: cat.id, categoryName: cat.name }])
          onCategorySelect(cat.id)
          onBrandModelSelect(null, null)
        } else {
          // Leaf category with direct products
          onCategorySelect(cat.id)
          onBrandModelSelect(null, null)
        }
      } else if (currentLevel.type === 'brands') {
        // User clicked a brand — load models
        loadModels(item.id)
        setNavStack((prev) => [...prev, { type: 'models', brandId: item.id, brandName: item.name }])
        onBrandModelSelect(item.id, null)
      } else if (currentLevel.type === 'models') {
        // User clicked a model — filter products by model
        onBrandModelSelect(currentLevel.brandId, item.id)
      }
    } else {
      // Services tab
      if (currentLevel.type === 'root' || currentLevel.type === 'svc-sub') {
        const hasSub = allServiceCats.some((c) => c.parentCategoryId === item.id)
        if (hasSub) {
          setNavStack((prev) => [...prev, { type: 'svc-sub', parentId: item.id, parentName: item.name }])
          onCategorySelect(null)
        } else {
          onCategorySelect(item.id)
        }
        onBrandModelSelect(null, null)
      } else if (currentLevel.type === 'svc-brands') {
        loadModels(item.id)
        setNavStack((prev) => [...prev, { type: 'models', brandId: item.id, brandName: item.name }])
        onBrandModelSelect(item.id, null)
      } else if (currentLevel.type === 'models') {
        onBrandModelSelect(currentLevel.brandId, item.id)
      }
    }
  }

  // ── Navigate back via breadcrumb ────────────────────────────────────────────

  const handleBreadcrumbClick = (targetIndex: number) => {
    const newStack = navStack.slice(0, targetIndex + 1)
    setNavStack(newStack)
    setActiveId(null)

    const newTop = newStack[newStack.length - 1]
    if (newTop.type === 'root') {
      onCategorySelect(null)
      onBrandModelSelect(null, null)
    } else if (newTop.type === 'prod-sub' || newTop.type === 'svc-sub') {
      onCategorySelect(null)
      onBrandModelSelect(null, null)
    } else if (newTop.type === 'brands') {
      onCategorySelect(newTop.categoryId)
      onBrandModelSelect(null, null)
    } else if (newTop.type === 'svc-brands') {
      onCategorySelect(null)
      onBrandModelSelect(null, null)
    } else if (newTop.type === 'models') {
      onBrandModelSelect(newTop.brandId, null)
    }
  }

  // ── "All" reset ─────────────────────────────────────────────────────────────

  const handleSelectAll = () => {
    setNavStack([{ type: 'root' }])
    setActiveId(null)
    onCategorySelect(null)
    onBrandModelSelect(null, null)
  }

  // ── "By Device" entry point for services ───────────────────────────────────

  const handleByDevice = () => {
    if (!companyId) return
    loadBrands()
    setNavStack([{ type: 'root' }, { type: 'svc-brands' }])
    setActiveId(null)
    onCategorySelect(null)
    onBrandModelSelect(null, null)
  }

  // ── Breadcrumb label helper ─────────────────────────────────────────────────

  const getBreadcrumbLabel = (level: NavLevel): string => {
    switch (level.type) {
      case 'root': return 'All'
      case 'prod-sub': return level.parentName
      case 'brands': return level.categoryName || 'Brands'
      case 'models': return level.brandName
      case 'svc-sub': return level.parentName
      case 'svc-brands': return 'By Device'
      default: return ''
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const items = getItems()
  const isAtRoot = navStack.length === 1
  const isServicesRoot = tab === 'services' && currentLevel.type === 'root'

  return (
    <div className="space-y-1.5">
      {/* Breadcrumb — shown when drilled in */}
      {!isAtRoot && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          {navStack.map((level, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={cn(
                  'transition-colors',
                  index === navStack.length - 1
                    ? 'text-gray-900 dark:text-white font-semibold cursor-default'
                    : 'hover:text-blue-600 dark:hover:text-blue-400 hover:underline'
                )}
              >
                {index === 0 ? (
                  <span className="flex items-center gap-0.5">
                    <Home className="w-3 h-3" /> All
                  </span>
                ) : (
                  getBreadcrumbLabel(level)
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Pills row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* "All" pill — only at root level */}
        {isAtRoot && (
          <button
            onClick={handleSelectAll}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeId === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            )}
          >
            All
          </button>
        )}

        {/* Current level items */}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
              activeId === item.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            )}
          >
            {item.name}
            {item.hasChildren && (
              <ChevronRight className="w-3 h-3 opacity-50" />
            )}
          </button>
        ))}

        {/* "By Device" entry — only shown in services tab at root level */}
        {isServicesRoot && (
          <button
            onClick={handleByDevice}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
          >
            <Smartphone className="w-3.5 h-3.5" />
            By Device
          </button>
        )}
      </div>
    </div>
  )
}
