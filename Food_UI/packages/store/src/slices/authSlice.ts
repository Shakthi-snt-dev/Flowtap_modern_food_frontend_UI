import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AppUser {
  id: string
  email: string
  name: string
  defaultLocationId?: string
  hasPassword?: boolean
  employeeId?: string
  role?: string
  jobTitle?: string
  locationIds?: string[]
  permissions?: Record<string, boolean>
}

interface AuthState {
  token: string | null
  user: AppUser | null
  isLoading: boolean
  error: string | null
  ownerToken: string | null
  ownerUser: AppUser | null
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  user: null,
  isLoading: false,
  error: null,
  ownerToken: null,
  ownerUser: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.isLoading = true
      state.error = null
    },
    loginSuccess(state, action: PayloadAction<{ token: string; user: AppUser }>) {
      state.isLoading = false
      state.token = action.payload.token
      state.user = action.payload.user
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.isLoading = false
      state.error = action.payload
    },
    logout(state) {
      state.token = null
      state.user = null
      state.ownerToken = null
      state.ownerUser = null
      localStorage.removeItem('token')
      localStorage.removeItem('currentStoreId')
    },
    setUser(state, action: PayloadAction<AppUser | null>) {
      if (action.payload === null) {
        state.user = null
      } else {
        state.user = { ...(state.user ?? {} as AppUser), ...action.payload }
      }
    },
    loginAsEmployee(state, action: PayloadAction<{ token: string; user: AppUser }>) {
      if (!state.ownerToken) {
        state.ownerToken = state.token
        state.ownerUser = state.user
      }
      state.token = action.payload.token
      state.user = action.payload.user
      localStorage.setItem('token', action.payload.token)
      if (action.payload.user.defaultLocationId) {
        localStorage.setItem('currentStoreId', action.payload.user.defaultLocationId)
      }
    },
    loginAsOwnerViaPin(state, action: PayloadAction<{ token: string; user: AppUser }>) {
      state.token = action.payload.token
      state.user = action.payload.user
      state.ownerToken = null
      state.ownerUser = null
      localStorage.setItem('token', action.payload.token)
      if (action.payload.user.defaultLocationId) {
        localStorage.setItem('currentStoreId', action.payload.user.defaultLocationId)
      }
    },
    switchBackToOwner(state) {
      if (state.ownerToken) {
        state.token = state.ownerToken
        state.user = state.ownerUser
        localStorage.setItem('token', state.ownerToken)
        if (state.ownerUser?.defaultLocationId) {
          localStorage.setItem('currentStoreId', state.ownerUser.defaultLocationId)
        }
      }
      state.ownerToken = null
      state.ownerUser = null
    },
  },
})

export const {
  loginStart, loginSuccess, loginFailure,
  logout, setUser, loginAsEmployee, loginAsOwnerViaPin, switchBackToOwner,
} = authSlice.actions
export default authSlice.reducer
