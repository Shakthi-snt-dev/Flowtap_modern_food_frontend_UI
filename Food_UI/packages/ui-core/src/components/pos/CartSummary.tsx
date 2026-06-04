import React from 'react'
import { useAppDispatch, useAppSelector } from '@flowtap/store'
import { setDiscount } from '@flowtap/store'
import { useCurrency } from '@flowtap/shared'

interface TaxLine {
  label: string
  amount: number
}

interface CartSummaryProps {
  subtotal: number
  discountAmt: number
  taxBreakdown: TaxLine[]
  totalTax: number
  total: number
  isInclusive: boolean
  advancePaid?: number   // pre-paid on the ticket — shown as a credit line
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  subtotal,
  discountAmt,
  taxBreakdown,
  totalTax,
  total,
  isInclusive,
  advancePaid,
}) => {
  const dispatch = useAppDispatch()
  const discountPercent = useAppSelector((s) => s.cart.discountPercent)
  const { format } = useCurrency()

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Subtotal</span>
        <span>{format(subtotal)}</span>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>Discount</span>
          <input
            type="number"
            min={0}
            max={100}
            value={discountPercent}
            onChange={(e) => dispatch(setDiscount(Number(e.target.value)))}
            className="w-12 px-1.5 py-0.5 text-xs border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span>%</span>
        </div>
        <span className="text-red-500">-{format(discountAmt)}</span>
      </div>

      {/* Tax breakdown — one line per component (CGST, SGST, HST, etc.) */}
      {taxBreakdown.length === 0 ? (
        totalTax > 0 && (
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Tax{isInclusive ? ' (incl.)' : ''}</span>
            <span>{format(totalTax)}</span>
          </div>
        )
      ) : taxBreakdown.length === 1 ? (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {taxBreakdown[0].label}
            {isInclusive ? ' (incl.)' : ''}
          </span>
          <span>{format(taxBreakdown[0].amount)}</span>
        </div>
      ) : (
        <div className="space-y-1">
          {taxBreakdown.map((line) => (
            <div key={line.label} className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span className="pl-2 text-xs">
                {line.label}
                {isInclusive ? ' (incl.)' : ''}
              </span>
              <span className="text-xs">{format(line.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 border-t border-dashed border-gray-100 dark:border-gray-700 pt-1">
            <span>Total Tax</span>
            <span>{format(totalTax)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-2">
        <span>Total</span>
        <span className="text-blue-600 text-lg">{format(total)}</span>
      </div>

      {/* Advance credit — only shown during ticket checkout */}
      {advancePaid != null && advancePaid > 0 && (
        <>
          <div className="flex justify-between text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded-lg">
            <span className="font-medium">Advance Credit</span>
            <span className="font-bold">-{format(advancePaid)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-green-700 dark:text-green-300 border-t border-dashed border-gray-200 dark:border-gray-600 pt-1.5">
            <span>Remaining Due</span>
            <span className="text-base">{format(Math.max(0, total - advancePaid))}</span>
          </div>
        </>
      )}
    </div>
  )
}
