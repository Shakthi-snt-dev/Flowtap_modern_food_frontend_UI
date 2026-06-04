import api from './axiosInstance'

export const purchaseApi = {
  getPurchaseOrders(params: { companyId: string; locationId?: string; status?: string; page?: number; pageSize?: number }) {
    return api.get('/purchases/orders', { params })
  },
  getPurchaseOrder(id: string) {
    return api.get(`/purchases/orders/${id}`)
  },
  createPurchaseOrder(data: {
    companyId: string; supplierId: string; warehouseId: string; currency: string
    locationId?: string; expectedDeliveryDate?: string; notes?: string
    items: { productId: string; quantity: number; unitCost: number }[]
  }) {
    return api.post('/purchases/orders', data)
  },
  updatePurchaseOrderStatus(id: string, status: string) {
    return api.patch(`/purchases/orders/${id}/status`, { status })
  },
  getSuppliers(params: { companyId: string; search?: string; page?: number; pageSize?: number }) {
    return api.get('/purchases/suppliers', { params })
  },
  getSupplier(id: string) {
    return api.get(`/purchases/suppliers/${id}`)
  },
  createSupplier(data: { companyId: string; name: string; phone?: string; email?: string; address?: string; gstNumber?: string; paymentTerms?: string }) {
    return api.post('/purchases/suppliers', data)
  },
  updateSupplier(id: string, data: Record<string, unknown>) {
    return api.put(`/purchases/suppliers/${id}`, data)
  },
}
