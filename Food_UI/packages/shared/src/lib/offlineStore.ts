import Dexie, { type Table } from 'dexie'

export interface OfflineSale {
  id?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saleData: any
  status: 'pending' | 'synced'
  createdAt: number
}

export interface OfflineProduct {
  id: string
  name: string
  sku: string
  price: number
  taxRate: number
  taxSlabId?: string
  categoryId?: string
}

export class FlowtapOfflineDB extends Dexie {
  products!: Table<OfflineProduct>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients!: Table<any>
  salesQueue!: Table<OfflineSale>

  constructor() {
    super('FlowtapOfflineDB')
    this.version(1).stores({
      products: 'id, name, sku, categoryId',
      clients: 'id, name, phone, email',
      salesQueue: '++id, status, createdAt',
    })
  }
}

export const db = new FlowtapOfflineDB()

export const offlineService = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async queueSale(saleData: any) {
    return await db.salesQueue.add({ saleData, status: 'pending', createdAt: Date.now() })
  },
  async getPendingSales() {
    return await db.salesQueue.where('status').equals('pending').toArray()
  },
  async markAsSynced(id: number) {
    return await db.salesQueue.update(id, { status: 'synced' })
  },
  async syncProducts(products: OfflineProduct[]) {
    return await db.products.bulkPut(products)
  },
}
