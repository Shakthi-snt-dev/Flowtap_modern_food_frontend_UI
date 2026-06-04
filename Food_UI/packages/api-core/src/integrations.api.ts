import api from './axiosInstance'

export interface IntegrationRecord {
  id: string
  companyId: string
  category: string
  provider: string
  displayName: string
  configJson?: string | null
  isEnabled: boolean
  connectedAt?: string | null
  webhookUrl?: string | null
  lastStatusMessage?: string | null
  lastCheckedAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface UpsertIntegrationData {
  companyId: string
  category: string
  provider: string
  displayName: string
  configJson?: string | null
  isEnabled: boolean
  webhookUrl?: string | null
}

export const integrationsApi = {
  getIntegrations(companyId: string, category?: string) {
    return api.get<{ data: IntegrationRecord[] }>('/integrations', { params: { companyId, category } })
  },
  upsertIntegration(data: UpsertIntegrationData) {
    return api.post<{ data: IntegrationRecord }>('/integrations', data)
  },
  disconnect(id: string, companyId: string) {
    return api.delete(`/integrations/${id}`, { params: { companyId } })
  },
}
