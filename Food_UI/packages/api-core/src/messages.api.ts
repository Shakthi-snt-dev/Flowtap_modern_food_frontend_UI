import api from './axiosInstance'

export interface DirectMessage {
  id: string
  subject: string
  body: string
  senderId: string
  senderName: string
  recipientId: string
  recipientName: string
  isRead: boolean
  isComplaint: boolean
  createdAt: string
  readAt?: string
}

export const messagesApi = {
  send(data: { recipientId: string; subject: string; body: string; isComplaint?: boolean }) {
    return api.post('/messages', data)
  },
  getInbox(params?: { isComplaint?: boolean; page?: number; pageSize?: number }) {
    return api.get('/messages/inbox', { params })
  },
  getSent(params?: { page?: number; pageSize?: number }) {
    return api.get('/messages/sent', { params })
  },
  getUnreadCount() {
    return api.get('/messages/unread-count')
  },
  markRead(id: string) {
    return api.put(`/messages/${id}/read`)
  },
  delete(id: string) {
    return api.delete(`/messages/${id}`)
  },
}
