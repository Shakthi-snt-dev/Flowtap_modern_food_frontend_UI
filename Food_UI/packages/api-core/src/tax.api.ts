import api from './axiosInstance'

export const taxApi = {
  getConfiguration(companyId: string, storeId?: string) {
    return api.get('/tax/configuration', { params: { companyId, storeId } })
  },
  saveConfiguration(data: { companyId: string; systemType: number | string; taxIdNumber?: string; isInclusive: boolean; isTaxExempt?: boolean; storeId?: string }) {
    return api.post('/tax/configuration', data)
  },
  applyTemplate(storeId: string, countryCode: string) {
    return api.post('/tax/apply-template', null, { params: { storeId, countryCode } })
  },
  getSlabs(companyId: string) {
    return api.get('/tax/slabs', { params: { companyId } })
  },
  createSlab(data: { companyId: string; name: string; code: string; rate: number; isActive?: boolean }) {
    return api.post('/tax/slabs', data)
  },
  updateSlab(id: string, data: { name: string; code: string; rate: number; isActive: boolean }) {
    return api.put(`/tax/slabs/${id}`, data)
  },
  deleteSlab(id: string) {
    return api.delete(`/tax/slabs/${id}`)
  },
  getRules(slabId: string) {
    return api.get(`/tax/slabs/${slabId}/rules`)
  },
  addRule(slabId: string, data: { componentName: string; rate: number; jurisdiction?: string; effectiveTo?: string }) {
    return api.post(`/tax/slabs/${slabId}/rules`, data)
  },
  updateRule(slabId: string, ruleId: string, data: { componentName: string; rate: number; jurisdiction?: string; effectiveTo?: string }) {
    return api.put(`/tax/slabs/${slabId}/rules/${ruleId}`, data)
  },
  deleteRule(slabId: string, ruleId: string) {
    return api.delete(`/tax/slabs/${slabId}/rules/${ruleId}`)
  },
}
