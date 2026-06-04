import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface Tenant {
  id: string
  title: string
  businessType: string
  industryType: string
  modules: string[]
  phone?: string
  email?: string
  country?: string
  currency?: string
  createdAt?: string
  plan?: string
  maxLocations?: number
  maxEmployees?: number
  timeZoneId?: string
  logoUrl?: string
  isOnboardingComplete?: boolean
}

export interface Store {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  city?: string
  state?: string
  countryCode?: string
  currencyCode?: string
  postalCode?: string
  locationCode?: string
  type?: number
  isDefault?: boolean
  timeZoneId?: string
  managerEmployeeId?: string
}

interface TenantState {
  tenant: Tenant | null
  stores: Store[]
  currentStoreId: string | null
  bootstrapped: boolean
}

const initialState: TenantState = {
  tenant: null,
  stores: [],
  currentStoreId: localStorage.getItem('currentStoreId'),
  bootstrapped: false,
}

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenant(state, action: PayloadAction<Tenant>) {
      state.tenant = action.payload
      state.bootstrapped = true
    },
    setStores(state, action: PayloadAction<Store[]>) {
      state.stores = action.payload
      if (action.payload.length > 0 && !state.currentStoreId) {
        state.currentStoreId = action.payload[0].id
        localStorage.setItem('currentStoreId', action.payload[0].id)
      }
    },
    setCurrentStore(state, action: PayloadAction<string>) {
      state.currentStoreId = action.payload
      localStorage.setItem('currentStoreId', action.payload)
    },
    setBootstrapped(state) {
      state.bootstrapped = true
    },
    clearTenant(state) {
      state.tenant = null
      state.stores = []
      state.currentStoreId = null
      state.bootstrapped = false
      localStorage.removeItem('currentStoreId')
    },
  },
})

export const { setTenant, setStores, setCurrentStore, setBootstrapped, clearTenant } = tenantSlice.actions
export default tenantSlice.reducer
