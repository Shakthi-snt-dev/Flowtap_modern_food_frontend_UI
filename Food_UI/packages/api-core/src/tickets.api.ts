import api from './axiosInstance'

export const ticketsApi = {
  getTickets(params: {
    companyId: string
    locationId?: string
    status?: string
    assignedTo?: string
    page?: number
    pageSize?: number
  }) {
    return api.get('/tickets', { params })
  },
  getTicket(id: string) {
    return api.get(`/tickets/${id}`)
  },
  createTicket(data: {
    companyId: string
    locationId?: string
    clientId?: string
    clientName?: string
    clientPhone?: string
    clientEmail?: string
    deviceBrandId?: string
    deviceModelId?: string
    problemDescription: string
    estimatedCost?: number
    technicianEmployeeId?: string
    priorityLevel?: string
    appearance?: string
    password?: string
    equipment?: string
    deadline?: string
    reason?: string
  }) {
    const payload = {
      companyId: data.companyId,
      locationId: data.locationId,
      clientId: data.clientId,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientEmail: data.clientEmail,
      type: 'Paid',
      priority: data.priorityLevel || 'Medium',
      deviceBrand: data.deviceBrandId,
      deviceModel: data.deviceModelId,
      reason: data.problemDescription,
      mastersNotes: data.reason,
      appearance: data.appearance,
      password: data.password,
      equipment: data.equipment,
      executorEmployeeId: data.technicianEmployeeId,
      estimatedCost: data.estimatedCost || 0,
      prepayment: 0,
    }
    return api.post('/tickets', payload)
  },
  updateStatus(id: string, status: string, notes?: string) {
    return api.patch(`/tickets/${id}/status`, { newStatus: status, notes })
  },
  assignTicket(id: string, employeeId: string) {
    return api.patch(`/tickets/${id}/assign`, { employeeId })
  },
  addPart(id: string, data: { productId: string; warehouseId: string; quantity: number; unitPrice: number }) {
    return api.post(`/tickets/${id}/parts`, data)
  },
  getServices(companyId: string) {
    return api.get('/services', { params: { companyId } })
  },
  getServiceCategories(companyId: string) {
    return api.get('/service-categories', { params: { companyId } })
  },
  getServicesByModel(modelId: string, companyId: string) {
    return api.get(`/devices/models/${modelId}/services`, { params: { companyId } })
  },
  createService(data: {
    companyId: string
    name: string
    category: string
    price: number
    duration: number
    description?: string
    isActive?: boolean
  }) {
    return api.post('/services', data)
  },
  updateService(id: string, data: Record<string, unknown>) {
    return api.put(`/services/${id}`, data)
  },
  deleteService(id: string) {
    return api.delete(`/services/${id}`)
  },
  getTasks(params: { companyId: string; ticketId?: string; assigneeEmployeeId?: string; authorEmployeeId?: string; status?: string }) {
    return api.get('/tasks', { params })
  },
  createTask(data: {
    locationId?: string
    authorEmployeeId?: string
    assigneeEmployeeId: string
    title: string
    description: string
    priority: string
    deadline?: string
    ticketId?: string
    tags: string[]
  }) {
    const payload: Record<string, unknown> = {}
    if (data.locationId)       payload.locationId       = data.locationId
    if (data.authorEmployeeId) payload.authorEmployeeId = data.authorEmployeeId
    payload.assigneeEmployeeId = data.assigneeEmployeeId
    payload.title              = data.title
    payload.description        = data.description
    payload.priority           = data.priority
    if (data.deadline) payload.deadline = data.deadline
    if (data.ticketId) payload.ticketId = data.ticketId
    payload.tags = data.tags
    return api.post('/tasks', payload)
  },
  updateTaskStatus(id: string, status: string) {
    return api.patch(`/tasks/${id}/status`, { status })
  },
  addTicketItem(id: string, data: {
    itemReferenceId: string
    name: string
    type: string
    quantity: number
    price: number
    discountAmount?: number
    taxPercent?: number
  }) {
    return api.post(`/tickets/${id}/items`, data)
  },
  removeTicketItem(id: string, itemId: string) {
    return api.delete(`/tickets/${id}/items/${itemId}`)
  },
  recordAdvance(id: string, data: {
    amount: number
    method: string
    accountId?: string
    externalReference?: string
    comment?: string
    employeeId?: string
  }) {
    return api.post(`/tickets/${id}/advance`, data)
  },
  collectTicket(id: string, data: {
    finalPaymentAmount?: number
    finalPaymentMethod?: string
    accountId?: string
    externalReference?: string
    comment?: string
  }) {
    return api.post(`/tickets/${id}/collect`, data)
  },
  toggleTicketTimer(id: string) {
    return api.post(`/tickets/${id}/timer/toggle`)
  },
  toggleTaskTimer(id: string) {
    return api.post(`/tasks/${id}/timer/toggle`)
  },
}
