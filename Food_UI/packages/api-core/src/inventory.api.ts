import api from './axiosInstance'

interface GetProductsParams {
  companyId: string
  search?: string
  sku?: string
  categoryId?: string
  isActive?: boolean
  pageSize?: number
  page?: number
  locationId?: string
  kind?: string   // optional ProductKind filter — 'FinalProduct' for food POS; omit for all industries
}

interface GetCategoriesParams {
  companyId: string
  parentCategoryId?: string
  isActive?: boolean
  pageSize?: number
}

export const inventoryApi = {
  getProducts(params: GetProductsParams) {
    return api.get('/products', { params })
  },
  getProduct(id: string) {
    return api.get(`/products/${id}`)
  },
  createProduct(data: Record<string, unknown>) {
    return api.post('/products', data)
  },
  updateProduct(id: string, data: Record<string, unknown>) {
    return api.put(`/products/${id}`, data)
  },
  archiveProduct(id: string) {
    return api.delete(`/products/${id}`)
  },
  getCategories(params: GetCategoriesParams) {
    return api.get('/product-categories', { params })
  },
  createCategory(data: Record<string, unknown>) {
    return api.post('/product-categories', data)
  },
  updateCategory(id: string, data: Record<string, unknown>) {
    return api.put(`/product-categories/${id}`, data)
  },
  deleteCategory(id: string) {
    return api.delete(`/product-categories/${id}`)
  },
  getDeviceBrands(params?: { search?: string; productCategoryId?: string }) {
    return api.get('/devices/brands', { params })
  },
  getDeviceModels(params?: { brandId?: string; productCategoryId?: string }) {
    return api.get('/devices/models', { params })
  },
  getProductsByModel(modelId: string, companyId: string) {
    return api.get(`/devices/models/${modelId}/products`, { params: { companyId } })
  },
  createDeviceBrand(data: Record<string, unknown>) {
    return api.post('/devices/brands', data)
  },
  updateDeviceBrand(id: string, data: Record<string, unknown>) {
    return api.put(`/devices/brands/${id}`, data)
  },
  deleteDeviceBrand(id: string) {
    return api.delete(`/devices/brands/${id}`)
  },
  createDeviceModel(data: Record<string, unknown>) {
    return api.post('/devices/models', data)
  },
  updateDeviceModel(id: string, data: Record<string, unknown>) {
    return api.put(`/devices/models/${id}`, data)
  },
  deleteDeviceModel(id: string) {
    return api.delete(`/devices/models/${id}`)
  },
  getWarehouses(params: { companyId: string; storeId?: string }) {
    return api.get('/warehouses', { params })
  },
  getWarehouse(id: string) {
    return api.get(`/warehouses/${id}`)
  },
  createWarehouse(data: Record<string, unknown>) {
    return api.post('/warehouses', data)
  },
  updateWarehouse(id: string, data: Record<string, unknown>) {
    return api.put(`/warehouses/${id}`, data)
  },
  deleteWarehouse(id: string) {
    return api.delete(`/warehouses/${id}`)
  },
  getWarehouseStock(id: string, params?: { companyId: string }) {
    return api.get(`/warehouses/${id}/stock`, { params })
  },
  getRacks(warehouseId: string) {
    return api.get(`/warehouses/${warehouseId}/racks`)
  },
  createRack(warehouseId: string, data: { name: string; code?: string; capacity?: number; notes?: string }) {
    return api.post(`/warehouses/${warehouseId}/racks`, data)
  },
  updateRack(warehouseId: string, rackId: string, data: Record<string, unknown>) {
    return api.put(`/warehouses/${warehouseId}/racks/${rackId}`, data)
  },
  deleteRack(warehouseId: string, rackId: string) {
    return api.delete(`/warehouses/${warehouseId}/racks/${rackId}`)
  },
  getBins(warehouseId: string, rackId: string) {
    return api.get(`/warehouses/${warehouseId}/racks/${rackId}/bins`)
  },
  createBin(warehouseId: string, rackId: string, data: { name: string; code?: string; capacity?: number; notes?: string }) {
    return api.post(`/warehouses/${warehouseId}/racks/${rackId}/bins`, data)
  },
  updateBin(warehouseId: string, rackId: string, binId: string, data: Record<string, unknown>) {
    return api.put(`/warehouses/${warehouseId}/racks/${rackId}/bins/${binId}`, data)
  },
  deleteBin(warehouseId: string, rackId: string, binId: string) {
    return api.delete(`/warehouses/${warehouseId}/racks/${rackId}/bins/${binId}`)
  },
  getStockLevels(params: { companyId: string; productId?: string; locationId?: string; warehouseId?: string }) {
    return api.get('/stock', { params })
  },
  adjustStock(data: {
    companyId: string
    productId: string
    warehouseId: string
    adjustmentType: string
    quantity: number
    reason: string
    reasonCode?: string
    notes?: string
    adjustedByEmployeeId?: string
  }) {
    return api.post('/stock/adjust', data)
  },
  getStockAdjustments(params: { companyId?: string; warehouseId?: string; productId?: string; page?: number; pageSize?: number }) {
    return api.get('/stock/adjustments', { params })
  },
  getProductDeviceMappings(productId: string) {
    return api.get(`/products/${productId}/device-models`)
  },
  addProductDeviceMapping(productId: string, deviceModelId: string) {
    return api.post(`/products/${productId}/device-models`, { deviceModelId })
  },
  removeProductDeviceMapping(productId: string, deviceModelId: string) {
    return api.delete(`/products/${productId}/device-models/${deviceModelId}`)
  },
  getProductVariants(productId: string) {
    return api.get(`/products/${productId}/variants`)
  },
  createProductVariant(productId: string, data: Record<string, unknown>) {
    return api.post(`/products/${productId}/variants`, data)
  },
  updateProductVariant(productId: string, variantId: string, data: Record<string, unknown>) {
    return api.put(`/products/${productId}/variants/${variantId}`, data)
  },
  deleteProductVariant(productId: string, variantId: string) {
    return api.delete(`/products/${productId}/variants/${variantId}`)
  },
  getProductLocationPrices(productId: string) {
    return api.get(`/products/${productId}/prices`)
  },
  setProductLocationPrice(productId: string, data: Record<string, unknown>) {
    return api.post(`/products/${productId}/prices`, data)
  },
  addProductMedia(productId: string, data: { url: string; isPrimary?: boolean; sortOrder?: number }) {
    return api.post(`/products/${productId}/media`, data)
  },
  deleteProductMedia(productId: string, mediaId: string) {
    return api.delete(`/products/${productId}/media/${mediaId}`)
  },
  getSerials(params: { companyId?: string; productId?: string; warehouseId?: string; isSold?: boolean; serialNumber?: string; page?: number; pageSize?: number }) {
    return api.get('/serials', { params })
  },
  createSerial(data: Record<string, unknown>) {
    return api.post('/serials', data)
  },
  updateSerial(id: string, data: Record<string, unknown>) {
    return api.put(`/serials/${id}`, data)
  },
  getBatches(params: { companyId?: string; productId?: string; warehouseId?: string }) {
    return api.get('/inventory/batches', { params })
  },
  createBatch(data: Record<string, unknown>) {
    return api.post('/inventory/batches', data)
  },
  updateBatch(id: string, data: Record<string, unknown>) {
    return api.put(`/inventory/batches/${id}`, data)
  },
  getTransfers(params: { companyId?: string; status?: string; page?: number; pageSize?: number }) {
    return api.get('/inventory/transfers', { params })
  },
  createTransfer(data: Record<string, unknown>) {
    return api.post('/inventory/transfers', data)
  },
  getWriteOffs(params: { companyId?: string; status?: string; page?: number; pageSize?: number }) {
    return api.get('/inventory/write-offs', { params })
  },
  createWriteOff(data: Record<string, unknown>) {
    return api.post('/inventory/write-offs', data)
  },
  approveWriteOff(id: string, data: { approved: boolean; approvedByEmployeeId: string; notes?: string }) {
    return api.post(`/inventory/write-offs/${id}/approve`, data)
  },
  getReorderRules(params: { companyId?: string }) {
    return api.get('/inventory/reorder-rules', { params })
  },
  createReorderRule(data: Record<string, unknown>) {
    return api.post('/inventory/reorder-rules', data)
  },
  updateReorderRule(id: string, data: Record<string, unknown>) {
    return api.put(`/inventory/reorder-rules/${id}`, data)
  },
  deleteReorderRule(id: string) {
    return api.delete(`/inventory/reorder-rules/${id}`)
  },
  getReorderAlerts(params: { companyId?: string; warehouseId?: string }) {
    return api.get('/inventory/reorder-alerts', { params })
  },
  getInventorySettings() {
    return api.get('/inventory/settings')
  },
  updateInventorySettings(data: Record<string, unknown>) {
    return api.put('/inventory/settings', data)
  },
  getLocationInventorySettings(locationId: string) {
    return api.get(`/inventory/settings/locations/${locationId}`)
  },
  updateLocationInventorySettings(locationId: string, data: Record<string, unknown>) {
    return api.put(`/inventory/settings/locations/${locationId}`, data)
  },
  getBarcodeTemplates() {
    return api.get('/inventory/settings/barcode-templates')
  },
  createBarcodeTemplate(data: Record<string, unknown>) {
    return api.post('/inventory/settings/barcode-templates', data)
  },
  updateBarcodeTemplate(id: string, data: Record<string, unknown>) {
    return api.put(`/inventory/settings/barcode-templates/${id}`, data)
  },
  deleteBarcodeTemplate(id: string) {
    return api.delete(`/inventory/settings/barcode-templates/${id}`)
  },
  getEnums() {
    return api.get('/enums')
  },
}
