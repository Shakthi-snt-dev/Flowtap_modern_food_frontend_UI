import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface CartItem {
  id: string
  productId: string
  serviceId?: string
  type?: 'Product' | 'Service' | 'Part'
  name: string
  sku: string
  price: number
  quantity: number
  discount: number
  taxSlabId?: string
  taxRate: number
  isTaxIncluded?: boolean
  total: number
  // Food industry — null/undefined for Repair/Retail
  variantId?:   string
  variantName?: string
  notes?:       string  // special instructions ("no onion", "extra cheese")
  ticketConfig?: {
    brandId: string; brandName: string; modelId: string; modelName: string
    problem: string; password?: string; appearance?: string; technicianId?: string
    estimatedCost: number
    parts: { productId: string; name: string; quantity: number; unitPrice: number; warehouseId: string }[]
  }
}

export interface CartPayment { method: string; amount: number; purpose: 'Advance' | 'Partial' | 'Final' }

interface CartState {
  items: CartItem[]
  discountPercent: number
  payments: CartPayment[]
  clientId?: string
  clientName?: string
  // Ticket-checkout context — set when collecting a repair ticket via POS
  ticketId?: string
  ticketNumber?: string
  ticketAdvancePaid?: number
  // Food industry context — undefined for Repair/Retail
  tableId?:       string
  tableName?:     string
  foodOrderType?: 'DineIn' | 'Takeaway' | 'Delivery'
}

const computeTotal = (price: number, quantity: number, discount: number): number =>
  parseFloat((price * quantity * (1 - discount / 100)).toFixed(2))

const initialState: CartState = { items: [], discountPercent: 0, payments: [] }

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<Omit<CartItem, 'total'>>) {
      const existing = state.items.find((i) => i.productId === action.payload.productId)
      if (existing) {
        existing.quantity += action.payload.quantity
        existing.total = computeTotal(existing.price, existing.quantity, existing.discount)
      } else {
        state.items.push({ ...action.payload, total: computeTotal(action.payload.price, action.payload.quantity, action.payload.discount) })
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload)
    },
    updateQuantity(state, action: PayloadAction<{ id: string; quantity: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id)
      if (item) { item.quantity = action.payload.quantity; item.total = computeTotal(item.price, item.quantity, item.discount) }
    },
    updateItemDiscount(state, action: PayloadAction<{ id: string; discount: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id)
      if (item) { item.discount = Math.min(100, Math.max(0, action.payload.discount)); item.total = computeTotal(item.price, item.quantity, item.discount) }
    },
    setDiscount(state, action: PayloadAction<number>) { state.discountPercent = Math.min(100, Math.max(0, action.payload)) },
    addPayment(state, action: PayloadAction<CartPayment>) { state.payments.push(action.payload) },
    removePayment(state, action: PayloadAction<number>) { state.payments.splice(action.payload, 1) },
    setClient(state, action: PayloadAction<{ id: string; name: string }>) { state.clientId = action.payload.id; state.clientName = action.payload.name },
    clearClient(state) { state.clientId = undefined; state.clientName = undefined },
    setTicketContext(state, action: PayloadAction<{ ticketId: string; ticketNumber: string; advancePaid: number }>) {
      state.ticketId = action.payload.ticketId
      state.ticketNumber = action.payload.ticketNumber
      state.ticketAdvancePaid = action.payload.advancePaid
    },
    setFoodOrder(state, action: PayloadAction<{ tableId?: string; tableName?: string; foodOrderType: 'DineIn' | 'Takeaway' | 'Delivery' }>) {
      state.tableId       = action.payload.tableId
      state.tableName     = action.payload.tableName
      state.foodOrderType = action.payload.foodOrderType
    },
    updateItemNotes(state, action: PayloadAction<{ id: string; notes: string }>) {
      const item = state.items.find((i) => i.id === action.payload.id)
      if (item) item.notes = action.payload.notes
    },
    clearCart(state) {
      state.items = []; state.discountPercent = 0; state.payments = []
      state.clientId = undefined; state.clientName = undefined
      state.ticketId = undefined; state.ticketNumber = undefined; state.ticketAdvancePaid = undefined
      state.tableId  = undefined; state.tableName   = undefined; state.foodOrderType = undefined
    },
  },
})

export const { addItem, removeItem, updateQuantity, updateItemDiscount, setDiscount, addPayment, removePayment, setClient, clearClient, setTicketContext, setFoodOrder, updateItemNotes, clearCart } = cartSlice.actions
export default cartSlice.reducer
