import api from './axiosInstance'

export const employeesApi = {
  getEmployees(params: { companyId: string; search?: string; role?: string; isActive?: boolean; page?: number; pageSize?: number; locationId?: string }) {
    return api.get('/employees', { params })
  },
  getEmployee(id: string) {
    return api.get(`/employees/${id}`)
  },
  createEmployee(data: {
    companyId: string; name: string; phone?: string; email?: string; role?: string; pin?: string
    jobTitle?: string; department?: string; joinedAt?: string; comment?: string; vatin?: string
    salaryType?: string; salary?: number; salaryCurrency?: string; locationIds?: string[]
    permissions?: Record<string, boolean>; isActive?: boolean
  }) {
    return api.post('/employees', data)
  },
  updateEmployee(id: string, data: Record<string, unknown>) {
    return api.put(`/employees/${id}`, data)
  },
  deactivateEmployee(id: string) {
    return api.patch(`/employees/${id}/deactivate`)
  },
  activateEmployee(id: string) {
    return api.patch(`/employees/${id}/activate`)
  },
  deleteEmployee(id: string) {
    return api.delete(`/employees/${id}`)
  },
  resetPin(id: string, pin: string) {
    return api.patch(`/employees/${id}/pin`, { pin })
  },
  verifyPin(companyId: string, pin: string) {
    return api.post<{ data: { id: string; name: string; jobTitle?: string; avatarInitials?: string; permissions: Record<string, boolean> } }>(
      '/employees/verify-pin', { companyId, pin }
    )
  },
  pinLogin(companyId: string, pin: string) {
    return api.post<{ data: {
      accessToken: string; employeeId: string; userAccountId: string; name: string
      email?: string; jobTitle?: string; avatarInitials?: string
      permissions: Record<string, boolean>; isOwner: boolean; defaultLocationId?: string
    } }>('/employees/pin-login', { companyId, pin })
  },
}
