import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'
import tenantReducer from './slices/tenantSlice'
import cartReducer from './slices/cartSlice'
import cashierReducer from './slices/cashierSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    tenant: tenantReducer,
    cart: cartReducer,
    cashier: cashierReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
