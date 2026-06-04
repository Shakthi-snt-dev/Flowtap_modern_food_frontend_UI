export interface POSProduct {
  id: string
  name: string
  sku: string
  defaultSalePrice: number
  locationSalePrice?: number
  locationIsTaxIncluded?: boolean
  locationTaxSlabId?: string
  categoryId: string
  isActive: boolean
  stock: number
  taxSlabId?: string
}
