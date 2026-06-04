import api from './axiosInstance'

export const authApi = {
  register(data: { name: string; email: string; phone: string; password: string }) {
    return api.post('/auth/register', data)
  },
  login(data: { email: string; password: string }) {
    return api.post('/auth/login', data)
  },
  refreshToken(refreshToken: string) {
    return api.post('/auth/refresh', { refreshToken })
  },
  verifyEmail(token: string) {
    return api.post('/auth/verify-email', { token })
  },
  resendVerification(email: string) {
    return api.post('/auth/resend-verification', { email })
  },
  forgotPassword(email: string) {
    return api.post('/auth/forgot-password', { email })
  },
  resetPassword(data: { token: string; newPassword: string }) {
    return api.post('/auth/reset-password', data)
  },
  logout() {
    return api.post('/auth/logout')
  },
  getCurrentUser() {
    return api.get('/auth/me')
  },
  updateProfile(data: { name?: string; phone?: string }) {
    return api.put('/auth/me', data)
  },
  changePassword(data: { currentPassword?: string; newPassword: string }) {
    return api.post('/auth/change-password', data)
  },
}
