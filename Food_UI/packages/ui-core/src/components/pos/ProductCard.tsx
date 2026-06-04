import React from 'react'
import { Plus } from 'lucide-react'
import type { POSProduct } from '@flowtap/shared'
import { useCurrency } from '@flowtap/shared'

interface ProductCardProps {
  product: POSProduct
  onAdd: (product: POSProduct) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd }) => {
  const { format } = useCurrency()
  const stockQty = product.stock ?? (product as any).stockQuantity ?? 0
  const isDisabled = stockQty <= 0

  return (
  <button
    disabled={isDisabled}
    onClick={() => onAdd(product)}
    className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-left transition-all group ${isDisabled ? 'opacity-60 cursor-not-allowed grayscale' : 'hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700 active:scale-95'}`}
  >
    <div className="w-full aspect-square bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg mb-2 flex items-center justify-center relative">
      <span className="text-2xl">📦</span>
      {!isDisabled && (
        <div className="absolute top-1 right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <span className={`absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-bold rounded backdrop-blur-[2px] ${isDisabled ? 'bg-red-500/80 text-white' : 'bg-gray-900/60 text-white'}`}>
        Qty: {stockQty}
      </span>
    </div>
    <div className="font-medium text-xs text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight mb-1">
      {product.name}
    </div>
    <div className="text-xs text-gray-400 mb-1">{product.sku}</div>
    <div className="text-sm font-bold text-blue-600">
      {format(product.locationSalePrice ?? product.defaultSalePrice)}
    </div>
    {product.locationSalePrice != null && product.locationSalePrice !== product.defaultSalePrice && (
      <div className="text-[10px] text-gray-400 line-through leading-tight">
        {format(product.defaultSalePrice)}
      </div>
    )}
  </button>
  )
}
