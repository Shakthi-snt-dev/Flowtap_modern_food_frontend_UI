import api from './axiosInstance'

export const notificationsApi = {
  broadcast(data: {
    companyId: string; subject: string; message: string
    channel: 'Email' | 'SMS' | 'Both' | 'InApp'
    severity?: 'Information' | 'Warning' | 'Alert'; locationId?: string
  }) {
    return api.post('/notifications/broadcast', data)
  },
  getHistory(params: {
    companyId?: string; channel?: string; status?: string
    subjectContains?: string; page?: number; pageSize?: number
  }) {
    return api.get('/notifications', { params })
  },
  send(data: { companyId?: string; type: string; recipient: string; subject: string; payload: string }) {
    return api.post('/notifications/send', data)
  },
  getBroadcasts(params: { companyId: string; locationId?: string; limit?: number }) {
    return api.get('/notifications/broadcasts', { params })
  },
  dismissBroadcast(id: string) {
    return api.delete(`/notifications/broadcasts/${id}`)
  },
  getAnnouncements(params: { companyId?: string; type?: 'Banner' | 'Popup' | 'Notification'; locationId?: string; activeOnly?: boolean; limit?: number }) {
    return api.get('/notifications/announcements', { params })
  },
  broadcastAnnouncement(data: {
    companyId: string; subject: string; message: string; channel: string
    severity?: 'Information' | 'Warning' | 'Alert'; locationId?: string
    type?: 'Banner' | 'Popup' | 'Notification'
    targetType?: 'AllStores' | 'SelectedStores' | 'Role'; targetRole?: string
    priority?: 'Low' | 'Normal' | 'High' | 'Critical'
    startDate?: string; endDate?: string; targetLocationIds?: string[]
  }) {
    return api.post('/notifications/broadcast', data)
  },
}
