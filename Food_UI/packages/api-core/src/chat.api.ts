import api from './axiosInstance'

export const chatApi = {
  getConversations(locationId?: string) {
    return api.get('/conversations', { params: locationId ? { locationId } : undefined })
  },
  startConversation(data: { otherUserId: string; otherUserName?: string; locationId?: string }) {
    return api.post('/conversations', data)
  },
  getMessages(conversationId: string, page = 1) {
    return api.get(`/conversations/${conversationId}/messages`, { params: { page } })
  },
  sendMessage(conversationId: string, body: string) {
    return api.post(`/conversations/${conversationId}/messages`, { body })
  },
  markSeen(conversationId: string) {
    return api.put(`/conversations/${conversationId}/seen`)
  },
  deleteMessage(conversationId: string, messageId: string) {
    return api.delete(`/conversations/${conversationId}/messages/${messageId}`)
  },
}
