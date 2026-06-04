import api from './axiosInstance'

export const tenantApi = {
  create(data: {
    title: string
    phone: string
    email: string
    country: string
    currency: string
    subdomain: string
    industryType: string
    businessType: string
  }) {
    return api.post('/tenant', data)
  },
  getTenant() {
    return api.get('/tenant')
  },
  updateTenant(
    data: Partial<{
      title: string
      phone: string
      email: string
      country: string
      currency: string
    }>
  ) {
    return api.put('/tenant', data)
  },
  seedIndustry(data: { companyId: string; industryType: string; businessType: string }) {
    return api.post('/tenant/seed-industry', data)
  },
  getStores(companyId: string) {
    return api.get('/stores', { params: { companyId } })
  },
  createStore(data: {
    companyId: string
    title: string
    countryCode?: string
    currencyCode?: string
    locationCode?: string
    type?: number
    address?: string
    city?: string
    state?: string
    postalCode?: string
    phone?: string
    email?: string
    isDefault?: boolean
    timeZoneId?: string
  }) {
    return api.post('/stores', data)
  },
  updateStore(id: string, data: Record<string, unknown>) {
    return api.put(`/stores/${id}`, data)
  },
  deleteStore(id: string) {
    return api.delete(`/stores/${id}`)
  },
  setDefaultStore(storeId: string) {
    return api.post('/stores/default', { storeId })
  },
  updateTenantSettings(data: {
    maxLocations?: number
    maxEmployees?: number
    timeZoneId?: string
    logoUrl?: string
  }) {
    return api.put('/tenant/settings', data)
  },
}
