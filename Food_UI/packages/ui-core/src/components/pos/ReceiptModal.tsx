import React from 'react'
import { CheckCircle, Printer, Download, X } from 'lucide-react'
import { formatDateTime } from '@flowtap/shared'
import { useCurrency } from '@flowtap/shared'

interface ReceiptItem {
  name: string
  quantity: number
  price: number
  total: number
}

interface TaxLine {
  label: string
  amount: number
}

interface ReceiptData {
  saleId: string
  items: ReceiptItem[]
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

interface ReceiptModalProps {
  receipt: ReceiptData | null
  onClose: () => void
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const { format } = useCurrency()
  if (!receipt) return null

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
          aria-label="Close receipt"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Receipt content */}
        <div className="p-6 print:p-4" id="receipt-content">
          <div className="text-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{receipt.tenantName}</h2>
            <p className="text-xs text-gray-400 mt-1">{formatDateTime(receipt.createdAt)}</p>
            <p className="text-xs text-gray-400">Receipt #{receipt.saleId.slice(-8).toUpperCase()}</p>
          </div>

          <div className="space-y-2 border-t border-dashed border-gray-200 dark:border-gray-700 pt-4 mb-4">
            {receipt.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-800 dark:text-gray-200">{item.name}</span>
                  <span className="text-gray-400 ml-2">×{item.quantity}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {format(item.total)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{format(receipt.subtotal)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Discount</span>
                <span>-{format(receipt.discount)}</span>
              </div>
            )}

            {/* Tax breakdown — CGST/SGST/HST etc. or single Tax line */}
            {receipt.taxBreakdown.length > 1 ? (
              receipt.taxBreakdown.map((line) => (
                <div key={line.label} className="flex justify-between text-sm text-gray-500">
                  <span>
                    {line.label}
                    {receipt.isInclusive ? ' (incl.)' : ''}
                  </span>
                  <span>{format(line.amount)}</span>
                </div>
              ))
            ) : receipt.tax > 0 ? (
              <div className="flex justify-between text-sm text-gray-500">
                <span>
                  {receipt.taxBreakdown[0]?.label ?? 'Tax'}
                  {receipt.isInclusive ? ' (incl.)' : ''}
                </span>
                <span>{format(receipt.tax)}</span>
              </div>
            ) : null}

            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-600">
              <span>Total</span>
              <span>{format(receipt.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Payment</span>
              <span>{receipt.paymentMethod}</span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">Thank you for your business!</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() => {
              window.print()
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>
    </div>
  )
}
