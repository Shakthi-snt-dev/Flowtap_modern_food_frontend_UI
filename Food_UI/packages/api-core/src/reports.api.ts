import api from './axiosInstance'

export const reportsApi = {
  getDashboardStats(params: { companyId: string; locationId?: string; date?: string }) {
    return api.get('/reports/dashboard', { params })
  },
  getSalesReport(params: { companyId: string; from?: string; to?: string; locationId?: string; groupBy?: string }) {
    return api.get('/reports/sales', { params })
  },
  getTopProducts(params: { companyId: string; from?: string; to?: string; locationId?: string; top?: number }) {
    return api.get('/reports/top-products', { params })
  },
  getInventoryReport(params: { companyId: string; locationId?: string }) {
    return api.get('/reports/inventory', { params })
  },
  getExpensesReport(params: { companyId: string; from?: string; to?: string }) {
    return api.get('/reports/expenses', { params })
  },
  getAdminOverview() {
    return api.get('/admin/overview')
  },
}
