import api from './axiosInstance'

export interface StoreSettingData {
  themeMode?: string
  colorTheme?: string
  accentColor?: string
  fontFamily?: string
  borderRadius?: string
  sidebarDensity?: string
  requireClientOnSale?: boolean
  allowDiscount?: boolean
  maxDiscountPercent?: number
  allowVoid?: boolean
  requireManagerPinForVoid?: boolean
  autoPrintReceipt?: boolean
  receiptFooterText?: string
  openingTime?: string
  closingTime?: string
}

export const storeSettingsApi = {
  get(locationId: string) {
    return api.get(`/store-settings/${locationId}`)
  },
  upsert(locationId: string, data: StoreSettingData) {
    return api.put(`/store-settings/${locationId}`, data)
  },
}
