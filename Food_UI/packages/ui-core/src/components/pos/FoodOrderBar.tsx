import React, { useState, useEffect } from 'react'
import { UtensilsCrossed, ShoppingBag, Bike, ChevronDown, X } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@flowtap/store'
import { setFoodOrder } from '@flowtap/store'
import { cn } from '@flowtap/shared'
import { foodApi } from '@flowtap/api-core'

type FoodOrderType = 'DineIn' | 'Takeaway' | 'Delivery'

interface FoodTable {
  id: string
  name: string
  capacity: number
  section?: string
  status: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'
}

const ORDER_TYPES: { value: FoodOrderType; label: string; icon: React.ReactNode }[] = [
  { value: 'DineIn',   label: 'Dine In',   icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
  { value: 'Takeaway', label: 'Takeaway',  icon: <ShoppingBag     className="w-3.5 h-3.5" /> },
  { value: 'Delivery', label: 'Delivery',  icon: <Bike            className="w-3.5 h-3.5" /> },
]

const STATUS_COLOR: Record<string, string> = {
  Available: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400',
  Occupied:  'bg-red-100   text-red-700   border-red-200   dark:bg-red-900/20   dark:text-red-400',
  Reserved:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
  Cleaning:  'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-900/20  dark:text-blue-400',
}

interface FoodOrderBarProps {
  companyId: string
  locationId: string
}

export const FoodOrderBar: React.FC<FoodOrderBarProps> = ({ companyId, locationId }) => {
  const dispatch      = useAppDispatch()
  const foodOrderType = useAppSelector((s) => s.cart.foodOrderType) ?? 'DineIn'
  const tableId       = useAppSelector((s) => s.cart.tableId)
  const tableName     = useAppSelector((s) => s.cart.tableName)

  const [showPicker, setShowPicker] = useState(false)
  const [tables, setTables]         = useState<FoodTable[]>([])
  const [loadingTables, setLoadingTables] = useState(false)

  const isDineIn = foodOrderType === 'DineIn'

  // Fetch tables when picker opens (DineIn only)
  useEffect(() => {
    if (!showPicker || !isDineIn) return
    setLoadingTables(true)
    foodApi.getTables({ companyId, locationId })
      .then((res) => {
        const data = res.data?.data ?? res.data ?? []
        setTables(Array.isArray(data) ? data : [])
      })
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false))
  }, [showPicker, isDineIn, companyId, locationId])

  const handleOrderType = (type: FoodOrderType) => {
    dispatch(setFoodOrder({ foodOrderType: type, tableId: undefined, tableName: undefined }))
  }

  const handleSelectTable = (table: FoodTable) => {
    dispatch(setFoodOrder({ foodOrderType: 'DineIn', tableId: table.id, tableName: table.name }))
    setShowPicker(false)
  }

  const handleClearTable = () => {
    dispatch(setFoodOrder({ foodOrderType: 'DineIn', tableId: undefined, tableName: undefined }))
  }

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 pb-2 mb-1">
      {/* Order type selector */}
      <div className="flex gap-1 mb-2">
        {ORDER_TYPES.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => handleOrderType(value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-lg border transition-colors',
              foodOrderType === value
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-orange-300'
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Table selector — only for Dine In */}
      {isDineIn && (
        <div className="relative">
          {tableId ? (
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                🪑 {tableName}
              </span>
              <button onClick={handleClearTable} className="text-orange-400 hover:text-orange-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="w-full flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 hover:border-orange-300 transition-colors"
            >
              <span>Select Table</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Table picker popover */}
          {showPicker && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3">
              <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Available Tables
              </div>
              {loadingTables ? (
                <div className="text-xs text-center text-gray-400 py-4">Loading...</div>
              ) : tables.length === 0 ? (
                <div className="text-xs text-center text-gray-400 py-4">No tables found</div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      disabled={t.status !== 'Available'}
                      onClick={() => handleSelectTable(t)}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-colors',
                        t.status === 'Available'
                          ? 'hover:bg-orange-50 hover:border-orange-300 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed',
                        STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                      )}
                    >
                      <span className="font-bold">{t.name}</span>
                      <span className="text-[10px] opacity-75">{t.status}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowPicker(false)}
                className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 text-center"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
