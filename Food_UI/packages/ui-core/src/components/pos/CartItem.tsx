import React from 'react'
import { Minus, Plus, Trash2, Wrench, Package, Tag } from 'lucide-react'
import { useAppDispatch } from '@flowtap/store'
import { removeItem, updateQuantity, updateItemDiscount } from '@flowtap/store'
import type { CartItem as CartItemType } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'
import { cn } from '@flowtap/shared'

const TYPE_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  Service: { label: 'Service',  className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: <Wrench className="w-2.5 h-2.5" /> },
  Part:    { label: 'Part',     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: <Tag className="w-2.5 h-2.5" /> },
  Product: { label: 'Product',  className: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',   icon: <Package className="w-2.5 h-2.5" /> },
}

interface CartItemProps {
  item: CartItemType
  /** When true (ticket-checkout mode) — hides edit controls, locks quantity */
  readOnly?: boolean
  /** When true (food industry) — shows per-item special instructions input */
  showNotes?: boolean
  onNotesChange?: (id: string, notes: string) => void
}

export const CartItemRow: React.FC<CartItemProps> = ({ item, readOnly, showNotes, onNotesChange }) => {
  const dispatch = useAppDispatch()
  const { format } = useCurrency()

  const badge = item.type ? TYPE_BADGE[item.type] : undefined

  return (
    <div className="flex items-start gap-2 py-3 border-b border-gray-50 dark:border-gray-700/60">
      <div className="flex-1 min-w-0">
        {/* Name + type badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{item.name}</span>
          {badge && (
            <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold', badge.className)}>
              {badge.icon}{badge.label}
            </span>
          )}
        </div>
        {item.sku && <div className="text-[11px] text-gray-400 mt-0.5">{item.sku}</div>}

        {/* Special instructions — food industry only, hidden in readOnly */}
        {showNotes && !readOnly && (
          <input
            type="text"
            placeholder="Special instructions..."
            value={item.notes ?? ''}
            onChange={(e) => onNotesChange?.(item.id, e.target.value)}
            className="w-full text-xs px-2 py-0.5 rounded border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700 text-gray-700 dark:text-gray-300 placeholder-gray-400 mt-1 focus:outline-none focus:border-amber-400"
          />
        )}
        {showNotes && readOnly && item.notes && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 italic">📝 {item.notes}</div>
        )}

        {/* Per-item discount — hidden in readOnly */}
        {!readOnly && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[11px] text-gray-400">Disc %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={item.discount}
              onChange={(e) => dispatch(updateItemDiscount({ id: item.id, discount: Number(e.target.value) }))}
              className="w-14 px-1.5 py-0.5 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Quantity: stepper in normal mode, plain badge in readOnly */}
      {readOnly ? (
        <div className="flex-shrink-0 flex items-center">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg">
            ×{item.quantity}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <button
            onClick={() => dispatch(updateQuantity({ id: item.id, quantity: Math.max(1, item.quantity - 1) }))}
            className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => dispatch(updateQuantity({ id: item.id, quantity: Math.max(1, Number(e.target.value)) }))}
            className="w-10 text-center text-sm font-semibold border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
            className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-200 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Price + remove */}
      <div className="text-right flex-shrink-0 min-w-[64px]">
        <div className="text-sm font-bold text-gray-900 dark:text-white">{format(item.total)}</div>
        <div className="text-[11px] text-gray-400">{format(item.price)}/ea</div>
        {!readOnly && (
          <button
            onClick={() => dispatch(removeItem(item.id))}
            className="mt-1 text-red-400 hover:text-red-600 transition-colors"
            aria-label="Remove item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
