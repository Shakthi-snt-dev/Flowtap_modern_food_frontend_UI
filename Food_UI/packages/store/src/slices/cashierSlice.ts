import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ActiveCashier {
  id: string
  name: string
  jobTitle?: string
  avatarInitials?: string
  permissions: Record<string, boolean> | null
}

interface CashierState {
  cashier: ActiveCashier | null
}

const cashierSlice = createSlice({
  name: 'cashier',
  initialState: { cashier: null } as CashierState,
  reducers: {
    setCashier(state, action: PayloadAction<ActiveCashier>) { state.cashier = action.payload },
    clearCashier(state) { state.cashier = null },
  },
})

export const { setCashier, clearCashier } = cashierSlice.actions
export default cashierSlice.reducer
