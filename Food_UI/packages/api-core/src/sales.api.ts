import api from './axiosInstance'

interface CreateSaleItem {
  productId: string
  productName: string
  type: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxPercent: number
  serialNumber?: string
  variantId?: string   // food: which variant was ordered
  notes?: string       // food: special instructions ("no onion")
}

interface CreateSalePayment {
  method: string
  amount: number
  purpose?: string
  reference?: string
}

interface CreateSaleParams {
  companyId: string
  locationId?: string | null
  clientId?: string | null
  employeeId?: string | null
  source: string
  ticketId?: string
  idempotencyKey: string
  notes?: string
  payments: CreateSalePayment[]
  items: CreateSaleItem[]
  // Food industry — undefined for Repair/Retail
  tableId?: string
  foodOrderType?: string
}

interface GetSalesParams {
  companyId: string
  locationId?: string
  startDate?: string
  endDate?: string
  status?: string
  clientId?: string
  page?: number
  pageSize?: number
}

interface AddPaymentParams {
  companyId: string
  amount: number
  method: string
  purpose: string
  accountId?: string
  externalReference?: string
  comment?: string
  employeeId?: string
  idempotencyKey?: string
}

export const salesApi = {
  createSale(data: CreateSaleParams) {
    return api.post('/sales', data)
  },
  getSales(params: GetSalesParams) {
    return api.get('/sales', { params })
  },
  getSale(id: string) {
    return api.get(`/sales/${id}`)
  },
  addPayment(saleId: string, data: AddPaymentParams) {
    return api.post(`/sales/${saleId}/payments`, data)
  },
  voidSale(id: string, reason?: string) {
    return api.post(`/sales/${id}/void`, { reason })
  },
  getSaleReceipt(id: string) {
    return api.get(`/sales/${id}/receipt`)
  },
  getPaymentAccounts(companyId: string, locationId?: string) {
    return api.get('/payments/accounts', { params: { companyId, locationId } })
  },
  createPaymentAccount(data: { companyId: string; name: string; type: string; locationId?: string }) {
    return api.post('/payments/accounts', data)
  },
  updatePaymentAccount(id: string, data: { name?: string; isActive?: boolean }) {
    return api.put(`/payments/accounts/${id}`, data)
  },
  deletePaymentAccount(id: string) {
    return api.delete(`/payments/accounts/${id}`)
  },
  getMethodMappings(companyId: string, locationId: string) {
    return api.get('/payments/method-mappings', { params: { companyId, locationId } })
  },
  createMethodMapping(data: { companyId: string; locationId: string; method: string; paymentAccountId: string }) {
    return api.post('/payments/method-mappings', data)
  },
  deleteMethodMapping(id: string) {
    return api.delete(`/payments/method-mappings/${id}`)
  },
  getPayments(params: {
    companyId: string
    locationId?: string
    ticketId?: string
    saleId?: string
    method?: string
    purpose?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    pageSize?: number
  }) {
    return api.get('/payments', { params })
  },
}
