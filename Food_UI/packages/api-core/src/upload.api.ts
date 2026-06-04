import api from './axiosInstance'

export const uploadApi = {
  uploadFile(file: File, folder = 'products') {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    return api.post<{ data: { url: string } }>('/uploads', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
