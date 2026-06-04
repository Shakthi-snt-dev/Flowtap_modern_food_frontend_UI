import { api } from '@flowtap/api-core'

export const restaurantApi = {
  // ── Tables ────────────────────────────────────────────────────────────────
  getTables(params: { companyId: string }) {
    return api.get('/restaurant/tables', { params })
  },
  createTable(data: { companyId: string; number: string; capacity: number; type?: string }) {
    return api.post('/restaurant/tables', data)
  },
  updateTableStatus(id: string, status: string) {
    return api.patch(`/restaurant/tables/${id}/status`, { status })
  },
  deleteTable(id: string) {
    return api.delete(`/restaurant/tables/${id}`)
  },

  // ── Kitchen Orders (KOT) ──────────────────────────────────────────────────
  getKOTs(params: { companyId: string; status?: string }) {
    return api.get('/restaurant/orders', { params })
  },
  createKOT(data: { companyId: string; tableId?: string; items: { name: string; quantity: number; notes?: string }[] }) {
    return api.post('/restaurant/orders', data)
  },
  updateKOTStatus(id: string, status: string) {
    return api.patch(`/restaurant/orders/${id}/status`, { status })
  },

  // ── Recipes ───────────────────────────────────────────────────────────────
  getRecipes(params: { companyId: string; search?: string }) {
    return api.get('/restaurant/recipes', { params })
  },
  createRecipe(data: {
    companyId: string
    name: string
    category: string
    prepTime: number
    servings: number
    costPerServing: number
    ingredients: { name: string; quantity: number; unit: string }[]
  }) {
    return api.post('/restaurant/recipes', data)
  },
  updateRecipe(id: string, data: Record<string, unknown>) {
    return api.put(`/restaurant/recipes/${id}`, data)
  },
  deleteRecipe(id: string) {
    return api.delete(`/restaurant/recipes/${id}`)
  },
}
