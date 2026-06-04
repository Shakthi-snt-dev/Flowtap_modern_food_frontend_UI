import api from './axiosInstance'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface StockAlertRule {
  id: string
  productId: string
  warehouseId: string
  threshold: number
  unit: string
  sendEmail: boolean
  sendSms: boolean
  sendWhatsApp: boolean
  emailRecipients: string[]    // one or more email addresses (explicit)
  smsRecipients: string[]      // one or more E.164 phone numbers for SMS (explicit)
  whatsAppRecipients: string[] // one or more E.164 phone numbers for WhatsApp (explicit)
  notifyRoles: string[]        // selected roles e.g. ["Owner","Chef","Manager"]
  lastTriggeredAt?: string
}

export interface StockAlertRuleForm {
  productId: string
  warehouseId: string
  threshold: string
  unit: string
  sendEmail: boolean
  sendSms: boolean
  sendWhatsApp: boolean
  emailRecipients: string[]
  smsRecipients: string[]
  whatsAppRecipients: string[]
  notifyRoles: string[]
}

export interface FoodTable {
  id: string
  companyId: string
  locationId: string
  name: string
  capacity: number
  section?: string       // "Indoor" | "Outdoor" | "Private" | ...
  status: FoodTableStatus
  currentSaleId?: string
}

export type FoodTableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'

export interface KitchenOrderItem {
  id: string
  kitchenOrderId: string
  productId: string
  productName: string
  quantity: number
  notes?: string
}

export interface KitchenOrder {
  id: string
  companyId: string
  locationId: string
  saleId?: string
  tableId?: string
  table?: FoodTable
  orderType: 'DineIn' | 'TakeAway' | 'Delivery'
  status: KOTStatus
  kotNumber?: string
  notes?: string
  preparedAt?: string
  servedAt?: string
  createdAt?: string
  items: KitchenOrderItem[]
}

export type KOTStatus = 'New' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled'

export interface RecipeIngredient {
  id?: string
  recipeId?: string
  rawMaterialProductId: string
  rawMaterialName: string
  quantity: number
  unit: string
}

export interface Recipe {
  id: string
  companyId: string
  productId: string
  name: string
  yieldQuantity: number
  instructions?: string
  ingredients: RecipeIngredient[]
}

export interface RecipeForm {
  productId: string
  name: string
  yieldQuantity: number
  instructions?: string
  ingredients: Omit<RecipeIngredient, 'id' | 'recipeId'>[]
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const foodApi = {
  // ── Tables ──────────────────────────────────────────────────────────────────
  getTables(params: { companyId: string; locationId: string }) {
    return api.get<{ data: FoodTable[] }>('/food/tables', { params })
  },
  createTable(data: Omit<FoodTable, 'id' | 'currentSaleId'>) {
    return api.post<FoodTable>('/food/tables', data)
  },
  updateTableStatus(id: string, status: FoodTableStatus) {
    return api.patch(`/food/tables/${id}/status`, { status })
  },

  // ── Kitchen Orders (KOT) ────────────────────────────────────────────────────
  getOrders(params: { companyId: string; locationId?: string; status?: KOTStatus }) {
    return api.get<{ data: KitchenOrder[] }>('/food/orders', { params })
  },
  updateOrderStatus(id: string, status: KOTStatus) {
    return api.patch(`/food/orders/${id}/status`, { status })
  },

  // ── Recipes ─────────────────────────────────────────────────────────────────
  getRecipes(params: { companyId: string; locationId?: string }) {
    return api.get<{ data: Recipe[] }>('/food/recipes', { params })
  },
  createRecipe(data: RecipeForm) {
    return api.post<Recipe>('/food/recipes', data)
  },
  updateRecipe(id: string, data: RecipeForm) {
    return api.put<Recipe>(`/food/recipes/${id}`, data)
  },
  deleteRecipe(id: string) {
    return api.delete(`/food/recipes/${id}`)
  },

  // ── Raw Materials (convenience wrapper) ─────────────────────────────────────
  getRawMaterials(params: { companyId: string; locationId?: string }) {
    return api.get('/products', { params: { ...params, kind: 'RawMaterial' } })
  },

  // ── Stock Alert Rules ────────────────────────────────────────────────────────
  getStockAlerts() {
    return api.get<{ data: StockAlertRule[] }>('/food/stock-alerts')
  },
  createStockAlert(data: Omit<StockAlertRuleForm, 'threshold'> & { threshold: number }) {
    return api.post('/food/stock-alerts', data)
  },
  updateStockAlert(id: string, data: Omit<StockAlertRuleForm, 'threshold'> & { threshold: number }) {
    return api.put(`/food/stock-alerts/${id}`, data)
  },
  deleteStockAlert(id: string) {
    return api.delete(`/food/stock-alerts/${id}`)
  },
  previewRecipients(id: string) {
    return api.get(`/food/stock-alerts/${id}/preview-recipients`)
  },
  triggerNow(id: string) {
    return api.post(`/food/stock-alerts/${id}/trigger-now`)
  },
}
