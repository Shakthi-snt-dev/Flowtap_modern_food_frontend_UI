import api from './axiosInstance'

export const clientsApi = {
  getClients(params: { companyId: string; search?: string; type?: number; page?: number; pageSize?: number }) {
    return api.get('/clients', { params })
  },
  getClient(id: string) {
    return api.get(`/clients/${id}`)
  },
  createClient(data: {
    companyId: string; name: string; phone?: string; whatsApp?: string; email?: string
    type?: number; companyName?: string; gstin?: string; address?: string; city?: string
    state?: string; postalCode?: string; discountPercent?: number; dateOfBirth?: string
    referralSource?: string; notes?: string
  }) {
    return api.post('/clients', data)
  },
  updateClient(id: string, data: Record<string, unknown>) {
    return api.put(`/clients/${id}`, data)
  },
  deleteClient(id: string) {
    return api.delete(`/clients/${id}`)
  },
  getClientPurchases(id: string, params?: { page?: number; pageSize?: number }) {
    return api.get(`/clients/${id}/purchases`, { params })
  },
}
