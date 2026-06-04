import React, { useEffect, useRef, useState } from 'react'
import { Search, Barcode } from 'lucide-react'
import { inventoryApi } from '@flowtap/api-core'
import { useAppSelector } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'
import type { POSProduct } from '@flowtap/shared'

interface ProductSearchProps {
  onSelect: (product: POSProduct) => void
}

export const ProductSearch: React.FC<ProductSearchProps> = ({ onSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<POSProduct[]>([])
  const [loading, setLoading] = useState(false)
  const companyId = useAppSelector((s) => s.tenant.tenant?.id ?? '')
  const { format } = useCurrency()

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // F2 / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await inventoryApi.getProducts({ companyId, search: query, pageSize: 20 })
        setResults(res.data.data?.items ?? res.data.data ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, companyId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Barcode scanner sends Enter after the code (12+ chars = likely a barcode)
    if (e.key === 'Enter' && query.length >= 8) {
      inventoryApi.getProducts({ companyId, sku: query }).then((res) => {
        const items: POSProduct[] = res.data.data?.items ?? res.data.data ?? []
        if (items.length === 1) {
          onSelect(items[0])
          setQuery('')
          setResults([])
        }
      })
    }
  }

  const handleSelect = (product: POSProduct) => {
    onSelect(product)
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search products, scan barcode… (F2)"
          className="w-full pl-10 pr-10 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white font-medium"
          autoComplete="off"
        />
        <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
      </div>

      {/* Results dropdown */}
      {(results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-20 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Searching…</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
              >
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {p.sku} • Stock: {p.stock ?? (p as any).stockQuantity ?? 0}
                  </div>
                </div>
                <div className="text-sm font-semibold text-blue-600">{format(p.defaultSalePrice)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
