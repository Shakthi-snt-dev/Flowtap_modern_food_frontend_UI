import api from './axiosInstance'

export const superAdminApi = {
  getTenants() {
    return api.get('/superadmin/tenants')
  },
  getUsers(params?: { search?: string; page?: number; pageSize?: number }) {
    return api.get('/superadmin/users', { params })
  },
  toggleUser(id: string) {
    return api.patch(`/superadmin/users/${id}/toggle`)
  },
  resetPassword(id: string, password: string) {
    return api.post(`/superadmin/users/${id}/reset-password`, { password })
  },
}
