import api from './axiosInstance'

export const campaignsApi = {
  getMarketingCampaigns(params: { companyId?: string; isActive?: boolean }) {
    return api.get('/marketing/campaigns', { params })
  },
  createMarketingCampaign(data: {
    companyId: string; title: string; message: string; discountPercentage?: number
    targetLocationIds?: string[]; startsAt?: string; endsAt?: string
  }) {
    return api.post('/marketing/campaigns', data)
  },
  updateMarketingCampaign(id: string, data: { title?: string; message?: string; discountPercentage?: number; targetLocationIds?: string[]; isActive?: boolean }) {
    return api.put(`/marketing/campaigns/${id}`, data)
  },
  deleteMarketingCampaign(id: string) {
    return api.delete(`/marketing/campaigns/${id}`)
  },
  getOffers(params: { companyId?: string; activeOnly?: boolean }) {
    return api.get('/offers', { params })
  },
  createOffer(data: { companyId: string; promoCode: string; discountPercent: number; minOrderValue?: number; usageLimit?: number; validFrom: string; validTo: string }) {
    return api.post('/offers', data)
  },
  updateOffer(id: string, data: { promoCode?: string; discountPercent?: number; minOrderValue?: number; usageLimit?: number; validFrom?: string; validTo?: string; isActive?: boolean }) {
    return api.put(`/offers/${id}`, data)
  },
  deleteOffer(id: string) {
    return api.delete(`/offers/${id}`)
  },
  getDiscountCampaigns(params: { companyId?: string; activeOnly?: boolean }) {
    return api.get('/campaigns', { params })
  },
  createDiscountCampaign(data: { companyId: string; name: string; type: string; discountType?: string; discountValue?: number; startDate: string; endDate: string; productIds?: string[] }) {
    return api.post('/campaigns', data)
  },
  updateDiscountCampaign(id: string, data: { name?: string; status?: string; startDate?: string; endDate?: string }) {
    return api.put(`/campaigns/${id}`, data)
  },
  deleteDiscountCampaign(id: string) {
    return api.delete(`/campaigns/${id}`)
  },
}
