import api from './axiosInstance'

export const userNotificationsApi = {
  getAll(params?: { isRead?: boolean; page?: number; pageSize?: number }) {
    return api.get('/user-notifications', { params })
  },
  getUnreadCount() {
    return api.get('/user-notifications/count')
  },
  markRead(id: string) {
    return api.put(`/user-notifications/${id}/read`)
  },
  markAllRead() {
    return api.put('/user-notifications/read-all')
  },
  delete(id: string) {
    return api.delete(`/user-notifications/${id}`)
  },
}
